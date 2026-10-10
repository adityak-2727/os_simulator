export type LabKind =
  | 'cpu'
  | 'allocation'
  | 'paging'
  | 'deadlock'
  | 'synchronization'
  | 'disk'
  | 'system';
export type ProcessId = string;
export type ResourceId = string;
export type ProcessState =
  'new' | 'memory-wait' | 'ready' | 'running' | 'blocked' | 'terminated';
export type RunOutcome =
  | 'completed'
  | 'blocked'
  | 'unsafe'
  | 'deadlocked'
  | 'stalled'
  | 'awaiting-choice'
  | 'model-error';

export interface EngineError {
  readonly code: 'validation' | 'limit-exceeded';
  readonly message: string;
  readonly issues: readonly {
    readonly path: string;
    readonly message: string;
  }[];
}
export type EngineResponse<T> =
  | { readonly ok: true; readonly result: T }
  | { readonly ok: false; readonly error: EngineError };
export interface EventBase<K extends string> {
  readonly seq: number;
  readonly kind: K;
  readonly simTime?: number;
  readonly explanationKey: string;
}
export interface ReplayFrame<E, S> {
  readonly index: number;
  readonly event: E | null;
  readonly snapshot: S;
}
export interface TraceResult<E, S> {
  readonly engineVersion: string;
  readonly events: readonly E[];
  readonly frames: readonly ReplayFrame<E, S>[];
  readonly outcome: RunOutcome;
}

export type CpuAlgorithm = 'fcfs' | 'sjf' | 'priority' | 'rr';
export interface CpuProcessInput {
  readonly id: ProcessId;
  readonly arrival: number;
  readonly burst: number;
  readonly priority: number;
}
export interface CpuScenario {
  readonly kind: 'cpu';
  readonly processes: readonly CpuProcessInput[];
  readonly algorithm: CpuAlgorithm;
  readonly quantum: number;
  readonly contextSwitchCost: 0;
}
export type CpuEventPayload =
  | { readonly kind: 'process-arrived'; readonly processId: ProcessId }
  | {
      readonly kind: 'dispatch';
      readonly processId: ProcessId;
      readonly algorithm: CpuAlgorithm;
      readonly candidates: readonly ProcessId[];
    }
  | {
      readonly kind: 'quantum-expired';
      readonly processId: ProcessId;
      readonly remaining: number;
      readonly ahead: readonly ProcessId[];
    }
  | { readonly kind: 'process-completed'; readonly processId: ProcessId }
  | { readonly kind: 'idle-started'; readonly until: number }
  | { readonly kind: 'idle-ended' };
export type CpuEvent = CpuEventPayload & {
  readonly seq: number;
  readonly simTime: number;
  readonly explanationKey: string;
};

// Other modules add their own scenario/event unions at their implementation phase.
// The shared result contract never uses arbitrary untyped payloads.
export const TRACE_EVENT_BUDGET = 50_000;
