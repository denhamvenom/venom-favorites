import { useState } from 'react';
import type { Favorite, MatchResult } from '../types/domain';

interface Props {
  result: MatchResult;
  favorites: Favorite[];
}

export default function MatchResultRow({ result, favorites }: Props) {
  const [open, setOpen] = useState(false);
  const { match, alliance, outcome, ourScore, theirScore } = result;
  const labelPrefix = match.level === 'qual' ? 'Q' : match.level === 'playoff' ? 'PO ' : 'E';
  const allianceClass = alliance === 'red' ? 'bg-alliance-red/30 text-alliance-red' : 'bg-alliance-blue/30 text-alliance-blue';
  const outcomeClass =
    outcome === 'W'
      ? 'bg-feasible/20 text-feasible'
      : outcome === 'L'
        ? 'bg-loss/20 text-loss'
        : 'bg-tie/20 text-tie';
  const myAlliance = alliance === 'red' ? match.redAlliance : match.blueAlliance;
  const otherAlliance = alliance === 'red' ? match.blueAlliance : match.redAlliance;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-2 px-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-left"
      >
        <span className="font-mono text-sm w-12 shrink-0 text-neutral-700 dark:text-neutral-300">
          {labelPrefix}
          {match.matchNumber}
        </span>
        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${allianceClass}`}>
          {alliance.charAt(0).toUpperCase()}
        </span>
        <span className="flex-1 font-mono text-sm tabular-nums">
          <span className="text-neutral-900 dark:text-neutral-100">{ourScore}</span>
          <span className="text-neutral-500 dark:text-neutral-500"> — </span>
          <span className="text-neutral-500 dark:text-neutral-400">{theirScore}</span>
        </span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${outcomeClass}`}>{outcome}</span>
      </button>
      {open && (
        <div className="px-2 pb-2 -mt-1 text-[11px] font-mono">
          <div className="text-alliance-red mb-0.5">
            <span className="font-bold uppercase tracking-wider mr-1">R</span>
            <Teams teams={match.redAlliance} mine={alliance === 'red' ? new Set(myAlliance) : new Set(otherAlliance)} favorites={favorites} highlight={alliance === 'red'} />
          </div>
          <div className="text-alliance-blue">
            <span className="font-bold uppercase tracking-wider mr-1">B</span>
            <Teams teams={match.blueAlliance} mine={alliance === 'blue' ? new Set(myAlliance) : new Set(otherAlliance)} favorites={favorites} highlight={alliance === 'blue'} />
          </div>
        </div>
      )}
    </div>
  );
}

function Teams({
  teams,
  mine,
  favorites,
  highlight,
}: {
  teams: number[];
  mine: Set<number>;
  favorites: Favorite[];
  highlight: boolean;
}) {
  return (
    <span className="text-neutral-700 dark:text-neutral-300">
      {teams.map((t, i) => {
        const fav = favorites.find((f) => f.teamNumber === t);
        const cls = fav ? 'text-gold font-bold' : highlight && mine.has(t) ? 'text-neutral-900 dark:text-neutral-100' : '';
        return (
          <span key={t}>
            <span className={cls} title={fav?.teamName}>{t}</span>
            {i < teams.length - 1 && <span className="text-neutral-500 dark:text-neutral-600"> · </span>}
          </span>
        );
      })}
    </span>
  );
}
