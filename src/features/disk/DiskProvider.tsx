import { useEffect, useReducer, type ReactNode } from 'react';
import { DiskContext } from './DiskContext';
import { createDiskState, diskReducer } from './diskState';
export function DiskProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(diskReducer, undefined, createDiskState);
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
    <DiskContext.Provider value={{ state, dispatch }}>
      {children}
    </DiskContext.Provider>
  );
}
