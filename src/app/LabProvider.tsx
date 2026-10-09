import { useEffect, useReducer, type ReactNode } from 'react';
import { LabContext } from './LabContext';
import { createInitialLab, labReducer } from './labReducer';

export function LabProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(labReducer, undefined, createInitialLab);
  useEffect(() => {
    if (!state.replay.playing) return;
    const timer = window.setInterval(
      () => dispatch({ type: 'replay', action: { type: 'tick' } }),
      1000 / state.replay.speed,
    );
    return () => window.clearInterval(timer);
  }, [state.replay.playing, state.replay.speed]);
  return (
    <LabContext.Provider value={{ state, dispatch }}>
      {children}
    </LabContext.Provider>
  );
}
