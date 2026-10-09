import { describe, expect, it } from 'vitest';
import allocationFixtures from '../../fixtures/allocation.json';
import pagingFixtures from '../../fixtures/paging.json';
import {
  allocateMemory,
  compareAllocation,
} from '../../src/engine/memory/allocation';
import { replacePages, comparePaging } from '../../src/engine/memory/paging';
import {
  ALLOCATION_STRATEGIES,
  PAGING_ALGORITHMS,
} from '../../src/engine/memory/validation';
import type {
  AllocationOperation,
  AllocationResult,
  AllocationScenario,
  PagingScenario,
} from '../../src/engine/memory/types';

const operation = (id: string, sizeKiB: number): AllocationOperation => ({
  kind: 'allocate',
  id,
  sizeKiB,
});
const free = (id: string): AllocationOperation => ({ kind: 'free', id });
function allocation(
  operations: readonly AllocationOperation[],
  totalKiB = 100,
  strategy: AllocationScenario['strategy'] = 'first-fit',
) {
  const response = allocateMemory({
    kind: 'allocation',
    totalKiB,
    strategy,
    operations,
  });
  if (!response.ok) throw new Error(response.error.message);
  return response.result;
}
function paging(
  references: readonly number[],
  frames = 3,
  algorithm: PagingScenario['algorithm'] = 'fifo',
) {
  const response = replacePages({
    kind: 'paging',
    frames,
    algorithm,
    references,
  });
  if (!response.ok) throw new Error(response.error.message);
  return response.result;
}
function checkConservation(result: AllocationResult) {
  for (const { snapshot } of result.frames) {
    let address = 0;
    const ids: string[] = [];
    snapshot.segments.forEach((s, i) => {
      expect(s.start).toBe(address);
      expect(s.end).toBeGreaterThan(s.start);
      address = s.end;
      if (s.id !== null) ids.push(s.id);
      else if (i) expect(snapshot.segments[i - 1]?.id).not.toBeNull();
    });
    expect(address).toBe(result.scenario.totalKiB);
    expect(new Set(ids).size).toBe(ids.length);
    expect(snapshot.totalFreeKiB + snapshot.allocatedKiB).toBe(address);
  }
}
describe('allocation fixtures and independent invariants', () => {
  for (const fixture of allocationFixtures.cases)
    it(fixture.name, () => {
      const strategy = ALLOCATION_STRATEGIES.find(
        (s) => s === fixture.input.strategy,
      );
      if (!strategy) throw new Error('Invalid fixture strategy');
      const operations: AllocationOperation[] = fixture.input.operations.map(
        (op) =>
          op.kind === 'allocate' &&
          'sizeKiB' in op &&
          typeof op.sizeKiB === 'number'
            ? operation(op.id, op.sizeKiB)
            : free(op.id),
      );
      const result = allocation(operations, fixture.input.totalKiB, strategy);
      const holes = (step: number) =>
        result.frames[step]?.snapshot.segments
          .filter((s) => s.id === null)
          .map(({ start, end }) => ({ start, end }));
      const expected = fixture.expected;
      if ('holesBeforeLast' in expected)
        expect(holes(operations.length - 1)).toEqual(expected.holesBeforeLast);
      if ('lastAllocation' in expected)
        expect(result.summary.segments.find((s) => s.id === 'E')).toEqual(
          expected.lastAllocation,
        );
      if ('totalFreeKiB' in expected)
        expect(result.summary.totalFreeKiB).toBe(expected.totalFreeKiB);
      if ('lastOutcome' in expected) {
        expect(result.events.at(-1)?.decision).toBe(expected.lastOutcome);
        expect(result.summary.largestHoleKiB).toBe(expected.largestHoleKiB);
        expect(result.frames.at(-1)?.snapshot.segments).toBe(
          result.frames.at(-2)?.snapshot.segments,
        );
      }
      if ('afterFreeC' in expected) {
        expect(holes(6)).toEqual(expected.afterFreeC);
        expect(holes(7)).toEqual(expected.finalHoles);
        expect(result.summary.segments.filter((s) => s.id !== null)).toEqual(
          expected.remainingAllocations,
        );
      }
      checkConservation(result);
    });
  it('exact fit makes no zero-size hole, then frees all capacity', () => {
    const result = allocation([operation('A', 100), free('A')]);
    expect(result.frames[1]?.snapshot.segments).toEqual([
      { id: 'A', start: 0, end: 100 },
    ]);
    expect(result.summary.segments).toEqual([{ id: null, start: 0, end: 100 }]);
    checkConservation(result);
  });
  it('duplicates and unknown frees are visible rejected steps; freed ID is reusable', () => {
    const result = allocation([
      operation('A', 40),
      operation('A', 20),
      free('X'),
      free('A'),
      operation('A', 100),
    ]);
    expect(result.events.map((e) => e.decision)).toEqual([
      'allocated',
      'duplicate-id',
      'unknown-id',
      'freed',
      'allocated',
    ]);
    expect(result.frames[1]?.snapshot.segments).toBe(
      result.frames[2]?.snapshot.segments,
    );
    expect(result.frames[2]?.snapshot.segments).toBe(
      result.frames[3]?.snapshot.segments,
    );
    expect(result.summary.failedOperations).toBe(2);
    checkConservation(result);
  });
  it('insufficient total space differs from fragmentation and changes no memory', () => {
    const result = allocation([operation('A', 80), operation('B', 30)]);
    expect(result.events[1]?.decision).toBe('insufficient-total-space');
    expect(result.frames[1]?.snapshot.segments).toBe(
      result.frames[2]?.snapshot.segments,
    );
  });
  it('free between two holes coalesces both sides', () => {
    const result = allocation([
      operation('A', 20),
      operation('B', 20),
      operation('C', 20),
      free('A'),
      free('C'),
      free('B'),
    ]);
    expect(result.events.at(-1)?.mergedNeighbors).toBe(2);
    expect(result.summary.segments).toEqual([{ id: null, start: 0, end: 100 }]);
    checkConservation(result);
  });
  for (const strategy of ALLOCATION_STRATEGIES)
    it(`${strategy} tied holes use lower address`, () => {
      const result = allocation(
        [
          operation('A', 20),
          operation('B', 20),
          operation('C', 20),
          operation('D', 40),
          free('A'),
          free('C'),
          operation('E', 10),
        ],
        100,
        strategy,
      );
      expect(result.events.at(-1)?.selectedHole?.start).toBe(0);
      checkConservation(result);
    });
  it('all compared strategies receive identical operations and own immutable traces', () => {
    const source: AllocationScenario = {
      kind: 'allocation',
      totalKiB: 100,
      strategy: 'first-fit',
      operations: [operation('A', 30), free('A')],
    };
    const response = compareAllocation(source);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    for (const result of response.result) {
      expect(result.scenario.operations).toEqual(source.operations);
      expect(result.scenario.operations).not.toBe(source.operations);
      expect(Object.isFrozen(result.frames[1]?.snapshot.segments[0])).toBe(
        true,
      );
      expect(allocateMemory(result.scenario)).toEqual({ ok: true, result });
    }
  });
  for (const totalKiB of [0, 65_537, NaN, Infinity, 1.2])
    it(`rejects capacity ${totalKiB}`, () =>
      expect(
        allocateMemory({
          kind: 'allocation',
          totalKiB,
          strategy: 'first-fit',
          operations: [operation('A', 1)],
        }).ok,
      ).toBe(false));
  it('rejects empty/excessive operations, malformed IDs and oversize requests before construction', () => {
    for (const operations of [
      [],
      [operation('bad id', 1)],
      [operation('A', 101)],
      Array.from({ length: 201 }, () => free('A')),
    ])
      expect(
        allocateMemory({
          kind: 'allocation',
          totalKiB: 100,
          strategy: 'first-fit',
          operations,
        }).ok,
      ).toBe(false);
  });
  it('bounds trace construction and supports capacity/operation maxima', () => {
    const input: AllocationScenario = {
      kind: 'allocation',
      totalKiB: 65_536,
      strategy: 'first-fit',
      operations: Array.from({ length: 200 }, (_, i) =>
        i % 2 ? free('A') : operation('A', 65_536),
      ),
    };
    expect(allocateMemory(input, 199)).toMatchObject({
      ok: false,
      error: { code: 'limit-exceeded' },
    });
    const response = allocateMemory(input);
    expect(response.ok).toBe(true);
    if (response.ok) checkConservation(response.result);
  });
});
describe('paging reference frames and behavior', () => {
  for (const fixture of pagingFixtures.cases)
    it(fixture.name, () => {
      const algorithm = PAGING_ALGORITHMS.find(
        (a) => a === fixture.input.algorithm,
      );
      if (!algorithm) throw new Error('Invalid fixture algorithm');
      const result = paging(
        fixture.input.references,
        fixture.input.frames,
        algorithm,
      );
      expect(result.summary.faults).toBe(fixture.expected.faults);
      expect(result.summary.hits).toBe(fixture.expected.hits);
      expect(
        result.events.map(
          ({ referenceIndex, page, hit, frameIndex, evicted, frames }) => ({
            referenceIndex,
            page,
            hit,
            frameIndex,
            evicted,
            frames,
          }),
        ),
      ).toEqual(fixture.expected.trace);
      result.frames.forEach(({ snapshot, event }, i) => {
        expect(snapshot.pages).toHaveLength(3);
        const occupied = snapshot.pages.filter((p) => p !== null);
        expect(new Set(occupied).size).toBe(occupied.length);
        expect(snapshot.hits + snapshot.faults).toBe(i);
        expect(snapshot.processed).toBe(i);
        if (event?.hit)
          expect(snapshot.pages).toEqual(result.frames[i - 1]?.snapshot.pages);
        if (event) expect(snapshot.pages[event.frameIndex]).toBe(event.page);
      });
      expect(result.frames[0]?.snapshot.faultRatio).toBeNull();
      expect(result.summary.faultRatio).toBe(
        fixture.expected.faults / fixture.input.references.length,
      );
    });
  for (const algorithm of PAGING_ALGORITHMS) {
    it(`${algorithm} one frame and repeated page`, () => {
      const result = paging([0, 0, 1, 1, 0], 1, algorithm);
      expect(result.events.map((e) => e.frameIndex)).toEqual([0, 0, 0, 0, 0]);
      expect(result.events.map((e) => e.evicted)).toEqual([
        null,
        null,
        0,
        null,
        1,
      ]);
      expect(result.summary).toMatchObject({ faults: 3, hits: 2 });
    });
    it(`${algorithm} excess frames fill lowest empty first`, () => {
      const result = paging([3, 2, 3, 1], 12, algorithm);
      expect(result.events.map((e) => e.frameIndex)).toEqual([0, 1, 0, 2]);
      expect(result.summary.faults).toBe(3);
    });
  }
  it('FIFO hit leaves insertion order but LRU hit refreshes recency', () => {
    expect(paging([1, 2, 1, 3], 2, 'fifo').events.at(-1)?.evicted).toBe(1);
    expect(paging([1, 2, 1, 3], 2, 'lru').events.at(-1)?.evicted).toBe(2);
  });
  it('Optimal never-used tie evicts lowest frame and explains future assumption', () => {
    const result = paging([1, 2, 3, 4], 2, 'optimal');
    expect(result.events[2]?.frameIndex).toBe(0);
    expect(result.events[2]?.candidates.map((c) => c.nextUse)).toEqual([
      null,
      null,
    ]);
    expect(result.events[2]?.reason).toContain('infinity');
  });
  it('Optimal chooses farthest finite future use', () =>
    expect(paging([1, 2, 3, 1, 2], 2, 'optimal').events[2]?.evicted).toBe(2));
  it('comparisons preserve references and deterministic deeply frozen frames', () => {
    const input: PagingScenario = {
      kind: 'paging',
      frames: 3,
      algorithm: 'fifo',
      references: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2],
    };
    const response = comparePaging(input);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.result.map((r) => r.summary.faults)).toEqual([10, 9, 7]);
    response.result.forEach((result) => {
      expect(result.scenario.references).toEqual(input.references);
      expect(result.scenario.references).not.toBe(input.references);
      expect(Object.isFrozen(result.events[3]?.candidates[0])).toBe(true);
      expect(Object.isFrozen(result.frames[1]?.snapshot.pages)).toBe(true);
      expect(replacePages(result.scenario)).toEqual({ ok: true, result });
    });
  });
  it('validates empty sequence, page IDs, frame count, and reference count', () => {
    for (const references of [
      [],
      [-1],
      [10_000],
      [1.2],
      [NaN],
      [Infinity],
      Array.from({ length: 201 }, () => 1),
    ])
      expect(
        replacePages({
          kind: 'paging',
          algorithm: 'fifo',
          frames: 3,
          references,
        }).ok,
      ).toBe(false);
    for (const frames of [0, 13, NaN, 1.2])
      expect(
        replacePages({
          kind: 'paging',
          algorithm: 'fifo',
          frames,
          references: [0],
        }).ok,
      ).toBe(false);
  });
  it('supports upper bounds and rejects trace overflow before simulation', () => {
    const input: PagingScenario = {
      kind: 'paging',
      algorithm: 'optimal',
      frames: 12,
      references: Array.from({ length: 200 }, (_, i) => 9999 - i),
    };
    expect(replacePages(input, 199)).toMatchObject({
      ok: false,
      error: { code: 'limit-exceeded' },
    });
    expect(replacePages(input)).toMatchObject({
      ok: true,
      result: { summary: { faults: 200, hits: 0 } },
    });
  });
});
