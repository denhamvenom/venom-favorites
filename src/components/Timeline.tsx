import { useMemo } from 'react';
import type { Favorite, FieldDrift, Match, ScheduleEntry } from '../types/domain';
import FieldDriftPill from './FieldDriftPill';
import MatchCard from './MatchCard';

interface Props {
  matches: Match[];
  drifts: FieldDrift[];
  favorites: Favorite[];
  loading: boolean;
  fetchedAt: Date | null;
  showOnlyFavoriteMatches?: boolean;
  showSuggestedOnly?: boolean;
  /** Pre-computed schedule entries for favorite-involving matches (feasible/suggested/conflict). */
  entries: ScheduleEntry[];
  /** Set of team numbers belonging to any alliance that contains a favorite. Drives Saturday playoff filter. */
  favoriteAllianceTeams?: Set<number>;
  /** Super-favorite team number — gold ring on their match cards. */
  superTeamNumber?: number;
  onRefresh?: () => void;
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
  showSuggestedOnly = false,
  entries,
  favoriteAllianceTeams,
  superTeamNumber,
  onRefresh,
}: Props) {
  const driftByField = useMemo(() => {
    const m = new Map<string, FieldDrift>();
    for (const d of drifts) m.set(d.field, d);
    return m;
  }, [drifts]);

  const entryByKey = useMemo(() => {
    const m = new Map<string, ScheduleEntry>();
    for (const e of entries) m.set(`${e.match.field}|${e.match.level}|${e.match.matchNumber}`, e);
    return m;
  }, [entries]);

  // For Saturday's playoff matches, we limit to matches whose teams overlap with
  // any alliance containing a favorite — derived from the favorite's allianceNumber
  // and the alliance roster mapping. The alliance roster mapping is captured in
  // `favoriteAlliances` (passed in via props from App once Saturday Mode is live).
  const visibleMatches = useMemo(() => {
    let v = matches;
    if (showOnlyFavoriteMatches) {
      v = v.filter((m) => {
        if (m.level === 'qual') return m.myFavorites.length > 0;
        // Playoff: include if any of our allied teams is on the field. We piggyback
        // on `myFavorites` being recomputed against the favorite team numbers, BUT
        // for Saturday we want any alliance-mate to count. The transform layer fills
        // myFavorites only with literal favorite team numbers; alliance-mate filter
        // happens here using the favoriteAlliances Map provided by App.
        if (m.myFavorites.length > 0) return true;
        const allianceTeams = favoriteAllianceTeams;
        if (!allianceTeams) return false;
        return [...m.redAlliance, ...m.blueAlliance].some((t) => allianceTeams.has(t));
      });
    }
    if (showSuggestedOnly) {
      v = v.filter((m) => entryByKey.get(`${m.field}|${m.level}|${m.matchNumber}`)?.suggested);
    }
    return v;
  }, [matches, showOnlyFavoriteMatches, showSuggestedOnly, entryByKey, favoriteAllianceTeams]);

  const groups = useMemo(() => {
    const out = new Map<string, { label: string; matches: Match[]; drifts: FieldDrift[] }>();
    for (const m of visibleMatches) {
      const drift = driftByField.get(m.field);
      const adjusted = drift
        ? new Date(m.scheduledStart.getTime() + drift.driftSeconds * 1000)
        : m.scheduledStart;
      const key = `${adjusted.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'America/Chicago' })}-${adjusted.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'America/Chicago' })}`;
      const label = adjusted.toLocaleString('en-US', HOUR_HEADING_FMT);
      const bucket = out.get(key) ?? { label, matches: [], drifts: [] };
      bucket.matches.push(m);
      out.set(key, bucket);
    }
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
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-neutral-600">
          <span>
            Fetched{' '}
            {fetchedAt.toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'America/Chicago',
            })}
            {loading ? ' · refreshing…' : ''}
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh schedule"
              title="Refresh schedule + rankings now"
              className={`text-base leading-none text-neutral-500 hover:text-gold transition-colors disabled:opacity-50 ${loading ? 'animate-spin' : ''}`}
            >
              ↻
            </button>
          )}
        </div>
      )}
      {groups.map((g, i) => (
        <section key={i}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-xs uppercase tracking-wider text-neutral-400 font-bold">{g.label}</h3>
            {g.drifts.map((d) => (
              <FieldDriftPill key={d.field} drift={d} />
            ))}
          </div>
          <ul className="space-y-2">
            {g.matches.map((m) => (
              <li key={`${m.field}-${m.level}-${m.matchNumber}`}>
                <MatchCard
                  match={m}
                  drift={driftByField.get(m.field)}
                  favorites={favorites}
                  entry={entryByKey.get(`${m.field}|${m.level}|${m.matchNumber}`)}
                  superTeamNumber={superTeamNumber}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
