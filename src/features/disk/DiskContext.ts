import { createContext, useContext, type Dispatch } from 'react';
import type { DiskAction, DiskState } from './diskState';
export const DiskContext = createContext<{
  state: DiskState;
  dispatch: Dispatch<DiskAction>;
} | null>(null);
export function useDisk() {
  const c = useContext(DiskContext);
  if (!c) throw new Error('Disk controls require DiskProvider.');
  return c;
}
