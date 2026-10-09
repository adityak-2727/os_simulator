import { createContext, useContext } from 'react';
import type { Dispatch } from 'react';
import type { PreviewResult } from '../engine/preview';
import type { ReplayAction, ReplayState } from './replay';

export interface LabState {
  readonly draft: {
    readonly firstDuration: string;
    readonly secondDuration: string;
  };
  readonly result: PreviewResult | null;
  readonly replay: ReplayState;
  readonly changed: boolean;
}
export type LabAction =
  | { type: 'edit'; field: keyof LabState['draft']; value: string }
  | { type: 'example' }
  | { type: 'run'; result: PreviewResult }
  | { type: 'replay'; action: ReplayAction };
export const LabContext = createContext<{
  state: LabState;
  dispatch: Dispatch<LabAction>;
} | null>(null);
export function useLab() {
  const context = useContext(LabContext);
  if (!context) throw new Error('Lab controls require LabProvider.');
  return context;
}
