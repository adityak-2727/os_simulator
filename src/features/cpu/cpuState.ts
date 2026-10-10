import type {
  CpuAlgorithm,
  CpuScenario,
  EngineError,
  EngineResponse,
} from '../../engine/contracts';
import { validateCpuScenario } from '../../engine/cpu/validation';
import { scheduleCpu } from '../../engine/cpu/schedule';
import type { CpuResult } from '../../engine/cpu/types';
import {
  initialReplay,
  replayReducer,
  type ReplayAction,
  type ReplayState,
} from '../../app/replay';

export interface ProcessDraft {
  readonly key: number;
  readonly id: string;
  readonly arrival: string;
  readonly burst: string;
  readonly priority: string;
}
export interface CpuDraft {
  readonly name: string;
  readonly algorithm: CpuAlgorithm;
  readonly quantum: string;
  readonly processes: readonly ProcessDraft[];
}
export type ExampleName = 'reference' | 'idle' | 'ties';
export interface CpuState {
  readonly draft: CpuDraft;
  readonly nextKey: number;
  readonly result: CpuResult | null;
  readonly comparison: readonly CpuResult[] | null;
  readonly view: 'run' | 'compare';
  readonly replay: ReplayState;
  readonly changed: boolean;
  readonly error: EngineError | null;
}
export type CpuAction =
  | { type: 'load-scenario'; scenario: CpuScenario; name: string }
  | {
      type: 'edit-process';
      key: number;
      field: Exclude<keyof ProcessDraft, 'key'>;
      value: string;
    }
  | { type: 'edit-name' | 'edit-quantum'; value: string }
  | { type: 'algorithm'; algorithm: CpuAlgorithm }
  | { type: 'add' }
  | { type: 'remove'; key: number }
  | { type: 'example'; example: ExampleName }
  | { type: 'run'; result: CpuResult }
  | { type: 'compare'; results: readonly CpuResult[] }
  | { type: 'inspect-comparison'; result: CpuResult }
  | { type: 'back' }
  | { type: 'error'; error: EngineError }
  | { type: 'replay'; action: ReplayAction };

