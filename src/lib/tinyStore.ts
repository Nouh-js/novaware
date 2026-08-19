import { useSyncExternalStore } from 'react';

export type Store<T> = {
  getState: () => T;
  setState: (updater: (s: T) => T) => void;
  subscribe: (cb: () => void) => () => void;
  useStore: () => T;
};

export function create<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const getState = () => state;
  const setState = (updater: (s: T) => T) => {
    state = updater(state);
    listeners.forEach((l) => l());
  };
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };
  const useStore = () =>
    useSyncExternalStore(
      subscribe,
      getState,
      getState,
    );
  return { getState, setState, subscribe, useStore };
}
