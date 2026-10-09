import type { EngineError, EngineResponse } from '../../engine/contracts';
import type {
  AllocationOperation,
  AllocationResult,
  AllocationScenario,
  AllocationStrategy,
  PagingAlgorithm,
  PagingResult,
  PagingScenario,
} from '../../engine/memory/types';
import { allocateMemory } from '../../engine/memory/allocation';
import { replacePages } from '../../engine/memory/paging';
import {
  validateAllocation,
  validatePaging,
} from '../../engine/memory/validation';
import {
  initialReplay,
  replayReducer,
  type ReplayAction,
  type ReplayState,
} from '../../app/replay';

export interface OperationDraft {
  readonly key: number;
  readonly kind: 'allocate' | 'free';
  readonly id: string;
  readonly size: string;
}
export interface AllocationDraft {
  readonly name: string;
  readonly capacity: string;
  readonly strategy: AllocationStrategy;
  readonly operations: readonly OperationDraft[];
  readonly nextKey: number;
}
export interface PagingDraft {
  readonly name: string;
  readonly frames: string;
  readonly references: string;
  readonly algorithm: PagingAlgorithm;
}
export interface MemoryLabState<D, R> {
  readonly draft: D;
  readonly result: R | null;
  readonly comparison: readonly R[] | null;
  readonly replay: ReplayState;
  readonly error: EngineError | null;
  readonly changed: boolean;
  readonly view: 'replay' | 'compare';
}
export interface MemoryState {
  readonly allocation: MemoryLabState<AllocationDraft, AllocationResult>;
  readonly paging: MemoryLabState<PagingDraft, PagingResult>;
}
export type MemoryAction =
  | { type: 'allocation-draft'; draft: AllocationDraft }
  | { type: 'paging-draft'; draft: PagingDraft }
  | { type: 'allocation-run'; result: AllocationResult }
  | { type: 'paging-run'; result: PagingResult }
  | { type: 'allocation-compare'; results: readonly AllocationResult[] }
  | { type: 'paging-compare'; results: readonly PagingResult[] }
  | { type: 'allocation-inspect'; result: AllocationResult }
  | { type: 'paging-inspect'; result: PagingResult }
  | { type: 'replay'; lab: 'allocation' | 'paging'; action: ReplayAction }
  | { type: 'back'; lab: 'allocation' | 'paging' }
  | { type: 'error'; lab: 'allocation' | 'paging'; error: EngineError };

