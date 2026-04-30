import { useEffect, useState } from 'react';
import { logger, type LogEntry } from '../lib/logger';
import {
  compareFrcVsTba,
  fetchTbaDivisionMatches,
  tbaConfigured,
  type TbaComparison,
} from '../api/tba';
import type { Field, Match } from '../types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  matches: Match[];
  divisions: Field[];
}

const PHASES = ['A', 'B', 'C', 'D', 'E'] as const;
const PHASE_DESCRIPTIONS: Record<(typeof PHASES)[number], string> = {
  A: 'Rosters only — pre-event',
  B: 'Quals running — about half played',
  C: 'Quals complete, awaiting alliances',
  D: 'Alliances picked, playoffs scheduled',
  E: 'Full event replay (Saturday end)',
};

export default function DiagnosticsPanel({ open, onClose, matches, divisions }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [tbaResults, setTbaResults] = useState<TbaComparison[] | null>(null);
  const [tbaLoading, setTbaLoading] = useState(false);
  const [tbaError, setTbaError] = useState<string | null>(null);

  async function runTbaCheck() {
    setTbaLoading(true);
    setTbaError(null);
    setTbaResults(null);
    try {
      const out: TbaComparison[] = [];
      for (const d of divisions) {
        const tbaMatches = await fetchTbaDivisionMatches(d);
        const frcInDiv = matches.filter((m) => m.field === d);
        out.push(compareFrcVsTba(d, frcInDiv, tbaMatches));
      }
      setTbaResults(out);
    } catch (err) {
      setTbaError(err instanceof Error ? err.message : String(err));
    } finally {
      setTbaLoading(false);
    }
  }
  // Read once on mount — we reload the page after toggling, so no live updates needed.
  const override =
    typeof localStorage !== 'undefined' ? localStorage.getItem('dataSourceOverride') : null;
  const phase =
    typeof localStorage !== 'undefined' ? localStorage.getItem('fixturePhase') : null;

  useEffect(() => {
    if (!open) return;
    setEntries(logger.snapshot());
    const id = setInterval(() => setEntries(logger.snapshot()), 500);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;

  const dataSource = import.meta.env.VITE_DATA_SOURCE ?? 'live';

  function setLive() {
    localStorage.removeItem('dataSourceOverride');
    localStorage.removeItem('fixturePhase');
    location.reload();
  }
  function setDemo(p: (typeof PHASES)[number]) {
    localStorage.setItem('dataSourceOverride', 'fixture');
    localStorage.setItem('fixturePhase', p);
    location.reload();
  }
  const inDemo = override === 'fixture';

  return (
    <div className="fixed inset-0 z-50 bg-white/95 dark:bg-black/95 text-neutral-900 dark:text-neutral-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="text-sm font-bold text-gold">Diagnostics</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-500">
            source: {inDemo ? `fixture: ${phase ?? 'E'}` : dataSource} · {entries.length} entries
          </div>
        </div>
        <button onClick={onClose} className="text-sm bg-purple px-3 py-1 rounded hover:bg-purple-light">
          Close
        </button>
      </header>

      {/* Demo Mode */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 bg-neutral-50 dark:bg-neutral-950">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-500">Data Source</div>
            <div className="text-[10px] text-neutral-500 dark:text-neutral-600 mt-0.5">
              Demo replays the 2025 Championship at the chosen point in time. Live polls the actual 2026 API.
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={setLive}
            className={`px-3 py-2 rounded font-bold text-sm transition-colors ${!inDemo ? 'bg-feasible text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-feasible border border-neutral-300 dark:border-neutral-700'}`}
          >
            ● Live
          </button>
          {PHASES.map((p) => {
            const active = inDemo && phase === p;
            return (
              <button
                key={p}
                onClick={() => setDemo(p)}
                className={`px-3 py-2 rounded font-bold text-sm transition-colors ${active ? 'bg-gold text-neutral-900 dark:text-neutral-900' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-gold border border-neutral-300 dark:border-neutral-700'}`}
                title={PHASE_DESCRIPTIONS[p]}
              >
                Demo {p}
              </button>
            );
          })}
        </div>
        {inDemo && phase && (
          <div className="mt-2 text-[11px] text-gold/80">
            Demo {phase}: {PHASE_DESCRIPTIONS[phase as (typeof PHASES)[number]]}
          </div>
        )}
      </div>

      {/* TBA Verification */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-500">TBA Cross-Check</div>
            <div className="text-[10px] text-neutral-500 dark:text-neutral-600 mt-0.5">
              Compare FRC API match data against The Blue Alliance's authoritative event data.
            </div>
          </div>
          <button
            onClick={runTbaCheck}
            disabled={tbaLoading || !tbaConfigured() || divisions.length === 0}
            className="px-3 py-2 rounded font-bold text-sm bg-purple text-white hover:bg-purple-light disabled:opacity-50"
          >
            {tbaLoading ? 'checking…' : 'Verify with TBA'}
          </button>
        </div>
        {!tbaConfigured() && (
          <div className="text-[11px] text-tight">
            Set <span className="font-mono">VITE_TBA_API_KEY</span> in <span className="font-mono">.env</span> to enable.
          </div>
        )}
        {tbaError && <div className="text-[11px] text-loss">Error: {tbaError}</div>}
        {tbaResults && (
          <div className="mt-2 space-y-1 text-[11px]">
            {tbaResults.map((r) => (
              <div key={r.division} className="flex items-center gap-2">
                <span className="font-bold text-gold w-24">{r.division}</span>
                <span className={r.mismatches === 0 ? 'text-feasible' : 'text-loss'}>
                  {r.mismatches} mismatch{r.mismatches === 1 ? '' : 'es'}
                </span>
                <span className="text-neutral-500">
                  · FRC {r.totalFrc} qual / TBA {r.totalTba} qual
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {entries.length === 0 && (
          <div className="text-neutral-500 dark:text-neutral-500 px-4 py-6">No log entries yet.</div>
        )}
        {entries.map((e, i) => (
          <div
            key={i}
            className={`px-4 py-1 border-b border-neutral-100 dark:border-neutral-900 ${e.level === 'error' ? 'text-loss' : e.level === 'warn' ? 'text-tight' : e.level === 'debug' ? 'text-neutral-500 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-200'}`}
          >
            <span className="text-neutral-500 dark:text-neutral-500">{new Date(e.timestamp).toLocaleTimeString()}</span>{' '}
            <span className="text-purple-light">[{e.tag}]</span> {e.message}
            {e.data !== undefined && (
              <span className="text-neutral-500 dark:text-neutral-400"> · {JSON.stringify(e.data)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
