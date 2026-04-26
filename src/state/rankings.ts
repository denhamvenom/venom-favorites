/**
 * Rankings state — fetches `/rankings/{division}` for each division that
 * contains a favorite, on the same 60s cadence as the schedule.
 *
 * Caches to localStorage so the Results tab renders immediately on next mount.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { frcFetch } from '../api/frc';
import { logger } from '../lib/logger';
import type { Favorite, Field, Ranking } from '../types/domain';

const SEASON = 2026;
const POLL_INTERVAL_MS = 60_000;
const CACHE_KEY = 'rankings-cache/v1';

interface RawRanking {
  rank: number;
  teamNumber: number;
  wins: number;
  losses: number;
  ties: number;
  rankingPoints?: number;
  sortOrder1?: number; // ranking score in some seasons
  qualAverage?: number;
  matchesPlayed?: number;
}

interface RawRankingsEnvelope {
  Rankings: RawRanking[];
}

interface CachePayload {
  fetchedAt: number;
  byDivision: Record<string, RawRankingsEnvelope>;
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
    logger.warn('storage', 'rankings cache write failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface UseRankings {
  rankings: Ranking[];
  fetchedAt: Date | null;
  loading: boolean;
  refresh(): Promise<void>;
}

export function useRankings(favorites: Favorite[]): UseRankings {
  const [byDivision, setByDivision] = useState<Record<string, RawRankingsEnvelope>>(
    () => readCache()?.byDivision ?? {},
  );
  const [fetchedAt, setFetchedAt] = useState<Date | null>(() => {
    const c = readCache();
    return c ? new Date(c.fetchedAt) : null;
  });
  const [loading, setLoading] = useState(false);

  const divisions = useMemo(
    () => [...new Set(favorites.map((f) => f.division))].filter((d) => d !== 'EINSTEIN'),
    [favorites],
  ) as Field[];
  const divisionsKey = divisions.join(',');

  const refreshRef = useRef<() => Promise<void>>(async () => {});
  refreshRef.current = async () => {
    if (divisions.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        divisions.map(async (d) => {
          try {
            const env = await frcFetch<RawRankingsEnvelope>(`/${SEASON}/rankings/${d}`);
            return [d, env] as [Field, RawRankingsEnvelope];
          } catch (err) {
            logger.warn('schedule', `rankings fetch failed for ${d}`, {
              err: err instanceof Error ? err.message : String(err),
            });
            return [d, { Rankings: [] as RawRanking[] }] as [Field, RawRankingsEnvelope];
          }
        }),
      );
      const next: Record<string, RawRankingsEnvelope> = {};
      for (const [d, env] of results) next[d] = env;
      const fetchedAtNow = Date.now();
      setByDivision(next);
      setFetchedAt(new Date(fetchedAtNow));
      writeCache({ fetchedAt: fetchedAtNow, byDivision: next });
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

  // Project to the canonical Ranking[] for the favorites only.
  const rankings = useMemo<Ranking[]>(() => {
    const favSet = new Set(favorites.map((f) => f.teamNumber));
    const out: Ranking[] = [];
    for (const division of divisions) {
      const env = byDivision[division];
      if (!env?.Rankings) continue;
      const total = env.Rankings.length;
      for (const r of env.Rankings) {
        if (!favSet.has(r.teamNumber)) continue;
        out.push({
          division,
          teamNumber: r.teamNumber,
          rank: r.rank,
          totalTeams: total,
          wins: r.wins,
          losses: r.losses,
          ties: r.ties,
          rankingPoints: r.rankingPoints ?? r.sortOrder1 ?? 0,
          averageMatchPoints: r.qualAverage,
        });
      }
    }
    return out;
  }, [byDivision, divisions, favorites]);

  return { rankings, fetchedAt, loading, refresh: () => refreshRef.current() };
}
