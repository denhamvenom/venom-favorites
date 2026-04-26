/**
 * Transform raw FRC API envelopes into the canonical `Match` shape.
 *
 * The API returns Schedule (planned) and Matches (actuals + scores) on
 * separate endpoints; we merge by (eventCode, tournamentLevel, matchNumber).
 * The API's `field` value is the in-venue label ("Primary"/"Secondary"),
 * NOT our division — that comes from the eventCode we queried with.
 */

import { logger } from '../lib/logger';
import type { Field, Match, MatchLevel } from '../types/domain';

interface RawScheduleTeam {
  teamNumber: number;
  station: string;
  surrogate?: boolean;
}

export interface RawScheduleEntry {
  description: string;
  startTime: string; // ISO without offset, event-local time
  matchNumber: number;
  field: string;
  tournamentLevel: string; // "Qualification" | "Playoff"
  teams: RawScheduleTeam[];
}

export interface RawScheduleEnvelope {
  Schedule: RawScheduleEntry[];
}

export interface RawMatchTeam {
  teamNumber: number;
  station: string;
  dq?: boolean;
}

export interface RawMatch {
  description: string;
  matchNumber: number;
  scoreRedFinal?: number;
  scoreBlueFinal?: number;
  autoStartTime?: string;
  actualStartTime?: string;
  tournamentLevel: string;
  postResultTime?: string;
  isReplay?: boolean;
  matchVideoLink?: string;
  teams: RawMatchTeam[];
}

export interface RawMatchesEnvelope {
  Matches: RawMatch[];
}

const HOUSTON_TZ_OFFSET_HOURS = -5; // America/Chicago is UTC-5 in CDT (Apr–Nov). Worlds is always in CDT.

/**
 * Parse an event-local ISO timestamp (no offset) as a UTC Date.
 * The FRC API returns local times like "2025-04-17T08:25:14.99".
 * We attach Houston's CDT offset so toLocaleString in any timezone
 * displays the right wall-clock for someone at the convention center.
 */
function parseEventTime(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  // If the string lacks offset/Z, append Houston's CDT offset.
  const hasOffset = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso);
  const stamped = hasOffset ? iso : `${iso}${HOUSTON_TZ_OFFSET_HOURS < 0 ? '-' : '+'}${String(Math.abs(HOUSTON_TZ_OFFSET_HOURS)).padStart(2, '0')}:00`;
  const d = new Date(stamped);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function levelFromRaw(raw: string): MatchLevel {
  const lc = raw.toLowerCase();
  if (lc.startsWith('q')) return 'qual';
  if (lc.startsWith('p') || lc.includes('playoff')) return 'playoff';
  if (lc.startsWith('e')) return 'einstein';
  return 'qual';
}

function alliancesFromTeams<T extends { teamNumber: number; station: string }>(teams: T[]): {
  red: number[];
  blue: number[];
} {
  const red: number[] = [];
  const blue: number[] = [];
  for (const t of teams) {
    const station = t.station ?? '';
    if (station.startsWith('Red')) red.push(t.teamNumber);
    else if (station.startsWith('Blue')) blue.push(t.teamNumber);
  }
  return { red, blue };
}

/**
 * Merge the planned schedule with completed-match data into a Match[].
 * `division` is the eventCode the data was fetched for (NEWTON, etc.) —
 * this is what becomes the canonical `Match.field` so walking-time math
 * uses the correct division.
 */
export function buildMatches(
  division: Field,
  schedule: RawScheduleEnvelope | undefined | null,
  matches: RawMatchesEnvelope | undefined | null,
  favoriteTeamNumbers: ReadonlySet<number>,
): Match[] {
  const scheduleEntries = schedule?.Schedule ?? [];
  const matchEntries = matches?.Matches ?? [];
  const matchByKey = new Map<string, RawMatch>();
  for (const m of matchEntries) {
    matchByKey.set(`${m.tournamentLevel}:${m.matchNumber}`, m);
  }
  const out: Match[] = [];
  for (const sched of scheduleEntries) {
    const level = levelFromRaw(sched.tournamentLevel);
    const scheduledStart = parseEventTime(sched.startTime);
    if (!scheduledStart) {
      logger.warn('schedule', 'skipping match with unparseable startTime', {
        division,
        matchNumber: sched.matchNumber,
        startTime: sched.startTime,
      });
      continue;
    }
    const live = matchByKey.get(`${sched.tournamentLevel}:${sched.matchNumber}`);
    const { red, blue } = alliancesFromTeams(sched.teams);
    const teamSet = new Set([...red, ...blue]);
    const myFavorites = [...teamSet].filter((t) => favoriteTeamNumbers.has(t));
    out.push({
      matchNumber: sched.matchNumber,
      level,
      field: division,
      scheduledStart,
      actualStart: parseEventTime(live?.actualStartTime),
      actualEnd: parseEventTime(live?.postResultTime),
      redAlliance: red,
      blueAlliance: blue,
      redScore: live?.scoreRedFinal,
      blueScore: live?.scoreBlueFinal,
      myFavorites,
    });
  }
  return out;
}
