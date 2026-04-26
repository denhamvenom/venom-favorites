import type { Favorite, TeamStatus } from '../types/domain';

interface Props {
  favorites: Favorite[];
  onRemove: (teamNumber: number) => void;
}

export default function FavoritesList({ favorites, onRemove }: Props) {
  if (favorites.length === 0) {
    return (
      <div className="border border-dashed border-neutral-800 rounded-lg p-8 text-center text-sm text-neutral-500">
        No favorites yet. Tap <span className="text-gold">Add Favorite</span> to start.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {favorites.map((fav) => (
        <li key={fav.teamNumber}>
          <FavoriteRow favorite={fav} onRemove={() => onRemove(fav.teamNumber)} />
        </li>
      ))}
    </ul>
  );
}

function FavoriteRow({ favorite, onRemove }: { favorite: Favorite; onRemove: () => void }) {
  const dim = favorite.status === 'eliminated' || favorite.status === 'not_selected';
  return (
    <div
      className={`flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-lg p-3 ${dim ? 'opacity-50' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-gold">{favorite.teamNumber}</span>
          <span className="text-sm text-neutral-200 truncate">{favorite.teamName}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-neutral-500">{favorite.division}</span>
          <StatusBadge favorite={favorite} />
        </div>
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 w-8 h-8 rounded-lg bg-neutral-800 hover:bg-loss text-neutral-400 hover:text-white transition-colors"
        aria-label={`Remove team ${favorite.teamNumber}`}
      >
        ×
      </button>
    </div>
  );
}

function StatusBadge({ favorite }: { favorite: Favorite }) {
  const { status, allianceNumber, allianceRole } = favorite;
  const cfg = STATUS_BADGES[status];
  if (!cfg) return null;
  if (status === 'selected' && allianceNumber !== undefined) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.classes}`}>
        Alliance {allianceNumber}
        {allianceRole ? ` · ${formatRole(allianceRole)}` : ''}
      </span>
    );
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.classes}`}>{cfg.label}</span>;
}

function formatRole(role: NonNullable<Favorite['allianceRole']>): string {
  switch (role) {
    case 'captain':
      return 'Captain';
    case 'pick1':
      return 'Pick 1';
    case 'pick2':
      return 'Pick 2';
    case 'pick3':
      return 'Pick 3';
    case 'backup':
      return 'Backup';
  }
}

const STATUS_BADGES: Partial<Record<TeamStatus, { label: string; classes: string }>> = {
  qualifying: { label: 'Qualifying', classes: 'bg-neutral-800 text-neutral-400' },
  awaiting_selection: { label: 'Awaiting selection', classes: 'bg-tight/20 text-tight' },
  selected: { label: 'Selected', classes: 'bg-purple/40 text-purple-light border border-purple-light' },
  not_selected: { label: 'Not selected', classes: 'bg-neutral-800 text-tie' },
  eliminated: { label: 'Eliminated', classes: 'bg-neutral-800 text-tie' },
  division_winner: { label: '→ Einstein', classes: 'bg-gold/30 text-gold border border-gold' },
};
