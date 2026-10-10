import { useReducer, type ReactNode } from 'react';
import { ExperimentContext } from './ExperimentContext';
import {
  readExperiments,
  writeExperiments,
  readPreferences,
  writePreferences,
} from './storage';
import type { ExperimentV1 } from './format';
interface State {
  items: readonly ExperimentV1[];
  message: string;
  locked: boolean;
  filter: string;
}
type Action =
  | { type: 'items'; items: readonly ExperimentV1[] }
  | { type: 'notice'; message: string }
  | { type: 'filter'; filter: string };
function initial(): State {
  try {
    const r = readExperiments(window.localStorage),
      p = readPreferences(window.localStorage);
    return {
      items: r.ok ? r.value : [],
      message: r.ok ? (p.ok ? '' : p.message) : r.message,
      locked: !r.ok,
      filter: p.ok ? p.value.moduleFilter : 'all',
    };
  } catch {
    return {
      items: [],
      message:
        'Local storage is unavailable. Current work remains accessible; use JSON export.',
      locked: true,
      filter: 'all',
    };
  }
}
function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'items':
      return { ...s, items: a.items, message: 'Saved locally.' };
    case 'notice':
      return { ...s, message: a.message };
    case 'filter':
      return { ...s, filter: a.filter };
  }
}
export function ExperimentProvider({ children }: { children: ReactNode }) {
  const [s, dispatch] = useReducer(reducer, undefined, initial);
  const notice = (message: string) => dispatch({ type: 'notice', message });
  const commit = (items: readonly ExperimentV1[]) => {
    if (s.locked) {
      notice(
        'Existing storage could not be validated. It was preserved. Export JSON to keep your current work.',
      );
      return false;
    }
    try {
      const r = writeExperiments(window.localStorage, items);
      if (!r.ok) {
        notice(r.message);
        return false;
      }
      dispatch({ type: 'items', items: r.value });
      return true;
    } catch {
      notice(
        'Local storage is unavailable. Current work was preserved; use JSON export.',
      );
      return false;
    }
  };
  const setFilter = (filter: string) => {
    dispatch({ type: 'filter', filter });
    try {
      const r = writePreferences(window.localStorage, {
        schemaVersion: 1,
        moduleFilter: filter,
      });
      if (!r.ok) notice(r.message);
    } catch {
      notice('Filter changed for this session; preferences are unavailable.');
    }
  };
  return (
    <ExperimentContext.Provider value={{ ...s, commit, notice, setFilter }}>
      {children}
    </ExperimentContext.Provider>
  );
}
