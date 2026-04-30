/**
 * Saturday Mode — derive a Favorite's status from the latest alliance selection
 * + playoff results.
 *
 * State machine:
 *   qualifying          — quals not yet complete for this team's division
 *   awaiting_selection  — quals complete, alliance selection not yet started/done
 *   selected            — team is on an alliance roster
 *   not_selected        — alliance selection complete, team NOT on any alliance
 *   eliminated          — selected, then alliance picked up its 2nd playoff loss
 *   division_winner     — alliance won the division final
 */

import type { Alliance, AllianceRole, Favorite, Match, TeamStatus } from '../types/domain';

export interface RawAllianceEnvelope {
  Alliances?: RawAlliance[];
  count?: number;
}

export interface RawAlliance {
  number: number;
  captain: number;
  round1?: number | null;
  round2?: number | null;
  round3?: number | null;
  backup?: number | null;
  backupReplaced?: number | null;
  name?: string;
}

export interface DerivedStatus {
  status: TeamStatus;
  allianceNumber?: number;
  allianceRole?: AllianceRole;
}

export function teamRoleOnAlliance(alliance: RawAlliance, teamNumber: number): AllianceRole | null {
  if (alliance.captain === teamNumber) return 'captain';
  if (alliance.round1 === teamNumber) return 'pick1';
  if (alliance.round2 === teamNumber) return 'pick2';
  if (alliance.round3 === teamNumber) return 'pick3';
  if (alliance.backup === teamNumber) return 'backup';
  return null;
}

export function findAllianceForTeam(
  alliances: RawAlliance[],
  teamNumber: number,
): { alliance: RawAlliance; role: AllianceRole } | null {
  for (const a of alliances) {
    const role = teamRoleOnAlliance(a, teamNumber);
    if (role) return { alliance: a, role };
  }
  return null;
}

/**
 * The FRC API can return pre-populated empty alliance slots (captain 0/null)
 * well before alliance selection has actually concluded. Treat alliance
 * selection as "happened" only when at least one alliance has a real captain.
 */
export function alliancesPopulated(alliances: RawAlliance[]): boolean {
  return alliances.some((a) => typeof a.captain === 'number' && a.captain > 0);
}

export function allianceTeamNumbers(alliance: RawAlliance): number[] {
  const out: number[] = [];
  for (const v of [alliance.captain, alliance.round1, alliance.round2, alliance.round3, alliance.backup]) {
    if (typeof v === 'number') out.push(v);
  }
  return out;
}

/** Count playoff losses for an alliance. */
export function allianceLosses(alliance: RawAlliance, playoffMatches: Match[]): number {
  const teams = new Set(allianceTeamNumbers(alliance));
  let losses = 0;
  for (const m of playoffMatches) {
    if (m.redScore === undefined || m.blueScore === undefined) continue;
    const onRed = m.redAlliance.some((t) => teams.has(t));
    const onBlue = m.blueAlliance.some((t) => teams.has(t));
    if (!onRed && !onBlue) continue;
    if (m.redScore === m.blueScore) continue; // tie is replayed in playoffs, not a loss
    if (onRed && m.redScore < m.blueScore) losses++;
    if (onBlue && m.blueScore < m.redScore) losses++;
  }
  return losses;
}

/** True if the alliance won the division championship. Heuristic: at the end of a finished playoff bracket, exactly one alliance has <2 losses. */
export function isDivisionWinner(
  alliance: RawAlliance,
  allAlliances: RawAlliance[],
  playoffMatches: Match[],
): boolean {
  const ourLosses = allianceLosses(alliance, playoffMatches);
  if (ourLosses >= 2) return false;
  for (const other of allAlliances) {
    if (other.number === alliance.number) continue;
    if (allianceLosses(other, playoffMatches) < 2) return false;
  }
  // Also require that there's at least one decisive final match concluded.
  const finalsConcluded = playoffMatches.some(
    (m) => m.redScore !== undefined && m.blueScore !== undefined,
  );
  return finalsConcluded;
}

export interface StatusInputs {
  qualMatches: Match[];
  playoffMatches: Match[];
  alliances: RawAlliance[];
}

export function deriveStatus(favorite: Favorite, inputs: StatusInputs): DerivedStatus {
  const { qualMatches, playoffMatches, alliances } = inputs;
  const teamNumber = favorite.teamNumber;

  // 1. Alliance selection has not happened yet (no real captains assigned).
  if (!alliancesPopulated(alliances)) {
    const teamQuals = qualMatches.filter(
      (m) =>
        m.field === favorite.division &&
        (m.redAlliance.includes(teamNumber) || m.blueAlliance.includes(teamNumber)),
    );
    if (teamQuals.length === 0) return { status: 'qualifying' }; // no schedule yet, keep default
    const remaining = teamQuals.filter((m) => m.redScore === undefined || m.blueScore === undefined);
    return remaining.length > 0 ? { status: 'qualifying' } : { status: 'awaiting_selection' };
  }

  // 2. Alliances populated — is the team on one?
  const onAlliance = findAllianceForTeam(alliances, teamNumber);
  if (!onAlliance) return { status: 'not_selected' };

  // 3. Selected. Check losses + finals.
  const losses = allianceLosses(onAlliance.alliance, playoffMatches);
  const baseInfo: Pick<DerivedStatus, 'allianceNumber' | 'allianceRole'> = {
    allianceNumber: onAlliance.alliance.number,
    allianceRole: onAlliance.role,
  };
  if (isDivisionWinner(onAlliance.alliance, alliances, playoffMatches)) {
    return { status: 'division_winner', ...baseInfo };
  }
  if (losses >= 2) return { status: 'eliminated', ...baseInfo };
  return { status: 'selected', ...baseInfo };
}

export function findAllianceByNumber(alliances: RawAlliance[], number: number): Alliance | null {
  const raw = alliances.find((a) => a.number === number);
  if (!raw) return null;
  return {
    division: 'NEWTON', // caller should override with their division
    number: raw.number,
    captain: raw.captain,
    picks: [raw.round1, raw.round2, raw.round3].filter((v): v is number => typeof v === 'number'),
    backup: raw.backup ?? undefined,
    eliminated: false,
    losses: 0,
  };
}
