/**
 * FRC API client.
 *
 * Three sources, switchable at runtime:
 *   - 'live'    direct calls to frc-api.firstinspires.org (basic auth)
 *   - 'fixture' canned 2025 Championship JSON for the 5-stage test progression
 *   - 'proxy'   Firebase Function passthrough (set automatically when CORS preflight fails)
 */

import { logger } from '../lib/logger';
import { fixtureFetch } from './fixtureLoader';

export type DataSource = 'live' | 'fixture' | 'proxy';

const LIVE_BASE = 'https://frc-api.firstinspires.org/v3.0';
const PROXY_BASE = '/frcProxy'; // hosted on the same Firebase project; rewrites resolve to the function

export function getDataSource(): DataSource {
  // Runtime override from DiagnosticsPanel takes precedence over everything.
  if (typeof localStorage !== 'undefined') {
    const override = localStorage.getItem('dataSourceOverride');
    if (override === 'fixture' || override === 'proxy') return override;
    if (override === 'live') return 'live'; // explicit live ignores env + proxy flag
  }
  const explicit = import.meta.env.VITE_DATA_SOURCE as string | undefined;
  if (explicit === 'fixture') return 'fixture';
  if (typeof localStorage !== 'undefined' && localStorage.getItem('useProxy') === '1') {
    return 'proxy';
  }
  return 'live';
}

function basicAuthHeader(): string | null {
  const user = import.meta.env.VITE_FRC_USER;
  const token = import.meta.env.VITE_FRC_TOKEN;
  if (!user || !token) return null;
  // btoa is fine in browser context; tokens are short ASCII.
  return `Basic ${btoa(`${user}:${token}`)}`;
}

interface FetchOptions {
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

function buildQueryString(query?: Record<string, string | number | undefined>): string {
  if (!query) return '';
  const entries = Object.entries(query).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  const params = new URLSearchParams();
  for (const [k, v] of entries) params.set(k, String(v));
  return `?${params.toString()}`;
}

async function liveFetch<T>(path: string, opts: FetchOptions): Promise<T> {
  const auth = basicAuthHeader();
  if (!auth) {
    throw new Error('FRC API credentials missing — set VITE_FRC_USER and VITE_FRC_TOKEN in .env.local');
  }
  const url = `${LIVE_BASE}${path}${buildQueryString(opts.query)}`;
  const start = performance.now();
  const res = await fetch(url, {
    headers: { Authorization: auth, Accept: 'application/json' },
    signal: opts.signal,
  });
  const ms = Math.round(performance.now() - start);
  logger.debug('api', `${res.status} GET ${path}`, { ms, source: 'live' });
  if (!res.ok) throw new Error(`FRC API ${res.status}: ${path}`);
  return (await res.json()) as T;
}

async function proxyFetch<T>(path: string, opts: FetchOptions): Promise<T> {
  const qs = buildQueryString(opts.query);
  const proxyPath = path.replace(/^\/+/, '');
  const url = `${PROXY_BASE}?path=${encodeURIComponent(proxyPath)}${qs.replace('?', '&')}`;
  const start = performance.now();
  const res = await fetch(url, { signal: opts.signal });
  const ms = Math.round(performance.now() - start);
  logger.debug('api', `${res.status} GET ${path}`, { ms, source: 'proxy' });
  if (!res.ok) throw new Error(`Proxy ${res.status}: ${path}`);
  return (await res.json()) as T;
}

async function fixtureFetchTyped<T>(path: string, opts: FetchOptions): Promise<T> {
  const queryStrings: Record<string, string> = {};
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) queryStrings[k] = String(v);
    }
  }
  const start = performance.now();
  const result = await fixtureFetch(path, queryStrings);
  logger.debug('api', `200 GET ${path}`, { ms: Math.round(performance.now() - start), source: 'fixture' });
  return result as T;
}

/**
 * Top-level fetcher with source dispatch + 1 retry on transient failure.
 * `path` is the FRC API path *without* the base URL, e.g. "/2026/teams".
 */
export async function frcFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const source = getDataSource();
  const tryOnce = (): Promise<T> => {
    if (source === 'fixture') return fixtureFetchTyped<T>(path, opts);
    if (source === 'proxy') return proxyFetch<T>(path, opts);
    return liveFetch<T>(path, opts);
  };
  try {
    return await tryOnce();
  } catch (err) {
    // Single retry on transient errors. Proxy errors get retried too — the function might be cold.
    const msg = err instanceof Error ? err.message : String(err);
    if (/^FRC API 5\d{2}/.test(msg) || /^Proxy 5\d{2}/.test(msg) || msg.includes('NetworkError')) {
      logger.warn('api', 'retrying after transient error', { path, msg });
      await new Promise((r) => setTimeout(r, 500));
      return tryOnce();
    }
    throw err;
  }
}
