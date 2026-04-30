import { describe, expect, it } from 'vitest';
import {
  buildMatches,
  type RawMatchesEnvelope,
  type RawScheduleEnvelope,
} from './transform';

const FAVS = new Set<number>([8044]);

function sched(matchNumber: number, teams: { teamNumber: number; station: string }[] = []): RawScheduleEnvelope['Schedule'][number] {
  return {
    description: `Qualification ${matchNumber}`,
    startTime: `2026-04-30T10:${String(matchNumber).padStart(2, '0')}:00`,
    matchNumber,
    field: 'Primary',
    tournamentLevel: 'Qualification',
    teams,
  };
}

function live(matchNumber: number, scoreRed: number | undefined, scoreBlue: number | undefined, teams: { teamNumber: number; station: string }[] = []): RawMatchesEnvelope['Matches'][number] {
  return {
    description: `Qualification ${matchNumber}`,
    matchNumber,
    scoreRedFinal: scoreRed,
    scoreBlueFinal: scoreBlue,
    actualStartTime: `2026-04-30T10:${String(matchNumber).padStart(2, '0')}:00`,
    postResultTime: scoreRed !== undefined ? `2026-04-30T10:${String(matchNumber).padStart(2, '0')}:30` : undefined,
    tournamentLevel: 'Qualification',
    teams,
  };
}

