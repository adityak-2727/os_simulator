import { createPreview } from '../engine/preview';
import { initialReplay, replayReducer } from './replay';
import type { LabAction, LabState } from './LabContext';

export function createInitialLab(): LabState {
  const preview = createPreview({ firstDuration: 3, secondDuration: 2 });
  if (!preview.ok) throw new Error(preview.error.message);
  return {
    draft: { firstDuration: '3', secondDuration: '2' },
    result: preview.result,
    replay: initialReplay,
    changed: false,
  };
}
export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'edit':
      return {
        ...state,
        draft: { ...state.draft, [action.field]: action.value },
        result: null,
        replay: { ...state.replay, cursor: 0, playing: false },
        changed: true,
      };
    case 'example':
      return createInitialLab();
    case 'run':
      return {
        ...state,
        result: state.result ?? action.result,
        changed: false,
        replay: replayReducer(
          state.replay,
          { type: 'play' },
          (state.result ?? action.result).frames.length,
        ),
      };
    case 'replay':
      return {
        ...state,
        replay: replayReducer(
          state.replay,
          action.action,
          state.result?.frames.length ?? 0,
        ),
      };
  }
}
