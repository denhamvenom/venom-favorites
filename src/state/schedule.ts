/**
 * Schedule state — fetches qual + playoff schedule and live match data for
 * each division that contains a favorite, merges into Match[], computes
 * per-field drift, and refreshes every 60 s.
 *
 * Stale-while-revalidate: cached payload from localStorage renders
 * immediately on mount; the network refresh updates state when complete.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { frcFetch } from '../api/frc';
import { logger } from '../lib/logger';
import { buildFieldCycles } from '../logic/cycle';
import { buildFieldDrifts } from '../logic/drift';
import type { RawAllianceEnvelope } from '../logic/status';
import {
  buildMatches,
  type RawMatchesEnvelope,
  type RawScheduleEnvelope,
} from '../logic/transform';
import { DEFAULT_CYCLE_TIME_MIN } from '../logic/walking';
import type { Favorite, Field, FieldCycle, FieldDrift, Match } from '../types/domain';

const SEASON = 2026;
const POLL_INTERVAL_MS = 60_000;
const CACHE_KEY = 'schedule-cache/v1';

interface CachePayload {
  fetchedAt: number;
  byDivision: Record<string, RawByDivision>;
}

interface RawByDivision {
  scheduleQual?: RawScheduleEnvelope;
  schedulePlayoff?: RawScheduleEnvelope;
  matchesQual?: RawMatchesEnvelope;
  matchesPlayoff?: RawMatchesEnvelope;
  alliances?: RawAllianceEnvelope;
}

export interface UseSchedule {
  matches: Match[];
  drifts: FieldDrift[];
  cycles: FieldCycle[];
  /** Raw alliance envelope per division (Saturday Mode). */
  alliancesByDivision: Record<string, RawAllianceEnvelope>;
  fetchedAt: Date | null;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

interface UseScheduleOptions {
  /** Per-year + user-override baseline for cycle time when no observation exists. */
  defaultCycleTimeMin?: number;
}

function readCache(): CachePayload | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachePayload;
  } catch {
    return null;
  }
}

function writeCache(payload: CachePayload): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    logger.warn('storage', 'schedule cache write failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function fetchDivision(division: Field): Promise<RawByDivision> {
  const [scheduleQual, schedulePlayoff, matchesQual, matchesPlayoff, alliances] = await Promise.all([
    safe(() => frcFetch<RawScheduleEnvelope>(`/${SEASON}/schedule/${division}/qual`)),
    safe(() => frcFetch<RawScheduleEnvelope>(`/${SEASON}/schedule/${division}/playoff`)),
    safe(() =>
      frcFetch<RawMatchesEnvelope>(`/${SEASON}/matches/${division}`, {
        query: { tournamentLevel: 'qual' },
      }),
    ),
    safe(() =>
      frcFetch<RawMatchesEnvelope>(`/${SEASON}/matches/${division}`, {
        query: { tournamentLevel: 'playoff' },
      }),
    ),
    safe(() => frcFetch<RawAllianceEnvelope>(`/${SEASON}/alliances/${division}`)),
  ]);
  return { scheduleQual, schedulePlayoff, matchesQual, matchesPlayoff, alliances };
}

async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    logger.warn('schedule', 'sub-request failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

export function useSchedule(favorites: Favorite[], options: UseScheduleOptions = {}): UseSchedule {
  const defaultCycleMin = options.defaultCycleTimeMin ?? DEFAULT_CYCLE_TIME_MIN;
  const [byDivision, setByDivision] = useState<Record<string, RawByDivision>>(
    () => readCache()?.byDivision ?? {},
  );
  const [fetchedAt, setFetchedAt] = useState<Date | null>(() => {
    const c = readCache();
    return c ? new Date(c.fetchedAt) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable set of favorite team numbers to feed into transform.
  const favoriteSet = useMemo(
    () => new Set(favorites.map((f) => f.teamNumber)),
    [favorites],
  );

  // Distinct divisions that contain at least one favorite.
  const divisions = useMemo(
    () => [...new Set(favorites.map((f) => f.division))].filter((d) => d !== 'EINSTEIN'),
    [favorites],
  ) as Field[];
  const divisionsKey = divisions.join(',');

  const refreshRef = useRef<() => Promise<void>>(async () => {});

  refreshRef.current = async () => {
    if (divisions.length === 0) {
      setByDivision({});
      setFetchedAt(new Date());
      return;
    }
    setLoading(true);
    setError(null);
    logger.info('schedule', 'refresh start', { divisions });
    try {
      const results = await Promise.all(
        divisions.map(async (d) => [d, await fetchDivision(d)] as const),
      );
      const next: Record<string, RawByDivision> = {};
      for (const [d, raw] of results) next[d] = raw;
      const fetchedAtNow = Date.now();
      setByDivision(next);
      setFetchedAt(new Date(fetchedAtNow));
      writeCache({ fetchedAt: fetchedAtNow, byDivision: next });
      logger.info('schedule', 'refresh done', { divisions, ms: Date.now() - fetchedAtNow });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('schedule', 'refresh failed', { msg });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshRef.current();
    const id = setInterval(() => void refreshRef.current(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisionsKey]);

  const matches = useMemo<Match[]>(() => {
    const all: Match[] = [];
    for (const d of divisions) {
      const raw = byDivision[d];
      if (!raw) continue;
      all.push(...buildMatches(d, raw.scheduleQual, raw.matchesQual, favoriteSet));
      all.push(...buildMatches(d, raw.schedulePlayoff, raw.matchesPlayoff, favoriteSet));
    }
    return all.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
  }, [byDivision, divisions, favoriteSet]);

  const byField = useMemo(() => {
    const m = new Map<string, Match[]>();
    for (const match of matches) {
      const list = m.get(match.field) ?? [];
      list.push(match);
      m.set(match.field, list);
    }
    return m;
  }, [matches]);

  const drifts = useMemo<FieldDrift[]>(() => buildFieldDrifts(byField), [byField]);
  const cycles = useMemo<FieldCycle[]>(
    () => buildFieldCycles(byField, defaultCycleMin),
    [byField, defaultCycleMin],
  );

  // Log per-field cycle on every cycles update — surfaces in DiagnosticsPanel.
  useEffect(() => {
    for (const c of cycles) {
      if (c.basedOn >= 2) {
        logger.debug('schedule', `${c.field} cycle: ${(c.cycleSeconds / 60).toFixed(1)} min`, {
          basedOn: c.basedOn,
        });
      }
    }
  }, [cycles]);

  const alliancesByDivision = useMemo<Record<string, RawAllianceEnvelope>>(() => {
    const out: Record<string, RawAllianceEnvelope> = {};
    for (const [division, raw] of Object.entries(byDivision)) {
      if (raw.alliances) out[division] = raw.alliances;
    }
    return out;
  }, [byDivision]);

  return {
    matches,
    drifts,
    cycles,
    alliancesByDivision,
    fetchedAt,
    loading,
    error,
    refresh: () => refreshRef.current(),
  };
}
