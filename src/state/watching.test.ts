import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useWatching, type WatchingMatch } from './watching';
import type { Match } from '../types/domain';

function mkMatch(overrides: Partial<Match>): Match {
  return {
    matchNumber: 1,
    level: 'qual',
    field: 'ARCHIMEDES',
    scheduledStart: new Date('2026-04-30T15:00:00Z'),
    actualStart: undefined,
    actualEnd: undefined,
    redAlliance: [8044, 1, 2],
    blueAlliance: [3, 4, 5],
    redScore: undefined,
    blueScore: undefined,
    myFavorites: [8044],
    ...overrides,
  };
}

const W: WatchingMatch = {
  field: 'ARCHIMEDES',
  level: 'qual',
  matchNumber: 5,
  since: Date.now(),
};

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('useWatching', () => {
  it('starts with both watching and lastLocation null', () => {
    const { result } = renderHook(() => useWatching([], new Set([8044])));
    expect(result.current.watching).toBeNull();
    expect(result.current.lastLocation).toBeNull();
  });

  it('setWatching persists and is readable on remount', () => {
    const { result } = renderHook(() => useWatching([], new Set([8044])));
    act(() => result.current.setWatching(W));
    expect(result.current.watching).toEqual(W);
    expect(JSON.parse(localStorage.getItem('watching-match/v1')!)).toEqual(W);
  });

  it('auto-clears watching and promotes to lastLocation when scores arrive', () => {
    const matchPlaying = mkMatch({ matchNumber: 5 });
    const { result, rerender } = renderHook(
      ({ matches }) => useWatching(matches, new Set([8044])),
      { initialProps: { matches: [matchPlaying] as Match[] } },
    );
    act(() => result.current.setWatching(W));
    expect(result.current.watching).toEqual(W);

    // Score lands. actualEnd must be recent so lastLocation isn't filtered as stale by the 30-min TTL.
    const matchDone = mkMatch({
      matchNumber: 5,
      redScore: 100,
      blueScore: 80,
      actualEnd: new Date(),
    });
    rerender({ matches: [matchDone] });
    expect(result.current.watching).toBeNull();
    expect(result.current.lastLocation).not.toBeNull();
    expect(result.current.lastLocation?.field).toBe('ARCHIMEDES');
    expect(result.current.lastLocation?.fromMatch).toEqual({ level: 'qual', matchNumber: 5 });
  });

  it('clears watching + lastLocation when no favorite remains in the match', () => {
    const m = mkMatch({ matchNumber: 5, redAlliance: [1, 2, 3], blueAlliance: [4, 5, 6], myFavorites: [] });
    const { result, rerender } = renderHook(
      ({ favs }) => useWatching([m], favs),
      { initialProps: { favs: new Set([8044]) as ReadonlySet<number> } },
    );
    // Seed watching directly via storage to simulate prior session.
    act(() => result.current.setWatching(W));
    // Then favorite is removed (no longer in set) AND match no longer involves them either.
    rerender({ favs: new Set() as ReadonlySet<number> });
    expect(result.current.watching).toBeNull();
  });

  it('returns null lastLocation when older than 30 minutes', () => {
    const stale = {
      field: 'ARCHIMEDES' as const,
      fromMatch: { level: 'qual' as const, matchNumber: 1 },
      at: Date.now() - 31 * 60_000,
    };
    localStorage.setItem('last-location/v1', JSON.stringify(stale));
    const { result } = renderHook(() => useWatching([], new Set([8044])));
    expect(result.current.lastLocation).toBeNull();
  });
});
