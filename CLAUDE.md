# Venom Favorites — Claude context

## TL;DR

Mobile-first PWA for FRC Team 8044 to track favorite teams across the 8 division fields at the **2026 FIRST Championship** (Houston, Apr 29 – May 2). Spec lives in [SPEC.md](SPEC.md). Implementation plan and decisions: `~/.claude/plans/ok-please-refer-to-wondrous-lovelace.md`.

Companion app: [venom-scouting](../venom-scouting/) — shares the Firebase project `scouting-system-352a4` and brand palette, but this app is **TypeScript + Tailwind** (the scouting app is JS + plain CSS).

## Quick start

```bash
npm install
npm run dev                                  # live FRC API (needs VITE_FRC_USER + VITE_FRC_TOKEN)
npm run dev:fixture                          # 2025 Championship replay, default phase E
VITE_FIXTURE_PHASE=B npm run dev:fixture     # phase A | B | C | D | E
npm test                                     # vitest unit tests
npm run typecheck
npm run build
firebase deploy --only hosting:venom-favorites
```

## Architecture map

```
src/
  main.tsx, App.tsx, index.css
  lib/logger.ts                 — ring buffer + console mirror; window.__diag in tests
  api/
    frc.ts                      — basic-auth fetch, source switch (live | fixture | proxy), retry
    corsTest.ts                 — one-time CORS preflight, sets localStorage.useProxy
    fixtureLoader.ts            — serves tests/fixtures/2025-houston/ filtered by phase
  state/
    favorites.ts, schedule.ts, walkTimes.ts, rankings.ts  — localStorage-backed React hooks
  logic/
    walking.ts                  — FIELD_INDEX + walkMinutes() (pure)
    drift.ts                    — median over last 5 completed (pure)
    conflicts.ts                — feasibility + greedy best-path (pure)
    progress.ts                 — match-result derivation, bracket status (pure)
    status.ts                   — Saturday status state machine (pure)
  types/domain.ts               — all spec types: Field, Favorite, Match, Alliance, ...
  components/
    TabBar, TopBar, TeamSearch, FavoritesList, Timeline, MatchCard,
    FieldDriftPill, WalkTimeEditor, ResultsList, TeamProgressCard,
    MatchResultRow, DiagnosticsPanel
functions/src/index.ts          — frcProxy() — lazy CORS proxy; only deployed if needed
tests/fixtures/2025-houston/    — captured 2025 Championship JSON for the 5-stage replay
```

## Data sources

The API client has three modes (controlled by `VITE_DATA_SOURCE` and `localStorage.useProxy`):

- **`live`** — direct calls to `frc-api.firstinspires.org` with basic auth (default at runtime).
- **`fixture`** — reads from `tests/fixtures/2025-houston/` with a phase filter (A–E).
- **`proxy`** — calls the deployed Firebase Function at `/frcProxy?path=...`. Set automatically when the preflight in `corsTest.ts` fails.

## Testing protocol

Unit tests on the pure logic (`walking`, `drift`, `conflicts`, `progress`, `status`) run on every commit.

End-to-end is **5 progressive stages** against the 2025 Championship fixture set:

| Stage | What's served | What's tested |
|---|---|---|
| A | rosters only | team search, favorites, persistence |
| B | + qual schedule | timeline, conflicts on scheduled times |
| C | + qual results | drift, results tab, rankings |
| D | + alliances + playoff schedule | Saturday Mode status, schedule filtering |
| E | + playoff results | bracket status, eliminated dim, division winner gold |

Stages are driven from Claude Code's `chrome-devtools` MCP tools (screenshots, snapshot, click, fill, network log). Reports land in `tests/reports/stage-<X>.md`.

## Brand tokens

| Token | Hex | Use |
|---|---|---|
| `purple` | `#461D7C` | brand primary, alliance-selected pill |
| `purple-light` | `#5A2A9E` | hover, secondary surface |
| `gold` | `#FDD023` | brand accent, division-winner pill |
| `gold-dark` | `#C9A71A` | gold hover |
| `feasible` | `#16A34A` | green W / suggested path border |
| `loss` | `#DC2626` | red conflict / loss |
| `tight` | `#F59E0B` | amber tight slack |
| `tie` | `#6B7280` | gray tie / inactive / dimmed cards |
| `alliance-red` | `#ED1C24` | red alliance chip |
| `alliance-blue` | `#0066B3` | blue alliance chip |

