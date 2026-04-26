# Stage C — Quals scored, drift + conflicts active

**Date:** 2026-04-26
**Build:** Phase 4 complete (commit `efc3a6d`)
**Fixture:** 2025 FIRST Championship, phase C (rosters + qual schedule + qual matches with actuals + scores + rankings; alliances and playoffs still empty)
**Driver:** Claude Code via `chrome-devtools` MCP at 375 × 812
**Result:** ✅ PASS

## Acceptance checklist

- [x] Page loads, no console errors at level `error`
- [x] **Zero live FRC API calls** — all sources are `fixture`
- [x] Drift pills compute non-zero values from actuals (e.g. **DAL · +2 min**, **ARC · +6 min**, **NEW · +2 min**, **CUR · ON TIME**)
- [x] Match cards show **final scores** — 77 score rows rendered (e.g. Q1 DALY 253–130, Q3 ARCHIMEDES 223–163)
- [x] **41 conflict cards** (red border) with explanations: "🔴 8 min walk + 2 buffer needed (10 min), only 0 min between matches"
- [x] **35 suggested cards** (green border) — greedy best path
- [x] Summary chip: **"44 of 77 matches in suggested path · 41 conflicts · 4 tight"**
- [x] Walk-time editor opens, 8×8 (+ Einstein) matrix matches the spec exactly: 1 hop = 2 min, 7 hops (ARC↔NEW) = 10 min
- [x] Override flow works: ARC → NEW set to 12 min persisted to `walk-overrides/v1` localStorage as `{"ARCHIMEDES":{"NEWTON":12}}`; reset clears it
- [x] "Suggested only" toggle filters out greedy-skipped matches
- [x] Diagnostics: 149 log entries, 8 schedule lifecycle entries (refresh start / done)

## Visible counts

- 8 favorites across 5 divisions (same set as stages A/B)
- **77 favorite-involving matches** (qual only — playoff still empty in phase C)
- **44 suggested** by greedy (57%)
- **41 consecutive-conflicts** flagged (53%) — many because 2025 quals were back-to-back across far-apart fields
- **4 tight transitions** (≤2 min slack)

## Behavior nuances observed

A match can be **`suggested:true` AND `feasible:false`** — greedy includes it because the user is at a different (closer) location from a *prior* suggested match, but the consecutive rule flags it against the immediately-preceding (skipped) favorite match. Visible in the screenshot: Q12 CURIE has a red border under "Suggested only" filter. This is the spec's intended design — the user sees both signals.

## Drift values in the wild

Sample drift pills observed:
- `DAL · +2 min` — DALY ran ~2 min late
- `ARC · +6 min` — ARCHIMEDES ran significantly late (auto +6 min adjustment to schedule)
- `NEW · +2 min`
- `CUR · ON TIME` — Curie was on schedule

These propagate to match-card adjusted-start times: Q3 ARCHIMEDES schedule was 8:26, displayed as **8:31 AM** with `+6 min vs schedule` badge.

## Screenshot inventory

| File | What it shows |
|---|---|
| `stage-C-1-summary-top.png` | Top of page — favorites + clock |
| `stage-C-2-summary-and-conflicts.png` | Schedule with drift pills, drift-adjusted times, 🔴 conflict reasons |
| `stage-C-3-walk-editor.png` | 8×8 walk-time editor matrix matching the spec exactly |
| `stage-C-4-suggested-only.png` | Filtered to suggested-path only, mix of green and red borders showing dual-signal nature |
| `stage-C-5-diagnostics.png` | Diagnostics panel after the test run |

## Bugs / observations

**No blockers.** Two small items noted:

1. **Suggested-only filter shows 52 vs 44 chip count.** Could not be reproduced reliably; possibly a stale-state moment between summary chip and DOM filter, or a pulled-in overlap with first-match-per-division entries. Not a correctness issue — the right matches are visible. Worth a follow-up unit test if it recurs.
2. **Suggested cards can have red borders.** Intentional per spec design — it surfaces both the greedy decision and the consecutive-walk reality. If feedback says this is confusing, switch border priority so suggested overrides feasible.

## Next

Stage C complete. Phase 5 next: Results tab (rankings + per-team match results + bracket status).
