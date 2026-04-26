# FRC Worlds Match Watcher — Build Spec

## TL;DR

Build a mobile-first web app for FRC Team 8044 to track favorite teams across the 2026 FIRST Championship and generate a walking-time-aware viewing schedule. Whole team uses it via QR code. Deploy to Firebase Hosting on existing project `scouting-system-352a4`. PWA so it survives spotty convention center wifi.

---

## Context

- **Event:** 2026 FIRST Championship presented by BAE Systems
- **Dates:** Apr 29 – May 2, 2026 (Wed–Sat)
- **Venue:** George R. Brown Convention Center, Houston
- **Build window:** Spec written Apr 26, 2026 → 3 days until quals open Thursday
- **Built for:** Denham Venom, FRC 8044, Coach Daniel Eiland
- **Distribution:** Public URL → QR code → team & family scan to load
- **Git repo:** https://github.com/denhamvenom/venom-favorites.git

### Schedule structure
- **Wed Apr 29:** Practice matches
- **Thu Apr 30 + Fri May 1:** Qualification matches on all 8 division fields (this is the layout in the included field map PDF)
- **Sat May 2:** Alliance selection ~7:15–7:45 AM on each division field, then **double-elimination playoffs continue on all 8 division fields throughout the day**, Einstein finals at end of day on a separate stage

**App lifecycle:** Useful continuously Wed → Sat afternoon. The 8-field layout and walking-time math stay valid through division playoffs on Saturday. The app's role effectively ends when Einstein begins — at that point everyone is watching one stage and there's nothing to schedule.

---

## Tech Stack

- **Frontend:** React + Vite + Tailwind (mirror Venom Scout patterns where possible)
- **State:** `localStorage` for favorites + cached schedule. No server state.
- **PWA:** `vite-plugin-pwa` for offline + installability. Cache last-fetched schedule, stale-while-revalidate.
- **Deploy:** Firebase Hosting on existing `scouting-system-352a4` project. Either as a new site (e.g. `worlds.venom8044.app`) or a path on existing site — coordinate with existing Venom Scout deploy.
- **No auth.** QR loads app, app starts working.
- **Time:** `date-fns-tz` to keep America/Chicago explicit. FRC API returns event-local time.

---

## FRC API

**Base URL:** `https://frc-api.firstinspires.org/v3.0`

**Auth:** HTTP Basic — `Authorization: Basic {base64(username:token)}`

**Credentials:** Username `frc8044`, token provided separately by Daniel. **Do NOT commit to repo.** Use Vite env vars (`VITE_FRC_USER`, `VITE_FRC_TOKEN`) injected at build time. The deployed bundle is team-internal via QR, so build-time injection is acceptable; if Daniel prefers, swap to a one-time prompt screen that stores token in localStorage.

**CORS:** FRC API has historically been inconsistent here. First call should be a CORS preflight test. If blocked, fallback is a 20-line Firebase Function on `scouting-system-352a4` that proxies the request and adds CORS headers.

### Event codes (2026 season)
- `ARCHIMEDES`, `CURIE`, `DALY`, `GALILEO`, `HOPPER`, `JOHNSON`, `MILSTEIN`, `NEWTON` — 8 division codes
- `CMPTX` — championship/Einstein

### Key endpoints

```
GET /2026/teams?eventCode={division}              → team roster for a division
GET /2026/schedule/{eventCode}/qual               → scheduled qual matches
GET /2026/schedule/{eventCode}/playoff            → scheduled playoff matches
GET /2026/matches/{eventCode}                     → completed matches w/ actual times + scores
GET /2026/rankings/{eventCode}                    → division rankings (rank, W-L-T, RP)
GET /2026/alliances/{eventCode}                   → playoff alliances (populates Sat morning)
GET /2026/events?eventCode={eventCode}            → event metadata
```