## Known limitations

- **No Einstein support.** Once a team is `division_winner`, the app stops tracking — Einstein is a single stage with a published agenda.
- **No cross-device favorites sync** in v1. Each phone has its own list (localStorage).
- **No push notifications** in v1. Stretch goal — would need Firebase Cloud Messaging.
- **CORS proxy only deployed if needed.** Function code lives in `functions/` from day 1 but `firebase deploy --only functions:frcProxy` runs only when the preflight fails.

## Deploy + QR

```bash
npm run build
firebase deploy --only hosting:venom-favorites
# → hosted at https://venom-favorites.web.app (TBC, depends on site name approved at site creation)
# Generate QR pointing at the hosting URL; pin in team Slack/email.
```

## Phase log

- **Phase 0 (scaffold)** ✓ — project bootstrapped, Tailwind palette wired, PWA config, multi-site Firebase config, logger + diagnostics stubs.
- **Phase 1 (FRC API + fixtures)** ✓ — domain types, FRC client with three-way source switch (`live | fixture | proxy`), CORS preflight gate, fixture loader with phase A–E filter, `findTeamDivision()` with paginated roster fetch, 2025 Championship fixtures captured (75 teams × 8 divisions, all schedule + matches + rankings + alliances). Production build is 218 KiB (fixtures excluded via conditional `import.meta.glob`). Dev/fixture-mode build includes them. Auto-detects 8044 → ARCHIMEDES on mount in fixture mode. 18 unit tests passing.
- **Phase 2 (favorites flow)** ✓ — `useFavorites()` hook (localStorage `favorites/v1` key, cross-tab sync, dedupe on add, partial update for status changes), `TeamSearch.tsx` modal (search 8 divisions in parallel via `findTeamDivision`, idle/searching/found/not-found/duplicate/error states), `FavoritesList.tsx` (status badges: qualifying/awaiting/selected/not-selected/eliminated/division-winner per spec), `DiagnosticsPanel` revealed by tapping the version footer 5x. App layout: header with brand + clock + division detection, favorites section, floating "Add Favorite" FAB. 25 unit tests passing.
- **Stage A test** ✓ — 8 favorites added across 5 divisions, persistence verified, zero live FRC API calls. 6 screenshots + report under `tests/reports/stage-A.md`.
- **Phase 3 (schedule + drift + Timeline)** ✓ — `src/logic/transform.ts` joins schedule (planned) + matches (actuals + scores) by `(level, matchNumber)`, attaches Houston CDT offset to event-local times. `src/logic/drift.ts` computes per-field median drift over last 5 completed (outlier-robust). `src/state/schedule.ts` polls every 60s, fetches qual + playoff schedule + matches per favorite division in parallel, stale-while-revalidate from `schedule-cache/v1`. `Timeline.tsx` groups matches by hour with field drift pill per group, `MatchCard.tsx` shows match #/field/alliance chip/teams/score-when-final, `TopBar.tsx` surfaces next 1–2 must-see matches as huge cards, `FieldDriftPill.tsx` color-codes (green ON TIME, amber tight, red ≥5 min). 10 drift unit tests; 35 tests total.
- **Stage B test** ✓ — 85 favorite-involving matches across 5 divisions, 635 total when "show all" toggled, drift pills "no data" everywhere (correct — no actuals in phase B), zero score rows, all api source: fixture. Report at `tests/reports/stage-B.md`.
- **Phase 4 (walking + conflicts + best path + walk-time editor)** ✓ — `src/logic/walking.ts` exact spec matrix (1 hop=2, 7 hops=10) with user overrides + symmetric lookup. `src/logic/conflicts.ts` `planSchedule()` builds `ScheduleEntry[]` with consecutive-feasibility (red border infeasible, green suggested, amber tight, gray dropped) AND greedy `suggested` flag tracking user location across the timeline (skipped matches don't shift location). Same-field consecutive matches skip both walk and settle buffer. `src/state/walkTimes.ts` editable matrix in localStorage with reset-to-defaults. `WalkTimeEditor.tsx` 9×9 cell grid (8 divisions + Einstein), tap to edit, gold cells indicate overridden values. `MatchCard.tsx` now shows conflict reason ("🔴 5 min walk + 2 buffer needed, only 4 min between matches") + "X min walk from prev" hint. App header chip shows "Y of Z matches in suggested path · N conflicts · M tight". 17 new unit tests for walking + conflicts; 52 total.
- **Stage C test** ✓ — 77 favorite-involving qual matches with scores, 44 in suggested path, 41 conflicts, drift values DAL +2 / ARC +6 / NEW +2 / CUR ON TIME, walk-time editor matrix matches spec exactly, override flow persisted + reset works. 5 screenshots + report at `tests/reports/stage-C.md`.
- **Phase 5 (Results tab)** ✓ — `src/logic/progress.ts` derives MatchResult + naive bracket status from completed matches (≥2 losses → eliminated). `src/state/rankings.ts` polls `/rankings/{div}` per division on the same 60s cadence, projects to `Ranking[]` filtered to favorites with rank/total/W-L-T/RP. `ResultsList.tsx` sorts in-playoffs first, then qualifying-by-rank, then eliminated/not-selected. `TeamProgressCard.tsx` collapsible header with team#/name/division/rank/RP/bracket-pill/big W-L-T, default top-3 expanded. `MatchResultRow.tsx` per-match row with alliance chip, "ourScore — theirScore", W/L/T pill (green/red/gray); tap-to-expand shows all 6 teams. `TabBar.tsx` Schedule/Results switcher, sticky below header. 11 progress unit tests; 63 total.
- **Phase 6 (Saturday Mode)** ✓ — `src/logic/status.ts` six-state derivation from alliance data + playoff results: `qualifying` (quals remain), `awaiting_selection` (quals done, alliances empty), `selected` (on alliance, w/ allianceNumber + role: captain/pick1/pick2/pick3/backup), `not_selected` (alliances populated, team absent), `eliminated` (≥2 alliance playoff losses), `division_winner` (only alliance with <2 losses + finals concluded). `useSchedule` now also fetches `/alliances/{div}` per favorite-division on the same 60s cadence. App-level `useEffect` calls `useFavorites.update()` on each derivation to persist allianceNumber/role/status to localStorage. Saturday playoff filter: timeline includes matches involving any team in any alliance containing a favorite, not just literal favorite team numbers — driven by `favoriteAllianceTeams` Set computed from alliance rosters. 16 status unit tests; 79 total.
- **Stage D test** ✓ — alliance selection populated, 7/8 favorites selected with correct alliance # + role, 1 not_selected, status badges render, [status] transition logs captured. Report at `tests/reports/stage-D.md`.
- **Stage E test** ✓ — full playoff replay, 4 division winners + 3 eliminated + 1 not_selected detected from 2025 data (8044 actually won ARCHIMEDES at 2025 Worlds in this fixture). Bracket-status display fix: TeamProgressCard now respects `favorite.status === 'division_winner'` over the naive loss-count derivation. Report at `tests/reports/stage-E.md`.
- **Super-favorite (post-MVP add)** ✓ — `Favorite.isSuper` flag (single-super invariant enforced by `useFavorites.setSuper`); planner gives super matches anchor priority and **drops non-super matches** that would prevent reaching the next super in time. UI: tap star (☆ → ★) to mark; super favorites sort to top of list with gold ring + "SUPER" pill; super matches in schedule get gold border + "★ Super" pill (priority over conflict/feasibility coloring). 4 super-favorite hook tests + 4 planner tests; 87 total.
- **Manual refresh button** ✓ — ↻ next to "Fetched 8:54 AM" timestamp; spins while loading; calls both schedule + rankings refresh on demand. Useful Saturday morning when alliances drop.
- **Phase 7 (deploy)** ✓ — Firebase Hosting site `venom-favorites` created; production build deployed. **Live at https://venom-favorites.web.app.** Live FRC API smoke test passed: 8044 → HOPPER for 2026, 48 API calls, 0 errors, CORS preflight succeeded (no proxy needed). PWA icons (`pwa-192x192.png`, `pwa-512x512.png`, `venom-logo.png`) copied from venom-scouting. QR code at `public/venom-favorites-qr.png`.
