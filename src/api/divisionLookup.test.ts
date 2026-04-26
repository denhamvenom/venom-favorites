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
  it('returns null when no fixture data is captured (current state)', async () => {
    const { findTeamDivision } = await import('./divisionLookup');
    const result = await findTeamDivision(8044, 2025);
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
