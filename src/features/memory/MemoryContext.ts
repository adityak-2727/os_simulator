import { createContext, useContext, type Dispatch } from 'react';
import type { MemoryAction, MemoryState } from './memoryState';
export const MemoryContext = createContext<{
  state: MemoryState;
  dispatch: Dispatch<MemoryAction>;
} | null>(null);
export function useMemory() {
  const context = useContext(MemoryContext);
  if (!context) throw new Error('Memory lab must be inside MemoryProvider.');
  return context;
}
