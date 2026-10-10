import { useReducer, useEffect, type ReactNode } from 'react';
import { SystemContext } from './SystemContext';
import { createSystemState, systemReducer } from './systemState';
export function SystemProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
      systemReducer,
      undefined,
      createSystemState,
    ),
    { playing, speed } = state.replay;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => dispatch({ type: 'replay', action: { type: 'tick' } }),
      1000 / speed,
    );
    return () => window.clearInterval(timer);
  }, [playing, speed]);
  return (
    <SystemContext.Provider value={{ state, dispatch }}>
      {children}
    </SystemContext.Provider>
  );
}
