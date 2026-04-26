import { useEffect, useState } from 'react';
import { logger, type LogEntry } from '../lib/logger';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DiagnosticsPanel({ open, onClose }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    setEntries(logger.snapshot());
    const id = setInterval(() => setEntries(logger.snapshot()), 500);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;

  const dataSource = import.meta.env.VITE_DATA_SOURCE ?? 'live';

  return (
    <div className="fixed inset-0 z-50 bg-black/90 text-neutral-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div>
          <div className="text-sm font-bold text-gold">Diagnostics</div>
          <div className="text-xs text-neutral-500">source: {dataSource} · {entries.length} entries</div>
        </div>
        <button
          onClick={onClose}
          className="text-sm bg-purple px-3 py-1 rounded hover:bg-purple-light"
        >
          Close
        </button>
      </header>
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {entries.length === 0 && (
          <div className="text-neutral-500 px-4 py-6">No log entries yet.</div>
        )}
        {entries.map((e, i) => (
          <div
            key={i}
            className={`px-4 py-1 border-b border-neutral-900 ${e.level === 'error' ? 'text-loss' : e.level === 'warn' ? 'text-tight' : e.level === 'debug' ? 'text-neutral-500' : 'text-neutral-200'}`}
          >
            <span className="text-neutral-500">{new Date(e.timestamp).toLocaleTimeString()}</span>{' '}
            <span className="text-purple-light">[{e.tag}]</span> {e.message}
            {e.data !== undefined && (
              <span className="text-neutral-400"> · {JSON.stringify(e.data)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
