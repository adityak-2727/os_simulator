import {
  initialReplay,
  replayReducer,
  type ReplayAction,
  type ReplayState,
} from '../../app/replay';
import { analyzeGraph } from '../../engine/deadlock/graph';
import { runBanker } from '../../engine/deadlock/banker';
import {
  validateBanker,
  validateGraph,
} from '../../engine/deadlock/validation';
import type { EngineError, EngineResponse } from '../../engine/contracts';
import type {
  BankerResult,
  BankerScenario,
  Binding,
  GraphResult,
  GraphScenario,
} from '../../engine/deadlock/types';
export interface GraphDraft {
  processes: string;
  resources: string;
  allocations: readonly Binding[];
  requests: readonly Binding[];
}
export interface BankerDraft {
  processIds: readonly string[];
  resourceIds: readonly string[];
  total: readonly string[];
  allocation: readonly (readonly string[])[];
  max: readonly (readonly string[])[];
  requestProcess: string;
  amount: readonly string[];
}
export const splitIds = (text: string) =>
  text.trim() ? text.trim().split(/[\s,]+/) : [];
export const integer = (text: string) =>
  /^\d+$/.test(text.trim()) ? Number(text) : Number.NaN;
export function parseGraph(draft: GraphDraft): EngineResponse<GraphScenario> {
  const result: GraphScenario = {
    kind: 'deadlock',
    mode: 'graph',
    processIds: splitIds(draft.processes),
    resourceIds: splitIds(draft.resources),
    allocations: draft.allocations,
    requests: draft.requests,
  };
  const error = validateGraph(result);
  return error ? { ok: false, error } : { ok: true, result };
}
export function parseBanker(
  draft: BankerDraft,
  request = false,
): EngineResponse<BankerScenario> {
  const result: BankerScenario = {
    kind: 'deadlock',
    mode: 'banker',
    processIds: draft.processIds,
    resourceIds: draft.resourceIds,
    total: draft.total.map(integer),
    allocation: draft.allocation.map((r) => r.map(integer)),
    max: draft.max.map((r) => r.map(integer)),
    ...(request
      ? {
          request: {
            processId: draft.requestProcess,
            amount: draft.amount.map(integer),
          },
        }
      : {}),
  };
  const error = validateBanker(result);
  return error ? { ok: false, error } : { ok: true, result };
}
export function graphExample(cycle = true): GraphDraft {
  return {
    processes: 'P1, P2',
    resources: 'R1, R2',
    allocations: [
      { processId: 'P1', resourceId: 'R1' },
      { processId: 'P2', resourceId: 'R2' },
    ],
    requests: cycle
      ? [
          { processId: 'P1', resourceId: 'R2' },
          { processId: 'P2', resourceId: 'R1' },
        ]
      : [{ processId: 'P1', resourceId: 'R2' }],
  };
}
export function bankerExample(name = 'safe'): BankerDraft {
  if (name === 'unsafe')
    return {
      processIds: ['P1', 'P2'],
      resourceIds: ['R'],
      total: ['2'],
      allocation: [['1'], ['1']],
      max: [['2'], ['2']],
      requestProcess: 'P1',
      amount: ['0'],
    };
  const requests: Record<string, { process: string; amount: string[] }> = {
    grant: { process: 'P1', amount: ['1', '0', '2'] },
    'wait-safety': { process: 'P4', amount: ['3', '3', '0'] },
    'wait-availability': { process: 'P0', amount: ['0', '4', '0'] },
    invalid: { process: 'P1', amount: ['2', '0', '0'] },
  };
  return {
    processIds: ['P0', 'P1', 'P2', 'P3', 'P4'],
    resourceIds: ['A', 'B', 'C'],
    total: ['10', '5', '7'],
    allocation: [
      ['0', '1', '0'],
      ['2', '0', '0'],
      ['3', '0', '2'],
      ['2', '1', '1'],
      ['0', '0', '2'],
    ],
    max: [
      ['7', '5', '3'],
      ['3', '2', '2'],
      ['9', '0', '2'],
      ['2', '2', '2'],
      ['4', '3', '3'],
    ],
    requestProcess: requests[name]?.process ?? 'P1',
    amount: requests[name]?.amount ?? ['0', '0', '0'],
  };
}
interface Lab<D, R> {
  draft: D;
  result: R | null;
  replay: ReplayState;
  changed: boolean;
  error: EngineError | null;
}
export interface DeadlockState {
  mode: 'graph' | 'banker';
  graph: Lab<GraphDraft, GraphResult>;
  banker: Lab<BankerDraft, BankerResult>;
}
export type DeadlockAction =
  | { type: 'mode'; mode: DeadlockState['mode'] }
  | { type: 'graph-edit'; draft: GraphDraft }
  | { type: 'banker-edit'; draft: BankerDraft }
  | { type: 'graph-run'; result: GraphResult }
  | { type: 'banker-run'; result: BankerResult }
  | { type: 'error'; mode: DeadlockState['mode']; error: EngineError }
  | { type: 'replay'; mode: DeadlockState['mode']; action: ReplayAction }
  | { type: 'pause-all' };