export function exampleDraft(example: ExampleName): CpuDraft {
  // Inputs only: fixture expected outputs are never imported into application code.
  const rows =
    example === 'idle'
      ? [{ id: 'P1', arrival: '3', burst: '2', priority: '1' }]
      : example === 'ties'
        ? [
            { id: 'P10', arrival: '0', burst: '2', priority: '1' },
            { id: 'P2', arrival: '0', burst: '2', priority: '1' },
            { id: 'P1', arrival: '0', burst: '2', priority: '1' },
          ]
        : [
            { id: 'P1', arrival: '0', burst: '5', priority: '2' },
            { id: 'P2', arrival: '1', burst: '3', priority: '1' },
            { id: 'P3', arrival: '2', burst: '1', priority: '3' },
          ];
  return {
    name:
      example === 'idle'
        ? 'Example · Initial idle'
        : example === 'ties'
          ? 'Example · Equal arrival ties'
          : 'Example · Reference workload',
    algorithm: example === 'idle' ? 'fcfs' : 'rr',
    quantum: '2',
    processes: rows.map((row, key) => ({ ...row, key })),
  };
}
export function parseCpuDraft(
  draft: CpuDraft,
  forComparison = false,
): EngineResponse<CpuScenario> {
  const number = (value: string) => (value.trim() === '' ? NaN : Number(value));
  const scenario: CpuScenario = {
    kind: 'cpu',
    processes: draft.processes.map((p) => ({
      id: p.id,
      arrival: number(p.arrival),
      burst: number(p.burst),
      priority: number(p.priority),
    })),
    algorithm: forComparison ? 'rr' : draft.algorithm,
    quantum: number(draft.quantum),
    contextSwitchCost: 0,
  };
  const error = validateCpuScenario(scenario);
  const issues = [...(error?.issues ?? [])];
  if (!draft.name.trim() || draft.name.trim().length > 80)
    issues.push({
      path: 'name',
      message: 'Use a workload name from 1 to 80 characters.',
    });
  return issues.length
    ? {
        ok: false,
        error: {
          code: 'validation',
          message: 'Correct the workload before running.',
          issues,
        },
      }
    : { ok: true, result: { ...scenario, algorithm: draft.algorithm } };
}
export function createInitialCpu(): CpuState {
  const draft = exampleDraft('reference');
  const parsed = parseCpuDraft(draft);
  const result = parsed.ok ? scheduleCpu(parsed.result) : parsed;
  return {
    draft,
    nextKey: draft.processes.length,
    result: result.ok ? result.result : null,
    replay: initialReplay,
    comparison: null,
    view: 'run',
    changed: false,
    error: result.ok ? null : result.error,
  };
}
function invalidate(state: CpuState, draft: CpuDraft): CpuState {
  return {
    ...state,
    draft,
    result: null,
    comparison: null,
    view: 'run',
    changed: true,
    error: null,
    replay: { ...state.replay, cursor: 0, playing: false },
  };
}
export function cpuReducer(state: CpuState, action: CpuAction): CpuState {
  switch (action.type) {
    case 'load-scenario':
      return {
        ...invalidate(state, {
          name: action.name,
          algorithm: action.scenario.algorithm,
          quantum: String(action.scenario.quantum),
          processes: action.scenario.processes.map((p, key) => ({
            key,
            id: p.id,
            arrival: String(p.arrival),
            burst: String(p.burst),
            priority: String(p.priority),
          })),
        }),
        nextKey: action.scenario.processes.length,
      };
    case 'edit-process':
      return invalidate(state, {
        ...state.draft,
        processes: state.draft.processes.map((p) =>
          p.key === action.key ? { ...p, [action.field]: action.value } : p,
        ),
      });
    case 'edit-name':
      return invalidate(state, { ...state.draft, name: action.value });
    case 'edit-quantum':
      return invalidate(state, { ...state.draft, quantum: action.value });
    case 'algorithm':
      return invalidate(state, { ...state.draft, algorithm: action.algorithm });
    case 'remove':
      return invalidate(state, {
        ...state.draft,
        processes: state.draft.processes.filter((p) => p.key !== action.key),
      });
    case 'add': {
      if (state.draft.processes.length >= 50) return state;
      let n = 1;
      while (state.draft.processes.some((p) => p.id === `P${n}`)) n++;
      return {
        ...invalidate(state, {
          ...state.draft,
          processes: [
            ...state.draft.processes,
            {
              key: state.nextKey,
              id: `P${n}`,
              arrival: '0',
              burst: '1',
              priority: '1',
            },
          ],
        }),
        nextKey: state.nextKey + 1,
      };
    }
    case 'example': {
      const draft = exampleDraft(action.example);
      const parsed = parseCpuDraft(draft);
      const response = parsed.ok ? scheduleCpu(parsed.result) : parsed;
      return {
        ...state,
        draft,
        nextKey: draft.processes.length,
        result: response.ok ? response.result : null,
        error: response.ok ? null : response.error,
        comparison: null,
        view: 'run',
        changed: false,
        replay: { ...state.replay, cursor: 0, playing: false },
      };
    }
    case 'run': {
      const result = state.result ?? action.result;
      return {
        ...state,
        result,
        error: null,
        changed: false,
        view: 'run',
        replay: replayReducer(
          state.replay,
          { type: 'play' },
          result.frames.length,
        ),
      };
    }
    case 'compare':
      return {
        ...state,
        comparison: action.results,
        view: 'compare',
        error: null,
        replay: { ...state.replay, playing: false },
      };
    case 'inspect-comparison':
      return {
        ...state,
        result: action.result,
        draft: { ...state.draft, algorithm: action.result.scenario.algorithm },
        view: 'run',
        changed: false,
        error: null,
        replay: {
          ...state.replay,
          cursor: action.result.frames.length - 1,
          playing: false,
        },
      };
    case 'back':
      return { ...state, view: 'run' };
    case 'error':
      return {
        ...state,
        error: action.error,
        replay: { ...state.replay, playing: false },
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
