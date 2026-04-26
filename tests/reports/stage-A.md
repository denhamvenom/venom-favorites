# Stage A — Roster-only fixture

**Date:** 2026-04-26
**Build:** Phase 2 complete (commit `035eea5`)
**Fixture:** 2025 FIRST Championship, phase A (rosters only; all schedule/match/alliance/ranking endpoints return empty envelopes)
**Driver:** Claude Code via `chrome-devtools` MCP
**Viewport:** 375 × 812 (iPhone X size)
**Result:** ✅ PASS

## Acceptance checklist

- [x] Dev server started, page loads, no console errors at level `error`
- [x] Network shows fixture endpoints hit, **zero live FRC API calls** (confirmed via `list_network_requests` filtered to fetch/xhr — empty result; fixtures are bundled by Vite at build time, served in-process)
- [x] Add 8 favorites covering ≥4 divisions
- [x] Reload, verify persistence
- [x] Screenshots captured: empty, search-empty, search-found, populated, after-reload, diagnostics

## Favorites added (Stage A test set)

| # | Team | Name | Division | Notes |
|---|---:|---|---|---|
| 1 | 254 | The Cheesy Poofs | MILSTEIN | added via UI flow |
| 2 | 1678 | Citrus Circuits | DALY | added via scripted UI flow |
| 3 | 8044 | Denham Venom | ARCHIMEDES | our team |
| 4 | 1114 | Simbotics | ARCHIMEDES | |
| 5 | 469 | Las Guerrillas | CURIE | |
| 6 | 118 | Robonauts | MILSTEIN | |
| 7 | 2056 | OP Robotics | DALY | |
| 8 | 1323 | MadTown Robotics | NEWTON | |

**Divisions covered:** MILSTEIN, DALY, ARCHIMEDES, CURIE, NEWTON (5/8 — exceeds the ≥4 requirement)

## Screenshot inventory

| File | What it shows |
|---|---|
| `stage-A-1-empty-state.png` | Initial load, "No favorites yet" empty state, header shows 8044 → ARCHIMEDES auto-detection |
| `stage-A-2-search-modal-empty.png` | TeamSearch modal opened, idle state |
| `stage-A-3-search-found.png` | Team 254 found in MILSTEIN, "Add to favorites" CTA |
| `stage-A-4-favorites-populated.png` | All 8 favorites listed with division + qualifying badge |
| `stage-A-5-after-reload.png` | Same 8 favorites after a full page reload (persistence verified) |
| `stage-A-6-diagnostics-panel.png` | Diagnostics panel revealed via 5x tap on `v0.1.0 · FIXTURE` footer; 21 entries, all `[api]` calls show `source: "fixture"` |

## Network observation

`mcp__chrome-devtools__list_network_requests` filtered to fetch+xhr returned no requests — the fixture loader serves entirely from bundled JSON via `import.meta.glob`. This is the desired behavior: in fixture mode, **no live FRC API calls escape the browser**.

## Log highlights (21 entries)

```
[app] mount {"dataSource":"fixture"}
[cors] skipping preflight in fixture mode
[api] 200 GET /2026/teams · {"ms":3,"source":"fixture"}    × 16  (8 divisions × 2 mounts due to React StrictMode)
[app] team 8044 found in ARCHIMEDES · {team: {teamNumber: 8044, nameShort: "Denham Venom", city: "Denham Springs", ...}}
```

Per-call latency: 2–13 ms (in-bundle JSON parse, no network).

## Bugs / observations

**No bugs found.** Two minor observations for follow-up:

1. **React StrictMode causes auto-detect to fire twice** in dev. That's standard StrictMode behavior and goes away in production. Logger entries show duplicate `[app] mount` and 16 `/2026/teams` calls instead of 8. Not a real issue.
2. **Fixture API path uses 2026 season** (`/2026/teams`) but resolves to 2025 fixture data because the fixture loader is hardcoded to `tests/fixtures/2025-houston/`. By design — the app's runtime path is unchanged, the fixture layer just substitutes 2025 content. In live mode against the 2026 season, real 2026 rosters will be returned.

## Next

Stage A complete. Phase 3 next: Schedule + drift + Timeline. Stage B (quals scheduled, no scores) tests after.