describe('buildMatches — schedule + matches join robustness', () => {
  it('uses matches-endpoint teams when schedule.teams is empty (Day 1 partial)', () => {
    const schedule: RawScheduleEnvelope = { Schedule: [sched(5, [])] }; // schedule has no teams yet
    const matches: RawMatchesEnvelope = {
      Matches: [
        live(5, 100, 80, [
          { teamNumber: 8044, station: 'Red1' },
          { teamNumber: 1, station: 'Red2' },
          { teamNumber: 2, station: 'Red3' },
          { teamNumber: 3, station: 'Blue1' },
          { teamNumber: 4, station: 'Blue2' },
          { teamNumber: 5, station: 'Blue3' },
        ]),
      ],
    };
    const built = buildMatches('ARCHIMEDES', schedule, matches, FAVS);
    expect(built).toHaveLength(1);
    expect(built[0].redAlliance).toEqual([8044, 1, 2]);
    expect(built[0].blueAlliance).toEqual([3, 4, 5]);
    expect(built[0].myFavorites).toEqual([8044]);
    expect(built[0].redScore).toBe(100);
  });

  it('includes a match present in matches but missing from schedule', () => {
    const schedule: RawScheduleEnvelope = { Schedule: [] }; // schedule lagging
    const matches: RawMatchesEnvelope = {
      Matches: [
        live(7, 200, 150, [
          { teamNumber: 8044, station: 'Blue1' },
          { teamNumber: 6, station: 'Blue2' },
          { teamNumber: 7, station: 'Blue3' },
          { teamNumber: 8, station: 'Red1' },
          { teamNumber: 9, station: 'Red2' },
          { teamNumber: 10, station: 'Red3' },
        ]),
      ],
    };
    const built = buildMatches('ARCHIMEDES', schedule, matches, FAVS);
    expect(built).toHaveLength(1);
    expect(built[0].matchNumber).toBe(7);
    expect(built[0].blueAlliance).toContain(8044);
    expect(built[0].myFavorites).toEqual([8044]);
    expect(built[0].redScore).toBe(200);
  });

  it('keeps schedule-only matches (upcoming, no result yet)', () => {
    const schedule: RawScheduleEnvelope = {
      Schedule: [
        sched(15, [
          { teamNumber: 8044, station: 'Red1' },
          { teamNumber: 11, station: 'Red2' },
          { teamNumber: 12, station: 'Red3' },
          { teamNumber: 13, station: 'Blue1' },
          { teamNumber: 14, station: 'Blue2' },
          { teamNumber: 15, station: 'Blue3' },
        ]),
      ],
    };
    const matches: RawMatchesEnvelope = { Matches: [] };
    const built = buildMatches('ARCHIMEDES', schedule, matches, FAVS);
    expect(built).toHaveLength(1);
    expect(built[0].redAlliance).toContain(8044);
    expect(built[0].redScore).toBeUndefined();
    expect(built[0].blueScore).toBeUndefined();
  });

  it('prefers matches.teams over schedule.teams when both have data (replay/surrogate case)', () => {
    const schedule: RawScheduleEnvelope = {
      Schedule: [
        sched(20, [
          { teamNumber: 8044, station: 'Red1' },
          { teamNumber: 100, station: 'Red2' },
          { teamNumber: 200, station: 'Red3' },
          { teamNumber: 300, station: 'Blue1' },
          { teamNumber: 400, station: 'Blue2' },
          { teamNumber: 500, station: 'Blue3' },
        ]),
      ],
    };
    const matches: RawMatchesEnvelope = {
      Matches: [
        live(20, 50, 60, [
          // 8044 swapped out for 999 (e.g., backup robot)
          { teamNumber: 999, station: 'Red1' },
          { teamNumber: 100, station: 'Red2' },
          { teamNumber: 200, station: 'Red3' },
          { teamNumber: 300, station: 'Blue1' },
          { teamNumber: 400, station: 'Blue2' },
          { teamNumber: 500, station: 'Blue3' },
        ]),
      ],
    };
    const built = buildMatches('ARCHIMEDES', schedule, matches, FAVS);
    expect(built).toHaveLength(1);
    expect(built[0].redAlliance).toContain(999);
    expect(built[0].redAlliance).not.toContain(8044);
    expect(built[0].myFavorites).toEqual([]); // 8044 didn't actually play
  });

  it('emits a single Match per (level, matchNumber) — no duplicates from union', () => {
    const schedule: RawScheduleEnvelope = {
      Schedule: [sched(1, [{ teamNumber: 8044, station: 'Red1' }])],
    };
    const matches: RawMatchesEnvelope = {
      Matches: [live(1, 100, 80, [{ teamNumber: 8044, station: 'Red1' }])],
    };
    const built = buildMatches('NEWTON', schedule, matches, FAVS);
    expect(built).toHaveLength(1);
  });

  it('coerces null scoreRedFinal/scoreBlueFinal (FRC unplayed shape) to undefined', () => {
    // Live FRC API returns `scoreRedFinal: null` for unplayed matches.
    // Our domain treats undefined as "no score yet"; null would slip past
    // every `=== undefined` check downstream and flip status / fall-off.
    const schedule: RawScheduleEnvelope = {
      Schedule: [
        sched(50, [
          { teamNumber: 8044, station: 'Red1' },
          { teamNumber: 11, station: 'Red2' },
          { teamNumber: 12, station: 'Red3' },
          { teamNumber: 13, station: 'Blue1' },
          { teamNumber: 14, station: 'Blue2' },
          { teamNumber: 15, station: 'Blue3' },
        ]),
      ],
    };
    const matches: RawMatchesEnvelope = {
      Matches: [
        {
          description: 'Qualification 50',
          matchNumber: 50,
          // The exact shape FRC returns for an unplayed match: null scores.
          scoreRedFinal: null as unknown as undefined,
          scoreBlueFinal: null as unknown as undefined,
          actualStartTime: undefined,
          postResultTime: undefined,
          tournamentLevel: 'Qualification',
          teams: [
            { teamNumber: 8044, station: 'Red1' },
            { teamNumber: 11, station: 'Red2' },
            { teamNumber: 12, station: 'Red3' },
            { teamNumber: 13, station: 'Blue1' },
            { teamNumber: 14, station: 'Blue2' },
            { teamNumber: 15, station: 'Blue3' },
          ],
        },
      ],
    };
    const built = buildMatches('HOPPER', schedule, matches, FAVS);
    expect(built).toHaveLength(1);
    expect(built[0].redScore).toBeUndefined();
    expect(built[0].blueScore).toBeUndefined();
  });
});
