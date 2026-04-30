import { applyDrift } from '../logic/drift';
import type { Favorite, FieldDrift, Match } from '../types/domain';
import type { WatchingMatch } from '../state/watching';
import MatchCard from './MatchCard';

interface Props {
  now: Date;
  matches: Match[];
  drifts: FieldDrift[];
  favorites: Favorite[];
  superTeamNumber?: number;
  watching?: WatchingMatch | null;
  onToggleWatching?: (m: Match) => void;
}

const NEXT_UP_COUNT = 2;

export default function TopBar({ now, matches, drifts, favorites, superTeamNumber, watching, onToggleWatching }: Props) {
  const driftByField = new Map<string, FieldDrift>();
  for (const d of drifts) driftByField.set(d.field, d);

  // Find the watching match (if any) so we can render the "Watching now" header
  // and exclude it from the Next Up list.
  const watchingMatch = watching
    ? matches.find(
        (m) =>
          m.field === watching.field &&
          m.level === watching.level &&
          m.matchNumber === watching.matchNumber,
      )
    : undefined;

  // Upcoming matches that involve our favorites, sorted by drift-adjusted start time.
  // Skip played matches (have both scores) — a just-finished match in the past
  // 5-min window should NOT surface as "Next Up". Allow in-progress matches
  // (started recently, no score yet) by keeping the 8-minute past window.
  const upcoming = matches
    .filter((m) => m.myFavorites.length > 0)
    .filter((m) => m.redScore === undefined || m.blueScore === undefined)
    .filter((m) => !watchingMatch || m !== watchingMatch) // dedup with the Watching card
    .map((m) => {
      const drift = driftByField.get(m.field);
      const adjustedStart = drift ? applyDrift(m.scheduledStart, drift.driftSeconds) : m.scheduledStart;
      return { match: m, adjustedStart };
    })
    .filter((x) => x.adjustedStart.getTime() > now.getTime() - 8 * 60_000) // ~one cycle of in-progress slack
    .sort((a, b) => a.adjustedStart.getTime() - b.adjustedStart.getTime())
    .slice(0, NEXT_UP_COUNT);

  if (!watchingMatch && upcoming.length === 0) return null;
  return (
    <div className="space-y-2">
      {watchingMatch && (
        <>
          <div className="text-[10px] uppercase tracking-widest text-purple-light font-bold">
            Watching now · {watchingMatch.field}
          </div>
          <MatchCard
            key={`watching-${watchingMatch.field}-${watchingMatch.level}-${watchingMatch.matchNumber}`}
            match={watchingMatch}
            drift={driftByField.get(watchingMatch.field)}
            favorites={favorites}
            variant="next-up"
            superTeamNumber={superTeamNumber}
            isWatching
            onToggleWatching={onToggleWatching ? () => onToggleWatching(watchingMatch) : undefined}
          />
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Next up</div>
          {upcoming.map(({ match }) => (
            <MatchCard
              key={`${match.field}-${match.level}-${match.matchNumber}`}
              match={match}
              drift={driftByField.get(match.field)}
              favorites={favorites}
              variant="next-up"
              superTeamNumber={superTeamNumber}
              onToggleWatching={onToggleWatching ? () => onToggleWatching(match) : undefined}
            />
          ))}
        </>
      )}
    </div>
  );
}
