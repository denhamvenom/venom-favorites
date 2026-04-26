import { useMemo, useState } from 'react';
import { fullMatrix, walkMinutes, type WalkOverrides } from '../logic/walking';
import type { Field } from '../types/domain';

const FIELDS: Field[] = [
  'ARCHIMEDES',
  'CURIE',
  'DALY',
  'GALILEO',
  'HOPPER',
  'JOHNSON',
  'MILSTEIN',
  'NEWTON',
];

interface Props {
  open: boolean;
  onClose: () => void;
  overrides: WalkOverrides;
  setOverride: (from: Field, to: Field, minutes: number | null) => void;
  reset: () => void;
}

export default function WalkTimeEditor({ open, onClose, overrides, setOverride, reset }: Props) {
  const [editing, setEditing] = useState<{ from: Field; to: Field } | null>(null);
  const [draft, setDraft] = useState('');

  const matrix = useMemo(() => fullMatrix(overrides), [overrides]);

  if (!open) return null;

  function startEdit(from: Field, to: Field) {
    if (from === to) return;
    setEditing({ from, to });
    setDraft(String(matrix[from][to]));
  }

  function commit() {
    if (!editing) return;
    const n = Number.parseInt(draft, 10);
    if (Number.isFinite(n) && n >= 0) {
      const def = walkMinutes(editing.from, editing.to);
      setOverride(editing.from, editing.to, n === def ? null : n);
    }
    setEditing(null);
    setDraft('');
  }

  function isOverride(from: Field, to: Field): boolean {
    if (from === to) return false;
    return overrides[from]?.[to] !== undefined || overrides[to]?.[from] !== undefined;
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between sticky top-0 bg-neutral-900 z-10">
          <div>
            <h2 className="text-base font-bold text-gold">Walk Times</h2>
            <p className="text-xs text-neutral-500">Tap a cell to edit. Symmetric — A → B equals B → A.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="text-xs px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            >
              Reset
            </button>
            <button
              onClick={onClose}
              className="text-xs px-3 py-1 rounded bg-purple hover:bg-purple-light"
            >
              Close
            </button>
          </div>
        </header>
        <div className="p-3 overflow-x-auto">
          <table className="border-collapse text-xs font-mono">
            <thead>
              <tr>
                <th className="p-1"></th>
                {FIELDS.map((f) => (
                  <th key={f} className="p-1 text-neutral-500 uppercase tracking-wider text-[10px]">
                    {f.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((from) => (
                <tr key={from}>
                  <th className="p-1 text-right text-neutral-500 uppercase tracking-wider text-[10px]">
                    {from.slice(0, 3)}
                  </th>
                  {FIELDS.map((to) => {
                    const isSelf = from === to;
                    const isEditing = editing?.from === from && editing.to === to;
                    const value = matrix[from][to];
                    const overridden = isOverride(from, to);
                    return (
                      <td key={to} className="p-0.5">
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commit();
                              else if (e.key === 'Escape') {
                                setEditing(null);
                                setDraft('');
                              }
                            }}
                            className="w-10 h-9 text-center bg-purple/40 border border-purple-light text-gold font-bold rounded outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => startEdit(from, to)}
                            disabled={isSelf}
                            className={`w-10 h-9 rounded transition-colors ${
                              isSelf
                                ? 'bg-neutral-950 text-neutral-700'
                                : overridden
                                  ? 'bg-gold/20 text-gold hover:bg-gold/30 border border-gold/40'
                                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                            }`}
                          >
                            {value}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-neutral-500">
            Default formula: ~1.5 min/hop, clamped 2–10. +2 min settle buffer is added on top.
          </p>
        </div>
      </div>
    </div>
  );
}
