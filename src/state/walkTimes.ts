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
const CYCLE_OVERRIDE_KEY = 'cycle-override/v1';

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
  /** User-set baseline cycle time in minutes; null means use the per-year default. */
  cycleOverrideMin: number | null;
  setCycleOverrideMin(value: number | null): void;
  reset(): void;
}

function readCycleOverride(): number | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(CYCLE_OVERRIDE_KEY);
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function writeCycleOverride(value: number | null): void {
  if (typeof localStorage === 'undefined') return;
  if (value === null) localStorage.removeItem(CYCLE_OVERRIDE_KEY);
  else localStorage.setItem(CYCLE_OVERRIDE_KEY, String(value));
}

export function useWalkTimes(): UseWalkTimes {
  const [overrides, setOverrides] = useState<WalkOverrides>(() => read());
  const [cycleOverrideMin, setCycleOverrideMinState] = useState<number | null>(() =>
    readCycleOverride(),
  );

  useEffect(() => {
    write(overrides);
  }, [overrides]);

  useEffect(() => {
    writeCycleOverride(cycleOverrideMin);
  }, [cycleOverrideMin]);

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

  const setCycleOverrideMin = useCallback((value: number | null) => {
    setCycleOverrideMinState(value);
  }, []);

  const reset = useCallback(() => {
    setOverrides({});
    setCycleOverrideMinState(null);
  }, []);

  return { overrides, setOverride, cycleOverrideMin, setCycleOverrideMin, reset };
}
