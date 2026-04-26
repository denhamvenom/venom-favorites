# Venom Favorites · FRC 8044 Worlds Match Watcher

Mobile-first PWA for tracking favorite teams across the 8 division fields at the **2026 FIRST Championship**.

**Live URL:** [https://venom-favorites.web.app](https://venom-favorites.web.app)

**QR code:** see [public/venom-favorites-qr.png](public/venom-favorites-qr.png) — print, post in pit, scan to install.

## What it does

- Add favorite teams by number → app finds which division they're in
- Aggregates scheduled + live qual + playoff matches into one chronological timeline
- Per-field drift pills (median over last 5 completed) so the schedule reflects reality
- Walk-time-aware conflict detection between consecutive favorite matches
- "Suggested path" greedy planner that picks a feasible itinerary
- Saturday Mode: alliance selection + bracket status auto-update
- Results tab: per-team W-L-T, ranking, match-by-match scores

## Run locally

```bash
npm install
npm run dev
```

Provide `VITE_FRC_USER` and `VITE_FRC_TOKEN` in `.env.local` (FRC API basic auth credentials — see SPEC.md).

For testing without live data, use the 2025 Championship fixture replay:

```bash
npm run dev:fixture                          # default phase E (full replay)
VITE_FIXTURE_PHASE=B npm run dev:fixture     # phase A–E progression
```

## Build

```bash
npm run build
firebase deploy --only hosting:venom-favorites
```

## Tech

React 19 + Vite + TypeScript + Tailwind + `vite-plugin-pwa`. Firebase Hosting on `scouting-system-352a4`.

## Repo structure

See [CLAUDE.md](CLAUDE.md) for architecture map and testing protocol.
