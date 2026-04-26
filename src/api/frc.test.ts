import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('frc.getDataSource', () => {
  it("returns 'fixture' when VITE_DATA_SOURCE=fixture", async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'fixture');
    const { getDataSource } = await import('./frc');
    expect(getDataSource()).toBe('fixture');
  });

  it("returns 'proxy' when localStorage.useProxy is set", async () => {
    vi.stubEnv('VITE_DATA_SOURCE', '');
    localStorage.setItem('useProxy', '1');
    const { getDataSource } = await import('./frc');
    expect(getDataSource()).toBe('proxy');
  });

  it("defaults to 'live'", async () => {
    vi.stubEnv('VITE_DATA_SOURCE', '');
    const { getDataSource } = await import('./frc');
    expect(getDataSource()).toBe('live');
  });
});

describe('frc.frcFetch', () => {
  it('routes through fixture loader when source is fixture', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'fixture');
    const { frcFetch } = await import('./frc');
    // No fixtures captured yet, but for a path the loader cannot parse it should throw.
    await expect(frcFetch('/2026/nonsense')).rejects.toThrow(/cannot parse/);
  });

  it('throws helpful error when live creds are missing', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', '');
    vi.stubEnv('VITE_FRC_USER', '');
    vi.stubEnv('VITE_FRC_TOKEN', '');
    const { frcFetch } = await import('./frc');
    await expect(frcFetch('/2026/teams', { query: { eventCode: 'CURIE' } })).rejects.toThrow(
      /credentials missing/i,
    );
  });
});
