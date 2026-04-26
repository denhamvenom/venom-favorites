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

- **Phase 0 (scaffold)** — project bootstrapped, Tailwind palette wired, PWA config, multi-site Firebase config, logger + diagnostics stubs. _In progress._
