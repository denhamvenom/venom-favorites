/**
 * Fixture-mode loader for the FRC API client.
 *
 * Serves canned 2025 FIRST Championship JSON from `tests/fixtures/2025-houston/`.
 * The same fixture set powers all 5 test stages (A–E); the active phase
 * decides which endpoints return populated data vs. an empty envelope.
 *
 * Stage progression (per plan):
 *   A — rosters only
 *   B — + qual schedule
 *   C — + qual results + rankings
 *   D — + alliances + playoff schedule
 *   E — + playoff results (full replay)
 */

import { logger } from '../lib/logger';
import { DIVISION_FIELDS, type Field } from '../types/domain';

export type FixturePhase = 'A' | 'B' | 'C' | 'D' | 'E';

const PHASE_ORDER: FixturePhase[] = ['A', 'B', 'C', 'D', 'E'];

function phaseAtLeast(active: FixturePhase, threshold: FixturePhase): boolean {
  return PHASE_ORDER.indexOf(active) >= PHASE_ORDER.indexOf(threshold);
}

export type FixtureEndpoint =
  | 'teams'
  | 'schedule-qual'
  | 'schedule-playoff'
  | 'matches-qual'
  | 'matches-playoff'
  | 'rankings'
  | 'alliances'
  | 'events';

const ENDPOINT_MIN_PHASE: Record<FixtureEndpoint, FixturePhase> = {
  events: 'A',
  teams: 'A',
  'schedule-qual': 'B',
  // matches-qual is allowed from phase B onwards — but a per-phase cutoff filter
  // (PHASE_CUTOFFS_MS) trims to only matches actually played by that point in
  // the simulated event timeline. So phase B shows roughly half the quals with
  // scores + the rest still upcoming on the schedule.
  'matches-qual': 'B',
  rankings: 'C',
  alliances: 'D',
  'schedule-playoff': 'D',
  'matches-playoff': 'D',
};

/**
 * Per-phase cutoff timestamp (UTC ms) — matches whose `actualStartTime` is
 * after this cutoff are stripped from the response. The 2025 Championship
 * ran Apr 16-19; cutoffs are hand-picked to mirror the spec's stage progression:
 *
 *   A — before quals begin
 *   B — Thursday mid-afternoon (about half the qual matches played)
 *   C — Friday evening (all quals complete; alliance selection not yet)
 *   D — Saturday morning ~7:30 AM (alliances populated; playoffs not started)
 *   E — Saturday end-of-day (full replay)
 *
 * Houston is America/Chicago (UTC-5 in CDT during Worlds).
 */
const PHASE_CUTOFFS_MS: Record<FixturePhase, number> = {
  A: new Date('2025-04-16T00:00:00-05:00').getTime(),
  B: new Date('2025-04-17T15:00:00-05:00').getTime(),
  C: new Date('2025-04-18T20:00:00-05:00').getTime(),
  D: new Date('2025-04-19T07:30:00-05:00').getTime(),
  E: new Date('2025-04-20T00:00:00-05:00').getTime(),
};

/**
 * `import.meta.glob` bundles the fixture JSON as lazy chunks — they only
 * download on demand when the user enters demo mode from the diagnostics
 * panel, keeping the initial page load slim.
 */
const FIXTURE_FILES = import.meta.glob<{ default: unknown }>(
  '../../tests/fixtures/2025-houston/**/*.json',
);

function fixturePath(endpoint: FixtureEndpoint, division?: Field): string {
  const base = `../../tests/fixtures/2025-houston/${endpoint}`;
  return division ? `${base}/${division}.json` : `${base}.json`;
}

export function getActivePhase(): FixturePhase {
  // Runtime override (set by DiagnosticsPanel) takes precedence over build-time env.
  if (typeof localStorage !== 'undefined') {
    const fromLS = localStorage.getItem('fixturePhase');
    if (typeof fromLS === 'string' && PHASE_ORDER.includes(fromLS as FixturePhase)) {
      return fromLS as FixturePhase;
    }
  }
  const fromEnv = import.meta.env.VITE_FIXTURE_PHASE;
  if (typeof fromEnv === 'string' && PHASE_ORDER.includes(fromEnv as FixturePhase)) {
    return fromEnv as FixturePhase;
  }
  return 'E';
}

interface FixtureRequest {
  endpoint: FixtureEndpoint;
  division?: Field;
}

/**
 * Parse an FRC API path into an endpoint + division pair so we can look
 * up the right fixture file. We intentionally only handle the paths the
 * app actually uses — anything else returns null and the caller logs.
 */
