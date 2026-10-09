import type { EventBase, TraceResult } from '../contracts';
export interface Binding {
  readonly resourceId: string;
  readonly processId: string;
}
export interface GraphScenario {
  readonly kind: 'deadlock';
  readonly mode: 'graph';
  readonly processIds: readonly string[];
  readonly resourceIds: readonly string[];
  readonly allocations: readonly Binding[];
  readonly requests: readonly Binding[];
}
export interface GraphNode {
  readonly kind: 'process' | 'resource';
  readonly id: string;
}
export interface GraphEdge {
  readonly kind: 'request' | 'allocation';
  readonly source: GraphNode;
  readonly target: GraphNode;
}
export interface GraphSnapshot {
  readonly graph: GraphScenario;
  readonly step: number;
  readonly path: readonly GraphNode[];
  readonly visited: readonly GraphNode[];
  readonly cycle: readonly GraphNode[];
  readonly blockedProcessIds: readonly string[];
  readonly status: 'checking' | 'no-cycle' | 'deadlocked';
}
export interface GraphEvent extends EventBase<
  'graph-visit' | 'graph-backtrack' | 'graph-cycle' | 'graph-no-cycle'
> {
  readonly node: GraphNode | null;
  readonly reason: string;
}
export interface GraphResult extends TraceResult<GraphEvent, GraphSnapshot> {
  readonly scenario: GraphScenario;
  readonly edges: readonly GraphEdge[];
  readonly summary: GraphSnapshot;
}
export type GraphCommand = {
  readonly type: 'grant' | 'release' | 'request' | 'cancel-request';
  readonly resourceId: string;
  readonly processId: string;
};
export interface ResourceRequest {
  readonly processId: string;
  readonly amount: readonly number[];
}
export interface BankerScenario {
  readonly kind: 'deadlock';
  readonly mode: 'banker';
  readonly processIds: readonly string[];
  readonly resourceIds: readonly string[];
  readonly total: readonly number[];
  readonly allocation: readonly (readonly number[])[];
  readonly max: readonly (readonly number[])[];
  readonly request?: ResourceRequest;
}
export interface BankerState {
  readonly total: readonly number[];
  readonly allocation: readonly (readonly number[])[];
  readonly max: readonly (readonly number[])[];
  readonly available: readonly number[];
  readonly need: readonly (readonly number[])[];
}
export interface UnsatisfiedProcess {
  readonly processId: string;
  readonly shortfalls: readonly {
    readonly resourceId: string;
    readonly need: number;
    readonly work: number;
  }[];
}
export type BankerStatus =
  | 'checking'
  | 'safe'
  | 'unsafe'
  | 'granted'
  | 'wait-for-availability'
  | 'wait-for-safety'
  | 'invalid';
export interface BankerSnapshot {
  readonly step: number;
  readonly stage: 'initial' | 'tentative' | 'safety' | 'decision';
  readonly actual: BankerState;
  readonly analyzed: BankerState;
  readonly work: readonly number[];
  readonly finish: readonly boolean[];
  readonly sequence: readonly string[];
  readonly unsatisfied: readonly UnsatisfiedProcess[];
  readonly status: BankerStatus;
}
export interface BankerEvent extends EventBase<
  | 'request-tentative'
  | 'banker-select'
  | 'banker-safe'
  | 'banker-unsafe'
  | 'request-decision'
> {
  readonly processId: string | null;
  readonly workBefore: readonly number[];
  readonly workAfter: readonly number[];
  readonly eligible: readonly string[];
  readonly reason: string;
}
export interface BankerResult extends TraceResult<BankerEvent, BankerSnapshot> {
  readonly scenario: BankerScenario;
  readonly initialState: BankerState;
  readonly finalState: BankerState;
  readonly summary: BankerSnapshot;
}
