import type { ProcessState, TraceResult } from '../contracts';
import type { Segment } from '../memory/types';
import type { CpuInterval } from '../cpu/types';
export type SystemInstruction =
  | { readonly op: 'cpu'; readonly duration: number }
  | { readonly op: 'acquire' | 'release'; readonly resourceId: string };
export interface SystemScenario {
  readonly kind: 'system';
  readonly totalKiB: number;
  readonly algorithm: 'rr';
  readonly quantum: number;
  readonly resources: readonly { readonly id: string; readonly instances: 1 }[];
  readonly processes: readonly {
    readonly id: string;
    readonly arrival: number;
    readonly memoryKiB: number;
    readonly program: readonly SystemInstruction[];
  }[];
}
export interface SystemProcess {
  readonly id: string;
  readonly state: ProcessState;
  readonly pc: number;
  readonly remaining: number;
  readonly cpuService: number;
  readonly readyWait: number;
  readonly resourceWait: number;
  readonly memoryWait: number;
  readonly completion: number | null;
  readonly turnaround: number | null;
  readonly response: number | null;
  readonly waitingFor: string | null;
}
export interface SystemResource {
  readonly id: string;
  readonly owner: string | null;
  readonly queue: readonly string[];
}
export type SystemEventKind =
  | 'process-arrived'
  | 'memory-allocated'
  | 'memory-wait'
  | 'dispatch'
  | 'cpu-service'
  | 'instruction-completed'
  | 'resource-granted'
  | 'resource-blocked'
  | 'resource-released'
  | 'resource-wake'
  | 'quantum-expired'
  | 'process-completed'
  | 'memory-freed'
  | 'idle'
  | 'stalled'
  | 'deadlocked'
  | 'model-error';
export interface SystemEvent {
  readonly seq: number;
  readonly kind: SystemEventKind;
  readonly simTime: number;
  readonly explanationKey: string;
  readonly processId: string | null;
  readonly resourceId: string | null;
  readonly reason: string;
}
export interface SystemSnapshot {
  readonly simTime: number;
  readonly processes: readonly SystemProcess[];
  readonly resources: readonly SystemResource[];
  readonly segments: readonly Segment[];
  readonly ready: readonly string[];
  readonly memoryWait: readonly string[];
  readonly pendingWake: readonly string[];
  readonly running: string | null;
  readonly quantumRemaining: number;
  readonly intervalCount: number;
  readonly activeInterval: {
    readonly id: string;
    readonly start: number;
  } | null;
  readonly busyTime: number;
  readonly utilizationPercent: number | null;
  readonly status:
    'active' | 'completed' | 'stalled' | 'deadlocked' | 'model-error';
  readonly cycle: readonly string[];
}
export interface SystemResult extends TraceResult<SystemEvent, SystemSnapshot> {
  readonly scenario: SystemScenario;
  readonly intervals: readonly CpuInterval[];
  readonly metrics: readonly SystemProcess[];
  readonly summary: SystemSnapshot;
}
