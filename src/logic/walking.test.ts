import { describe, expect, it } from 'vitest';
import { fullMatrix, walkMinutes } from './walking';

describe('walkMinutes — defaults', () => {
  it('returns 0 for same field', () => {
    expect(walkMinutes('NEWTON', 'NEWTON')).toBe(0);
    expect(walkMinutes('EINSTEIN', 'EINSTEIN')).toBe(0);
  });

  it('matches the spec resulting matrix for hop counts 1–7', () => {
    // 1 hop: 2 min, 2 hops: 3 min, 3 hops: 5 min, 4 hops: 6 min,
    // 5 hops: 8 min, 6 hops: 9 min, 7 hops: 10 min.
    expect(walkMinutes('ARCHIMEDES', 'CURIE')).toBe(2); // 1 hop
    expect(walkMinutes('ARCHIMEDES', 'DALY')).toBe(3); // 2 hops
    expect(walkMinutes('ARCHIMEDES', 'GALILEO')).toBe(5); // 3 hops (round up from 4.5)
    expect(walkMinutes('ARCHIMEDES', 'HOPPER')).toBe(6); // 4 hops
    expect(walkMinutes('ARCHIMEDES', 'JOHNSON')).toBe(8); // 5 hops (round up from 7.5)
    expect(walkMinutes('ARCHIMEDES', 'MILSTEIN')).toBe(9); // 6 hops
    expect(walkMinutes('ARCHIMEDES', 'NEWTON')).toBe(10); // 7 hops, clamped
  });

  it('is symmetric', () => {
    expect(walkMinutes('NEWTON', 'ARCHIMEDES')).toBe(walkMinutes('ARCHIMEDES', 'NEWTON'));
    expect(walkMinutes('CURIE', 'JOHNSON')).toBe(walkMinutes('JOHNSON', 'CURIE'));
  });

  it('always returns 6 min for any Einstein hop', () => {
    expect(walkMinutes('EINSTEIN', 'NEWTON')).toBe(6);
    expect(walkMinutes('NEWTON', 'EINSTEIN')).toBe(6);
    expect(walkMinutes('EINSTEIN', 'ARCHIMEDES')).toBe(6);
  });
});

describe('walkMinutes — overrides', () => {
  it('takes user-edited values over the formula', () => {
    const overrides = { ARCHIMEDES: { NEWTON: 12 } };
    expect(walkMinutes('ARCHIMEDES', 'NEWTON', overrides)).toBe(12);
  });

  it('also applies to the reverse direction (overrides are symmetric by lookup)', () => {
    const overrides = { ARCHIMEDES: { NEWTON: 12 } };
    expect(walkMinutes('NEWTON', 'ARCHIMEDES', overrides)).toBe(12);
  });

  it('rounds non-integer overrides', () => {
    const overrides = { CURIE: { DALY: 4.7 } };
    expect(walkMinutes('CURIE', 'DALY', overrides)).toBe(5);
  });

  it('ignores negative or invalid overrides and falls back to formula', () => {
    const overrides = { CURIE: { DALY: -1 } };
    expect(walkMinutes('CURIE', 'DALY', overrides)).toBe(2);
  });
});

describe('fullMatrix', () => {
  it('produces a 9×9 matrix (8 divisions + Einstein) with consistent diagonals', () => {
    const m = fullMatrix();
    const fields = Object.keys(m);
    expect(fields).toHaveLength(9);
    for (const f of fields) {
      expect(m[f as keyof typeof m][f as keyof typeof m]).toBe(0);
    }
    expect(m.ARCHIMEDES.NEWTON).toBe(10);
    expect(m.NEWTON.ARCHIMEDES).toBe(10);
  });
});
