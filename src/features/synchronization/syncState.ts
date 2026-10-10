import {
  initialReplay,
  replayReducer,
  type ReplayAction,
  type ReplayState,
} from '../../app/replay';
import type { EngineError } from '../../engine/contracts';
import {
  chooseProcess,
  runSync,
} from '../../engine/synchronization/interpreter';
import type {
  SyncResult,
  SyncScenario,
} from '../../engine/synchronization/types';
import { draftFrom, parseSync, type SyncDraft } from './edit';
import { syncExample } from './presets';
export interface SyncState {
  draft: SyncDraft;
  result: SyncResult | null;
  error: EngineError | null;
  changed: boolean;
  replay: ReplayState;
  mode: 'scripted' | 'manual';
  pendingBranch: {
    processId: string;
    cursor: number;
    discarded: number;
  } | null;
  notice: string | null;
}
export type SyncAction =
  | { type: 'edit'; draft: SyncDraft }
  | { type: 'load'; preset: SyncScenario['preset'] }
  | { type: 'mode'; mode: SyncState['mode'] }
  | { type: 'empty-schedule' }
  | { type: 'run' }
  | { type: 'replay'; action: ReplayAction }
  | { type: 'choice'; processId: string }
  | { type: 'confirm-branch' | 'cancel-branch' };
export function createSyncState(): SyncState {
  const draft = draftFrom(syncExample('counter-race')),
    input = parseSync(draft),
    response = input.ok ? runSync(input.result) : input;
  return {
    draft,
    result: response.ok ? response.result : null,
    error: response.ok ? null : response.error,
    changed: false,
    replay: initialReplay,
    mode: 'scripted',
    pendingBranch: null,
    notice: null,
  };
}
function choose(
  state: SyncState,
  processId: string,
  confirmed = false,
): SyncState {
  const parsed = parseSync(state.draft),
    response = state.result
      ? { ok: true as const, result: state.result }
      : parsed.ok
        ? runSync(parsed.result)
        : parsed;
  const paused = {
    ...state,
    replay: { ...state.replay, playing: false },
    mode: 'manual' as const,
  };
  if (!response.ok)
    return { ...paused, error: response.error, pendingBranch: null };
  const result = response.result,
    cursor = state.replay.cursor,
    p = result.frames[cursor]?.snapshot.processes.find(
      (p) => p.id === processId,
    );
  const step = () => chooseProcess(result, cursor, processId);
  if (
    p?.state !== 'runnable' ||
    result.frames[cursor]?.snapshot.status === 'model-error'
  ) {
    const rejected = step();
    return {
      ...paused,
      result,
      error: rejected.ok ? null : rejected.error,
      pendingBranch: null,
    };
  }
  if (cursor < result.events.length) {
    if (result.events[cursor]?.processId === processId) {
      return {
        ...paused,
        result,
        error: null,
        changed: false,
        pendingBranch: null,
        notice: null,
        replay: replayReducer(
          paused.replay,
          { type: 'next' },
          result.frames.length,
        ),
      };
    }
    if (!confirmed)
      return {
        ...paused,
        result,
        error: null,
        pendingBranch: {
          processId,
          cursor,
          discarded: result.scenario.schedule.length - cursor,
        },
        notice: null,
      };
  }
  const selected = step();
  if (!selected.ok)
    return { ...paused, result, error: selected.error, pendingBranch: null };
  return {
    ...paused,
    draft: {
      ...state.draft,
      schedule: selected.result.scenario.schedule.join(', '),
    },
    result: selected.result,
    error: null,
    changed: false,
    pendingBranch: null,
    replay: { ...paused.replay, cursor: selected.result.events.length },
    notice:
      cursor < result.events.length
        ? `Branched at step ${cursor}. Discarded ${result.scenario.schedule.length - cursor} future choices; selected ${processId}.`
        : `Appended ${processId} at step ${cursor + 1}.`,
  };
}
export function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'edit':
      return {
        ...state,
        draft: action.draft,
        result: null,
        error: null,
        changed: true,
        replay: { ...state.replay, cursor: 0, playing: false },
        pendingBranch: null,
        notice: null,
      };
    case 'load':
      return syncReducer(
        { ...state, mode: 'scripted' },
        { type: 'edit', draft: draftFrom(syncExample(action.preset)) },
      );
    case 'mode':
      return {
        ...state,
        mode: action.mode,
        replay: { ...state.replay, playing: false },
        pendingBranch: null,
        notice: null,
      };
    case 'empty-schedule':
      return syncReducer(
        { ...state, mode: 'manual' },
        { type: 'edit', draft: { ...state.draft, schedule: '' } },
      );
    case 'run': {
      const parsed = parseSync(state.draft),
        response = state.result
          ? { ok: true as const, result: state.result }
          : parsed.ok
            ? runSync(parsed.result)
            : parsed;
      if (!response.ok)
        return {
          ...state,
          error: response.error,
          replay: { ...state.replay, playing: false },
          pendingBranch: null,
        };
      return {
        ...state,
        result: response.result,
        error: null,
        changed: false,
        replay: replayReducer(
          state.replay,
          { type: 'play' },
          response.result.frames.length,
        ),
        pendingBranch: null,
        notice: null,
      };
    }
    case 'replay':
      return {
        ...state,
        replay: replayReducer(
          state.replay,
          action.action,
          state.result?.frames.length ?? 0,
        ),
        pendingBranch: null,
      };
    case 'choice':
      return choose(state, action.processId);
    case 'confirm-branch':
      return state.pendingBranch &&
        state.pendingBranch.cursor === state.replay.cursor
        ? choose(state, state.pendingBranch.processId, true)
        : state;
    case 'cancel-branch':
      return { ...state, pendingBranch: null };
  }
}
