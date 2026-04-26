import { describe, expect, it } from 'vitest';
import { planSchedule, summarize } from './conflicts';
import type { Field, FieldDrift, Match } from '../types/domain';

const ZERO_DRIFTS = new Map<string, FieldDrift>();
const T0 = new Date('2026-04-30T13:00:00Z');

function mkMatch(
  matchNumber: number,
  field: Field,
  scheduledStartMin: number,
  myFavoriteOnRed = true,
): Match {
  const ms = T0.getTime() + scheduledStartMin * 60_000;
  const myFav = 8044;
  const red = myFavoriteOnRed ? [myFav, 1, 2] : [3, 4, 5];
  const blue = myFavoriteOnRed ? [3, 4, 5] : [myFav, 1, 2];
  return {
    matchNumber,
    level: 'qual',
    field,
    scheduledStart: new Date(ms),
    actualStart: undefined,
    actualEnd: undefined,
    redAlliance: red,
    blueAlliance: blue,
    redScore: undefined,
    blueScore: undefined,
    myFavorites: [myFav],
  };
}

describe('planSchedule — feasibility', () => {
  it('marks the first match as feasible (no preceding match)', () => {
    const matches = [mkMatch(1, 'ARCHIMEDES', 0)];
    const entries = planSchedule(matches, ZERO_DRIFTS);
    expect(entries[0].feasible).toBe(true);
    expect(entries[0].walkFromPrevious).toBeUndefined();
  });

  it('marks consecutive same-field matches as feasible regardless of gap', () => {
    const matches = [mkMatch(1, 'ARCHIMEDES', 0), mkMatch(2, 'ARCHIMEDES', 8)];
    const entries = planSchedule(matches, ZERO_DRIFTS);
    expect(entries[1].feasible).toBe(true);
    expect(entries[1].walkFromPrevious).toBe(0);
  });

  it('flags a 7-hop walk with only 5 min between matches as infeasible', () => {
    // 7 hops = 10 min walk + 2 buffer = 12 min required. Match duration 7 min.
    // Match 1 ends at +7 min (estimated), Match 2 starts at +12 min → 5 min gap. Need 12. → infeasible.
    const matches = [mkMatch(1, 'ARCHIMEDES', 0), mkMatch(2, 'NEWTON', 12)];
    const entries = planSchedule(matches, ZERO_DRIFTS);
    expect(entries[1].feasible).toBe(false);
    expect(entries[1].walkFromPrevious).toBe(10);
    expect(entries[1].conflictReason).toContain('10 min walk');
  });

  it('flags 1 min slack on a 1-hop walk as still feasible (just barely)', () => {
    // 1 hop = 2 min walk + 2 buffer = 4 min required. Match duration 7 min.
    // Match 2 at +12 min → 5 min gap. Need 4. → feasible, 1 min slack.
    const matches = [mkMatch(1, 'ARCHIMEDES', 0), mkMatch(2, 'CURIE', 12)];
    const entries = planSchedule(matches, ZERO_DRIFTS);
    expect(entries[1].feasible).toBe(true);
  });
});

describe('planSchedule — greedy path', () => {
  it('includes every match when all are reachable', () => {
    const matches = [
      mkMatch(1, 'ARCHIMEDES', 0),
      mkMatch(2, 'ARCHIMEDES', 15),
      mkMatch(3, 'CURIE', 30),
    ];
    const entries = planSchedule(matches, ZERO_DRIFTS);
    for (const e of entries) expect(e.suggested).toBe(true);
  });

  it('drops a too-far match and carries the prior location forward', () => {
    // Match 1: ARCHIMEDES at +0 (ends at +7)
    // Match 2: NEWTON at +12 → unreachable (10 min walk + 2 buffer needs 12 min from end of M1, only 5)
    // Match 3: CURIE at +25 → reachable from ARCHIMEDES (1-hop walk; gap from M1 end is 18 min, need 4)
    //          BUT if greedy went to NEWTON, M3 would be 7-hop walk from NEWTON to CURIE within 13 min — also feasible
    // The greedy decision: skip M2 (infeasible), so user stays at ARCHIMEDES → M3 from ARCHIMEDES is feasible.
    const matches = [
      mkMatch(1, 'ARCHIMEDES', 0),
      mkMatch(2, 'NEWTON', 12),
      mkMatch(3, 'CURIE', 25),
    ];
    const entries = planSchedule(matches, ZERO_DRIFTS);
    expect(entries[0].suggested).toBe(true);
    expect(entries[1].suggested).toBe(false); // greedy drops the unreachable Newton match
    expect(entries[2].suggested).toBe(true);
  });

  it('greedy path can include an infeasible-by-consecutive match if we skipped one before', () => {
    // M1: ARCHIMEDES +0  → suggested, location ARCHIMEDES, ends +7
    // M2: NEWTON +5      → consecutive-infeasible (only 0 min slack? actually impossible).
    //                      greedy drops it, location stays ARCHIMEDES.
    // M3: CURIE +20      → consecutive (vs M2) needs 7-hop NEWTON→CURIE walk in 13 min, feasible.
    //                      greedy: from ARCHIMEDES → CURIE is trivial.
    // Both consecutive-feasibility AND greedy include M3.
    const matches = [
      mkMatch(1, 'ARCHIMEDES', 0),
      mkMatch(2, 'NEWTON', 5),
      mkMatch(3, 'CURIE', 20),
    ];
    const entries = planSchedule(matches, ZERO_DRIFTS);
    expect(entries[1].feasible).toBe(false);
    expect(entries[1].suggested).toBe(false);
    expect(entries[2].suggested).toBe(true);
  });
});

