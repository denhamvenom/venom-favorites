import { applyDrift } from '../logic/drift';
import type { Favorite, FieldDrift, Match } from '../types/domain';
import MatchCard from './MatchCard';

interface Props {
  now: Date;
  matches: Match[];
  drifts: FieldDrift[];
  favorites: Favorite[];
  superTeamNumber?: number;
}

const NEXT_UP_COUNT = 2;

export default function TopBar({ now, matches, drifts, favorites, superTeamNumber }: Props) {
  const driftByField = new Map<string, FieldDrift>();
  for (const d of drifts) driftByField.set(d.field, d);

  // Upcoming matches that involve our favorites, sorted by drift-adjusted start time.
  const upcoming = matches
    .filter((m) => m.myFavorites.length > 0)
    .map((m) => {
      const drift = driftByField.get(m.field);
      const adjustedStart = drift ? applyDrift(m.scheduledStart, drift.driftSeconds) : m.scheduledStart;
      return { match: m, adjustedStart };
    })
    .filter((x) => x.adjustedStart.getTime() > now.getTime() - 5 * 60_000) // include matches up to 5 min past
    .sort((a, b) => a.adjustedStart.getTime() - b.adjustedStart.getTime())
    .slice(0, NEXT_UP_COUNT);

  if (upcoming.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Next up</div>
      {upcoming.map(({ match }) => (
        <MatchCard
          key={`${match.field}-${match.level}-${match.matchNumber}`}
          match={match}
          drift={driftByField.get(match.field)}
          favorites={favorites}
          variant="next-up"
          superTeamNumber={superTeamNumber}
        />
      ))}
    </div>
  );
}
