# Stage D — Alliance selection populates Saturday Mode

**Date:** 2026-04-26
**Build:** Phase 6 complete (commit `e8aed82`)
**Fixture:** 2025 Championship, phase D (rosters + qual schedule + qual matches + rankings + alliances + playoff schedule; playoff matches still empty)
**Driver:** Claude Code via `chrome-devtools` MCP at 375 × 812
**Result:** ✅ PASS

## Acceptance checklist

- [x] App loads, no errors
- [x] **All 8 favorites' statuses derive correctly** from the captured 2025 alliance rosters
- [x] 7 of 8 selected (with alliance # + role), 1 not_selected — exactly the mix the spec wants to test
- [x] Status badges render per spec: purple "Alliance N · Captain/Pick N" for selected, gray "Not selected" + 50% opacity for not_selected
- [x] Schedule timeline now includes **playoff matches** (PO1 across 4 divisions)
- [x] Saturday playoff conflict detection runs across fields
- [x] Drift values from qual matches still apply on playoff times (e.g. MIL +15 min, ARC +6 min carrying through to PO1)
- [x] 8 status transition logs captured: `[status] 254: qualifying → selected`, etc.
- [x] All API sources remain `fixture` — no live calls

## Status derivation results (2025 Championship ground truth)

| Team | Division | Status | Alliance | Role |
|---:|---|---|---:|---|
| 254 | MILSTEIN | selected | 1 | Pick 1 |
| 1678 | DALY | selected | 3 | Captain |
| 8044 | ARCHIMEDES | selected | 1 | **Captain** |
| 1114 | ARCHIMEDES | selected | 6 | Captain |
| 469 | CURIE | **not_selected** | — | — |
| 118 | MILSTEIN | selected | 2 | Captain |
| 2056 | DALY | selected | 6 | Captain |
| 1323 | NEWTON | selected | 1 | Captain |

*8044 captained Alliance 1 of ARCHIMEDES at 2025 Worlds — useful real-data ground truth.*

## Schedule view changes vs Stage C

- Stage C: 77 favorite-involving qual matches
- Stage D: 110 visible cards (qual + new playoff schedule)
- New "SAT, 8 AM" hour group with drift pills carrying over from Friday quals
- Playoff matches show "PO1" prefix in the gold match-number label

Visible PO1 matches in Saturday morning hour group:
- **PO1 MILSTEIN** (254 on Red) at 8:44 AM (+15 min drift) — flagged as conflict from previous match
- **PO1 ARCHIMEDES** (8044 on Red captaining) at 8:35 AM (+6 min) — flagged as conflict
- **PO1 NEWTON** (1323 on Red captaining) at 8:31 AM (+2 min) — feasible, "2 min walk from prev"
- **PO1 DALY** also visible in subsequent rows

## Screenshot inventory

| File | What it shows |
|---|---|
| `stage-D-1-favorites-with-statuses.png` | Full page after Saturday Mode kicks in — all favorites with status badges |
| `stage-D-2-favorites-viewport.png` | Viewport showing purple Alliance pills on 7 selected favorites + dimmed 469 with "Not selected" pill |
| `stage-D-3-results-tab.png` | Results tab showing 8044 9-1-0 #1 ARCHIMEDES + 1323 10-0-0 #1 NEWTON |
| `stage-D-4-playoff-match.png` | PO1 matches across MILSTEIN / ARCHIMEDES / NEWTON with conflict reasons + favorite-alliance-mate highlighting |
| `stage-D-5-fullpage.png` | Full-page snapshot of Saturday Mode active |

## Bugs / observations

**No bugs found.** Two observations:

1. **Status updates persist to localStorage immediately.** The `useEffect` in App.tsx detects derivation changes and calls `useFavorites.update()` per favorite — visible in the JSON: `{"n":254,"d":"MILSTEIN","s":"selected","a":1,"r":"pick1"}`. Reload would preserve.
2. **Saturday playoff filter** allows alliance-mate matches (driven by `favoriteAllianceTeams` Set). All 8 favorites are captains or first picks, so the alliance-mate filter is implicitly tested but doesn't have a strong "non-favorite alliance-mate appearing alone" case in this data.

## Next

Stage D complete. Stage E = full playoff replay (all playoff scores populated).
