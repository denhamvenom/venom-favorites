/**
 * Watching state — "I'm at this match right now."
 *
 * Two-stage model:
 *   - `watching`     active anchor (user is mid-match). Drives UI pill + TopBar mode.
 *                    Clears automatically the moment scores post for the match.
 *   - `lastLocation` implicit memory (user's last-known field). No UI signal;
 *                    the planner uses this to keep walks anchored after a match
 *                    ends but before they pick a new one. Expires after 30 min.
 */

import { useCallback, useEffect, useState } from 'react';
import { logger } from '../lib/logger';
import type { Field, Match, MatchLevel } from '../types/domain';

const WATCHING_KEY = 'watching-match/v1';
const LAST_LOC_KEY = 'last-location/v1';
const LAST_LOC_TTL_MS = 30 * 60_000;

export interface WatchingMatch {
  field: Field;
  level: MatchLevel;
  matchNumber: number;
  /** ms epoch when the user marked this match. */
  since: number;
}

export interface LastLocation {
  field: Field;
  fromMatch: { level: MatchLevel; matchNumber: number };
  /** ms epoch when the watched match completed. */
  at: number;
}

function readJSON<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown | null): void {
  if (typeof localStorage === 'undefined') return;
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

export interface UseWatching {
  watching: WatchingMatch | null;
  /** Memory of where the user just was. Null after 30 min staleness. */
  lastLocation: LastLocation | null;
  setWatching(m: WatchingMatch | null): void;
}

export function useWatching(matches: Match[], favoriteTeamNumbers: ReadonlySet<number>): UseWatching {
  const [watching, setWatchingState] = useState<WatchingMatch | null>(() => readJSON<WatchingMatch>(WATCHING_KEY));
  const [lastLocation, setLastLocationState] = useState<LastLocation | null>(() => readJSON<LastLocation>(LAST_LOC_KEY));

  // Persist on change.
  useEffect(() => {
    writeJSON(WATCHING_KEY, watching);
  }, [watching]);
  useEffect(() => {
    writeJSON(LAST_LOC_KEY, lastLocation);
  }, [lastLocation]);

  // Auto-transition: when the watched match's scores arrive, promote to lastLocation and clear watching.
  useEffect(() => {
    if (!watching) return;
    const m = matches.find(
      (x) =>
        x.field === watching.field && x.level === watching.level && x.matchNumber === watching.matchNumber,
    );
    if (!m) return;
    const completed = m.redScore !== undefined && m.blueScore !== undefined;
    if (!completed) return;
    setLastLocationState({
      field: watching.field,
      fromMatch: { level: watching.level, matchNumber: watching.matchNumber },
      at: m.actualEnd?.getTime() ?? Date.now(),
    });
    setWatchingState(null);
    logger.info('watching', `auto-cleared on result post`, {
      match: `${watching.field}:${watching.level}:${watching.matchNumber}`,
    });
  }, [watching, matches]);

  // Auto-clear if the favorite tied to the watching match is removed (defensive — no UI for this state).
  useEffect(() => {
    if (!watching) return;
    const m = matches.find(
      (x) =>
        x.field === watching.field && x.level === watching.level && x.matchNumber === watching.matchNumber,
    );
    if (!m) return;
    const stillRelevant = [...m.redAlliance, ...m.blueAlliance].some((t) => favoriteTeamNumbers.has(t));
    if (!stillRelevant) {
      logger.info('watching', `cleared — no favorite remains in match`, {
        match: `${watching.field}:${watching.level}:${watching.matchNumber}`,
      });
      setWatchingState(null);
      setLastLocationState(null);
    }
  }, [watching, matches, favoriteTeamNumbers]);

  // Expose `lastLocation` only if fresh (≤30 min). Stale entries return null without disturbing storage —
  // a user reopening the app the next day shouldn't have ghost walks computed from yesterday's location.
  const fresh = lastLocation && Date.now() - lastLocation.at < LAST_LOC_TTL_MS ? lastLocation : null;

  const setWatching = useCallback((m: WatchingMatch | null) => {
    setWatchingState(m);
    if (m) logger.info('watching', `set ${m.field}:${m.level}:${m.matchNumber}`);
    else logger.info('watching', `manually cleared`);
  }, []);

  return { watching, lastLocation: fresh, setWatching };
}
