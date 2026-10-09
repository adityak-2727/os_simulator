import {
  TRACE_EVENT_BUDGET,
  type EngineResponse,
  type ReplayFrame,
} from '../contracts';
import type {
  AllocationEvent,
  AllocationResult,
  AllocationScenario,
  AllocationSnapshot,
  Segment,
} from './types';
import { ALLOCATION_STRATEGIES, validateAllocation } from './validation';

export function allocateMemory(
  input: AllocationScenario,
  budget = TRACE_EVENT_BUDGET,
): EngineResponse<AllocationResult> {
  const error = validateAllocation(input);
  if (error) return { ok: false, error };
  if (
    !Number.isInteger(budget) ||
    budget < input.operations.length ||
    budget > TRACE_EVENT_BUDGET
  )
    return {
      ok: false,
      error: {
        code: 'limit-exceeded',
        message:
          'The operation list exceeds the trace budget. Reduce operations.',
        issues: [],
      },
    };
  const scenario: AllocationScenario = Object.freeze({
    ...input,
    operations: Object.freeze(
      input.operations.map((op) => Object.freeze({ ...op })),
    ),
  });
  let segments: readonly Segment[] = Object.freeze([
    Object.freeze({ start: 0, end: input.totalKiB, id: null }),
  ]);
  let successfulAllocations = 0,
    failedOperations = 0;
  const events: AllocationEvent[] = [];
  const frames: ReplayFrame<AllocationEvent, AllocationSnapshot>[] = [];
  const snapshot = (step: number): AllocationSnapshot => {
    const holes = segments.filter((s) => s.id === null);
    const totalFreeKiB = holes.reduce((n, s) => n + s.end - s.start, 0);
    const largestHoleKiB = Math.max(0, ...holes.map((s) => s.end - s.start));
    return Object.freeze({
      step,
      segments,
      totalFreeKiB,
      largestHoleKiB,
      freeOutsideLargestKiB: totalFreeKiB - largestHoleKiB,
      allocatedKiB: input.totalKiB - totalFreeKiB,
      liveCount: segments.length - holes.length,
      successfulAllocations,
      failedOperations,
    });
  };
  frames.push(Object.freeze({ index: 0, event: null, snapshot: snapshot(0) }));
  scenario.operations.forEach((operation, operationIndex) => {
    const holesBefore = Object.freeze(segments.filter((s) => s.id === null));
    let decision: AllocationEvent['decision'],
      selectedHole: Segment | null = null,
      affectedRange: Segment | null = null,
      mergedNeighbors = 0,
      reason: string;
    const live = segments.find((s) => s.id === operation.id);
    if (operation.kind === 'allocate') {
      const fitting = holesBefore.filter(
        (s) => s.end - s.start >= operation.sizeKiB,
      );
      fitting.sort(
        (a, b) =>
          (scenario.strategy === 'best-fit'
            ? a.end - a.start - (b.end - b.start)
            : scenario.strategy === 'worst-fit'
              ? b.end - b.start - (a.end - a.start)
              : 0) || a.start - b.start,
      );
      selectedHole = fitting[0] ?? null;
      if (live) {
        selectedHole = null;
        decision = 'duplicate-id';
        reason = `${operation.id} is already live at [${live.start}, ${live.end}) KiB. Duplicate allocation rejected; memory is unchanged.`;
      } else if (!selectedHole) {
        const total = holesBefore.reduce((n, h) => n + h.end - h.start, 0);
        const largest = Math.max(0, ...holesBefore.map((h) => h.end - h.start));
        decision =
          total >= operation.sizeKiB
            ? 'insufficient-contiguous-space'
            : 'insufficient-total-space';
        reason =
          total >= operation.sizeKiB
            ? `${operation.id} needs ${operation.sizeKiB} KiB. Total free space is ${total} KiB, but the largest hole is ${largest} KiB. Fragmentation prevents a contiguous allocation; memory is unchanged.`
            : `${operation.id} needs ${operation.sizeKiB} KiB, but only ${total} KiB is free (largest hole ${largest} KiB). Insufficient total free space; memory is unchanged.`;
      } else {
        decision = 'allocated';
        const range: Segment = Object.freeze({
          start: selectedHole.start,
          end: selectedHole.start + operation.sizeKiB,
          id: operation.id,
        });
        affectedRange = range;
        const remainder: Segment = Object.freeze({
          start: affectedRange.end,
          end: selectedHole.end,
          id: null,
        });
        segments = Object.freeze(
          segments.flatMap((s) =>
            s === selectedHole
              ? remainder.start < remainder.end
                ? [range, remainder]
                : [range]
              : [s],
          ),
        );
        successfulAllocations++;
        const rule =
          scenario.strategy === 'first-fit'
            ? 'first fitting hole in ascending address order'
            : scenario.strategy === 'best-fit'
              ? 'smallest fitting hole, with lower address breaking ties'
              : 'largest fitting hole, with lower address breaking ties';
        reason = `${operation.id} occupies [${affectedRange.start}, ${affectedRange.end}) KiB. Selected [${selectedHole.start}, ${selectedHole.end}) because it is the ${rule}. ${remainder.start < remainder.end ? `Remaining hole: [${remainder.start}, ${remainder.end}) KiB.` : 'Exact fit: no remainder.'}`;
      }
    } else if (!live) {
      decision = 'unknown-id';
      reason = `${operation.id} has no live allocation. Free rejected; memory is unchanged.`;
    } else {
      decision = 'freed';
      affectedRange = live;
      const released = segments.map((s) =>
        s === live ? Object.freeze({ ...s, id: null }) : s,
      );
      const merged: Segment[] = [];
      released.forEach((s) => {
        const previous = merged.at(-1);
        if (previous?.id === null && s.id === null) {
          merged[merged.length - 1] = Object.freeze({
            start: previous.start,
            end: s.end,
            id: null,
          });
          mergedNeighbors++;
        } else merged.push(s);
      });
      segments = Object.freeze(merged);
      const hole = segments.find(
        (s) => s.id === null && s.start <= live.start && s.end >= live.end,
      );
      reason = `Freed ${operation.id} at [${live.start}, ${live.end}) KiB. Merged ${mergedNeighbors} free neighbor${mergedNeighbors === 1 ? '' : 's'}; resulting hole [${hole?.start}, ${hole?.end}) KiB.`;
    }
    if (decision !== 'allocated' && decision !== 'freed') failedOperations++;
    const event: AllocationEvent = Object.freeze({
      seq: operationIndex,
      kind: 'allocation-operation',
      explanationKey: `allocation.${decision}`,
      operationIndex,
      operation,
      decision,
      holesBefore,
      selectedHole,
      affectedRange,
      mergedNeighbors,
      reason,
    });
    events.push(event);
    frames.push(
      Object.freeze({
        index: operationIndex + 1,
        event,
        snapshot: snapshot(operationIndex + 1),
      }),
    );
  });
  return {
    ok: true,
    result: Object.freeze({
      engineVersion: '0.3.0',
      scenario,
      events: Object.freeze(events),
      frames: Object.freeze(frames),
      summary: snapshot(events.length),
      outcome: 'completed',
    }),
  };
}
export function compareAllocation(
  input: AllocationScenario,
): EngineResponse<readonly AllocationResult[]> {
  const results: AllocationResult[] = [];
  for (const strategy of ALLOCATION_STRATEGIES) {
    const response = allocateMemory({ ...input, strategy });
    if (!response.ok) return response;
    results.push(response.result);
  }
  return { ok: true, result: Object.freeze(results) };
}
