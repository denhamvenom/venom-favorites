import { useMemo } from 'react';
import type { Favorite, FieldDrift, Match } from '../types/domain';
import FieldDriftPill from './FieldDriftPill';
import MatchCard from './MatchCard';

interface Props {
  matches: Match[];
  drifts: FieldDrift[];
  favorites: Favorite[];
  loading: boolean;
  fetchedAt: Date | null;
  showOnlyFavoriteMatches?: boolean;
}

const HOUR_HEADING_FMT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  weekday: 'short',
  timeZone: 'America/Chicago',
};

export default function Timeline({
  matches,
  drifts,
  favorites,
  loading,
  fetchedAt,
  showOnlyFavoriteMatches = true,
}: Props) {
  const driftByField = useMemo(() => {
    const m = new Map<string, FieldDrift>();
    for (const d of drifts) m.set(d.field, d);
    return m;
  }, [drifts]);

  const visibleMatches = useMemo(() => {
    if (!showOnlyFavoriteMatches) return matches;
    return matches.filter((m) => m.myFavorites.length > 0);
  }, [matches, showOnlyFavoriteMatches]);

  // Group by hour-of-day in America/Chicago.
  const groups = useMemo(() => {
    const out = new Map<string, { label: string; matches: Match[]; drifts: FieldDrift[] }>();
    for (const m of visibleMatches) {
      const drift = driftByField.get(m.field);
      const adjusted = drift
        ? new Date(m.scheduledStart.getTime() + drift.driftSeconds * 1000)
        : m.scheduledStart;
      const key = `${adjusted.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'America/Chicago' })}-${adjusted.getUTCHours()}-${adjusted.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'America/Chicago' })}`;
      const label = adjusted.toLocaleString('en-US', HOUR_HEADING_FMT);
      const bucket = out.get(key) ?? { label, matches: [], drifts: [] };
      bucket.matches.push(m);
      out.set(key, bucket);
    }
    // Attach distinct drifts per group (unique field set in the group's matches).
    for (const bucket of out.values()) {
      const fields = new Set(bucket.matches.map((m) => m.field));
      bucket.drifts = drifts.filter((d) => fields.has(d.field));
    }
    return [...out.values()];
  }, [visibleMatches, driftByField, drifts]);

  if (matches.length === 0) {
    return (
      <div className="border border-dashed border-neutral-800 rounded-lg p-6 text-center text-sm text-neutral-500">
        {loading
          ? 'Fetching schedule…'
          : favorites.length === 0
            ? 'Add favorites to populate the schedule.'
            : "Schedule is empty for your favorites' divisions."}
      </div>
    );
  }

  if (visibleMatches.length === 0) {
    return (
      <div className="border border-dashed border-neutral-800 rounded-lg p-6 text-center text-sm text-neutral-500">
        No matches involve your favorites yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fetchedAt && (
        <div className="text-[10px] uppercase tracking-widest text-neutral-600">
          Fetched {fetchedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}
          {loading ? ' · refreshing…' : ''}
        </div>
      )}
      {groups.map((g, i) => (
        <section key={i}>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs uppercase tracking-wider text-neutral-400 font-bold">{g.label}</h3>
            {g.drifts.map((d) => (
              <FieldDriftPill key={d.field} drift={d} />
            ))}
          </div>
          <ul className="space-y-2">
            {g.matches.map((m) => (
              <li key={`${m.field}-${m.level}-${m.matchNumber}`}>
                <MatchCard match={m} drift={driftByField.get(m.field)} favorites={favorites} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
