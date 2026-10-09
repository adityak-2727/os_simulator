import { useEffect, useReducer, type ReactNode } from 'react';
import { CpuContext } from './CpuContext';
import { cpuReducer, createInitialCpu } from './cpuState';

export function CpuProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cpuReducer, undefined, createInitialCpu);
  useEffect(() => {
    if (!state.replay.playing) return;
    const timer = window.setInterval(
      () => dispatch({ type: 'replay', action: { type: 'tick' } }),
      1000 / state.replay.speed,
    );
    return () => window.clearInterval(timer);
  }, [state.replay.playing, state.replay.speed]);
  return (
    <CpuContext.Provider value={{ state, dispatch }}>
      {children}
    </CpuContext.Provider>
  );
}
