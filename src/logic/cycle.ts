/**
 * Per-field cycle-time computation.
 *
 * Cycle time = median start-to-start interval between consecutive completed
 * matches at the same field. Use this as the proxy for "by when can the user
 * leave their seat?" — by that time the field is being reset for the next
 * match, so it's a conservative-but-realistic end-of-match marker.
 *
 * Until at least two matches have completed at a field we fall back to the
 * per-year baseline (`DEFAULT_CYCLE_TIME_MIN` in walking.ts, surfaced via the
 * `defaultMin` arg here).
 */

import type { FieldCycle, Match } from '../types/domain';
import { median } from './stats';

const SAMPLE_SIZE = 5;

export interface CycleResult {
  cycleSeconds: number;
  basedOn: number;
}

export function computeFieldCycle(matches: Match[], defaultMin: number): CycleResult {
  const fallback = { cycleSeconds: defaultMin * 60, basedOn: 0 };
  const completed = matches
    .filter((m) => m.actualStart)
    .sort((a, b) => a.actualStart!.getTime() - b.actualStart!.getTime());
  if (completed.length < 2) return fallback;
  // Consecutive start-to-start deltas in seconds.
  const deltas: number[] = [];
  for (let i = 1; i < completed.length; i++) {
    const ms = completed[i].actualStart!.getTime() - completed[i - 1].actualStart!.getTime();
    if (ms > 0) deltas.push(ms / 1000);
  }
  if (deltas.length === 0) return fallback;
  const recent = deltas.slice(-SAMPLE_SIZE);
  return { cycleSeconds: median(recent), basedOn: recent.length };
}

export function buildFieldCycles(byField: Map<string, Match[]>, defaultMin: number): FieldCycle[] {
  const now = new Date();
  const out: FieldCycle[] = [];
  for (const [field, matches] of byField) {
    const { cycleSeconds, basedOn } = computeFieldCycle(matches, defaultMin);
    out.push({
      field: field as FieldCycle['field'],
      cycleSeconds,
      basedOn,
      computedAt: now,
    });
  }
  return out;
}

/** Return the field's effective cycle in minutes, prefer override → observed → default. */
export function effectiveCycleMin(
  field: string,
  cycles: Map<string, FieldCycle> | undefined,
  defaultMin: number,
): number {
  const observed = cycles?.get(field);
  if (observed && observed.basedOn >= 2) return observed.cycleSeconds / 60;
  return defaultMin;
}