export function parsePath(path: string, query: Record<string, string> = {}): FixtureRequest | null {
  // Strip leading slash + trim trailing slash
  const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '');
  // /2025/events?eventCode=...   (handled separately, not used by the app's runtime path)
  if (/^\d{4}\/events$/.test(trimmed)) {
    return { endpoint: 'events' };
  }
  // /2025/teams?eventCode=ARCHIMEDES
  if (/^\d{4}\/teams$/.test(trimmed)) {
    const code = query.eventCode?.toUpperCase();
    if (!code || !isField(code)) return null;
    return { endpoint: 'teams', division: code };
  }
  // /2025/schedule/ARCHIMEDES/qual  or  /playoff
  const sched = /^\d{4}\/schedule\/([A-Z]+)\/(qual|playoff)$/.exec(trimmed);
  if (sched) {
    const division = sched[1] as Field;
    if (!isField(division)) return null;
    return {
      endpoint: sched[2] === 'qual' ? 'schedule-qual' : 'schedule-playoff',
      division,
    };
  }
  // /2025/matches/ARCHIMEDES?tournamentLevel=qual|playoff
  const matches = /^\d{4}\/matches\/([A-Z]+)$/.exec(trimmed);
  if (matches) {
    const division = matches[1] as Field;
    if (!isField(division)) return null;
    const level = (query.tournamentLevel ?? 'qual').toLowerCase();
    return {
      endpoint: level === 'playoff' ? 'matches-playoff' : 'matches-qual',
      division,
    };
  }
  // /2025/rankings/ARCHIMEDES
  const rank = /^\d{4}\/rankings\/([A-Z]+)$/.exec(trimmed);
  if (rank) {
    const division = rank[1] as Field;
    if (!isField(division)) return null;
    return { endpoint: 'rankings', division };
  }
  // /2025/alliances/ARCHIMEDES
  const all = /^\d{4}\/alliances\/([A-Z]+)$/.exec(trimmed);
  if (all) {
    const division = all[1] as Field;
    if (!isField(division)) return null;
    return { endpoint: 'alliances', division };
  }
  return null;
}

function isField(s: string): s is Field {
  return (DIVISION_FIELDS as readonly string[]).includes(s) || s === 'EINSTEIN';
}

/**
 * Empty envelope per FRC API endpoint. Real shapes have an array under a
 * specific key — we mimic that so the rest of the client doesn't branch.
 */
function emptyEnvelope(endpoint: FixtureEndpoint): unknown {
  switch (endpoint) {
    case 'teams':
      return { teams: [], teamCountTotal: 0 };
    case 'schedule-qual':
    case 'schedule-playoff':
      return { Schedule: [] };
    case 'matches-qual':
    case 'matches-playoff':
      return { Matches: [] };
    case 'rankings':
      return { Rankings: [] };
    case 'alliances':
      return { Alliances: [], count: 0 };
    case 'events':
      return { Events: [], eventCount: 0 };
  }
}

export async function fixtureFetch(
  path: string,
  query: Record<string, string> = {},
  phase: FixturePhase = getActivePhase(),
): Promise<unknown> {
  const parsed = parsePath(path, query);
  if (!parsed) {
    logger.warn('fixture', 'unparseable path', { path, query });
    throw new Error(`fixture: cannot parse path "${path}"`);
  }
  const minPhase = ENDPOINT_MIN_PHASE[parsed.endpoint];
  if (!phaseAtLeast(phase, minPhase)) {
    logger.debug('fixture', 'phase gate: returning empty', {
      endpoint: parsed.endpoint,
      phase,
      minPhase,
    });
    return emptyEnvelope(parsed.endpoint);
  }
  const fileKey = fixturePath(parsed.endpoint, parsed.division);
  const loader = FIXTURE_FILES[fileKey];
  if (!loader) {
    logger.warn('fixture', 'fixture file missing — returning empty', { fileKey, phase });
    return emptyEnvelope(parsed.endpoint);
  }
  const mod = await loader();
  const data = mod.default;
  // For match endpoints, apply the per-phase cutoff so phase B shows only the
  // matches that were "played" by Thursday afternoon, etc.
  if (parsed.endpoint === 'matches-qual' || parsed.endpoint === 'matches-playoff') {
    return filterMatchesByCutoff(data, PHASE_CUTOFFS_MS[phase]);
  }
  return data;
}

interface RawMatchTimestamped {
  actualStartTime?: string;
  postResultTime?: string;
}

interface RawMatchesEnvelopeShape {
  Matches?: RawMatchTimestamped[];
}

function filterMatchesByCutoff(envelope: unknown, cutoffMs: number): unknown {
  if (!envelope || typeof envelope !== 'object') return envelope;
  const e = envelope as RawMatchesEnvelopeShape;
  if (!Array.isArray(e.Matches)) return envelope;
  const filtered = e.Matches.filter((m) => {
    if (!m.actualStartTime) return false;
    // Match timestamps are event-local with no offset; attach Houston CDT (UTC-5).
    const t = new Date(`${m.actualStartTime}-05:00`).getTime();
    return Number.isFinite(t) && t <= cutoffMs;
  });
  return { ...e, Matches: filtered };
}
