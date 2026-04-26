/**
 * Per-field drift computation.
 *
 * For each division, take the most recent N completed matches and compute the
 * median of (actualStart - scheduledStart). Median (not mean) so a one-off
 * field reset (concrete settling, e-stop, etc.) doesn't corrupt the schedule.
 */

import type { FieldDrift, Match } from '../types/domain';
import { median } from './stats';

const SAMPLE_SIZE = 5;

export interface DriftResult {
  driftSeconds: number;
  basedOn: number;
}

export function computeFieldDrift(matches: Match[]): DriftResult {
  // We only consider matches that actually started AND have a scheduled time.
  const completed = matches
    .filter((m) => m.actualStart && m.scheduledStart)
    .sort((a, b) => (a.scheduledStart.getTime() - b.scheduledStart.getTime()));
  if (completed.length === 0) return { driftSeconds: 0, basedOn: 0 };
  const recent = completed.slice(-SAMPLE_SIZE);
  const drifts = recent.map(
    (m) => (m.actualStart!.getTime() - m.scheduledStart.getTime()) / 1000,
  );
  return { driftSeconds: median(drifts), basedOn: drifts.length };
}

export function buildFieldDrifts(byField: Map<string, Match[]>): FieldDrift[] {
  const now = new Date();
  const out: FieldDrift[] = [];
  for (const [field, matches] of byField) {
    const { driftSeconds, basedOn } = computeFieldDrift(matches);
    out.push({
      field: field as FieldDrift['field'],
      driftSeconds,
      basedOn,
      computedAt: now,
    });
  }
  return out;
}

export function applyDrift(scheduledStart: Date, driftSeconds: number): Date {
  return new Date(scheduledStart.getTime() + driftSeconds * 1000);
}
