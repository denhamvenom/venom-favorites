import { useEffect, useState } from 'react';
import { logger } from './lib/logger';

export default function App() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    logger.info('app', 'mount', { dataSource: import.meta.env.VITE_DATA_SOURCE ?? 'live' });
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold text-gold mb-2">Worlds Watcher</h1>
      <p className="text-neutral-400 mb-8">FRC 8044 · Denham Venom</p>
      <div className="bg-purple/20 border border-purple-light rounded-lg px-6 py-4 text-center">
        <div className="text-xs uppercase tracking-wider text-neutral-500">scaffold ok</div>
        <div className="text-2xl font-mono mt-1">{now.toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
