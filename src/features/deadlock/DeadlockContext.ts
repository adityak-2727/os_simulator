import { createContext, useContext, type Dispatch } from 'react';
import type { DeadlockAction, DeadlockState } from './deadlockState';
export const DeadlockContext = createContext<{
  state: DeadlockState;
  dispatch: Dispatch<DeadlockAction>;
} | null>(null);
export function useDeadlock() {
  const context = useContext(DeadlockContext);
  if (!context) throw new Error('Deadlock controls require DeadlockProvider.');
  return context;
}
