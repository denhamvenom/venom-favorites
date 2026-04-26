/**
 * Walking-time matrix between division fields.
 *
 * The 8 division fields run west → east in a single row across the main hall:
 *   0 ARCHIMEDES → 7 NEWTON
 * The formula is ~1.5 min per hop, clamped to [2, 10].
 * Einstein is on a separate stage; treat it as a fixed 6-min walk.
 *
 * `walkMinutes(from, to, overrides)` consults the user-editable overrides matrix
 * first, then falls back to the formula. Used by conflict detection and the
 * editable matrix UI.
 */

import type { Field } from '../types/domain';

export const FIELD_INDEX: Record<Exclude<Field, 'EINSTEIN'>, number> = {
  ARCHIMEDES: 0,
  CURIE: 1,
  DALY: 2,
  GALILEO: 3,
  HOPPER: 4,
  JOHNSON: 5,
  MILSTEIN: 6,
  NEWTON: 7,
};

export const SETTLE_BUFFER_MIN = 2;

/**
 * Per-year baseline cycle time (start-to-start interval at the same field).
 * 2026 ≈ 8 min. Used as the proxy for "by when can the user leave their seat?"
 * when a match has no `actualEnd` yet — by that point the field is being reset
 * for the next match. The conflict planner prefers an observed median cycle
 * (see src/logic/cycle.ts) and falls back to this value.
 *
 * When the season rolls over, bump this constant for the new cycle.
 */
export const DEFAULT_CYCLE_TIME_MIN = 8;

export type WalkOverrides = Partial<Record<Field, Partial<Record<Field, number>>>>;

export function walkMinutes(from: Field, to: Field, overrides?: WalkOverrides): number {
  if (from === to) return 0;
  const overrideValue = overrides?.[from]?.[to] ?? overrides?.[to]?.[from];
  if (typeof overrideValue === 'number' && Number.isFinite(overrideValue) && overrideValue >= 0) {
    return Math.round(overrideValue);
  }
  if (from === 'EINSTEIN' || to === 'EINSTEIN') return 6;
  const fromIdx = FIELD_INDEX[from as Exclude<Field, 'EINSTEIN'>];
  const toIdx = FIELD_INDEX[to as Exclude<Field, 'EINSTEIN'>];
  const hops = Math.abs(fromIdx - toIdx);
  return Math.min(10, Math.max(2, Math.round(1.5 * hops)));
}

/** Build a full 8×8 (+ Einstein) matrix as a 2D record for display in the editor. */
export function fullMatrix(overrides?: WalkOverrides): Record<Field, Record<Field, number>> {
  const fields: Field[] = [
    'ARCHIMEDES',
    'CURIE',
    'DALY',
    'GALILEO',
    'HOPPER',
    'JOHNSON',
    'MILSTEIN',
    'NEWTON',
    'EINSTEIN',
  ];
  const out: Record<Field, Record<Field, number>> = {} as never;
  for (const f of fields) {
    out[f] = {} as Record<Field, number>;
    for (const t of fields) out[f][t] = walkMinutes(f, t, overrides);
  }
  return out;
}