export const STRATEGY_NAMES: Record<AllocationStrategy, string> = {
  'first-fit': 'First Fit',
  'best-fit': 'Best Fit',
  'worst-fit': 'Worst Fit',
};
export const PAGE_NAMES: Record<PagingAlgorithm, string> = {
  fifo: 'FIFO',
  lru: 'LRU',
  optimal: 'Optimal',
};
export function allocationExample(
  example: 'reference' | 'fragmentation' | 'coalescing',
): AllocationDraft {
  const base: OperationDraft[] = [
    { key: 0, kind: 'allocate', id: 'A', size: '100' },
    { key: 1, kind: 'allocate', id: 'B', size: '300' },
    { key: 2, kind: 'allocate', id: 'C', size: '100' },
    { key: 3, kind: 'allocate', id: 'D', size: '300' },
    { key: 4, kind: 'free', id: 'B', size: '300' },
  ];
  const operations: OperationDraft[] =
    example === 'coalescing'
      ? [
          ...base,
          { key: 5, kind: 'free', id: 'C', size: '100' },
          { key: 6, kind: 'free', id: 'D', size: '300' },
        ]
      : [
          ...base,
          {
            key: 5,
            kind: 'allocate',
            id: 'E',
            size: example === 'fragmentation' ? '400' : '200',
          },
        ];
  return {
    name: `Example · ${example === 'reference' ? 'Hole selection' : example === 'fragmentation' ? 'Fragmentation failure' : 'Coalescing'}`,
    capacity: '1024',
    strategy: 'first-fit',
    operations,
    nextKey: operations.length,
  };
}
export function pagingExample(): PagingDraft {
  return {
    name: 'Example · Page reference sequence',
    frames: '3',
    references: '7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2',
    algorithm: 'fifo',
  };
}
const number = (value: string) => (value.trim() === '' ? NaN : Number(value));
function nameError(name: string): EngineError | null {
  return name.trim().length < 1 || name.trim().length > 80
    ? {
        code: 'validation',
        message: 'Enter a scenario name.',
        issues: [
          {
            path: 'name',
            message: 'Name must contain 1–80 characters after trimming.',
          },
        ],
      }
    : null;
}
export function parseAllocation(
  draft: AllocationDraft,
): EngineResponse<AllocationScenario> {
  const operations: AllocationOperation[] = draft.operations.map((op) =>
    op.kind === 'free'
      ? { kind: 'free', id: op.id }
      : { kind: 'allocate', id: op.id, sizeKiB: number(op.size) },
  );
  const result: AllocationScenario = {
    kind: 'allocation',
    totalKiB: number(draft.capacity),
    strategy: draft.strategy,
    operations,
  };
  const domainError = validateAllocation(result),
    titleError = nameError(draft.name);
  const issues = [
    ...(titleError?.issues ?? []),
    ...(domainError?.issues ?? []),
  ];
  return issues.length
    ? {
        ok: false,
        error: {
          code: 'validation',
          message: 'Correct the allocation inputs before running.',
          issues,
        },
      }
    : { ok: true, result };
}
export function parsePaging(
  draft: PagingDraft,
): EngineResponse<PagingScenario> {
  const tokens = draft.references.trim()
    ? draft.references.trim().split(/[\s,]+/)
    : [];
  const result: PagingScenario = {
    kind: 'paging',
    frames: number(draft.frames),
    algorithm: draft.algorithm,
    references: tokens.map((token) =>
      /^\d+$/.test(token) ? Number(token) : NaN,
    ),
  };
  const domainError = validatePaging(result),
    titleError = nameError(draft.name);
  const issues = [
    ...(titleError?.issues ?? []),
    ...(domainError?.issues ?? []),
  ];
  return issues.length
    ? {
        ok: false,
        error: {
          code: 'validation',
          message: 'Correct the paging inputs before running.',
          issues,
        },
      }
    : { ok: true, result };
}
function initial<D, R>(draft: D, result: R | null): MemoryLabState<D, R> {
  return {
    draft,
    result,
    comparison: null,
    replay: initialReplay,
    error: null,
    changed: false,
    view: 'replay',
  };
}
export function createMemoryState(): MemoryState {
  const allocationDraft = allocationExample('reference'),
    pagingDraft = pagingExample();
  const a = parseAllocation(allocationDraft),
    p = parsePaging(pagingDraft);
  const ar = a.ok ? allocateMemory(a.result) : a,
    pr = p.ok ? replacePages(p.result) : p;
  return {
    allocation: initial(allocationDraft, ar.ok ? ar.result : null),
    paging: initial(pagingDraft, pr.ok ? pr.result : null),
  };
}
function edited<D, R>(
  state: MemoryLabState<D, R>,
  draft: D,
): MemoryLabState<D, R> {
  return {
    ...state,
    draft,
    result: null,
    comparison: null,
    replay: { ...initialReplay, speed: state.replay.speed },
    error: null,
    changed: true,
    view: 'replay',
  };
}
export function memoryReducer(
  state: MemoryState,
  action: MemoryAction,
): MemoryState {
  switch (action.type) {
    case 'allocation-draft':
      return { ...state, allocation: edited(state.allocation, action.draft) };
    case 'paging-draft':
      return { ...state, paging: edited(state.paging, action.draft) };
    case 'allocation-run':
      return {
        ...state,
        allocation: {
          ...state.allocation,
          result: action.result,
          replay: replayReducer(
            state.allocation.replay,
            { type: 'play' },
            action.result.frames.length,
          ),
          error: null,
          changed: false,
          view: 'replay',
        },
      };
    case 'paging-run':
      return {
        ...state,
        paging: {
          ...state.paging,
          result: action.result,
          replay: replayReducer(
            state.paging.replay,
            { type: 'play' },
            action.result.frames.length,
          ),
          error: null,
          changed: false,
          view: 'replay',
        },
      };
    case 'allocation-compare':
      return {
        ...state,
        allocation: {
          ...state.allocation,
          comparison: action.results,
          view: 'compare',
          error: null,
          replay: { ...state.allocation.replay, playing: false },
        },
      };
    case 'paging-compare':
      return {
        ...state,
        paging: {
          ...state.paging,
          comparison: action.results,
          view: 'compare',
          error: null,
          replay: { ...state.paging.replay, playing: false },
        },
      };
    case 'allocation-inspect':
      return {
        ...state,
        allocation: {
          ...state.allocation,
          draft: {
            ...state.allocation.draft,
            strategy: action.result.scenario.strategy,
          },
          result: action.result,
          changed: false,
          view: 'replay',
          error: null,
          replay: {
            ...state.allocation.replay,
            cursor: action.result.events.length,
            playing: false,
          },
        },
      };
    case 'paging-inspect':
      return {
        ...state,
        paging: {
          ...state.paging,
          draft: {
            ...state.paging.draft,
            algorithm: action.result.scenario.algorithm,
          },
          result: action.result,
          changed: false,
          view: 'replay',
          error: null,
          replay: {
            ...state.paging.replay,
            cursor: action.result.events.length,
            playing: false,
          },
        },
      };
    case 'replay': {
      const lab = state[action.lab];
      return {
        ...state,
        [action.lab]: {
          ...lab,
          replay: replayReducer(
            lab.replay,
            action.action,
            lab.result?.frames.length ?? 0,
          ),
        },
      };
    }
    case 'back':
      return {
        ...state,
        [action.lab]: { ...state[action.lab], view: 'replay' },
      };
    case 'error':
      return {
        ...state,
        [action.lab]: {
          ...state[action.lab],
          error: action.error,
          replay: { ...state[action.lab].replay, playing: false },
        },
      };
  }
}
