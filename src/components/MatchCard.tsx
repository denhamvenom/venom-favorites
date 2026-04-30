import { applyDrift } from '../logic/drift';
import type { Favorite, FieldDrift, Match, ScheduleEntry } from '../types/domain';

interface Props {
  match: Match;
  drift?: FieldDrift;
  favorites: Favorite[];
  variant?: 'default' | 'next-up';
  /** Optional schedule entry — when present, drives the border color (feasible / tight / suggested / dropped). */
  entry?: ScheduleEntry;
  /** Team number of the super-favorite, if any — drives the gold ring on must-see matches. */
  superTeamNumber?: number;
  /** True if this card is the user's actively-watched match. */
  isWatching?: boolean;
  /** Toggle handler for "I'm here". When omitted, the button is hidden (e.g., next-up cards). */
  onToggleWatching?: () => void;
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Chicago',
};

export default function MatchCard({ match, drift, favorites, variant = 'default', entry, superTeamNumber, isWatching = false, onToggleWatching }: Props) {
  const adjusted = drift ? applyDrift(match.scheduledStart, drift.driftSeconds) : match.scheduledStart;
  const myFavoriteSet = new Set(match.myFavorites);
  const myAlliance: 'red' | 'blue' | null =
    match.redAlliance.some((t) => myFavoriteSet.has(t))
      ? 'red'
      : match.blueAlliance.some((t) => myFavoriteSet.has(t))
        ? 'blue'
        : null;
  const adjustedDelta =
    drift && Math.abs(drift.driftSeconds) >= 60 ? Math.round(drift.driftSeconds / 60) : 0;

  const labelPrefix = match.level === 'qual' ? 'Q' : match.level === 'playoff' ? 'PO' : 'E';
  const big = variant === 'next-up';

  const isSuperMatch =
    superTeamNumber !== undefined && match.myFavorites.includes(superTeamNumber);

  const played = match.redScore !== undefined && match.blueScore !== undefined;

  // Border priority: watching (purple) > super (gold) > infeasible (red) > suggested (green) > dropped (gray) > default.
  let borderClass = 'border-neutral-200 dark:border-neutral-800';
  let extraRing = '';
  if (isWatching) {
    borderClass = 'border-purple-light';
    extraRing = 'ring-2 ring-purple/40';
  } else if (isSuperMatch) {
    borderClass = 'border-gold/70';
    extraRing = 'ring-1 ring-gold/40';
  } else if (entry) {
    if (!entry.feasible) borderClass = 'border-loss';
    else if (entry.suggested) borderClass = 'border-feasible/60';
    else if (entry.match.myFavorites.length > 0) borderClass = 'border-tie/40 opacity-60';
  }

  // Dim already-played cards, but never override a super-match's gold ring.
  const playedDim = played && !isSuperMatch ? 'opacity-70' : '';

  return (
    <div className={`bg-white dark:bg-neutral-900 border ${borderClass} ${extraRing} ${playedDim} rounded-lg ${big ? 'p-4' : 'p-3'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className={`font-mono font-bold ${big ? 'text-2xl' : 'text-base'} text-gold`}>
            {labelPrefix}
            {match.matchNumber}
          </span>
          <span className={`uppercase tracking-wider ${big ? 'text-sm' : 'text-xs'} text-neutral-500`}>
            {match.field}
          </span>
          {myAlliance && (
            <span
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${myAlliance === 'red' ? 'bg-alliance-red/30 text-alliance-red' : 'bg-alliance-blue/30 text-alliance-blue'}`}
            >
              {myAlliance.charAt(0)}
            </span>
          )}
          {isSuperMatch && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/30 text-gold border border-gold/50">
              ★ Super
            </span>
          )}
          {played && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-tie/20 text-tie border border-tie/40">
              Already Played
            </span>
          )}
          {isWatching && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple/40 text-purple-light border border-purple-light">
              I'm watching
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={`font-mono ${big ? 'text-2xl' : 'text-base'}`}>
            {adjusted.toLocaleTimeString(undefined, TIME_FORMAT)}
          </div>
          {adjustedDelta !== 0 && (
            <div className={`text-[10px] ${adjustedDelta > 0 ? 'text-loss' : 'text-tight'}`}>
              {adjustedDelta > 0 ? '+' : ''}
              {adjustedDelta} min vs schedule
            </div>
          )}
        </div>
      </div>
      <TeamRow alliance="red" teams={match.redAlliance} myFavorites={myFavoriteSet} favorites={favorites} played={played} />
      <TeamRow alliance="blue" teams={match.blueAlliance} myFavorites={myFavoriteSet} favorites={favorites} played={played} />
      {match.redScore !== undefined && match.blueScore !== undefined && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 text-xs">
          <span className="text-alliance-red font-mono">{match.redScore}</span>
          <span className="text-neutral-500">final</span>
          <span className="text-alliance-blue font-mono">{match.blueScore}</span>
        </div>
      )}
      {entry && !entry.feasible && entry.conflictReason && (
        <div className="mt-2 pt-2 border-t border-loss/30 text-[11px] text-loss">
          🔴 {entry.conflictReason}
        </div>
      )}
      {entry && entry.feasible && entry.walkFromPrevious !== undefined && entry.walkFromPrevious > 0 && (
        <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500">
          {entry.walkFromPrevious} min walk from prev
        </div>
      )}
      {onToggleWatching && !played && (
        <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onToggleWatching}
            className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
              isWatching
                ? 'bg-purple/30 text-purple-light border-purple-light hover:bg-purple/40'
                : 'bg-transparent text-neutral-500 border-neutral-300 dark:border-neutral-700 hover:text-purple-light hover:border-purple-light'
            }`}
            aria-label={isWatching ? 'Clear watching' : "I'm watching this match"}
          >
            {isWatching ? 'Stop watching' : "I'm here"}
          </button>
        </div>
      )}
    </div>
  );
}

function TeamRow({
  alliance,
  teams,
  myFavorites,
  favorites,
  played,
}: {
  alliance: 'red' | 'blue';
  teams: number[];
  myFavorites: Set<number>;
  favorites: Favorite[];
  played: boolean;
}) {
  const colorClass = alliance === 'red' ? 'text-alliance-red' : 'text-alliance-blue';
  const strike = played ? 'line-through decoration-neutral-500' : '';
  return (
    <div className={`flex items-baseline gap-2 mt-2 text-xs ${colorClass}`}>
      <span className="font-bold uppercase tracking-wider w-5">{alliance.charAt(0)}</span>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-neutral-700 dark:text-neutral-300">
        {teams.map((t) => {
          const isFav = myFavorites.has(t);
          const fav = favorites.find((f) => f.teamNumber === t);
          return (
            <span key={t} className={`font-mono ${isFav ? 'text-gold font-bold' : ''} ${strike}`} title={fav?.teamName}>
              {t}
            </span>
          );
        })}
      </div>
    </div>
  );
}
