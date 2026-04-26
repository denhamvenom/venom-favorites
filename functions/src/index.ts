import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const FRC_USER = defineSecret('FRC_USER');
const FRC_TOKEN = defineSecret('FRC_TOKEN');

const FRC_BASE = 'https://frc-api.firstinspires.org/v3.0';
const ALLOWED_ORIGINS = [
  'https://venom-favorites.web.app',
  'https://venom-favorites.firebaseapp.com',
  'http://localhost:5173',
];

/**
 * Lazy CORS proxy for the FRC API.
 * Only deployed if the first-run CORS preflight in the client fails.
 * Forwards GET requests verbatim, injecting basic auth + permissive CORS headers.
 */
export const frcProxy = onRequest(
  { secrets: [FRC_USER, FRC_TOKEN], cors: ALLOWED_ORIGINS, region: 'us-central1' },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).send('method not allowed');
      return;
    }

    const path = String(req.query.path ?? '').replace(/^\/+/, '');
    if (!path) {
      res.status(400).send('missing ?path');
      return;
    }
    // Whitelist allowed FRC API paths to prevent the function from being abused as an open proxy.
    if (!/^\d{4}\/(events|teams|schedule|matches|rankings|alliances)/.test(path)) {
      res.status(400).send('disallowed path');
      return;
    }

    const auth = Buffer.from(`${FRC_USER.value()}:${FRC_TOKEN.value()}`).toString('base64');
    const upstreamUrl = `${FRC_BASE}/${path}`;
    const upstream = await fetch(upstreamUrl, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });

    res.status(upstream.status);
    res.set('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
    const body = await upstream.text();
    res.send(body);
  },
);
