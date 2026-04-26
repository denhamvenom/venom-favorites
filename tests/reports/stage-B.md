# Stage B — Quals scheduled, no actuals

**Date:** 2026-04-26
**Build:** Phase 3 complete (commit `5b3b9eb`)
**Fixture:** 2025 FIRST Championship, phase B (rosters + qual schedule populated; matches/alliances/rankings empty)
**Driver:** Claude Code via `chrome-devtools` MCP
**Viewport:** 375 × 812
**Result:** ✅ PASS

## Acceptance checklist

- [x] Dev server starts, no console errors at level `error`
- [x] **Zero live FRC API calls** — all sources are `fixture` (verified via diagnostics export)
- [x] Timeline renders matches with scheduled times grouped by hour-of-day in America/Chicago
- [x] Drift pills show **"no data"** for every field (correct — no completed matches in phase B)
- [x] Match cards show match #, division, alliance chip (R/B), 6 team numbers, scheduled time
- [x] Match cards show **no score row** (verified: 0 instances of "final" label across all 85 favorite-involving matches)
- [x] Favorite team numbers highlighted in gold within the alliance rows
- [x] "Show only mine" / "Show all matches" toggle works: 85 ↔ 635 visible items

## Visible match counts

- 8 favorites across 5 divisions (MILSTEIN, DALY, ARCHIMEDES, CURIE, NEWTON)
- **85 matches** involve at least one favorite (default view)
- **635 matches** total across those 5 division qual schedules (when "show all" is toggled)
- TopBar empty (correct — all 2025 schedule timestamps are in the past relative to wall-clock 2026-04-26)

## Screenshot inventory

| File | What it shows |
|---|---|
| `stage-B-1-schedule-default.png` | Top of page after favorites + schedule loaded |
| `stage-B-2-schedule-fullpage.png` | Full 10,249 px page — every visible match grouped by hour |
| `stage-B-3-schedule-viewport.png` | Schedule section in viewport, showing Q1/Q2/Q3/Q6 with favorites highlighted in gold (2056, 1323, 8044, 1114) |
| `stage-B-4-diagnostics.png` | Diagnostics panel revealed, 100+ entries showing fixture-only sources |

## Sample API call log

```
[api] 200 GET /2026/schedule/MILSTEIN/playoff   (fixture)
[api] 200 GET /2026/matches/MILSTEIN            (fixture)
[api] 200 GET /2026/schedule/DALY/playoff       (fixture)
...
```

`apiSources` distinct = `["fixture"]` only — no live or proxy calls.

## Drift pill rendering

Every group header shows pills like:
- `MIL · no data`
- `DAL · no data`
- `ARC · no data`

Color: gray (tie/inactive) — matches the `no data` branch in `FieldDriftPill.tsx` which fires when `basedOn === 0`. This is correct for phase B since matches-qual is empty (no `actualStartTime` to compute drift from).

## Bugs / observations

**No bugs found.** Two follow-ups noted for later phases:

1. **TopBar empty** — works as designed: filters out matches whose drift-adjusted start is more than 5 minutes in the past. All 2025 schedule timestamps are in the past for the test machine clock. In live 2026 mode, TopBar will populate when matches are upcoming.
2. **Match field labels are correct** — schedule-qual fixtures contain every team's scheduled match, but the `field` we attach is the division eventCode (NEWTON, etc.) not the API's "Primary"/"Secondary" venue label. This is the desired behavior since walking-time math operates on division identity.

## Next

Stage B complete. Phase 4 next: walking-time matrix + conflict detection + greedy best path + walk-time editor. Stage C (quals scored) tests after.
