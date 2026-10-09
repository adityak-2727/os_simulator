import { useEffect, useReducer, type ReactNode } from 'react';
import { DeadlockContext } from './DeadlockContext';
import { createDeadlockState, deadlockReducer } from './deadlockState';
export function DeadlockProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    deadlockReducer,
    undefined,
    createDeadlockState,
  );
  const replay = state[state.mode].replay,
    mode = state.mode;
  useEffect(() => {
    if (!replay.playing) return;
    const timer = window.setInterval(
      () => dispatch({ type: 'replay', mode, action: { type: 'tick' } }),
      1000 / replay.speed,
    );
    return () => window.clearInterval(timer);
  }, [replay.playing, replay.speed, mode]);
  return (
    <DeadlockContext.Provider value={{ state, dispatch }}>
      {children}
    </DeadlockContext.Provider>
  );
}
