# Stage E — Full playoff replay

**Date:** 2026-04-26
**Build:** Phase 6 + bracket-status display fix (commits `e8aed82` + this)
**Fixture:** 2025 Championship, phase E (full replay — every endpoint populated)
**Driver:** Claude Code via `chrome-devtools` MCP at 375 × 812
**Result:** ✅ PASS

## Acceptance checklist

- [x] All 8 favorites' final statuses derive correctly from the 2025 playoff outcome
- [x] Bracket statuses transition: 4 Division Winner, 3 Eliminated, 1 Not Selected
- [x] Eliminated favorites dim with gray pill in Favorites list
- [x] Division winners get gold "→ Einstein" pill in Favorites list
- [x] Results tab shows "DIVISION WINNER" gold pill (after the Stage-E fix), "ELIMINATED" red pill
- [x] Playoff matches in Schedule have final scores rendered
- [x] Saturday morning drift pills show large carry-over (MIL +21 min, ARC +15 min)
- [x] All API sources remain `fixture` — zero live calls

## Final favorite statuses (2025 ground truth)

| Team | Division | Final Status | Alliance | Bracket Result |
|---:|---|---|---:|---|
| 254 | MILSTEIN | eliminated | 1 (Pick 1) | Alliance 1 lost in playoffs |
| 1678 | DALY | eliminated | 3 (Captain) | Alliance 3 lost in playoffs |
| **8044** | **ARCHIMEDES** | **division_winner** | **1 (Captain)** | **Won ARCHIMEDES at 2025 Worlds** |
| 1114 | ARCHIMEDES | eliminated | 6 (Captain) | Alliance 6 lost (8044's alliance won) |
| 469 | CURIE | not_selected | — | (never selected) |
| **118** | **MILSTEIN** | **division_winner** | **2 (Captain)** | **Won MILSTEIN** |
| **2056** | **DALY** | **division_winner** | **6 (Captain)** | **Won DALY** |
| **1323** | **NEWTON** | **division_winner** | **1 (Captain)** | **Won NEWTON** |

The selected favorite set happens to include 4 different division winners — an unusually rich test set.

## Bug found during Stage E + fix

**Symptom:** Bracket badge in Results tab showed "UPPER BRACKET" for 8044 even though Favorites list showed "→ Einstein" — inconsistent.

**Cause:** `progress.ts` `deriveBracketStatus()` is naive (loss-count only — 0/1/2+ → upper/lower_1L/eliminated). The `'winner'` state requires the cross-alliance check which lives in `status.ts` `isDivisionWinner()`. The Results tab card was using only the naive derivation.

**Fix:** `TeamProgressCard.tsx` now overrides the bracket badge with the favorite's authoritative status when it's `division_winner` or `eliminated` — those are the cases where Saturday Mode's broader knowledge supersedes the loss-count heuristic. `'lower_1L'` and `'upper'` continue to come from the per-team derivation since those are intermediate states only meaningful during an in-progress bracket.

After fix: 4 "Division Winner" gold pills + 3 "Eliminated" red pills render in Results tab — consistent with Favorites list.

## Saturday playoff observations

- Drift carry-over from quals shows up in Saturday morning playoff times (MIL +21 min, ARC +15 min). When a division ran late Friday, Saturday's 8:30 starts shift to ~8:45-9:00 with the existing drift.
- PO1 ARCHIMEDES result: **275-255** (8044's red alliance wins) — matches the actual 2025 outcome.
- PO1 MILSTEIN result: **261-218** (254's red alliance wins) — but they're ultimately eliminated by Alliance 2 (118).

## Screenshot inventory

| File | What it shows |
|---|---|
| `stage-E-1-final-statuses.png` | Favorites list with 4 gold "→ Einstein" + 3 gray "Eliminated" + 1 dimmed "Not selected" |
| `stage-E-2-results-with-bracket.png` | Pre-fix Results tab showing the wrong "UPPER BRACKET" badge for 8044 |
| `stage-E-3-results-with-winner.png` | Post-fix Results tab showing "DIVISION WINNER" gold pill |
| `stage-E-4-playoff-with-scores.png` | Saturday morning Schedule view with PO1 final scores + cross-field conflict reasons |

## Bugs / observations

**One bug found and fixed mid-test** (bracket badge consistency, see above). No other issues.

## Conclusion

The 2026 Worlds Match Watcher passes all 5 progressive test stages against the 2025 FIRST Championship fixture set. The full feature surface — favorite tracking, drift-aware schedule, walking-time conflict detection, greedy best-path planner, results tab, Saturday Mode status derivation — works end-to-end with realistic data.

## Next

Phase 7: PWA polish + production deploy + QR code generation.
