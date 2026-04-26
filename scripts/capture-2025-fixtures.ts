/**
 * One-shot capture of the 2025 FIRST Championship into the fixture directory.
 *
 * Hits the live FRC API for all 8 divisions across 7 endpoints and writes
 * the raw JSON envelopes to `tests/fixtures/2025-houston/<endpoint>/<DIVISION>.json`.
 *
 * Run: `node --import tsx ./scripts/capture-2025-fixtures.ts`
 *
 * Reads creds from environment (loaded from .env.local by the npm wrapper):
 *   FRC_USER, FRC_TOKEN
 *
 * Idempotent — re-running overwrites with current upstream state. The 2025
 * season is finalized so subsequent runs should be noops, but safe to retry.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEASON = 2025;
const BASE = `https://frc-api.firstinspires.org/v3.0/${SEASON}`;
const DIVISIONS = ['ARCHIMEDES', 'CURIE', 'DALY', 'GALILEO', 'HOPPER', 'JOHNSON', 'MILSTEIN', 'NEWTON'] as const;

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '..', 'tests', 'fixtures', '2025-houston');

interface Endpoint {
  /** Slug used for the on-disk subdirectory. */
  slug: string;
  /** Build URL given a division code. */
  url: (division: string) => string;
}

const ENDPOINTS: Endpoint[] = [
  { slug: 'teams', url: (d) => `${BASE}/teams?eventCode=${d}` },
  { slug: 'schedule-qual', url: (d) => `${BASE}/schedule/${d}/qual` },
  { slug: 'schedule-playoff', url: (d) => `${BASE}/schedule/${d}/playoff` },
  { slug: 'matches-qual', url: (d) => `${BASE}/matches/${d}?tournamentLevel=qual` },
  { slug: 'matches-playoff', url: (d) => `${BASE}/matches/${d}?tournamentLevel=playoff` },
  { slug: 'rankings', url: (d) => `${BASE}/rankings/${d}` },
  { slug: 'alliances', url: (d) => `${BASE}/alliances/${d}` },
];

async function loadEnv(): Promise<{ user: string; token: string }> {
  let user = process.env.FRC_USER ?? process.env.VITE_FRC_USER ?? '';
  let token = process.env.FRC_TOKEN ?? process.env.VITE_FRC_TOKEN ?? '';
  if (!user || !token) {
    const envPath = resolve(HERE, '..', '.env.local');
    if (existsSync(envPath)) {
      const text = await readFile(envPath, 'utf-8');
      for (const line of text.split(/\r?\n/)) {
        const m = /^\s*(VITE_FRC_USER|VITE_FRC_TOKEN|FRC_USER|FRC_TOKEN)\s*=\s*(.+?)\s*$/.exec(line);
        if (m) {
          const v = m[2].replace(/^['"]|['"]$/g, '');
          if (m[1].endsWith('USER')) user ||= v;
          if (m[1].endsWith('TOKEN')) token ||= v;
        }
      }
    }
  }
  if (!user || !token) {
    throw new Error('Missing FRC creds — set FRC_USER + FRC_TOKEN env vars or VITE_FRC_USER + VITE_FRC_TOKEN in .env.local');
  }
  return { user, token };
}

async function captureOne(endpoint: Endpoint, division: string, auth: string): Promise<void> {
  const url = endpoint.url(division);
  const res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } });
  if (!res.ok) {
    console.warn(`  [warn] ${endpoint.slug}/${division} → HTTP ${res.status}`);
    return;
  }
  const json = await res.json();
  const outFile = join(OUT_DIR, endpoint.slug, `${division}.json`);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(json, null, 2));
  process.stdout.write(`.`);
}

async function main(): Promise<void> {
  const { user, token } = await loadEnv();
  const auth = `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`;
  console.log(`Capturing ${SEASON} Championship → ${OUT_DIR}`);
  console.log(`${ENDPOINTS.length} endpoints × ${DIVISIONS.length} divisions = ${ENDPOINTS.length * DIVISIONS.length} requests`);
  for (const endpoint of ENDPOINTS) {
    process.stdout.write(`  ${endpoint.slug.padEnd(18)} `);
    for (const division of DIVISIONS) {
      await captureOne(endpoint, division, auth);
    }
    process.stdout.write('\n');
  }
  console.log('done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
