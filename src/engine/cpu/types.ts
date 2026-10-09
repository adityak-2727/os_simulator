import type {
  CpuEvent,
  CpuProcessInput,
  CpuScenario,
  TraceResult,
} from '../contracts';

export interface CpuInterval {
  readonly id: string | null;
  readonly start: number;
  readonly end: number;
}
export interface CpuProcessFrame extends CpuProcessInput {
  readonly state: 'new' | 'ready' | 'running' | 'terminated';
  readonly remaining: number;
  readonly serviced: number;
  readonly firstStart: number | null;
  readonly completion: number | null;
  readonly turnaround: number | null;
  readonly waiting: number | null;
  readonly response: number | null;
}
export interface CpuSummary {
  readonly completedCount: number;
  readonly busyTime: number;
  readonly finishTime: number;
  readonly utilizationPercent: number | null;
  readonly throughput: number | null;
  readonly averageWaiting: number | null;
  readonly averageTurnaround: number | null;
  readonly averageResponse: number | null;
}
export interface CpuSnapshot {
  readonly simTime: number;
  readonly processes: readonly CpuProcessFrame[];
  readonly ready: readonly string[];
  readonly running: string | null;
  readonly intervalCount: number;
  readonly activeInterval: {
    readonly id: string | null;
    readonly start: number;
  } | null;
  readonly summary: CpuSummary;
}
export type CpuResult = TraceResult<CpuEvent, CpuSnapshot> & {
  readonly scenario: CpuScenario;
  readonly intervals: readonly CpuInterval[];
  readonly metrics: readonly CpuProcessFrame[];
  readonly summary: CpuSummary;
};
