import { describe, expect, it } from 'vitest';
import { buildFieldCycles, computeFieldCycle, effectiveCycleMin } from './cycle';
import type { FieldCycle, Match } from '../types/domain';

const DEFAULT_MIN = 8;

function mkMatch(overrides: Partial<Match>): Match {
  return {
    matchNumber: 1,
    level: 'qual',
    field: 'NEWTON',
    scheduledStart: new Date('2026-04-30T13:00:00Z'),
    actualStart: undefined,
    actualEnd: undefined,
    redAlliance: [1, 2, 3],
    blueAlliance: [4, 5, 6],
    redScore: undefined,
    blueScore: undefined,
    myFavorites: [],
    ...overrides,
  };
}

function startAt(base: Date, deltaMin: number): Date {
  return new Date(base.getTime() + deltaMin * 60_000);
}

describe('computeFieldCycle', () => {
  it('falls back to default when no matches have completed', () => {
    expect(computeFieldCycle([], DEFAULT_MIN)).toEqual({
      cycleSeconds: 480,
      basedOn: 0,
    });
  });

  it('falls back to default when only one match has an actualStart', () => {
    const m = mkMatch({ actualStart: new Date('2026-04-30T13:00:00Z') });
    expect(computeFieldCycle([m], DEFAULT_MIN)).toEqual({
      cycleSeconds: 480,
      basedOn: 0,
    });
  });

  it('computes median start-to-start delta from consecutive completed matches', () => {
    const base = new Date('2026-04-30T13:00:00Z');
    const matches: Match[] = [0, 8, 16, 24, 32, 40].map((delta, i) =>
      mkMatch({ matchNumber: i + 1, actualStart: startAt(base, delta) }),
    );
    // Deltas (min): 8, 8, 8, 8, 8 → median = 8 → 480 s.
    expect(computeFieldCycle(matches, DEFAULT_MIN)).toEqual({
      cycleSeconds: 480,
      basedOn: 5,
    });
  });

  it('clamps the sample to the most recent 5 deltas', () => {
    const base = new Date('2026-04-30T13:00:00Z');
    // 7 matches → 6 deltas; only the last 5 should count.
    // Deltas: 7, 7, 7, 7, 9, 9, 9 — actually 6 deltas from 7 matches.
    // Use: starts at 0, 7, 14, 21, 30, 39, 48 → deltas 7,7,7,9,9,9 → last 5 = 7,7,9,9,9 → median 9.
    const matches: Match[] = [0, 7, 14, 21, 30, 39, 48].map((delta, i) =>
      mkMatch({ matchNumber: i + 1, actualStart: startAt(base, delta) }),
    );
    expect(computeFieldCycle(matches, DEFAULT_MIN)).toEqual({
      cycleSeconds: 540, // 9 min
      basedOn: 5,
    });
  });

  it('is robust to a single 30-min outlier (concrete settling, e-stop)', () => {
    const base = new Date('2026-04-30T13:00:00Z');
    // Deltas: 8, 8, 38, 8, 8 → median 8.
    const matches: Match[] = [0, 8, 16, 54, 62, 70].map((delta, i) =>
      mkMatch({ matchNumber: i + 1, actualStart: startAt(base, delta) }),
    );
    expect(computeFieldCycle(matches, DEFAULT_MIN)).toEqual({
      cycleSeconds: 480,
      basedOn: 5,
    });
  });

  it('handles non-uniform cycles via even-count median', () => {
    const base = new Date('2026-04-30T13:00:00Z');
    // 3 matches → 2 deltas: 8, 10 → median 9.
    const matches: Match[] = [0, 8, 18].map((delta, i) =>
      mkMatch({ matchNumber: i + 1, actualStart: startAt(base, delta) }),
    );
    expect(computeFieldCycle(matches, DEFAULT_MIN)).toEqual({
      cycleSeconds: 540,
      basedOn: 2,
    });
  });
});

describe('buildFieldCycles', () => {
  it('produces one entry per field; basedOn=0 when no data', () => {
    const byField = new Map<string, Match[]>();
    byField.set('NEWTON', []);
    byField.set('CURIE', []);
    const out = buildFieldCycles(byField, DEFAULT_MIN);
    expect(out.map((c) => c.field).sort()).toEqual(['CURIE', 'NEWTON']);
    for (const c of out) {
      expect(c.basedOn).toBe(0);
      expect(c.cycleSeconds).toBe(480);
    }
  });
});

describe('effectiveCycleMin', () => {
  const cycles = new Map<string, FieldCycle>([
    [
      'ARCHIMEDES',
      {
        field: 'ARCHIMEDES',
        cycleSeconds: 540,
        basedOn: 4,
        computedAt: new Date(),
      },
    ],
    [
      'NEWTON',
      {
        field: 'NEWTON',
        cycleSeconds: 480,
        basedOn: 1, // not enough samples
        computedAt: new Date(),
      },
    ],
  ]);

  it('uses observed cycle when basedOn >= 2', () => {
    expect(effectiveCycleMin('ARCHIMEDES', cycles, DEFAULT_MIN)).toBe(9);
  });

  it('falls back to default when basedOn < 2 even if observation is present', () => {
    expect(effectiveCycleMin('NEWTON', cycles, DEFAULT_MIN)).toBe(DEFAULT_MIN);
  });

  it('falls back to default when no cycle entry for the field', () => {
    expect(effectiveCycleMin('CURIE', cycles, DEFAULT_MIN)).toBe(DEFAULT_MIN);
  });

  it('falls back to default when cycles map is undefined', () => {
    expect(effectiveCycleMin('ARCHIMEDES', undefined, DEFAULT_MIN)).toBe(DEFAULT_MIN);
  });
});
