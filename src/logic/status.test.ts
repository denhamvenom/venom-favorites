import { describe, expect, it } from 'vitest';
import {
  allianceLosses,
  allianceTeamNumbers,
  deriveStatus,
  findAllianceForTeam,
  teamRoleOnAlliance,
  type RawAlliance,
} from './status';
import type { Favorite, Match } from '../types/domain';

const FAV: Favorite = {
  teamNumber: 1323,
  teamName: 'MadTown',
  division: 'NEWTON',
  status: 'qualifying',
};

const ALLIANCE_1: RawAlliance = {
  number: 1,
  captain: 1323,
  round1: 2910,
  round2: 4272,
  round3: 5026,
  backup: null,
};

const ALLIANCE_8: RawAlliance = {
  number: 8,
  captain: 3937,
  round1: 294,
  round2: 449,
  round3: 4909,
  backup: null,
};

function mkMatch(
  matchNumber: number,
  level: 'qual' | 'playoff',
  redTeams: number[],
  blueTeams: number[],
  redScore?: number,
  blueScore?: number,
): Match {
  return {
    matchNumber,
    level,
    field: 'NEWTON',
    scheduledStart: new Date(`2026-04-30T${10 + matchNumber}:00:00Z`),
    actualStart: redScore !== undefined ? new Date(`2026-04-30T${10 + matchNumber}:00:00Z`) : undefined,
    actualEnd: redScore !== undefined ? new Date(`2026-04-30T${10 + matchNumber}:07:00Z`) : undefined,
    redAlliance: redTeams,
    blueAlliance: blueTeams,
    redScore,
    blueScore,
    myFavorites: [],
  };
}

describe('teamRoleOnAlliance', () => {
  it('finds captain', () => {
    expect(teamRoleOnAlliance(ALLIANCE_1, 1323)).toBe('captain');
  });
  it('finds pick1/pick2/pick3', () => {
    expect(teamRoleOnAlliance(ALLIANCE_1, 2910)).toBe('pick1');
    expect(teamRoleOnAlliance(ALLIANCE_1, 4272)).toBe('pick2');
    expect(teamRoleOnAlliance(ALLIANCE_1, 5026)).toBe('pick3');
  });
  it('returns null for non-member', () => {
    expect(teamRoleOnAlliance(ALLIANCE_1, 9999)).toBeNull();
  });
});

describe('findAllianceForTeam', () => {
  it('locates the team across multiple alliances', () => {
    const result = findAllianceForTeam([ALLIANCE_1, ALLIANCE_8], 4909);
    expect(result?.alliance.number).toBe(8);
    expect(result?.role).toBe('pick3');
  });
  it('returns null when team not on any alliance', () => {
    expect(findAllianceForTeam([ALLIANCE_1, ALLIANCE_8], 9999)).toBeNull();
  });
});

describe('allianceTeamNumbers', () => {
  it('skips null entries', () => {
    expect(allianceTeamNumbers(ALLIANCE_1).sort()).toEqual([1323, 2910, 4272, 5026]);
  });
});

describe('allianceLosses', () => {
  it('counts a match where the alliance lost', () => {
    // Alliance 1 (red) scored 200, lost to 250
    const matches = [mkMatch(1, 'playoff', [1323, 2910, 4272], [3937, 294, 449], 200, 250)];
    expect(allianceLosses(ALLIANCE_1, matches)).toBe(1);
  });
  it('does not count a match where the alliance won', () => {
    const matches = [mkMatch(1, 'playoff', [1323, 2910, 4272], [3937, 294, 449], 250, 200)];
    expect(allianceLosses(ALLIANCE_1, matches)).toBe(0);
  });
  it('handles ties (no loss credited)', () => {
    const matches = [mkMatch(1, 'playoff', [1323, 2910, 4272], [3937, 294, 449], 200, 200)];
    expect(allianceLosses(ALLIANCE_1, matches)).toBe(0);
  });
  it('skips matches without scores', () => {
    const matches = [mkMatch(1, 'playoff', [1323, 2910, 4272], [3937, 294, 449])];
    expect(allianceLosses(ALLIANCE_1, matches)).toBe(0);
  });
});

describe('deriveStatus', () => {
  it("returns 'qualifying' before alliance selection if quals remain", () => {
    const matches = [mkMatch(1, 'qual', [1323, 1, 2], [3, 4, 5])]; // no score
    expect(deriveStatus(FAV, { qualMatches: matches, playoffMatches: [], alliances: [] })).toEqual({
      status: 'qualifying',
    });
  });
  it("returns 'awaiting_selection' when all quals scored but alliances empty", () => {
    const matches = [mkMatch(1, 'qual', [1323, 1, 2], [3, 4, 5], 100, 80)];
    expect(deriveStatus(FAV, { qualMatches: matches, playoffMatches: [], alliances: [] })).toEqual({
      status: 'awaiting_selection',
    });
  });
  it("returns 'selected' with alliance # and role when on an alliance", () => {
    expect(
      deriveStatus(FAV, { qualMatches: [], playoffMatches: [], alliances: [ALLIANCE_1, ALLIANCE_8] }),
    ).toEqual({ status: 'selected', allianceNumber: 1, allianceRole: 'captain' });
  });
  it("returns 'not_selected' when alliances populated but team is not on one", () => {
    const fav: Favorite = { ...FAV, teamNumber: 9999 };
    expect(
      deriveStatus(fav, { qualMatches: [], playoffMatches: [], alliances: [ALLIANCE_1, ALLIANCE_8] }),
    ).toEqual({ status: 'not_selected' });
  });
  it("returns 'eliminated' after 2 alliance losses", () => {
    const playoff = [
      mkMatch(1, 'playoff', [1323, 2910, 4272], [3937, 294, 449], 100, 200),
      mkMatch(2, 'playoff', [1323, 2910, 4272], [3937, 294, 449], 150, 200),
    ];
    expect(
      deriveStatus(FAV, {
        qualMatches: [],
        playoffMatches: playoff,
        alliances: [ALLIANCE_1, ALLIANCE_8],
      }),
    ).toMatchObject({ status: 'eliminated', allianceNumber: 1 });
  });
  it("returns 'division_winner' when all other alliances have ≥2 losses", () => {
    // Alliance 1 has 0 losses, Alliance 8 has 2 losses
    const playoff = [
      mkMatch(1, 'playoff', [1323, 2910, 4272], [3937, 294, 449], 250, 200),
      mkMatch(2, 'playoff', [1323, 2910, 4272], [3937, 294, 449], 250, 200),
    ];
    expect(
      deriveStatus(FAV, {
        qualMatches: [],
        playoffMatches: playoff,
        alliances: [ALLIANCE_1, ALLIANCE_8],
      }),
    ).toMatchObject({ status: 'division_winner', allianceNumber: 1 });
  });
});
