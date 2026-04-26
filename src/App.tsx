import { useEffect, useState } from 'react';
import { ensureCorsTested } from './api/corsTest';
import { findTeamDivision } from './api/divisionLookup';
import { getDataSource } from './api/frc';
import { logger } from './lib/logger';
import type { Field } from './types/domain';

const TEAM_NUMBER = 8044;

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const [division, setDivision] = useState<Field | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(true);

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
          logger.warn('app', `team ${TEAM_NUMBER} not found in any 2026 division roster`);
          setLookupError('not found in any 2026 roster');
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('app', 'auto-detect failed', { msg });
        setLookupError(msg);
      } finally {
        if (!cancelled) setLookingUp(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold text-gold mb-2">Worlds Watcher</h1>
      <p className="text-neutral-400 mb-8">FRC 8044 · Denham Venom</p>
      <div className="bg-purple/20 border border-purple-light rounded-lg px-6 py-4 text-center mb-4">
        <div className="text-xs uppercase tracking-wider text-neutral-500">scaffold ok</div>
        <div className="text-2xl font-mono mt-1">{now.toLocaleTimeString()}</div>
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-6 py-3 text-center text-sm w-full max-w-xs">
        <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">8044 division</div>
        {lookingUp && <div className="text-neutral-400">looking up…</div>}
        {!lookingUp && division && <div className="text-gold font-bold">{division}</div>}
        {!lookingUp && !division && <div className="text-loss">{lookupError ?? 'not found'}</div>}
      </div>
    </div>
  );
}
