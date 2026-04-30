/**
 * Service-worker update detection.
 *
 * `vite-plugin-pwa` is configured with `registerType: 'autoUpdate'`. That
 * causes the SW to skip waiting and claim clients on its own — but for users
 * with the PWA installed and never closed, the page itself doesn't reload.
 * This hook surfaces an `onNeedRefresh` event so we can show a "new version
 * available — reloading…" toast and trigger a reload after a short delay.
 */

import { useEffect, useRef, useState } from 'react';
import { logger } from '../lib/logger';

export interface UseSwUpdate {
  needRefresh: boolean;
  reload(): void;
}

export function useSwUpdate(): UseSwUpdate {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Lazy-load to keep this off the critical path and avoid SSR/test issues.
        const mod = await import('virtual:pwa-register');
        if (cancelled) return;
        const update = mod.registerSW({
          onNeedRefresh() {
            logger.info('sw', 'new version available — banner shown');
            setNeedRefresh(true);
          },
          onOfflineReady() {
            logger.info('sw', 'app ready to work offline');
          },
        });
        updateRef.current = update;
      } catch (err) {
        // Dev environment without SW, or import failed — fail quiet.
        logger.debug('sw', 'registerSW unavailable', {
          msg: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    needRefresh,
    reload: () => {
      const fn = updateRef.current;
      if (!fn) {
        logger.warn('sw', 'reload called before registerSW resolved — falling back to location.reload');
        location.reload();
        return;
      }
      void fn(true).then(() => setNeedRefresh(false));
    },
  };
}