The `/teams` endpoint is how we resolve "which division is team N in?" when a user adds a favorite — query each of the 8 division event codes and find the one containing the team number. Cache this aggressively (rosters don't change mid-event).

The `/alliances` endpoint returns empty until Saturday alliance selection populates (~7:15–7:45 AM Central). Each alliance entry includes captain, round1/round2/round3 picks (for 4-team alliances), and backup. **This is the data source for Saturday status detection** — see Saturday Mode below.

---

## Field Layout & Walking Times

The 8 division fields are arranged in a **single horizontal row** across the main hall (Hall B–D area). Pits sit immediately above/below their respective fields. Position index from west to east:

| Index | Field      | 2026 Sponsor          |
|------:|------------|-----------------------|
| 0     | Archimedes | Rockwell Automation   |
| 1     | Curie      | Argosy Foundation     |
| 2     | Daly       | BAE Systems           |
| 3     | Galileo    | Mouser Electronics    |
| 4     | Hopper     | GE Aerospace          |
| 5     | Johnson    | Gene Haas Foundation  |
| 6     | Milstein   | Qualcomm              |
| 7     | Newton     | NASA                  |

### Walking time function

```javascript
const FIELD_INDEX = {
  ARCHIMEDES: 0, CURIE: 1, DALY: 2, GALILEO: 3,
  HOPPER: 4, JOHNSON: 5, MILSTEIN: 6, NEWTON: 7
};

function walkMinutes(fromField, toField) {
  if (fromField === toField) return 0;
  if (fromField === 'EINSTEIN' || toField === 'EINSTEIN') return 6;
  const hops = Math.abs(FIELD_INDEX[fromField] - FIELD_INDEX[toField]);
  // ~1.5 min per field hop in Worlds-density crowds, clamped 2–10
  return Math.min(10, Math.max(2, Math.round(1.5 * hops)));
}
```

**Resulting matrix:**
- 1 hop: 2 min · 2 hops: 3 min · 3 hops: 5 min · 4 hops: 6 min
- 5 hops: 8 min · 6 hops: 9 min · 7 hops (Archimedes ↔ Newton): 10 min

Add a **2-minute "settle" buffer** on arrival (find AS seat, get oriented).

**Make this matrix user-editable in-app.** Daniel will tune after Day 1 on the floor. Store overrides in localStorage with a "Reset to defaults" button.

---

## Features (MVP first, then stretch)

### MVP

1. **Team search & favorites**
   - Input team number → app queries the 8 division rosters → returns "Team 1234 (Name) is in Galileo"
   - "Add to favorites" persists `{teamNumber, teamName, division}` in localStorage
   - Favorites list view with remove button

2. **Match aggregator**
   - For each favorite, fetch quals + playoff schedule from their division
   - Merge into a single chronological timeline across all fields
   - Each entry shows: match number, field, drift-adjusted start time, alliance color (R/B), the 5 other teams on field

3. **Drift adjustment (per-field)**
   - Refresh every 60 sec
   - For each division: take last 5 completed matches, compute median drift = `actualStart - scheduledStart`
   - All upcoming scheduled matches at that field display `scheduledStart + drift`
   - Visible drift pill on each field section: "Galileo: +8 min" (red), "ON TIME" (green), "−2 min" (amber)

4. **Conflict detection**
   - For consecutive favorite matches, compute walk feasibility:
     `feasible = (next.adjustedStart - current.adjustedEnd) >= walkMinutes(current.field, next.field) + 2`
   - Matches in conflict get red border + explanation: "🔴 5 min walk + 2 buffer needed, only 4 min between matches"
   - "Tight" matches (≤2 min slack) get amber border

5. **Greedy "best path" suggestion**
   - Walk through chronological match list, tracking current location
   - For each match, ask: can I get there in time from my last seat?
   - Yes → include in path. No → drop, log conflict.
   - Toggle: "Show suggested path only" hides dropped matches

6. **Saturday Mode (alliance selection + playoff status)**
   - Starting Saturday ~7:00 AM Central, app polls `/alliances/{division}` every 60s for each division that contains favorites
   - For each favorite, derive a `status`:
     - `qualifying` (Thu/Fri default — has more quals to play)
     - `awaiting_selection` (quals done, alliance selection not yet started or in progress)
     - `selected` (on an alliance — store alliance number + role: captain/pick1/pick2/pick3/backup)
     - `not_selected` (alliance selection complete, team not on any alliance — done for the event)
     - `eliminated` (was on an alliance but the alliance lost in double-elim playoffs)
     - `division_winner` (won their division — heading to Einstein, app no longer tracks)
   - Status determination logic:
     - Cross-reference favorite team number against all alliances in their division
     - If alliances are populated AND team is not in any → `not_selected`
     - If team is on an alliance, check playoff matches: alliance is eliminated when its 2nd loss in double-elim is recorded
   - Once a favorite is `not_selected` or `eliminated`, gray it out in the favorites list with a status badge but DON'T auto-remove (user might want to keep tracking siblings/friends)
   - Filter the schedule to only show playoff matches involving alliances containing favorites (Saturday's playoff schedule is sparse compared to Thu/Fri quals)

7. **Results / Team Progress page**
   - Second page in the app, accessed via tab switcher at the top: "Schedule" / "Results"
   - For each favorite team, shows:
     - Header: team number, name, division, current rank ("4th of 75")
     - W-L-T record (quals): big number display, e.g. "8-2-0"
     - Ranking points (quals)
     - If in playoffs: alliance number + composition + bracket status ("Upper Bracket", "Lower Bracket — 1 loss", "Eliminated", "Division Winner")
     - List of completed matches, newest first:
       - Match label (e.g. "Q47", "PO Match 3")
       - Their alliance color chip (R/B)
       - Final score: their score vs opponent score
       - Result: green W / red L / gray T pill
       - Tap to expand: show all 6 teams in match (their alliance highlighted)
   - **Color rules:** green `#16A34A` for wins, red `#DC2626` for losses, gray `#6B7280` for ties. Alliance color (red/blue) is a small chip — kept distinct from the W/L color so they don't compete visually.
   - Data sources: rankings from `/rankings/{division}` (filter to favorite team numbers), match results derived from already-fetched `/matches/{eventCode}` data
   - Refresh on the same 60s cadence as the schedule view
   - Empty state per team before their first match: "No completed matches yet"

### Stretch (after MVP)

- Elimination matches always prioritized > quals in conflict resolution
- Auto-prioritize 8044 if in favorites
- Push notifications: "Team 1234 in Curie in 10 min"
- Per-field "next 3 matches" display
- Einstein-day mode (different layout, fewer fields, treat all as must-see)
- Manual time override: "Curie just had a 20-min field reset"
- `.ics` calendar export

### Out of scope
- Scoring, EPA/result analysis (Statbotics + Venom Scout cover this)
- Picklist tools (Venom Scout)
- Video feeds
- **Einstein matches.** Once a team is `division_winner`, the app marks them and stops tracking. Einstein happens on a single stage with a published agenda — no walking-time logic needed.

---

## Drift Algorithm Detail

```javascript
async function computeFieldDrift(division) {
  const matches = await fetchCompletedMatches(division);
  if (matches.length < 2) return { drift: 0, basedOn: 0 };

  const recent = matches.slice(-5); // last 5 completed
  const drifts = recent
    .filter(m => m.actualStartTime && m.scheduledStartTime)
    .map(m => (m.actualStartTime - m.scheduledStartTime) / 1000); // seconds

  if (drifts.length === 0) return { drift: 0, basedOn: 0 };

  const sorted = [...drifts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return { drift: median, basedOn: drifts.length };
}
```

Why median and not mean: one-off field resets (concrete settling, e-stop, etc.) can show 30+ min outliers that would corrupt a mean.

---

## Data Models

```typescript
type Field =
  | 'ARCHIMEDES' | 'CURIE' | 'DALY' | 'GALILEO'
  | 'HOPPER' | 'JOHNSON' | 'MILSTEIN' | 'NEWTON'
  | 'EINSTEIN';

type Favorite = {
  teamNumber: number;
  teamName: string;
  division: Field;
  status: TeamStatus;        // derived, recomputed on each poll
  allianceNumber?: number;   // populated once selected
  allianceRole?: 'captain' | 'pick1' | 'pick2' | 'pick3' | 'backup';
};

type TeamStatus =
  | 'qualifying'
  | 'awaiting_selection'
  | 'selected'
  | 'not_selected'
  | 'eliminated'
  | 'division_winner';

type Alliance = {
  division: Field;
  number: number;            // 1-8
  captain: number;           // team number
  picks: number[];           // round1, round2, round3 picks
  backup?: number;
  eliminated: boolean;       // derived from playoff results
  losses: number;            // 0, 1, or 2 (eliminated at 2)
};

type Match = {
  matchNumber: number;
  level: 'qual' | 'playoff' | 'einstein';
  field: Field;
  scheduledStart: Date;
  actualStart?: Date;
  actualEnd?: Date;
  redAlliance: number[];   // team numbers
  blueAlliance: number[];
  redScore?: number;       // null until match completes
  blueScore?: number;
  myFavorites: number[];   // intersection with favorites list
};

type Ranking = {
  division: Field;
  teamNumber: number;
  rank: number;
  totalTeams: number;
  wins: number;
  losses: number;
  ties: number;
  rankingPoints: number;
  averageMatchPoints?: number;
};

type MatchResult = {
  match: Match;
  teamNumber: number;
  alliance: 'red' | 'blue';
  outcome: 'W' | 'L' | 'T';
  ourScore: number;
  theirScore: number;
};

type TeamProgress = {
  favorite: Favorite;
  ranking?: Ranking;            // null before first match completes
  qualResults: MatchResult[];   // sorted newest-first
  playoffResults: MatchResult[];
  bracketStatus?: 'upper' | 'lower_1L' | 'eliminated' | 'winner';
};

type FieldDrift = {
  field: Field;
  driftSeconds: number;    // positive = late, negative = early
  basedOn: number;
  computedAt: Date;
};

type ScheduleEntry = {
  match: Match;
  adjustedStart: Date;
  walkFromPrevious?: number;
  feasible: boolean;
  suggested: boolean;
  conflictReason?: string;
};
```

---

## UI Notes

- **Two pages, tab-based.** "Schedule" (default) and "Results" tabs at the top of the app, sticky. No URL routing needed — just a single piece of state in `App.tsx`. Both pages share the same fetched data; the tab just changes the lens.
- **Mobile-first.** Phones in stands. Test at 375px viewport width.
- **Colors:** LSU Purple `#461D7C` and Gold `#FDD023` as Venom brand. Red `#DC2626` for conflicts and losses, green `#16A34A` for feasible and wins, amber `#F59E0B` for tight, gray `#6B7280` for ties and inactive states.
- **Top of screen, always visible:** current time (large), next 1-2 matches in suggested path as huge cards (Schedule tab only).
- **Below (Schedule tab):** full chronological timeline grouped by hour, with field drift pills at section headers.
- **Field drift pills** prominent. People will glance at this constantly.
- **Add favorite:** sticky button at bottom, opens search modal.
- **Favorites list status badges (Saturday):**
  - `selected` → small purple pill: "Alliance 3 · Pick 1"
  - `not_selected` → gray pill: "Not selected" + dim card
  - `eliminated` → gray pill: "Eliminated" + dim card
  - `division_winner` → gold pill: "Division Winner →  Einstein"
  - Eliminated/not-selected favorites stay in the list but visually demote (50% opacity, no upcoming-match callout)
- **Results tab layout:** one collapsible card per favorite. Card header shows team number, name, rank, and big W-L-T. Tap to expand match list. Default state: top 3 favorites expanded, rest collapsed. Sort favorites by: in-playoffs first, then qualifying (by rank), then eliminated/not-selected last.
- **Match result row:** match label · alliance chip (R or B) · "120 — 98" score · W/L/T pill. Compact, scannable.

---

## Architecture / File Layout

```
src/
  api/
    frc.ts              # FRC API client w/ auth, retry, error handling
    cors-test.ts        # one-time CORS check + fallback to FB Function proxy
  state/
    favorites.ts        # localStorage hook for favorites
    schedule.ts         # localStorage hook for cached schedule
    walkTimes.ts        # localStorage hook for editable walk-time matrix
    rankings.ts         # localStorage hook for cached rankings
  logic/
    drift.ts            # per-field drift computation
    conflicts.ts        # walk feasibility + greedy path
    walking.ts          # walkMinutes() function + matrix
    progress.ts         # MatchResult derivation + bracket status from playoff matches
  components/
    TabBar.tsx          # Schedule / Results switcher
    TeamSearch.tsx
    FavoritesList.tsx
    Timeline.tsx              # Schedule tab
    MatchCard.tsx
    FieldDriftPill.tsx
    WalkTimeEditor.tsx
    ResultsList.tsx           # Results tab — list of TeamProgressCard
    TeamProgressCard.tsx      # collapsible per-team card
    MatchResultRow.tsx        # one row in the match result list
  App.tsx
  main.tsx
firebase.json           # hosting config (likely a new site target)
.env.local              # VITE_FRC_USER, VITE_FRC_TOKEN (gitignored)
```

---

## Open Questions to Resolve During Build

1. **Daniel's division for 2026.** Auto-detect by searching team 8044 across the 8 division rosters on first load.
2. **Hosting target.** New Firebase Hosting site vs path on existing scouting site? Confirm w/ Daniel before `firebase deploy`.
3. **Favorites sync across devices.** Not in MVP. Flag for v2 — if multiple mentors want a shared list, Firestore makes sense.
4. **CORS reality.** Test on first run. If blocked, deploy proxy Function — keep the function code simple, single endpoint, identical request shape.

---

## What Good Looks Like

End of build: Daniel scans QR with phone, app loads in <2 sec, he taps "Add favorite" and types `1678` → app says "Citrus Circuits is in Newton" → adds to list. Repeats for 10 teams. **Schedule tab** shows all 30+ matches sorted by time, color-coded by feasibility, with a "Suggested path: 24 of 30 matches" toggle at top. Field drift pills show actual current schedule status. **Results tab** shows each favorite's W-L record, division rank, and match-by-match scores with green/red W/L coloring. Refreshes silently every 60s. Works offline. Whole team uses it Thursday morning, then Saturday morning the favorites list auto-updates with alliance selection results — picked teams show their alliance number, not-selected teams visually demote.
