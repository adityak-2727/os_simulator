import { useEffect, useReducer, type ReactNode } from 'react';
import { SyncContext } from './SyncContext';
import { createSyncState, syncReducer } from './syncState';
export function SyncProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(syncReducer, undefined, createSyncState);
  const { playing, speed } = state.replay;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => dispatch({ type: 'replay', action: { type: 'tick' } }),
      1000 / speed,
    );
    return () => window.clearInterval(timer);
  }, [playing, speed]);
  return (
    <SyncContext.Provider value={{ state, dispatch }}>
      {children}
    </SyncContext.Provider>
  );
}
