/**
 * One-time CORS preflight against the live FRC API.
 *
 * The FRC API has historically been inconsistent on CORS. On the very first
 * app load (in non-fixture mode), we hit a benign endpoint and check whether
 * the browser will accept the response. If it fails, we flip
 * `localStorage.useProxy = '1'` and the api client routes through the
 * Firebase Function from then on.
 *
 * Skipped entirely in fixture mode.
 */

import { logger } from '../lib/logger';

const LIVE_PROBE_URL = 'https://frc-api.firstinspires.org/v3.0/2026/events?eventCode=CMPTX';
const FLAG_TESTED = 'frcCorsTested';
const FLAG_USE_PROXY = 'useProxy';

function authHeader(): string | null {
  const user = import.meta.env.VITE_FRC_USER;
  const token = import.meta.env.VITE_FRC_TOKEN;
  if (!user || !token) return null;
  return `Basic ${btoa(`${user}:${token}`)}`;
}

export async function ensureCorsTested(): Promise<void> {
  if (import.meta.env.VITE_DATA_SOURCE === 'fixture') {
    logger.debug('cors', 'skipping preflight in fixture mode');
    return;
  }
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(FLAG_TESTED) === '1') return;

  const auth = authHeader();
  if (!auth) {
    // No creds yet — defer the test until they're provided. Don't flip useProxy
    // yet because we can't tell whether CORS or auth would have failed first.
    logger.warn('cors', 'preflight skipped — credentials not configured');
    return;
  }

  try {
    const res = await fetch(LIVE_PROBE_URL, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    // Any HTTP response that came back through the browser means CORS succeeded.
    // 401 just means the token is wrong — still a valid CORS round-trip.
    logger.info('cors', 'preflight ok — direct mode', { status: res.status });
    localStorage.setItem(FLAG_USE_PROXY, '0');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('cors', 'preflight failed — switching to proxy', { msg });
    localStorage.setItem(FLAG_USE_PROXY, '1');
  } finally {
    localStorage.setItem(FLAG_TESTED, '1');
  }
}

export function resetCorsTest(): void {
  localStorage.removeItem(FLAG_TESTED);
  localStorage.removeItem(FLAG_USE_PROXY);
}
