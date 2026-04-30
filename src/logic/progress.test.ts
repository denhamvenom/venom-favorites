import { describe, expect, it } from 'vitest';
import { deriveBracketStatus, deriveMatchResult, deriveProgress } from './progress';
import type { Favorite, Match, MatchResult } from '../types/domain';

const FAV: Favorite = {
  teamNumber: 254,
  teamName: 'Cheesy Poofs',
  division: 'NEWTON',
  status: 'qualifying',
};

function mkMatch(overrides: Partial<Match>): Match {
  return {
    matchNumber: 1,
    level: 'qual',
    field: 'NEWTON',
    scheduledStart: new Date('2026-04-30T13:00:00Z'),
    actualStart: new Date('2026-04-30T13:00:00Z'),
    actualEnd: new Date('2026-04-30T13:07:00Z'),
    redAlliance: [254, 1, 2],
    blueAlliance: [3, 4, 5],
    redScore: 100,
    blueScore: 80,
    myFavorites: [254],
    ...overrides,
  };
}

describe('deriveMatchResult', () => {
  it('returns null when scores are missing', () => {
    const m = mkMatch({ redScore: undefined, blueScore: undefined });
    expect(deriveMatchResult(m, 254)).toBeNull();
  });

  it('returns null when team is not in either alliance', () => {
    const m = mkMatch({});
    expect(deriveMatchResult(m, 999)).toBeNull();
  });

  it('returns W when our alliance scored higher', () => {
    const m = mkMatch({ redScore: 100, blueScore: 80 });
    const r = deriveMatchResult(m, 254);
    expect(r).toMatchObject({ alliance: 'red', outcome: 'W', ourScore: 100, theirScore: 80 });
  });

  it('returns L when our alliance scored lower', () => {
    const m = mkMatch({ redScore: 50, blueScore: 80 });
    const r = deriveMatchResult(m, 254);
    expect(r?.outcome).toBe('L');
  });

  it('returns T on tie', () => {
    const m = mkMatch({ redScore: 90, blueScore: 90 });
    const r = deriveMatchResult(m, 254);
    expect(r?.outcome).toBe('T');
  });

  it('handles team on blue alliance', () => {
    const m = mkMatch({ redAlliance: [3, 4, 5], blueAlliance: [254, 1, 2], redScore: 50, blueScore: 80 });
    const r = deriveMatchResult(m, 254);
    expect(r).toMatchObject({ alliance: 'blue', outcome: 'W', ourScore: 80, theirScore: 50 });
  });
});

describe('deriveBracketStatus', () => {
  function mkResult(outcome: 'W' | 'L'): MatchResult {
    return {
      match: mkMatch({ level: 'playoff' }),
      teamNumber: 254,
      alliance: 'red',
      outcome,
      ourScore: 100,
      theirScore: outcome === 'W' ? 80 : 120,
    };
  }
  it('returns upper with 0 losses', () => {
    expect(deriveBracketStatus([mkResult('W'), mkResult('W')])).toBe('upper');
  });
  it('returns lower_1L with exactly 1 loss', () => {
    expect(deriveBracketStatus([mkResult('W'), mkResult('L'), mkResult('W')])).toBe('lower_1L');
  });
  it('returns eliminated with 2 or more losses', () => {
    expect(deriveBracketStatus([mkResult('L'), mkResult('L')])).toBe('eliminated');
    expect(deriveBracketStatus([mkResult('L'), mkResult('L'), mkResult('W')])).toBe('eliminated');
  });
});

describe('deriveProgress', () => {
  it('separates qual vs playoff results, sorts earliest-first', () => {
    const matches = [
      mkMatch({ matchNumber: 5, level: 'qual', redScore: 60, blueScore: 80 }),
      mkMatch({ matchNumber: 1, level: 'qual' }),
      mkMatch({ matchNumber: 2, level: 'playoff' }),
    ];
    const progress = deriveProgress(FAV, matches);
    expect(progress.qualResults.map((r) => r.match.matchNumber)).toEqual([1, 5]);
    expect(progress.playoffResults).toHaveLength(1);
    expect(progress.bracketStatus).toBe('upper');
  });

  it('skips matches without scores', () => {
    const matches = [
      mkMatch({ matchNumber: 1, level: 'qual' }),
      mkMatch({ matchNumber: 2, level: 'qual', redScore: undefined, blueScore: undefined }),
    ];
    const progress = deriveProgress(FAV, matches);
    expect(progress.qualResults).toHaveLength(1);
  });
});
