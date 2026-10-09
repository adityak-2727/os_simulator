import type { EventBase, TraceResult } from '../contracts';

export type AllocationStrategy = 'first-fit' | 'best-fit' | 'worst-fit';
export type AllocationOperation =
  | { readonly kind: 'allocate'; readonly id: string; readonly sizeKiB: number }
  | { readonly kind: 'free'; readonly id: string };
export interface AllocationScenario {
  readonly kind: 'allocation';
  readonly totalKiB: number;
  readonly strategy: AllocationStrategy;
  readonly operations: readonly AllocationOperation[];
}
export interface Segment {
  readonly start: number;
  readonly end: number;
  readonly id: string | null;
}
export interface AllocationSnapshot {
  readonly step: number;
  readonly segments: readonly Segment[];
  readonly totalFreeKiB: number;
  readonly largestHoleKiB: number;
  readonly freeOutsideLargestKiB: number;
  readonly allocatedKiB: number;
  readonly liveCount: number;
  readonly successfulAllocations: number;
  readonly failedOperations: number;
}
export type AllocationDecision =
  | 'allocated'
  | 'freed'
  | 'duplicate-id'
  | 'unknown-id'
  | 'insufficient-total-space'
  | 'insufficient-contiguous-space';
export interface AllocationEvent extends EventBase<'allocation-operation'> {
  readonly operationIndex: number;
  readonly operation: AllocationOperation;
  readonly decision: AllocationDecision;
  readonly holesBefore: readonly Segment[];
  readonly selectedHole: Segment | null;
  readonly affectedRange: Segment | null;
  readonly mergedNeighbors: number;
  readonly reason: string;
}
export interface AllocationResult extends TraceResult<
  AllocationEvent,
  AllocationSnapshot
> {
  readonly scenario: AllocationScenario;
  readonly summary: AllocationSnapshot;
}
export type PagingAlgorithm = 'fifo' | 'lru' | 'optimal';
export interface PagingScenario {
  readonly kind: 'paging';
  readonly frames: number;
  readonly references: readonly number[];
  readonly algorithm: PagingAlgorithm;
}
export interface PageCandidate {
  readonly frameIndex: number;
  readonly page: number;
  readonly insertedAt: number;
  readonly lastAccess: number;
  readonly nextUse: number | null;
}
export interface PagingSnapshot {
  readonly step: number;
  readonly pages: readonly (number | null)[];
  readonly insertedAt: readonly (number | null)[];
  readonly lastAccess: readonly (number | null)[];
  readonly hits: number;
  readonly faults: number;
  readonly processed: number;
  readonly hitRatio: number | null;
  readonly faultRatio: number | null;
}
export interface PagingEvent extends EventBase<'page-hit' | 'page-fault'> {
  readonly referenceIndex: number;
  readonly page: number;
  readonly hit: boolean;
  readonly frameIndex: number;
  readonly evicted: number | null;
  readonly frames: readonly (number | null)[];
  readonly candidates: readonly PageCandidate[];
  readonly reason: string;
}
export interface PagingResult extends TraceResult<PagingEvent, PagingSnapshot> {
  readonly scenario: PagingScenario;
  readonly summary: PagingSnapshot;
}
