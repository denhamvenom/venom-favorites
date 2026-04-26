import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFavorites } from './favorites';
import type { Favorite } from '../types/domain';

const sampleFav: Favorite = {
  teamNumber: 254,
  teamName: 'The Cheesy Poofs',
  division: 'NEWTON',
  status: 'qualifying',
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('useFavorites', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it('add() persists to localStorage and returns true on first add', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      const added = result.current.add(sampleFav);
      expect(added).toBe(true);
    });
    expect(result.current.favorites).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('favorites/v1')!)).toEqual([sampleFav]);
  });

  it('add() de-duplicates by teamNumber', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.add(sampleFav);
      const second = result.current.add(sampleFav);
      expect(second).toBe(false);
    });
    expect(result.current.favorites).toHaveLength(1);
  });

  it('remove() drops by teamNumber', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.add(sampleFav);
      result.current.remove(254);
    });
    expect(result.current.favorites).toHaveLength(0);
  });

  it('update() patches a single favorite', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.add(sampleFav);
      result.current.update(254, { status: 'selected', allianceNumber: 1 });
    });
    expect(result.current.favorites[0]).toMatchObject({
      status: 'selected',
      allianceNumber: 1,
    });
  });

  it('rehydrates from localStorage on next mount', () => {
    localStorage.setItem('favorites/v1', JSON.stringify([sampleFav]));
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([sampleFav]);
  });

  it('falls back to empty list when storage is malformed', () => {
    localStorage.setItem('favorites/v1', 'not json');
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it('setSuper marks a single favorite super and reports superTeamNumber', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.add(sampleFav);
      result.current.add({ ...sampleFav, teamNumber: 118, teamName: 'Robonauts', division: 'MILSTEIN' });
      result.current.setSuper(254);
    });
    expect(result.current.favorites.find((f) => f.teamNumber === 254)?.isSuper).toBe(true);
    expect(result.current.favorites.find((f) => f.teamNumber === 118)?.isSuper).toBeFalsy();
    expect(result.current.superTeamNumber).toBe(254);
  });

  it('setSuper enforces single-super invariant — promoting a different team unsets the prior', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.add(sampleFav);
      result.current.add({ ...sampleFav, teamNumber: 118, teamName: 'Robonauts', division: 'MILSTEIN' });
      result.current.setSuper(254);
      result.current.setSuper(118);
    });
    expect(result.current.favorites.find((f) => f.teamNumber === 254)?.isSuper).toBeFalsy();
    expect(result.current.favorites.find((f) => f.teamNumber === 118)?.isSuper).toBe(true);
    expect(result.current.superTeamNumber).toBe(118);
  });

  it('setSuper(null) clears any current super', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.add(sampleFav);
      result.current.setSuper(254);
      result.current.setSuper(null);
    });
    expect(result.current.superTeamNumber).toBeUndefined();
  });

  it('setSuper(teamNumber) on the existing super clears it (toggle)', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.add(sampleFav);
      result.current.setSuper(254);
      result.current.setSuper(254);
    });
    expect(result.current.superTeamNumber).toBeUndefined();
  });
});
