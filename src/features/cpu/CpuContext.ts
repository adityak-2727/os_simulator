import { createContext, useContext, type Dispatch } from 'react';
import type { CpuAction, CpuState } from './cpuState';

export const CpuContext = createContext<{
  state: CpuState;
  dispatch: Dispatch<CpuAction>;
} | null>(null);
export function useCpu() {
  const context = useContext(CpuContext);
  if (!context) throw new Error('CPU controls require CpuProvider.');
  return context;
}
