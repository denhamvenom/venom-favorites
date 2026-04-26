import { describe, expect, it } from 'vitest';
import { parsePath } from './fixtureLoader';

describe('fixtureLoader.parsePath', () => {
  it('parses /YYYY/teams?eventCode=CURIE', () => {
    expect(parsePath('/2025/teams', { eventCode: 'CURIE' })).toEqual({
      endpoint: 'teams',
      division: 'CURIE',
    });
  });

  it('parses /YYYY/schedule/<DIV>/qual', () => {
    expect(parsePath('/2025/schedule/ARCHIMEDES/qual')).toEqual({
      endpoint: 'schedule-qual',
      division: 'ARCHIMEDES',
    });
  });

  it('parses /YYYY/schedule/<DIV>/playoff', () => {
    expect(parsePath('/2025/schedule/HOPPER/playoff')).toEqual({
      endpoint: 'schedule-playoff',
      division: 'HOPPER',
    });
  });

  it('parses /YYYY/matches/<DIV>?tournamentLevel=qual', () => {
    expect(parsePath('/2025/matches/MILSTEIN', { tournamentLevel: 'qual' })).toEqual({
      endpoint: 'matches-qual',
      division: 'MILSTEIN',
    });
  });

  it('parses /YYYY/matches/<DIV>?tournamentLevel=playoff', () => {
    expect(parsePath('/2025/matches/NEWTON', { tournamentLevel: 'playoff' })).toEqual({
      endpoint: 'matches-playoff',
      division: 'NEWTON',
    });
  });

  it('defaults matches without tournamentLevel to qual', () => {
    expect(parsePath('/2025/matches/DALY')).toEqual({
      endpoint: 'matches-qual',
      division: 'DALY',
    });
  });

  it('parses /YYYY/rankings/<DIV>', () => {
    expect(parsePath('/2025/rankings/GALILEO')).toEqual({
      endpoint: 'rankings',
      division: 'GALILEO',
    });
  });

  it('parses /YYYY/alliances/<DIV>', () => {
    expect(parsePath('/2025/alliances/JOHNSON')).toEqual({
      endpoint: 'alliances',
      division: 'JOHNSON',
    });
  });

  it('returns null for unknown divisions', () => {
    expect(parsePath('/2025/teams', { eventCode: 'BOGUS' })).toBeNull();
  });

  it('returns null for unparseable paths', () => {
    expect(parsePath('/2025/whatever/nope')).toBeNull();
  });
});
