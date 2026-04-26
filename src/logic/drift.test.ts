import { describe, expect, it } from 'vitest';
import { applyDrift, buildFieldDrifts, computeFieldDrift } from './drift';
import type { Match } from '../types/domain';

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

function offsetSeconds(base: Date, deltaSec: number): Date {
  return new Date(base.getTime() + deltaSec * 1000);
}

describe('computeFieldDrift', () => {
  it('returns zero when no matches are completed', () => {
    expect(computeFieldDrift([])).toEqual({ driftSeconds: 0, basedOn: 0 });
  });

  it('returns zero when matches have no actual start', () => {
    const matches = [mkMatch({}), mkMatch({ matchNumber: 2 })];
    expect(computeFieldDrift(matches)).toEqual({ driftSeconds: 0, basedOn: 0 });
  });

  it('computes median drift over the last 5 completed matches', () => {
    const base = new Date('2026-04-30T13:00:00Z');
    const matches: Match[] = [60, 120, 180, 240, 300].map((delta, i) =>
      mkMatch({
        matchNumber: i + 1,
        scheduledStart: offsetSeconds(base, i * 600), // 10 min apart
        actualStart: offsetSeconds(base, i * 600 + delta),
      }),
    );
    // drifts = [60, 120, 180, 240, 300]; median = 180
    expect(computeFieldDrift(matches)).toEqual({ driftSeconds: 180, basedOn: 5 });
  });

  it('clamps to the last 5 when more than 5 matches are completed', () => {
    const base = new Date('2026-04-30T13:00:00Z');
    const matches: Match[] = [60, 60, 60, 60, 600, 600, 600, 600].map((delta, i) =>
      mkMatch({
        matchNumber: i + 1,
        scheduledStart: offsetSeconds(base, i * 600),
        actualStart: offsetSeconds(base, i * 600 + delta),
      }),
    );
    // last 5 drifts = [60, 600, 600, 600, 600]; median = 600
    expect(computeFieldDrift(matches)).toEqual({ driftSeconds: 600, basedOn: 5 });
  });

  it('is robust to a single 30-min outlier', () => {
    const base = new Date('2026-04-30T13:00:00Z');
    const drifts = [60, 60, 60, 1800, 60]; // one 30-min reset
    const matches: Match[] = drifts.map((delta, i) =>
      mkMatch({
        matchNumber: i + 1,
        scheduledStart: offsetSeconds(base, i * 600),
        actualStart: offsetSeconds(base, i * 600 + delta),
      }),
    );
    // median([60, 60, 60, 60, 1800] sorted) = 60
    expect(computeFieldDrift(matches)).toEqual({ driftSeconds: 60, basedOn: 5 });
  });

  it('handles negative drift (running early)', () => {
    const base = new Date('2026-04-30T13:00:00Z');
    const matches: Match[] = [-30, -60, -90].map((delta, i) =>
      mkMatch({
        matchNumber: i + 1,
        scheduledStart: offsetSeconds(base, i * 600),
        actualStart: offsetSeconds(base, i * 600 + delta),
      }),
    );
    expect(computeFieldDrift(matches)).toEqual({ driftSeconds: -60, basedOn: 3 });
  });

  it('handles even-count median correctly', () => {
    const base = new Date('2026-04-30T13:00:00Z');
    const matches: Match[] = [100, 200].map((delta, i) =>
      mkMatch({
        matchNumber: i + 1,
        scheduledStart: offsetSeconds(base, i * 600),
        actualStart: offsetSeconds(base, i * 600 + delta),
      }),
    );
    // median([100, 200]) = 150
    expect(computeFieldDrift(matches)).toEqual({ driftSeconds: 150, basedOn: 2 });
  });
});

describe('applyDrift', () => {
  it('shifts a date forward by drift seconds', () => {
    const original = new Date('2026-04-30T13:00:00Z');
    const drifted = applyDrift(original, 180);
    expect(drifted.toISOString()).toBe('2026-04-30T13:03:00.000Z');
  });

  it('shifts backward for negative drift', () => {
    const original = new Date('2026-04-30T13:00:00Z');
    const drifted = applyDrift(original, -60);
    expect(drifted.toISOString()).toBe('2026-04-30T12:59:00.000Z');
  });
});

describe('buildFieldDrifts', () => {
  it('produces one entry per field', () => {
    const byField = new Map<string, Match[]>();
    byField.set('NEWTON', []);
    byField.set('CURIE', []);
    const drifts = buildFieldDrifts(byField);
    expect(drifts).toHaveLength(2);
    expect(drifts.map((d) => d.field).sort()).toEqual(['CURIE', 'NEWTON']);
  });
});
