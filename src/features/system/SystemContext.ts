import { createContext, useContext, type Dispatch } from 'react';
import type { SystemState, SystemAction } from './systemState';
export const SystemContext = createContext<{
  state: SystemState;
  dispatch: Dispatch<SystemAction>;
} | null>(null);
export function useSystem() {
  const c = useContext(SystemContext);
  if (!c) throw new Error('Integrated lab requires SystemProvider.');
  return c;
}
