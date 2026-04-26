/**
 * Favorites persistence over localStorage.
 *
 * The favorites list is the entry point to everything else — schedule fetches
 * derive their division set from this list, results-tab cards iterate over it,
 * Saturday Mode statuses are computed per favorite. Keep the shape stable.
 *
 * Storage key: `favorites/v1`. Bump the suffix if the shape ever changes
 * incompatibly so old clients fall back to an empty list rather than crashing.
 */

import { useCallback, useEffect, useState } from 'react';
import { logger } from '../lib/logger';
import type { Favorite } from '../types/domain';

const STORAGE_KEY = 'favorites/v1';

function readStorage(): Favorite[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Favorite[];
  } catch (err) {
    logger.warn('storage', 'favorites parse failed — resetting', {
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

function writeStorage(list: Favorite[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export interface UseFavorites {
  favorites: Favorite[];
  add(fav: Favorite): boolean;
  remove(teamNumber: number): void;
  has(teamNumber: number): boolean;
  update(teamNumber: number, patch: Partial<Favorite>): void;
  /**
   * Set or clear the super-favorite. Pass a team number to mark that team as super
   * (clearing any prior super); pass null to clear without setting a new one.
   * Single-super invariant is enforced here.
   */
  setSuper(teamNumber: number | null): void;
  /** The currently super-favorite team number, or undefined. */
  superTeamNumber: number | undefined;
  clear(): void;
}

export function useFavorites(): UseFavorites {
  const [favorites, setFavorites] = useState<Favorite[]>(() => readStorage());

  useEffect(() => {
    writeStorage(favorites);
  }, [favorites]);

  // Cross-tab sync: react when another tab writes to the same storage key.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      setFavorites(readStorage());
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
  }, []);

  const add = useCallback((fav: Favorite): boolean => {
    let added = false;
    setFavorites((prev) => {
      if (prev.some((f) => f.teamNumber === fav.teamNumber)) return prev;
      added = true;
      logger.info('storage', `add favorite ${fav.teamNumber} (${fav.division})`);
      return [...prev, fav];
    });
    return added;
  }, []);

  const remove = useCallback((teamNumber: number) => {
    setFavorites((prev) => {
      if (!prev.some((f) => f.teamNumber === teamNumber)) return prev;
      logger.info('storage', `remove favorite ${teamNumber}`);
      return prev.filter((f) => f.teamNumber !== teamNumber);
    });
  }, []);

  const setSuper = useCallback((teamNumber: number | null) => {
    setFavorites((prev) => {
      if (teamNumber === null) {
        // Clear any current super.
        if (!prev.some((f) => f.isSuper)) return prev;
        logger.info('storage', 'clear super-favorite');
        return prev.map((f) => (f.isSuper ? { ...f, isSuper: false } : f));
      }
      // Toggle: if the target is already super, clear; otherwise set + clear others.
      const current = prev.find((f) => f.teamNumber === teamNumber);
      if (!current) return prev;
      if (current.isSuper) {
        logger.info('storage', `clear super-favorite (was ${teamNumber})`);
        return prev.map((f) => (f.isSuper ? { ...f, isSuper: false } : f));
      }
      logger.info('storage', `set super-favorite ${teamNumber}`);
      return prev.map((f) =>
        f.teamNumber === teamNumber ? { ...f, isSuper: true } : f.isSuper ? { ...f, isSuper: false } : f,
      );
    });
  }, []);

  const superTeamNumber = favorites.find((f) => f.isSuper)?.teamNumber;

  const has = useCallback(
    (teamNumber: number) => favorites.some((f) => f.teamNumber === teamNumber),
    [favorites],
  );

  const update = useCallback((teamNumber: number, patch: Partial<Favorite>) => {
    setFavorites((prev) =>
      prev.map((f) => (f.teamNumber === teamNumber ? { ...f, ...patch } : f)),
    );
  }, []);

  const clear = useCallback(() => setFavorites([]), []);

  return { favorites, add, remove, has, update, setSuper, superTeamNumber, clear };
}
