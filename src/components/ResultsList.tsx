import { useMemo } from 'react';
import { deriveProgress } from '../logic/progress';
import type { Favorite, Match, Ranking, TeamProgress } from '../types/domain';
import TeamProgressCard from './TeamProgressCard';

interface Props {
  favorites: Favorite[];
  matches: Match[];
  rankings: Ranking[];
}

const STATUS_PRIORITY: Record<Favorite['status'], number> = {
  selected: 0,
  qualifying: 1,
  awaiting_selection: 2,
  division_winner: 3,
  not_selected: 4,
  eliminated: 5,
};

export default function ResultsList({ favorites, matches, rankings }: Props) {
  const progresses = useMemo<TeamProgress[]>(() => {
    const rankingByTeam = new Map<number, Ranking>();
    for (const r of rankings) rankingByTeam.set(r.teamNumber, r);
    const list = favorites.map((f) => deriveProgress(f, matches, rankingByTeam.get(f.teamNumber)));
    list.sort((a, b) => {
      // Sort: in-playoffs first, then qualifying-by-rank, then eliminated/not-selected last.
      const sp = STATUS_PRIORITY[a.favorite.status] - STATUS_PRIORITY[b.favorite.status];
      if (sp !== 0) return sp;
      if (a.bracketStatus && !b.bracketStatus) return -1;
      if (!a.bracketStatus && b.bracketStatus) return 1;
      const ra = a.ranking?.rank ?? Number.MAX_SAFE_INTEGER;
      const rb = b.ranking?.rank ?? Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
    return list;
  }, [favorites, matches, rankings]);

  if (favorites.length === 0) {
    return (
      <div className="border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg p-6 text-center text-sm text-neutral-500 dark:text-neutral-500">
        Add favorites to see results.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {progresses.map((p, i) => (
        <li key={p.favorite.teamNumber}>
          <TeamProgressCard progress={p} favorites={favorites} defaultOpen={i < 3} />
        </li>
      ))}
    </ul>
  );
}
