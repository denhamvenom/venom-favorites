/**
 * Resolve "which division is team N in?" by querying the 8 division rosters
 * in parallel and returning the first one that contains the team.
 *
 * Used at app mount to auto-detect 8044's division, and inside the team-search
 * modal when a user types any team number.
 */

import { logger } from '../lib/logger';
import { DIVISION_FIELDS, type Field } from '../types/domain';
import { frcFetch } from './frc';

export interface RosterTeam {
  teamNumber: number;
  nameShort?: string;
  nameFull?: string;
  city?: string;
  stateProv?: string;
  country?: string;
}

export interface RosterEnvelope {
  teams: RosterTeam[];
  teamCountTotal?: number;
  teamCountPage?: number;
  pageCurrent?: number;
  pageTotal?: number;
}

const SEASON_DEFAULT = 2026;

/**
 * Fetches every page of /teams for a division and returns a merged envelope.
 * The FRC API paginates this endpoint at ~65 teams per page; without this the
 * client misses ~10 teams per division. In fixture mode the captured JSON is
 * already merged, so pageTotal is 1 and only one fetch happens.
 */
export async function fetchRoster(eventCode: Field, season: number = SEASON_DEFAULT): Promise<RosterEnvelope> {
  const first = await frcFetch<RosterEnvelope>(`/${season}/teams`, {
    query: { eventCode },
  });
  const total = first.pageTotal ?? 1;
  if (total <= 1) return first;
  const rest = await Promise.all(
    Array.from({ length: total - 1 }, (_, i) =>
      frcFetch<RosterEnvelope>(`/${season}/teams`, {
        query: { eventCode, page: i + 2 },
      }),
    ),
  );
  const merged: RosterEnvelope = {
    teams: [...first.teams, ...rest.flatMap((p) => p.teams)],
    teamCountTotal: first.teamCountTotal,
    teamCountPage: first.teams.length + rest.reduce((sum, p) => sum + p.teams.length, 0),
    pageCurrent: 1,
    pageTotal: 1,
  };
  return merged;
}

export interface TeamDivisionMatch {
  team: RosterTeam;
  division: Field;
}

export async function findTeamDivision(
  teamNumber: number,
  season: number = SEASON_DEFAULT,
): Promise<TeamDivisionMatch | null> {
  const attempts = await Promise.allSettled(
    DIVISION_FIELDS.map(async (division) => {
      const env = await fetchRoster(division, season);
      const team = env.teams?.find((t) => t.teamNumber === teamNumber);
      return team ? ({ team, division } as TeamDivisionMatch) : null;
    }),
  );
  for (const a of attempts) {
    if (a.status === 'fulfilled' && a.value) return a.value;
    if (a.status === 'rejected') {
      logger.warn('api', 'roster lookup failed for one division', {
        reason: a.reason instanceof Error ? a.reason.message : String(a.reason),
      });
    }
  }
  return null;
}
