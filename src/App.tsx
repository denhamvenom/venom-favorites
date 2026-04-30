import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureCorsTested } from './api/corsTest';
import { findTeamDivision } from './api/divisionLookup';
import { getDataSource } from './api/frc';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import FavoritesList from './components/FavoritesList';
import ResultsList from './components/ResultsList';
import TabBar, { type Tab } from './components/TabBar';
import TeamSearch from './components/TeamSearch';
import Timeline from './components/Timeline';
import TopBar from './components/TopBar';
import WalkTimeEditor from './components/WalkTimeEditor';
import { logger } from './lib/logger';
import { planSchedule, summarize } from './logic/conflicts';
import { deriveStatus, type RawAlliance } from './logic/status';
import { useFavorites } from './state/favorites';
import { useRankings } from './state/rankings';
import { useSchedule } from './state/schedule';
import { useTheme } from './state/theme';
import { useWalkTimes } from './state/walkTimes';
import { useSwUpdate } from './state/swUpdate';
import { useWatching } from './state/watching';
import { effectiveCycleMin } from './logic/cycle';
import { DEFAULT_CYCLE_TIME_MIN } from './logic/walking';
import type { Field, FieldCycle, FieldDrift } from './types/domain';

const TEAM_NUMBER = 8044;

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState<Tab>('schedule');
  const [division, setDivision] = useState<Field | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [walkEditorOpen, setWalkEditorOpen] = useState(false);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [showSuggestedOnly, setShowSuggestedOnly] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem('favorites-section-open/v1') !== 'false';
  });
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('favorites-section-open/v1', favoritesOpen ? 'true' : 'false');
    }
  }, [favoritesOpen]);
  const versionTapsRef = useRef(0);
  const versionTapResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { favorites, add, remove, has, update, setSuper, superTeamNumber } = useFavorites();
  const { theme, toggle: toggleTheme } = useTheme();
  const { overrides, setOverride, cycleOverrideMin, setCycleOverrideMin, reset: resetWalkTimes } =
    useWalkTimes();
  const {
    matches,
    drifts,
    cycles,
    alliancesByDivision,
    fetchedAt,
    loading,
    refresh: refreshSchedule,
  } = useSchedule(favorites, { defaultCycleTimeMin: cycleOverrideMin ?? undefined });
  const { rankings, refresh: refreshRankings } = useRankings(favorites);
  const favoriteTeamNumberSet = useMemo(
    () => new Set(favorites.map((f) => f.teamNumber)),
    [favorites],
  );
  const { watching, lastLocation, setWatching } = useWatching(matches, favoriteTeamNumberSet);
  const { needRefresh: swNeedsRefresh, reload: reloadForSw } = useSwUpdate();
  useEffect(() => {
    if (!swNeedsRefresh) return;
    const id = setTimeout(reloadForSw, 3000);
    return () => clearTimeout(id);
  }, [swNeedsRefresh, reloadForSw]);

  function refreshAll() {
    void refreshSchedule();
    void refreshRankings();
    logger.info('app', 'manual refresh triggered');
  }

  // Saturday Mode: derive each favorite's status from latest alliances + playoff results
  // and persist when it changes. Drives status badges in FavoritesList.
  useEffect(() => {
    for (const fav of favorites) {
      const alliancesEnv = alliancesByDivision[fav.division];
      const alliances: RawAlliance[] = alliancesEnv?.Alliances ?? [];
      const inputs = {
        qualMatches: matches.filter((m) => m.field === fav.division && m.level === 'qual'),
        playoffMatches: matches.filter((m) => m.field === fav.division && m.level === 'playoff'),
        alliances,
      };
      const derived = deriveStatus(fav, inputs);
      const changed =
        fav.status !== derived.status ||
        fav.allianceNumber !== derived.allianceNumber ||
        fav.allianceRole !== derived.allianceRole;
      if (changed) {
        update(fav.teamNumber, {
          status: derived.status,
          allianceNumber: derived.allianceNumber,
          allianceRole: derived.allianceRole,
        });
        logger.info('status', `${fav.teamNumber}: ${fav.status} → ${derived.status}`, {
          allianceNumber: derived.allianceNumber,
          allianceRole: derived.allianceRole,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites, alliancesByDivision, matches]);

  const driftMap = useMemo(() => {
    const m = new Map<string, FieldDrift>();
    for (const d of drifts) m.set(d.field, d);
    return m;
  }, [drifts]);

  const cycleMap = useMemo(() => {
    const m = new Map<string, FieldCycle>();
    for (const c of cycles) m.set(c.field, c);
    return m;
  }, [cycles]);

  // Build the planner anchor from watching (active) or lastLocation (memory).
  const anchor = useMemo(() => {
    if (watching) {
      const m = matches.find(
        (x) =>
          x.field === watching.field && x.level === watching.level && x.matchNumber === watching.matchNumber,
      );
      if (!m) return undefined;
      const driftSec = driftMap.get(m.field)?.driftSeconds ?? 0;
      const cycleMin = effectiveCycleMin(m.field, cycleMap, cycleOverrideMin ?? DEFAULT_CYCLE_TIME_MIN);
      const busyUntil = new Date(m.scheduledStart.getTime() + driftSec * 1000 + cycleMin * 60_000);
      return { field: m.field, busyUntil, label: `Q${m.matchNumber}` };
    }
    if (lastLocation) return { field: lastLocation.field };
    return undefined;
  }, [watching, lastLocation, matches, driftMap, cycleMap, cycleOverrideMin]);

  const entries = useMemo(
    () =>
      planSchedule(matches, driftMap, {
        overrides,
        now,
        superFavorite: superTeamNumber,
        cycles: cycleMap,
        defaultCycleTimeMin: cycleOverrideMin ?? undefined,
        anchor,
      }),
    [matches, driftMap, overrides, now, superTeamNumber, cycleMap, cycleOverrideMin, anchor],
  );
  const summary = useMemo(
    () => summarize(entries, driftMap, overrides, cycleMap, cycleOverrideMin ?? undefined),
    [entries, driftMap, overrides, cycleMap, cycleOverrideMin],
  );

  // Map from each favorite's alliance to all team numbers in it (for Saturday
  // playoff filter — we want to see matches involving alliance-mates, not just
  // the literal favorite team numbers).
  const favoriteAllianceTeams = useMemo(() => {
    const out = new Set<number>();
    for (const fav of favorites) {
      out.add(fav.teamNumber);
      const env = alliancesByDivision[fav.division];
      const alliance = env?.Alliances?.find(
        (a) =>
          a.captain === fav.teamNumber ||
          a.round1 === fav.teamNumber ||
          a.round2 === fav.teamNumber ||
          a.round3 === fav.teamNumber ||
          a.backup === fav.teamNumber,
      );
      if (alliance) {
        for (const v of [alliance.captain, alliance.round1, alliance.round2, alliance.round3, alliance.backup]) {
          if (typeof v === 'number') out.add(v);
        }
      }
    }
    return out;
  }, [favorites, alliancesByDivision]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const source = getDataSource();
    logger.info('app', 'mount', { dataSource: source });
    let cancelled = false;
    (async () => {
      await ensureCorsTested();
      try {
        const match = await findTeamDivision(TEAM_NUMBER);
        if (cancelled) return;
        if (match) {
          logger.info('app', `team ${TEAM_NUMBER} found in ${match.division}`, { team: match.team });
          setDivision(match.division);
        } else {
          logger.warn('app', `team ${TEAM_NUMBER} not found in any division roster`);
        }
      } catch (err) {
        if (cancelled) return;
        logger.error('app', 'auto-detect failed', {
          msg: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Shared between TopBar (Next Up + Watching now) and Timeline (full schedule)
  // so the user can toggle watching from any card without scrolling.
  function toggleWatchingMatch(m: import('./types/domain').Match) {
    if (
      watching &&
      watching.field === m.field &&
      watching.level === m.level &&
      watching.matchNumber === m.matchNumber
    ) {
      setWatching(null);
    } else {
      setWatching({
        field: m.field,
        level: m.level,
        matchNumber: m.matchNumber,
        since: Date.now(),
      });
    }
  }

  function tapVersion() {
    versionTapsRef.current += 1;
    if (versionTapsRef.current >= 5) {
      versionTapsRef.current = 0;
      setDiagOpen(true);
      return;
    }
    if (versionTapResetRef.current) clearTimeout(versionTapResetRef.current);
    versionTapResetRef.current = setTimeout(() => {
      versionTapsRef.current = 0;
    }, 1500);
  }

  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col">
      <header className="px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-900 sticky top-0 bg-neutral-50 dark:bg-neutral-950 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gold leading-tight">Worlds Watcher</h1>
            <p className="text-xs text-neutral-500">FRC 8044 · Denham Venom{division ? ` · ${division}` : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="text-xl leading-none w-9 h-9 flex items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800 hover:border-gold transition-colors"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">now</div>
              <div className="text-base font-mono">
                {now.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZone: 'America/Chicago',
                })}
              </div>
            </div>
          </div>
        </div>
      </header>
      <TabBar active={tab} onChange={setTab} />

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-6">
        {tab === 'schedule' && (
          <>
            <TopBar
              now={now}
              matches={matches}
              drifts={drifts}
              favorites={favorites}
              superTeamNumber={superTeamNumber}
              watching={watching}
              onToggleWatching={toggleWatchingMatch}
            />

            <section>
              <button
                onClick={() => setFavoritesOpen((v) => !v)}
                className="w-full flex items-center justify-between mb-2 text-left"
                aria-expanded={favoritesOpen}
                aria-controls="favorites-section-body"
              >
                <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-bold flex items-center gap-1">
                  <span className="text-neutral-500">{favoritesOpen ? '▾' : '▸'}</span>
                  My Favorites
                </h2>
                <span className="text-[10px] text-neutral-500">{favorites.length}</span>
              </button>
              {favoritesOpen && (
                <div id="favorites-section-body">
                  <FavoritesList
                    favorites={favorites}
                    onRemove={remove}
                    onToggleSuper={(teamNumber) => setSuper(teamNumber)}
                  />
                </div>
              )}
            </section>

            {entries.length > 0 && (
              <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-xs">
                    <span className="text-feasible font-bold">{summary.suggested}</span>
                    <span className="text-neutral-500"> of </span>
                    <span className="text-neutral-700 dark:text-neutral-300">{summary.total}</span>
                    <span className="text-neutral-500"> matches in suggested path</span>
                    {summary.conflicts > 0 && (
                      <span className="text-loss ml-2">· {summary.conflicts} conflict{summary.conflicts === 1 ? '' : 's'}</span>
                    )}
                    {summary.tight > 0 && (
                      <span className="text-tight ml-2">· {summary.tight} tight</span>
                    )}
                  </div>
                  <div className="flex gap-2 text-[10px] uppercase tracking-wider">
                    <button
                      onClick={() => setShowSuggestedOnly((v) => !v)}
                      className={`px-2 py-1 rounded border ${showSuggestedOnly ? 'bg-feasible/20 text-feasible border-feasible/40' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700'}`}
                    >
                      suggested only
                    </button>
                    <button
                      onClick={() => setWalkEditorOpen(true)}
                      className="px-2 py-1 rounded border bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700 hover:text-gold"
                    >
                      walk times
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-bold">Schedule</h2>
                <button
                  onClick={() => setShowAllMatches((v) => !v)}
                  className="text-[10px] uppercase tracking-wider text-purple-light hover:text-gold transition-colors"
                >
                  {showAllMatches ? 'show only mine' : 'show all matches'}
                </button>
              </div>
              <Timeline
                matches={matches}
                drifts={drifts}
                favorites={favorites}
                loading={loading}
                fetchedAt={fetchedAt}
                showOnlyFavoriteMatches={!showAllMatches}
                showSuggestedOnly={showSuggestedOnly}
                entries={entries}
                favoriteAllianceTeams={favoriteAllianceTeams}
                superTeamNumber={superTeamNumber}
                onRefresh={refreshAll}
                watching={watching}
                onToggleWatching={toggleWatchingMatch}
              />
            </section>
          </>
        )}

        {tab === 'results' && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-bold">Team Progress</h2>
              <span className="text-[10px] text-neutral-500">{favorites.length} team{favorites.length === 1 ? '' : 's'}</span>
            </div>
            <ResultsList favorites={favorites} matches={matches} rankings={rankings} />
          </section>
        )}
      </main>

      <button
        onClick={() => setSearchOpen(true)}
        className="fixed bottom-6 right-6 z-30 bg-purple hover:bg-purple-light text-white font-bold px-5 py-3 rounded-full shadow-2xl border border-purple-light"
        aria-label="Add favorite"
      >
        + Add Favorite
      </button>

      <footer className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-900 text-center">
        <button
          onClick={tapVersion}
          className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-400 transition-colors"
        >
          v0.1.0 · {getDataSource()}
        </button>
      </footer>

      <TeamSearch open={searchOpen} onClose={() => setSearchOpen(false)} onAdd={add} alreadyFavorited={has} />
      <DiagnosticsPanel
        open={diagOpen}
        onClose={() => setDiagOpen(false)}
        matches={matches}
        divisions={[...new Set(favorites.map((f) => f.division))].filter((d) => d !== 'EINSTEIN') as Field[]}
      />

      {swNeedsRefresh && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-purple text-white px-4 py-2 rounded-lg shadow-2xl text-xs uppercase tracking-wider"
        >
          New version available — reloading…
        </div>
      )}
      <WalkTimeEditor
        open={walkEditorOpen}
        onClose={() => setWalkEditorOpen(false)}
        overrides={overrides}
        setOverride={setOverride}
        cycleOverrideMin={cycleOverrideMin}
        setCycleOverrideMin={setCycleOverrideMin}
        cycles={cycles}
        reset={resetWalkTimes}
      />
    </div>
  );
}
