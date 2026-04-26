/**
 * Editable walk-time overrides matrix, stored in localStorage.
 *
 * Daniel will tune these on Day 1 once he's actually walking the floor.
 * The hook returns the override matrix + setters, plus a "reset to defaults"
 * helper that wipes overrides so `walkMinutes` falls back to the formula.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Field } from '../types/domain';
import type { WalkOverrides } from '../logic/walking';

const STORAGE_KEY = 'walk-overrides/v1';

function read(): WalkOverrides {
  if (typeof localStorage === 'undefined') return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as WalkOverrides) : {};
  } catch {
    return {};
  }
}

function write(value: WalkOverrides): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export interface UseWalkTimes {
  overrides: WalkOverrides;
  setOverride(from: Field, to: Field, minutes: number | null): void;
  reset(): void;
}

export function useWalkTimes(): UseWalkTimes {
  const [overrides, setOverrides] = useState<WalkOverrides>(() => read());

  useEffect(() => {
    write(overrides);
  }, [overrides]);

  const setOverride = useCallback((from: Field, to: Field, minutes: number | null) => {
    setOverrides((prev) => {
      const next: WalkOverrides = { ...prev, [from]: { ...(prev[from] ?? {}) } };
      const fromMap = next[from]!;
      if (minutes === null) {
        delete fromMap[to];
        if (Object.keys(fromMap).length === 0) delete next[from];
      } else {
        fromMap[to] = minutes;
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => setOverrides({}), []);

  return { overrides, setOverride, reset };
}
