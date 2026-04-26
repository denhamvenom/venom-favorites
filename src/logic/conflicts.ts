/**
 * Conflict detection + greedy "best path" planning.
 *
 * Two related but distinct algorithms:
 *
 *   markFeasibility — for each pair of consecutive favorite-involving matches,
 *     decide whether you could physically walk from the previous to the next
 *     given their drift-adjusted timestamps. Pure function on the pair.
 *
 *   greedyPath — walk the timeline tracking your current field, and decide
 *     whether to include each match. If we can't get to it in time from where
 *     we already are, drop it (and our location stays put). Different from
 *     feasibility because if we drop match N, match N+1 is judged against
 *     match N-1's location, not N's.
 */

import {
  DEFAULT_MATCH_DURATION_MIN,
  SETTLE_BUFFER_MIN,
  walkMinutes,
  type WalkOverrides,
} from './walking';
import { applyDrift } from './drift';
import type { Field, FieldDrift, Match, ScheduleEntry } from '../types/domain';

export interface PlanOptions {
  overrides?: WalkOverrides;
  /** "now" — used so greedyPath doesn't reject already-past matches as unreachable. */
  now?: Date;
  /**
   * Team number of the super-favorite. Their matches are MUST-INCLUDE anchors:
   * the planner skips any non-super match that would prevent reaching the next
   * super match in time, and always marks super matches as suggested.
   */
  superFavorite?: number;
}

interface AdjustedMatch {
  match: Match;
  adjustedStart: Date;
  adjustedEnd: Date;
}

function adjustMatch(match: Match, drift: FieldDrift | undefined): AdjustedMatch {
  const adjustedStart = drift ? applyDrift(match.scheduledStart, drift.driftSeconds) : match.scheduledStart;
  // Prefer actualEnd; otherwise estimate (start + 7 min default match window).
  const adjustedEnd = match.actualEnd
    ? new Date(match.actualEnd.getTime())
    : new Date(adjustedStart.getTime() + DEFAULT_MATCH_DURATION_MIN * 60_000);
  return { match, adjustedStart, adjustedEnd };
}

/**
 * Walk feasibility between two adjusted matches. Returns walk minutes required
 * (excluding the +2 settle buffer), the slack you'd actually have, and
 * whether the gap is feasible. Slack = available_minutes - walk - buffer.
 */
function walkBetween(prev: AdjustedMatch, next: AdjustedMatch, overrides?: WalkOverrides): {
  walk: number;
  slackMinutes: number;
  feasible: boolean;
} {
  const sameField = prev.match.field === next.match.field;
  const walk = sameField ? 0 : walkMinutes(prev.match.field, next.match.field, overrides);
  const availableMs = next.adjustedStart.getTime() - prev.adjustedEnd.getTime();
  const availableMinutes = availableMs / 60_000;
  // Same-field consecutive matches: you're already in your seat, no settle needed.
  const required = sameField ? 0 : walk + SETTLE_BUFFER_MIN;
  const slack = availableMinutes - required;
  return { walk, slackMinutes: slack, feasible: slack >= 0 };
}

/**
 * Build a ScheduleEntry[] that marks per-match feasibility against the
 * preceding favorite-involving match, plus runs the greedy planner to set
 * `suggested`.
 */
export function planSchedule(
  matches: Match[],
  drifts: Map<string, FieldDrift>,
  options: PlanOptions = {},
): ScheduleEntry[] {
  // Only matches that involve a favorite participate in conflict detection.
  const favoriteMatches = matches.filter((m) => m.myFavorites.length > 0);
  // Sort by drift-adjusted start; tied scheduledStart breaks at field index.
  const adjusted = favoriteMatches
    .map((m) => adjustMatch(m, drifts.get(m.field)))
    .sort((a, b) => {
      const diff = a.adjustedStart.getTime() - b.adjustedStart.getTime();
      if (diff !== 0) return diff;
      return a.match.field.localeCompare(b.match.field);
    });

  const isSuper = (match: Match): boolean =>
    options.superFavorite !== undefined && match.myFavorites.includes(options.superFavorite);

  const entries: ScheduleEntry[] = [];
  let lastEntry: AdjustedMatch | undefined;
  let suggestedLocation: Field | undefined;
  let lastSuggestedAdjusted: AdjustedMatch | undefined;

  for (let i = 0; i < adjusted.length; i++) {
    const cur = adjusted[i];
    let walkFromPrevious: number | undefined;
    let feasible = true;
    let conflictReason: string | undefined;

    if (lastEntry) {
      const fb = walkBetween(lastEntry, cur, options.overrides);
      walkFromPrevious = fb.walk;
      feasible = fb.feasible;
      if (!feasible) {
        const need = fb.walk + SETTLE_BUFFER_MIN;
        const have = Math.max(0, Math.round((cur.adjustedStart.getTime() - lastEntry.adjustedEnd.getTime()) / 60_000));
        conflictReason = `${fb.walk} min walk + ${SETTLE_BUFFER_MIN} buffer needed (${need} min), only ${have} min between matches`;
      }
    }

    let suggested: boolean;

    if (isSuper(cur.match)) {
      // Super matches are always suggested. They become the new anchor location.
      suggested = true;
    } else {
      // Reachable from where greedy currently has us?
      const reachableNow =
        lastSuggestedAdjusted === undefined ||
        suggestedLocation === cur.match.field ||
        walkBetween(lastSuggestedAdjusted, cur, options.overrides).feasible;

      if (!reachableNow) {
        suggested = false;
      } else {
        // Look ahead: would including this match break the next super match?
        // Only block if the super was reachable BEFORE we made this detour.
        const nextSuperIdx = adjusted.findIndex((m, j) => j > i && isSuper(m.match));
        if (nextSuperIdx >= 0) {
          const nextSuper = adjusted[nextSuperIdx];
          const reachAfterDetour = walkBetween(cur, nextSuper, options.overrides).feasible;
          const reachWithoutDetour =
            lastSuggestedAdjusted === undefined ||
            walkBetween(lastSuggestedAdjusted, nextSuper, options.overrides).feasible;
          // Only refuse if taking this match strictly worsens super reachability.
          suggested = reachAfterDetour || !reachWithoutDetour;
        } else {
          suggested = true;
        }
      }
    }

    if (suggested) {
      suggestedLocation = cur.match.field;
      lastSuggestedAdjusted = cur;
    }

    entries.push({
      match: cur.match,
      adjustedStart: cur.adjustedStart,
      walkFromPrevious,
      feasible,
      suggested,
      conflictReason,
    });

    lastEntry = cur;
  }

  return entries;
}

export interface ScheduleSummary {
  total: number;
  suggested: number;
  conflicts: number;
  tight: number;
}

const TIGHT_SLACK_MIN = 2;

export function summarize(
  entries: ScheduleEntry[],
  drifts: Map<string, FieldDrift>,
  overrides?: WalkOverrides,
): ScheduleSummary {
  let conflicts = 0;
  let tight = 0;
  let suggested = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.feasible) conflicts++;
    if (e.suggested) suggested++;
    if (i > 0 && e.feasible) {
      const prev = entries[i - 1];
      const prevAdjusted = adjustMatch(prev.match, drifts.get(prev.match.field));
      const curAdjusted = adjustMatch(e.match, drifts.get(e.match.field));
      const fb = walkBetween(prevAdjusted, curAdjusted, overrides);
      if (fb.feasible && fb.slackMinutes <= TIGHT_SLACK_MIN) tight++;
    }
  }
  return { total: entries.length, suggested, conflicts, tight };
}
