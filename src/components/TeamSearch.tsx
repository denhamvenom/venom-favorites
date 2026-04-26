import { useState } from 'react';
import { findTeamDivision } from '../api/divisionLookup';
import { logger } from '../lib/logger';
import type { Favorite } from '../types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (favorite: Favorite) => boolean;
  alreadyFavorited: (teamNumber: number) => boolean;
}

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching'; teamNumber: number }
  | { kind: 'found'; favorite: Favorite }
  | { kind: 'not-found'; teamNumber: number }
  | { kind: 'duplicate'; teamNumber: number }
  | { kind: 'error'; message: string };

export default function TeamSearch({ open, onClose, onAdd, alreadyFavorited }: Props) {
  const [input, setInput] = useState('');
  const [state, setState] = useState<LookupState>({ kind: 'idle' });

  if (!open) return null;

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const teamNumber = Number.parseInt(input.trim(), 10);
    if (!Number.isFinite(teamNumber) || teamNumber <= 0) {
      setState({ kind: 'error', message: 'Enter a valid team number' });
      return;
    }
    if (alreadyFavorited(teamNumber)) {
      setState({ kind: 'duplicate', teamNumber });
      return;
    }
    setState({ kind: 'searching', teamNumber });
    try {
      const match = await findTeamDivision(teamNumber);
      if (!match) {
        setState({ kind: 'not-found', teamNumber });
        return;
      }
      const favorite: Favorite = {
        teamNumber: match.team.teamNumber,
        teamName: match.team.nameShort ?? match.team.nameFull ?? `Team ${match.team.teamNumber}`,
        division: match.division,
        status: 'qualifying',
      };
      setState({ kind: 'found', favorite });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('app', 'team search failed', { msg });
      setState({ kind: 'error', message: msg });
    }
  }

  function commit() {
    if (state.kind !== 'found') return;
    const ok = onAdd(state.favorite);
    if (ok) {
      setInput('');
      setState({ kind: 'idle' });
      onClose();
    } else {
      setState({ kind: 'duplicate', teamNumber: state.favorite.teamNumber });
    }
  }

  function reset() {
    setInput('');
    setState({ kind: 'idle' });
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-gold">Add Favorite</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <form onSubmit={search} className="px-5 py-4">
          <label htmlFor="team-num" className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
            Team Number
          </label>
          <div className="flex gap-2">
            <input
              id="team-num"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              className="flex-1 bg-neutral-950 border border-neutral-700 focus:border-gold rounded-lg px-3 py-2 text-lg font-mono outline-none"
              placeholder="e.g. 1678"
            />
            <button
              type="submit"
              className="bg-purple hover:bg-purple-light px-4 rounded-lg font-bold transition-colors disabled:opacity-50"
              disabled={state.kind === 'searching' || !input.trim()}
            >
              {state.kind === 'searching' ? '…' : 'Search'}
            </button>
          </div>
        </form>

        <div className="px-5 pb-5 min-h-[5rem]">
          {state.kind === 'idle' && (
            <p className="text-xs text-neutral-500">
              Searches all 8 division rosters in parallel.
            </p>
          )}
          {state.kind === 'searching' && (
            <p className="text-sm text-neutral-400">Searching 8 divisions for team {state.teamNumber}…</p>
          )}
          {state.kind === 'found' && (
            <div>
              <div className="bg-purple/30 border border-purple-light rounded-lg p-3 mb-3">
                <div className="text-xs uppercase tracking-wider text-neutral-400">Team {state.favorite.teamNumber}</div>
                <div className="text-lg font-bold text-neutral-100">{state.favorite.teamName}</div>
                <div className="text-sm text-gold mt-1">in {state.favorite.division}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={commit}
                  className="flex-1 bg-feasible hover:opacity-90 text-white font-bold py-2 rounded-lg transition-opacity"
                >
                  Add to favorites
                </button>
                <button
                  onClick={reset}
                  className="px-4 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {state.kind === 'not-found' && (
            <div className="text-sm text-tight">
              Team {state.teamNumber} is not at the 2026 Championship in any division.
            </div>
          )}
          {state.kind === 'duplicate' && (
            <div className="text-sm text-tight">
              Team {state.teamNumber} is already in your favorites.
            </div>
          )}
          {state.kind === 'error' && (
            <div className="text-sm text-loss">{state.message}</div>
          )}
        </div>
      </div>
    </div>
  );
}
