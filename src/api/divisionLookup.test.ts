import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubEnv('VITE_DATA_SOURCE', 'fixture');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('divisionLookup.findTeamDivision', () => {
  it('finds team 8044 in ARCHIMEDES from 2025 captured fixtures', async () => {
    const { findTeamDivision } = await import('./divisionLookup');
    const result = await findTeamDivision(8044, 2025);
    expect(result).not.toBeNull();
    expect(result?.division).toBe('ARCHIMEDES');
    expect(result?.team.teamNumber).toBe(8044);
  });

  it('returns null for a team number not at the event', async () => {
    const { findTeamDivision } = await import('./divisionLookup');
    const result = await findTeamDivision(99999, 2025);
    expect(result).toBeNull();
  });

  it('returns the division containing the team when a roster matches', async () => {
    vi.doMock('./frc', () => ({
      frcFetch: vi.fn().mockImplementation(async (_path: string, opts: { query?: { eventCode?: string } }) => {
        if (opts.query?.eventCode === 'NEWTON') {
          return { teams: [{ teamNumber: 8044, nameShort: 'Denham Venom' }], teamCountTotal: 1 };
        }
        return { teams: [], teamCountTotal: 0 };
      }),
    }));
    const { findTeamDivision } = await import('./divisionLookup');
    const result = await findTeamDivision(8044, 2026);
    expect(result).not.toBeNull();
    expect(result?.division).toBe('NEWTON');
    expect(result?.team.teamNumber).toBe(8044);
  });
});
