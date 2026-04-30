import { useState } from 'react';
import type { Favorite, TeamProgress } from '../types/domain';
import MatchResultRow from './MatchResultRow';

interface Props {
  progress: TeamProgress;
  favorites: Favorite[];
  defaultOpen: boolean;
}

const BRACKET_LABELS: Record<NonNullable<TeamProgress['bracketStatus']>, { label: string; classes: string }> = {
  upper: { label: 'Upper Bracket', classes: 'bg-feasible/20 text-feasible border-feasible/40' },
  lower_1L: { label: 'Lower Bracket · 1 Loss', classes: 'bg-tight/20 text-tight border-tight/40' },
  eliminated: { label: 'Eliminated', classes: 'bg-loss/20 text-loss border-loss/40' },
  winner: { label: 'Division Winner', classes: 'bg-gold/30 text-gold border-gold/60' },
};

export default function TeamProgressCard({ progress, favorites, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const { favorite, ranking, qualResults, playoffResults, bracketStatus: rawBracket } = progress;
  // Prefer the favorite's authoritative status (which knows about division_winner via cross-alliance
  // check) over the loss-count-only derivation from progress.ts.
  const bracketStatus =
    favorite.status === 'division_winner'
      ? 'winner'
      : favorite.status === 'eliminated'
        ? 'eliminated'
        : rawBracket;
  const dim =
    favorite.status === 'eliminated' || favorite.status === 'not_selected' || bracketStatus === 'eliminated';
  const wlt = ranking
    ? `${ranking.wins}-${ranking.losses}-${ranking.ties}`
    : qualResults.length > 0
      ? `${qualResults.filter((r) => r.outcome === 'W').length}-${qualResults.filter((r) => r.outcome === 'L').length}-${qualResults.filter((r) => r.outcome === 'T').length}`
      : '—';

  const totalCompleted = qualResults.length + playoffResults.length;

  return (
    <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden ${dim ? 'opacity-60' : ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-bold text-lg text-gold">{favorite.teamNumber}</span>
            <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate">{favorite.teamName}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-500">{favorite.division}</span>
            {ranking && (
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                #{ranking.rank}
                <span className="text-neutral-500 dark:text-neutral-600"> / {ranking.totalTeams}</span>
                {ranking.rankingPoints > 0 && (
                  <span className="ml-1.5 text-purple-light">{ranking.rankingPoints} RP</span>
                )}
              </span>
            )}
            {bracketStatus && (
              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${BRACKET_LABELS[bracketStatus].classes}`}>
                {BRACKET_LABELS[bracketStatus].label}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-mono font-bold text-neutral-900 dark:text-neutral-100">{wlt}</div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-500">W-L-T</div>
        </div>
        <span className="text-neutral-500 dark:text-neutral-600 text-xl shrink-0">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="border-t border-neutral-200 dark:border-neutral-800 p-2 space-y-1">
          {totalCompleted === 0 && (
            <p className="text-xs text-neutral-500 dark:text-neutral-500 px-2 py-3">No completed matches yet.</p>
          )}
          {playoffResults.length > 0 && (
            <Section label="Playoffs">
              {playoffResults.map((r) => (
                <MatchResultRow
                  key={`po-${r.match.matchNumber}`}
                  result={r}
                  favorites={favorites}
                />
              ))}
            </Section>
          )}
          {qualResults.length > 0 && (
            <Section label="Qualifying">
              {qualResults.map((r) => (
                <MatchResultRow
                  key={`q-${r.match.matchNumber}`}
                  result={r}
                  favorites={favorites}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-500 px-2 pt-2 pb-1">{label}</div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-900">{children}</div>
    </div>
  );
}
