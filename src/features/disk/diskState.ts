import {
  initialReplay,
  replayReducer,
  type ReplayAction,
  type ReplayState,
} from '../../app/replay';
import type { EngineError, EngineResponse } from '../../engine/contracts';
import type {
  DiskAlgorithm,
  DiskDirection,
  DiskResult,
  DiskScenario,
} from '../../engine/disk/types';
import { scheduleDisk, compareDisk } from '../../engine/disk/schedule';
import { validateDisk } from '../../engine/disk/validation';
export const DISK_NAMES: Record<DiskAlgorithm, string> = {
  fcfs: 'FCFS',
  sstf: 'SSTF',
  scan: 'SCAN',
  cscan: 'C-SCAN',
};
export interface RequestDraft {
  readonly key: number;
  readonly id: string;
  readonly cylinder: string;
}
export interface DiskDraft {
  readonly name: string;
  readonly maxCylinder: string;
  readonly initialHead: string;
  readonly direction: DiskDirection;
  readonly algorithm: DiskAlgorithm;
  readonly requests: readonly RequestDraft[];
  readonly nextKey: number;
}
export function diskExample(
  example: 'reference' | 'boundaries' = 'reference',
): DiskDraft {
  const cylinders =
    example === 'reference'
      ? [98, 183, 37, 122, 14, 124, 65, 67]
      : [50, 0, 100, 50, 40, 60];
  return {
    name:
      example === 'reference'
        ? 'Example · Static request batch'
        : 'Example · Duplicates and endpoints',
    maxCylinder: example === 'reference' ? '199' : '100',
    initialHead: example === 'reference' ? '53' : '50',
    direction: 'higher',
    algorithm: 'fcfs',
    requests: cylinders.map((cylinder, key) => ({
      key,
      id: `D${key + 1}`,
      cylinder: String(cylinder),
    })),
    nextKey: cylinders.length,
  };
}
const number = (text: string) =>
  /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN;
export function parseDisk(draft: DiskDraft): EngineResponse<DiskScenario> {
  const scenario: DiskScenario = {
    kind: 'disk',
    minCylinder: 0,
    maxCylinder: number(draft.maxCylinder),
    initialHead: number(draft.initialHead),
    direction: draft.direction,
    algorithm: draft.algorithm,
    requests: draft.requests.map((r) => ({
      id: r.id,
      cylinder: number(r.cylinder),
    })),
  };
  const domainError = validateDisk(scenario);
  const issues = [...(domainError?.issues ?? [])];
  if (!draft.name.trim() || draft.name.trim().length > 80)
    issues.push({
      path: 'name',
      message: 'Name must contain 1–80 characters after trimming.',
    });
  return issues.length
    ? {
        ok: false,
        error: {
          code: 'validation',
          message: 'Correct the disk inputs before running.',
          issues,
        },
      }
    : { ok: true, result: scenario };
}
export interface DiskState {
  readonly draft: DiskDraft;
  readonly result: DiskResult | null;
  readonly comparison: readonly DiskResult[] | null;
  readonly replay: ReplayState;
  readonly error: EngineError | null;
  readonly changed: boolean;
  readonly view: 'replay' | 'compare';
}
export type DiskAction =
  | { type: 'edit'; draft: DiskDraft }
  | { type: 'load'; example: 'reference' | 'boundaries' }
  | { type: 'run' | 'compare' | 'back' }
  | { type: 'inspect'; result: DiskResult }
  | { type: 'replay'; action: ReplayAction };
export function createDiskState(): DiskState {
  const draft = diskExample(),
    parsed = parseDisk(draft),
    response = parsed.ok ? scheduleDisk(parsed.result) : parsed;
  return {
    draft,
    result: response.ok ? response.result : null,
    comparison: null,
    replay: initialReplay,
    error: response.ok ? null : response.error,
    changed: false,
    view: 'replay',
  };
}
export function diskReducer(state: DiskState, action: DiskAction): DiskState {
  switch (action.type) {
    case 'edit':
      return {
        ...state,
        draft: action.draft,
        result: null,
        comparison: null,
        error: null,
        changed: true,
        view: 'replay',
        replay: { ...state.replay, cursor: 0, playing: false },
      };
    case 'load':
      return diskReducer(state, {
        type: 'edit',
        draft: diskExample(action.example),
      });
    case 'replay':
      return {
        ...state,
        replay: replayReducer(
          state.replay,
          action.action,
          state.result?.frames.length ?? 0,
        ),
      };
    case 'back':
      return {
        ...state,
        view: 'replay',
        replay: { ...state.replay, playing: false },
      };
    case 'run': {
      const parsed = parseDisk(state.draft),
        response = state.result
          ? { ok: true as const, result: state.result }
          : parsed.ok
            ? scheduleDisk(parsed.result)
            : parsed;
      if (!response.ok)
        return {
          ...state,
          error: response.error,
          replay: { ...state.replay, playing: false },
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
      };
    }
    case 'compare': {
      const parsed = parseDisk(state.draft),
        response = parsed.ok ? compareDisk(parsed.result) : parsed;
      if (!response.ok)
        return {
          ...state,
          error: response.error,
          replay: { ...state.replay, playing: false },
        };
      return {
        ...state,
        comparison: response.result,
        view: 'compare',
        error: null,
        replay: { ...state.replay, playing: false },
      };
    }
    case 'inspect':
      return {
        ...state,
        draft: { ...state.draft, algorithm: action.result.scenario.algorithm },
        result: action.result,
        changed: false,
        view: 'replay',
        error: null,
        replay: { ...state.replay, cursor: 0, playing: false },
      };
  }
}
