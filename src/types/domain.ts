/**
 * Domain types for Worlds Match Watcher.
 * These mirror the spec ([SPEC.md](../../SPEC.md)) and are the canonical shapes
 * the UI and logic layers consume. Raw FRC API envelope shapes (e.g. `{ teams: [...] }`)
 * live near their fetchers and are transformed into these types at the boundary.
 */

export type Field =
  | 'ARCHIMEDES'
  | 'CURIE'
  | 'DALY'
  | 'GALILEO'
  | 'HOPPER'
  | 'JOHNSON'
  | 'MILSTEIN'
  | 'NEWTON'
  | 'EINSTEIN';

export const DIVISION_FIELDS: ReadonlyArray<Exclude<Field, 'EINSTEIN'>> = [
  'ARCHIMEDES',
  'CURIE',
  'DALY',
  'GALILEO',
  'HOPPER',
  'JOHNSON',
  'MILSTEIN',
  'NEWTON',
];

export type TeamStatus =
  | 'qualifying'
  | 'awaiting_selection'
  | 'selected'
  | 'not_selected'
  | 'eliminated'
  | 'division_winner';

export type AllianceRole = 'captain' | 'pick1' | 'pick2' | 'pick3' | 'backup';

export interface Favorite {
  teamNumber: number;
  teamName: string;
  division: Field;
  status: TeamStatus;
  allianceNumber?: number;
  allianceRole?: AllianceRole;
}

export interface Alliance {
  division: Field;
  number: number;
  captain: number;
  picks: number[];
  backup?: number;
  eliminated: boolean;
  losses: number;
}

export type MatchLevel = 'qual' | 'playoff' | 'einstein';

export interface Match {
  matchNumber: number;
  level: MatchLevel;
  field: Field;
  scheduledStart: Date;
  actualStart?: Date;
  actualEnd?: Date;
  redAlliance: number[];
  blueAlliance: number[];
  redScore?: number;
  blueScore?: number;
  myFavorites: number[];
}

export interface Ranking {
  division: Field;
  teamNumber: number;
  rank: number;
  totalTeams: number;
  wins: number;
  losses: number;
  ties: number;
  rankingPoints: number;
  averageMatchPoints?: number;
}

export type MatchOutcome = 'W' | 'L' | 'T';
export type AllianceColor = 'red' | 'blue';

export interface MatchResult {
  match: Match;
  teamNumber: number;
  alliance: AllianceColor;
  outcome: MatchOutcome;
  ourScore: number;
  theirScore: number;
}

export type BracketStatus = 'upper' | 'lower_1L' | 'eliminated' | 'winner';

export interface TeamProgress {
  favorite: Favorite;
  ranking?: Ranking;
  qualResults: MatchResult[];
  playoffResults: MatchResult[];
  bracketStatus?: BracketStatus;
}

export interface FieldDrift {
  field: Field;
  driftSeconds: number;
  basedOn: number;
  computedAt: Date;
}

export interface ScheduleEntry {
  match: Match;
  adjustedStart: Date;
  walkFromPrevious?: number;
  feasible: boolean;
  suggested: boolean;
  conflictReason?: string;
}
