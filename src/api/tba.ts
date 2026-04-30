/**
 * The Blue Alliance (TBA) API v3 — diagnostic-only verification source.
 *
 * Used by the Diagnostics panel's "Verify with TBA" section. Compares FRC
 * API match data against TBA's authoritative event data; surfaces missing
 * matches or roster mismatches so we can rule out FRC API as the bug source.
 *
 * NOT a primary data path — venom-favorites' main schedule/results pipeline
 * still runs against the FRC API. This module is purely a side-channel
 * cross-check, gated by the user opening the Diagnostics panel.
 */

import { logger } from '../lib/logger';
import type { Field } from '../types/domain';

const BASE_URL = 'https://www.thebluealliance.com/api/v3';
const API_KEY = import.meta.env.VITE_TBA_API_KEY as string | undefined;

/** TBA's event-key per Worlds 2026 division. */
const DIVISION_TO_TBA_KEY: Record<Exclude<Field, 'EINSTEIN'>, string> = {
  ARCHIMEDES: '2026arc',
  CURIE: '2026cur',
  DALY: '2026dal',
  GALILEO: '2026gal',
  HOPPER: '2026hop',
  JOHNSON: '2026joh',
  MILSTEIN: '2026mil',
  NEWTON: '2026new',
};

export interface TbaSimpleMatch {
  key: string;
  comp_level: 'qm' | 'qf' | 'sf' | 'f' | 'ef';
  match_number: number;
  set_number: number;
  alliances: {
    red: { team_keys: string[]; score: number };
    blue: { team_keys: string[]; score: number };
  };
  winning_alliance: 'red' | 'blue' | '';
  time?: number; // unix seconds
  actual_time?: number;
  predicted_time?: number;
  post_result_time?: number;
}

export function tbaConfigured(): boolean {
  return typeof API_KEY === 'string' && API_KEY.length > 0;
}

async function tbaFetch<T>(path: string): Promise<T> {
  if (!tbaConfigured()) throw new Error('VITE_TBA_API_KEY is not set');
  const res = await fetch(`${BASE_URL}${path}`, { headers: { 'X-TBA-Auth-Key': API_KEY! } });
  if (!res.ok) throw new Error(`TBA ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

/** Fetch TBA's match list (simple shape) for a single division. */
export async function fetchTbaDivisionMatches(division: Field): Promise<TbaSimpleMatch[]> {
  if (division === 'EINSTEIN') return []; // not tracked
  const eventKey = DIVISION_TO_TBA_KEY[division];
  const path = `/event/${eventKey}/matches/simple`;
  const data = await tbaFetch<TbaSimpleMatch[]>(path);
  return data;
}

/** Convert TBA's `frc8044` team key to a plain number. */
export function teamKeyToNumber(key: string): number {
  return parseInt(key.replace(/^frc/, ''), 10);
}

export interface TbaComparisonRow {
  matchNumber: number;
  level: 'qual' | 'playoff';
  inFrc: boolean;
  inTba: boolean;
  redMismatch: boolean;
  blueMismatch: boolean;
}

export interface TbaComparison {
  division: Field;
  totalFrc: number;
  totalTba: number;
  rows: TbaComparisonRow[];
  mismatches: number;
}

/**
 * Compare a division's FRC match list (already-built `Match[]` from useSchedule)
 * against TBA. Returns a row per (level, matchNumber) flagging any divergence.
 * Quals only — playoffs have set_number complications we don't need yet.
 */
export function compareFrcVsTba(
  division: Field,
  frcMatches: Array<{ level: 'qual' | 'playoff' | 'einstein'; matchNumber: number; redAlliance: number[]; blueAlliance: number[] }>,
  tbaMatches: TbaSimpleMatch[],
): TbaComparison {
  const rows: TbaComparisonRow[] = [];
  const tbaQuals = tbaMatches.filter((t) => t.comp_level === 'qm');
  const frcQuals = frcMatches.filter((m) => m.level === 'qual');

  const frcByNum = new Map<number, (typeof frcQuals)[number]>();
  for (const m of frcQuals) frcByNum.set(m.matchNumber, m);
  const tbaByNum = new Map<number, TbaSimpleMatch>();
  for (const t of tbaQuals) tbaByNum.set(t.match_number, t);

  const allNums = new Set<number>([...frcByNum.keys(), ...tbaByNum.keys()]);
  let mismatches = 0;
  for (const n of [...allNums].sort((a, b) => a - b)) {
    const f = frcByNum.get(n);
    const t = tbaByNum.get(n);
    let redMismatch = false;
    let blueMismatch = false;
    if (f && t) {
      const tbaRed = t.alliances.red.team_keys.map(teamKeyToNumber).sort();
      const tbaBlue = t.alliances.blue.team_keys.map(teamKeyToNumber).sort();
      const frcRed = [...f.redAlliance].sort();
      const frcBlue = [...f.blueAlliance].sort();
      redMismatch = JSON.stringify(tbaRed) !== JSON.stringify(frcRed);
      blueMismatch = JSON.stringify(tbaBlue) !== JSON.stringify(frcBlue);
    }
    const row: TbaComparisonRow = {
      matchNumber: n,
      level: 'qual',
      inFrc: !!f,
      inTba: !!t,
      redMismatch,
      blueMismatch,
    };
    rows.push(row);
    if (!row.inFrc || !row.inTba || row.redMismatch || row.blueMismatch) mismatches++;
  }

  logger.info('tba', `compared ${division}: ${mismatches} mismatch(es)`, {
    totalFrc: frcQuals.length,
    totalTba: tbaQuals.length,
  });

  return {
    division,
    totalFrc: frcQuals.length,
    totalTba: tbaQuals.length,
    rows,
    mismatches,
  };
}