export function createDeadlockState(): DeadlockState {
  const graph = graphExample(),
    banker = bankerExample(),
    g = parseGraph(graph),
    b = parseBanker(banker);
  const gr = g.ok ? analyzeGraph(g.result) : g,
    br = b.ok ? runBanker(b.result) : b;
  return {
    mode: 'graph',
    graph: {
      draft: graph,
      result: gr.ok ? gr.result : null,
      replay: initialReplay,
      changed: false,
      error: gr.ok ? null : gr.error,
    },
    banker: {
      draft: banker,
      result: br.ok ? br.result : null,
      replay: initialReplay,
      changed: false,
      error: br.ok ? null : br.error,
    },
  };
}
export function deadlockReducer(
  state: DeadlockState,
  action: DeadlockAction,
): DeadlockState {
  switch (action.type) {
    case 'mode':
      return {
        ...state,
        mode: action.mode,
        graph: {
          ...state.graph,
          replay: { ...state.graph.replay, playing: false },
        },
        banker: {
          ...state.banker,
          replay: { ...state.banker.replay, playing: false },
        },
      };
    case 'pause-all':
      return {
        ...state,
        graph: {
          ...state.graph,
          replay: { ...state.graph.replay, playing: false },
        },
        banker: {
          ...state.banker,
          replay: { ...state.banker.replay, playing: false },
        },
      };
    case 'graph-edit':
      return {
        ...state,
        graph: {
          draft: action.draft,
          result: null,
          replay: { ...state.graph.replay, cursor: 0, playing: false },
          changed: true,
          error: null,
        },
      };
    case 'banker-edit':
      return {
        ...state,
        banker: {
          draft: action.draft,
          result: null,
          replay: { ...state.banker.replay, cursor: 0, playing: false },
          changed: true,
          error: null,
        },
      };
    case 'graph-run':
      return {
        ...state,
        graph: {
          ...state.graph,
          result: action.result,
          changed: false,
          error: null,
          replay: replayReducer(
            state.graph.replay,
            { type: 'play' },
            action.result.frames.length,
          ),
        },
      };
    case 'banker-run':
      return {
        ...state,
        banker: {
          ...state.banker,
          result: action.result,
          changed: false,
          error: null,
          replay: replayReducer(
            {
              ...state.banker.replay,
              cursor:
                action.result === state.banker.result
                  ? state.banker.replay.cursor
                  : 0,
            },
            { type: 'play' },
            action.result.frames.length,
          ),
        },
      };
    case 'error':
      return action.mode === 'graph'
        ? {
            ...state,
            graph: {
              ...state.graph,
              error: action.error,
              result: null,
              replay: { ...state.graph.replay, cursor: 0, playing: false },
            },
          }
        : {
            ...state,
            banker: {
              ...state.banker,
              error: action.error,
              result: null,
              replay: { ...state.banker.replay, cursor: 0, playing: false },
            },
          };
    case 'replay':
      return action.mode === 'graph'
        ? {
            ...state,
            graph: {
              ...state.graph,
              replay: replayReducer(
                state.graph.replay,
                action.action,
                state.graph.result?.frames.length ?? 0,
              ),
            },
          }
        : {
            ...state,
            banker: {
              ...state.banker,
              replay: replayReducer(
                state.banker.replay,
                action.action,
                state.banker.result?.frames.length ?? 0,
              ),
            },
          };
  }
}