describe('planSchedule — super-favorite anchors', () => {
  it('always marks super matches as suggested even when not reachable from greedy location', () => {
    // M1 ARCHIMEDES at 0 (regular fav) — suggested.
    // M2 NEWTON at 5 (SUPER fav, but myFavorites doesn't include 8044 here — let's set up properly).
    // For super behavior we override myFavorites manually below.
    const m1 = mkMatch(1, 'ARCHIMEDES', 0); // myFavorites = [8044]
    const m2: Match = { ...mkMatch(2, 'NEWTON', 5), myFavorites: [8044] };
    const entries = planSchedule([m1, m2], ZERO_DRIFTS, { superFavorite: 8044 });
    expect(entries[0].suggested).toBe(true);
    expect(entries[1].suggested).toBe(true); // super override
    expect(entries[1].feasible).toBe(false); // but consecutive feasibility still flags it
  });

  it('drops a non-super match that would prevent reaching the next super', () => {
    // M1 ARCHIMEDES at 0 (regular fav) — would normally be suggested.
    // M2 NEWTON at 12 (super) — going to M1 first means we leave at +7, need 12 to NEWTON, only 5 min.
    // Without super-priority, greedy still includes M1.
    // With super-priority: skipping M1 lets us start at NEWTON cleanly. So M1 should be dropped.
    const m1: Match = { ...mkMatch(1, 'ARCHIMEDES', 0), myFavorites: [254] }; // regular favorite team
    const m2: Match = { ...mkMatch(2, 'NEWTON', 12), myFavorites: [8044] }; // super
    const entries = planSchedule([m1, m2], ZERO_DRIFTS, { superFavorite: 8044 });
    expect(entries[0].suggested).toBe(false); // dropped to keep super reachable
    expect(entries[1].suggested).toBe(true);
  });

  it('drops an in-between match that would block reaching a later super', () => {
    // M1 ARCHIMEDES at 0 (regular) — easy first pick, location ARC.
    // M2 NEWTON at 30 (regular) — reachable from ARC in 23 min (>= 12 needed), greedy
    //   would normally take it. But going to NEWTON makes M3 unreachable.
    // M3 ARCHIMEDES at 35 (super) — from ARC same field free; from NEWTON not in time.
    //   Planner should DROP M2 to preserve M3.
    const m1: Match = { ...mkMatch(1, 'ARCHIMEDES', 0), myFavorites: [254] };
    const m2: Match = { ...mkMatch(2, 'NEWTON', 30), myFavorites: [254] };
    const m3: Match = { ...mkMatch(3, 'ARCHIMEDES', 35), myFavorites: [8044] };
    const entries = planSchedule([m1, m2, m3], ZERO_DRIFTS, { superFavorite: 8044 });
    expect(entries[0].suggested).toBe(true);
    expect(entries[1].suggested).toBe(false); // dropped to preserve super
    expect(entries[2].suggested).toBe(true);
  });

  it('treats matches without superFavorite option exactly like before', () => {
    const m1 = mkMatch(1, 'ARCHIMEDES', 0);
    const m2 = mkMatch(2, 'NEWTON', 12);
    const entries = planSchedule([m1, m2], ZERO_DRIFTS);
    // Without super-favorite, M1 is suggested (feasible from nowhere), M2 is dropped (unreachable).
    expect(entries[0].suggested).toBe(true);
    expect(entries[1].suggested).toBe(false);
  });
});

describe('summarize', () => {
  it('counts conflicts, tights, and suggestions per consecutive feasibility', () => {
    // M1 ARCHIMEDES +0 (ends +7) → M2 NEWTON +12: 7-hop walk needs 12 min, only 5 → infeasible
    // M2 NEWTON +12 (ends +19) → M3 CURIE +25: 6-hop walk needs 11 min, only 6 → infeasible
    // Both M2 and M3 are flagged as conflicts per spec's consecutive-feasibility rule;
    // greedy still includes M3 because skipping M2 keeps the user at ARCHIMEDES.
    const matches = [
      mkMatch(1, 'ARCHIMEDES', 0),
      mkMatch(2, 'NEWTON', 12),
      mkMatch(3, 'CURIE', 25),
    ];
    const entries = planSchedule(matches, ZERO_DRIFTS);
    const summary = summarize(entries, ZERO_DRIFTS);
    expect(summary.total).toBe(3);
    expect(summary.conflicts).toBe(2);
    expect(summary.suggested).toBe(2); // M1 + M3
  });
});
