import { useEffect, useReducer, type ReactNode } from 'react';
import { createMemoryState, memoryReducer } from './memoryState';
import { MemoryContext } from './MemoryContext';
export function MemoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    memoryReducer,
    undefined,
    createMemoryState,
  );
  const a = state.allocation.replay,
    p = state.paging.replay;
  useEffect(() => {
    if (!a.playing) return;
    const timer = window.setInterval(
      () =>
        dispatch({
          type: 'replay',
          lab: 'allocation',
          action: { type: 'tick' },
        }),
      1000 / a.speed,
    );
    return () => window.clearInterval(timer);
  }, [a.playing, a.speed]);
  useEffect(() => {
    if (!p.playing) return;
    const timer = window.setInterval(
      () =>
        dispatch({ type: 'replay', lab: 'paging', action: { type: 'tick' } }),
      1000 / p.speed,
    );
    return () => window.clearInterval(timer);
  }, [p.playing, p.speed]);
  return (
    <MemoryContext.Provider value={{ state, dispatch }}>
      {children}
    </MemoryContext.Provider>
  );
}
