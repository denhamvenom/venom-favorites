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
}

const SEASON_DEFAULT = 2026;

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
      const env = await frcFetch<RosterEnvelope>(`/${season}/teams`, {
        query: { eventCode: division },
      });
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
