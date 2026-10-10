import { createContext, useContext } from 'react';
import type { ExperimentV1 } from './format';
export interface ExperimentService {
  items: readonly ExperimentV1[];
  message: string;
  filter: string;
  locked: boolean;
  commit: (items: readonly ExperimentV1[]) => boolean;
  notice: (message: string) => void;
  setFilter: (filter: string) => void;
}
export const ExperimentContext = createContext<ExperimentService | null>(null);
export function useExperiments() {
  const c = useContext(ExperimentContext);
  if (!c) throw new Error('ExperimentProvider required.');
  return c;
}
