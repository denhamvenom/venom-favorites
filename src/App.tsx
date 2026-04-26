import { useEffect, useRef, useState } from 'react';
import { ensureCorsTested } from './api/corsTest';
import { findTeamDivision } from './api/divisionLookup';
import { getDataSource } from './api/frc';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import FavoritesList from './components/FavoritesList';
import TeamSearch from './components/TeamSearch';
import { logger } from './lib/logger';
import { useFavorites } from './state/favorites';
import type { Field } from './types/domain';

const TEAM_NUMBER = 8044;

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const [division, setDivision] = useState<Field | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const versionTapsRef = useRef(0);
  const versionTapResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { favorites, add, remove, has } = useFavorites();

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

  function tapVersion() {
    versionTapsRef.current += 1;
    if (versionTapsRef.current >= 5) {
      versionTapsRef.current = 0;
      setDiagOpen(true);
      return;
    }
    // Reset tap counter after 1.5s of inactivity so casual taps don't accumulate.
    if (versionTapResetRef.current) clearTimeout(versionTapResetRef.current);
    versionTapResetRef.current = setTimeout(() => {
      versionTapsRef.current = 0;
    }, 1500);
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="px-4 pt-4 pb-2 border-b border-neutral-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gold leading-tight">Worlds Watcher</h1>
            <p className="text-xs text-neutral-500">FRC 8044 · Denham Venom{division ? ` · ${division}` : ''}</p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-neutral-500">now</div>
            <div className="text-base font-mono">{now.toLocaleTimeString()}</div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wider text-neutral-400">My Favorites</h2>
            <span className="text-xs text-neutral-500">{favorites.length}</span>
          </div>
          <FavoritesList favorites={favorites} onRemove={remove} />
        </section>
      </main>

      <button
        onClick={() => setSearchOpen(true)}
        className="fixed bottom-6 right-6 z-30 bg-purple hover:bg-purple-light text-white font-bold px-5 py-3 rounded-full shadow-2xl border border-purple-light"
        aria-label="Add favorite"
      >
        + Add Favorite
      </button>

      <footer className="px-4 py-2 border-t border-neutral-900 text-center">
        <button
          onClick={tapVersion}
          className="text-[10px] uppercase tracking-widest text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          v0.1.0 · {getDataSource()}
        </button>
      </footer>

      <TeamSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onAdd={add}
        alreadyFavorited={has}
      />
      <DiagnosticsPanel open={diagOpen} onClose={() => setDiagOpen(false)} />
    </div>
  );
}
