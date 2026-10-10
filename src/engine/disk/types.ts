import type { EventBase, TraceResult } from '../contracts';
export type DiskAlgorithm = 'fcfs' | 'sstf' | 'scan' | 'cscan';
export type DiskDirection = 'higher' | 'lower';
export interface DiskRequest {
  readonly id: string;
  readonly cylinder: number;
}
export interface DiskScenario {
  readonly kind: 'disk';
  readonly minCylinder: 0;
  readonly maxCylinder: number;
  readonly initialHead: number;
  readonly direction: DiskDirection;
  readonly requests: readonly DiskRequest[];
  readonly algorithm: DiskAlgorithm;
}
export type DiskMove = {
  readonly from: number;
  readonly to: number;
  readonly distance: number;
} & (
  | { readonly kind: 'service'; readonly requestId: string }
  | { readonly kind: 'endpoint' | 'wrap'; readonly requestId: null }
);
export type DiskEvent = DiskMove &
  EventBase<DiskMove['kind']> & {
    readonly directionBefore: DiskDirection;
    readonly directionAfter: DiskDirection;
    readonly reason: string;
    readonly candidates: readonly (DiskRequest & {
      readonly distance: number;
    })[];
  };
export interface DiskSnapshot {
  readonly step: number;
  readonly head: number;
  readonly direction: DiskDirection;
  readonly serviceOrder: readonly string[];
  readonly pendingIds: readonly string[];
  readonly totalMovement: number;
  readonly averageMovement: number | null;
  readonly endpointMovement: number;
  readonly wrapMovement: number;
  readonly status: 'ready' | 'in-progress' | 'completed';
}
export interface DiskResult extends TraceResult<DiskEvent, DiskSnapshot> {
  readonly scenario: DiskScenario;
  readonly summary: DiskSnapshot;
  readonly headPath: readonly number[];
  readonly moves: readonly DiskMove[];
}
