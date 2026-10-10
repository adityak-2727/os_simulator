import { createContext, useContext, type Dispatch } from 'react';
import type { SyncAction, SyncState } from './syncState';
export const SyncContext = createContext<{
  state: SyncState;
  dispatch: Dispatch<SyncAction>;
} | null>(null);
export function useSync() {
  const c = useContext(SyncContext);
  if (!c) throw new Error('Synchronization controls require SyncProvider.');
  return c;
}
