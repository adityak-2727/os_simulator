import { describe, expect, it } from 'vitest';
import fixtures from '../../fixtures/deadlock.json';
import { runBanker } from '../../src/engine/deadlock/banker';
import {
  analyzeGraph,
  editGraph,
  nodeKey,
} from '../../src/engine/deadlock/graph';
import {
  validateBanker,
  validateGraph,
} from '../../src/engine/deadlock/validation';
import type {
  BankerScenario,
  GraphScenario,
} from '../../src/engine/deadlock/types';
import type { EngineResponse } from '../../src/engine/contracts';
function value<T>(response: EngineResponse<T>): T {
  if (!response.ok) throw new Error(response.error.message);
  return response.result;
}
const safe: BankerScenario = {
  kind: 'deadlock',
  mode: 'banker',
  processIds: ['P0', 'P1', 'P2', 'P3', 'P4'],
  resourceIds: ['A', 'B', 'C'],
  total: [10, 5, 7],
  allocation: [
    [0, 1, 0],
    [2, 0, 0],
    [3, 0, 2],
    [2, 1, 1],
    [0, 0, 2],
  ],
  max: [
    [7, 5, 3],
    [3, 2, 2],
    [9, 0, 2],
    [2, 2, 2],
    [4, 3, 3],
  ],
};
const cycle: GraphScenario = {
  kind: 'deadlock',
  mode: 'graph',
  processIds: ['P1', 'P2'],
  resourceIds: ['R1', 'R2'],
  allocations: [
    { processId: 'P1', resourceId: 'R1' },
    { processId: 'P2', resourceId: 'R2' },
  ],
  requests: [
    { processId: 'P1', resourceId: 'R2' },
    { processId: 'P2', resourceId: 'R1' },
  ],
};
describe('reference oracles', () => {
  for (const fixture of fixtures.cases)
    it(fixture.name, () => {
      const source = fixture.input;
      if (
        source.mode === 'banker' &&
        source.total &&
        source.allocation &&
        source.max
      ) {
        const result = value(
          runBanker({ ...source, kind: 'deadlock', mode: 'banker' }),
        );
        expect(result.summary.status).toBe(fixture.expected.status);
        if (fixture.expected.available)
          expect(result.initialState.available).toEqual(
            fixture.expected.available,
          );
        if (fixture.expected.safeSequence)
          expect(result.summary.sequence).toEqual(
            fixture.expected.safeSequence,
          );
        if (fixture.expected.workTrace)
          expect([
            result.initialState.available,
            ...result.events
              .filter((e) => e.kind === 'banker-select')
              .map((e) => e.workAfter),
          ]).toEqual(fixture.expected.workTrace);
        if (fixture.expected.stateUnchanged)
          expect(result.finalState).toBe(result.initialState);
        if (fixture.expected.availableAfter)
          expect(result.finalState.available).toEqual(
            fixture.expected.availableAfter,
          );
        if (fixture.expected.allocationRowAfter)
          expect(result.finalState.allocation[1]).toEqual(
            fixture.expected.allocationRowAfter,
          );
      } else if (source.allocations && source.requests) {
        const result = value(
          analyzeGraph({ ...source, kind: 'deadlock', mode: 'graph' }),
        );
        expect(result.summary.cycle.map((n) => n.id)).toEqual(
          fixture.expected.cycle,
        );
        expect(result.summary.status).toBe(fixture.expected.status);
      } else throw new Error('Unrecognized fixture');
    });
});
describe('independent Banker invariants', () => {
  it('never releases actual allocations during safety and restarts input-order selection', () => {
    const result = value(runBanker(safe));
    expect(result.initialState.need).toEqual([
      [7, 4, 3],
      [1, 2, 2],
      [6, 0, 0],
      [0, 1, 1],
      [4, 3, 1],
    ]);
    for (const frame of result.frames)
      expect(frame.snapshot.actual).toBe(result.initialState);
    const selections = result.events.filter((e) => e.kind === 'banker-select');
    expect(selections[2]?.eligible).toEqual(['P0', 'P2', 'P4']);
    for (const event of selections) {
      const i = safe.processIds.indexOf(event.processId ?? '');
      expect(
        safe.max[i]?.every(
          (n, j) =>
            n - (safe.allocation[i]?.[j] ?? 0) <= (event.workBefore[j] ?? 0),
        ),
      ).toBe(true);
      expect(event.workAfter).toEqual(
        event.workBefore.map((n, j) => n + (safe.allocation[i]?.[j] ?? 0)),
      );
    }
    expect(result.summary.work).toEqual(safe.total);
    expect(new Set(result.summary.sequence).size).toBe(safe.processIds.length);
  });
  it('commits only at the decision frame; rejection keeps the exact state', () => {
    const granted = value(
      runBanker({ ...safe, request: { processId: 'P1', amount: [1, 0, 2] } }),
    );
    granted.frames
      .slice(0, -1)
      .forEach((f) => expect(f.snapshot.actual).toBe(granted.initialState));
    expect(granted.frames.at(-1)?.snapshot.actual).toBe(granted.finalState);
    granted.finalState.total.forEach((n, j) =>
      expect(
        (granted.finalState.available[j] ?? 0) +
          granted.finalState.allocation.reduce((s, r) => s + (r[j] ?? 0), 0),
      ).toBe(n),
    );
    const rejected = value(
      runBanker({ ...safe, request: { processId: 'P4', amount: [3, 3, 0] } }),
    );
    expect(rejected.summary.analyzed.available).toEqual([0, 0, 2]);
    expect(rejected.finalState).toBe(rejected.initialState);
    expect(rejected.summary.unsatisfied.length).toBeGreaterThan(0);
  });
  it('unsafe does not imply deadlock and zero Need is eligible even with no Work', () => {
    const unsafe: BankerScenario = {
      ...safe,
      processIds: ['P10', 'P2'],
      resourceIds: ['R'],
      total: [2],
      allocation: [[1], [1]],
      max: [[2], [2]],
    };
    const result = value(runBanker(unsafe));
    expect(result.outcome).toBe('unsafe');
    expect(result.summary.sequence).toEqual([]);
    const zero = value(runBanker({ ...unsafe, max: [[1], [1]] }));
    expect(zero.summary.sequence).toEqual(['P10', 'P2']);
  });
  it('zero requests are no-op transactions; unknown, negative, fractional and wrong dimensions are invalid', () => {
    const zero = value(
      runBanker({ ...safe, request: { processId: 'P1', amount: [0, 0, 0] } }),
    );
    expect(zero.summary.status).toBe('granted');
    expect(zero.finalState).toEqual(zero.initialState);
    for (const request of [
      { processId: 'X', amount: [0, 0, 0] },
      { processId: 'P1', amount: [-1, 0, 0] },
      { processId: 'P1', amount: [0.5, 0, 0] },
      { processId: 'P1', amount: [0, 0] },
    ]) {
      const result = value(runBanker({ ...safe, request }));
      expect(result.summary.status).toBe('invalid');
      expect(result.finalState).toBe(result.initialState);
    }
  });
  it('validates dimensions, sums, claims, integers, IDs and empty inputs', () => {
    for (const change of [
      { total: [1, 5, 7] },
      { total: [10, 5] },
      { allocation: [[0, 1, 0]] },
      { max: [[11, 5, 3], ...safe.max.slice(1)] },
      { allocation: [[8, 1, 0], ...safe.allocation.slice(1)] },
      { total: [10.1, 5, 7] },
      { processIds: ['P0', 'P0', 'P2', 'P3', 'P4'] },
      { processIds: [] },
    ])
      expect(validateBanker({ ...safe, ...change })).not.toBeNull();
  });
  it('is deterministic, immutable and bounded at maximum dimensions', () => {
    const original = JSON.stringify(safe),
      result = value(runBanker(safe));
    expect(runBanker(safe)).toEqual({ ok: true, result });
    expect(JSON.stringify(safe)).toBe(original);
    expect(
      Object.isFrozen(result.frames[1]?.snapshot.actual.allocation[0]),
    ).toBe(true);
    expect(runBanker(safe, 1).ok).toBe(false);
    const max: BankerScenario = {
      kind: 'deadlock',
      mode: 'banker',
      processIds: Array.from({ length: 10 }, (_, i) => `P${i}`),
      resourceIds: Array.from({ length: 8 }, (_, i) => `R${i}`),
      total: Array(8).fill(1000) as number[],
      allocation: Array.from(
        { length: 10 },
        () => Array(8).fill(100) as number[],
      ),
      max: Array.from({ length: 10 }, () => Array(8).fill(100) as number[]),
    };
    const full = value(runBanker(max));
    expect(full.events).toHaveLength(11);
    expect(full.summary.work).toEqual(max.total);
    full.frames.forEach((f, i) => expect(f.index).toBe(i));
  });
});
describe('single-instance graph', () => {
  it('uses correct arrows and reports the closed cycle and blocked processes', () => {
    const result = value(analyzeGraph(cycle));
    expect(result.edges[0]?.source.kind).toBe('process');
    expect(result.edges[0]?.target.kind).toBe('resource');
    expect(result.edges[2]?.source.kind).toBe('resource');
    expect(result.edges[2]?.target.kind).toBe('process');
    expect(result.summary.blockedProcessIds).toEqual(['P1', 'P2']);
    for (let i = 0; i < result.summary.cycle.length - 1; i++)
      expect(
        result.edges.some(
          (e) =>
            nodeKey(e.source) === nodeKey(result.summary.cycle[i]!) &&
            nodeKey(e.target) === nodeKey(result.summary.cycle[i + 1]!),
        ),
      ).toBe(true);
  });
  it('releases only owned resources, prevents multiple owners and grants available resources atomically', () => {
    expect(
      editGraph(cycle, { type: 'grant', processId: 'P2', resourceId: 'R1' }).ok,
    ).toBe(false);
    expect(
      editGraph(cycle, { type: 'release', processId: 'P2', resourceId: 'R1' })
        .ok,
    ).toBe(false);
    const released = value(
      editGraph(cycle, { type: 'release', processId: 'P1', resourceId: 'R1' }),
    );
    expect(value(analyzeGraph(released)).summary.status).toBe('no-cycle');
    const granted = value(
      editGraph(released, { type: 'grant', processId: 'P2', resourceId: 'R1' }),
    );
    expect(granted.requests).not.toContainEqual({
      processId: 'P2',
      resourceId: 'R1',
    });
    expect(cycle.allocations).toHaveLength(2);
  });
  it('adds and cancels requests, rejects duplicates and unknown nodes', () => {
    const noRequests = { ...cycle, requests: [] };
    const requested = value(
      editGraph(noRequests, {
        type: 'request',
        processId: 'P1',
        resourceId: 'R2',
      }),
    );
    expect(
      value(
        editGraph(requested, {
          type: 'cancel-request',
          processId: 'P1',
          resourceId: 'R2',
        }),
      ).requests,
    ).toHaveLength(0);
    expect(
      editGraph(requested, {
        type: 'request',
        processId: 'P1',
        resourceId: 'R2',
      }).ok,
    ).toBe(false);
    for (const change of [
      { requests: [{ processId: 'X', resourceId: 'R1' }] },
      {
        allocations: [
          ...cycle.allocations,
          { processId: 'P2', resourceId: 'R1' },
        ],
      },
      { requests: [...cycle.requests, ...cycle.requests] },
      { processIds: ['P1', 'P1'] },
      { resourceIds: [] },
    ])
      expect(validateGraph({ ...cycle, ...change })).not.toBeNull();
  });
  it('uses typed node identities, preserves input order, immutable deterministic frames and bounded traces', () => {
    const graph: GraphScenario = {
      kind: 'deadlock',
      mode: 'graph',
      processIds: ['P10', 'P2', 'R'],
      resourceIds: ['R'],
      requests: [{ processId: 'P10', resourceId: 'R' }],
      allocations: [],
    };
    const result = value(analyzeGraph(graph));
    expect(result.summary.status).toBe('no-cycle');
    expect(result.events[0]?.node?.id).toBe('P10');
    expect(result.summary.visited.filter((n) => n.id === 'R')).toHaveLength(2);
    expect(analyzeGraph(graph)).toEqual({ ok: true, result });
    expect(Object.isFrozen(result.frames[1]?.snapshot.path)).toBe(true);
    expect(analyzeGraph(graph, 1).ok).toBe(false);
    const max = {
      ...graph,
      processIds: Array.from({ length: 12 }, (_, i) => `P${i}`),
      resourceIds: Array.from({ length: 12 }, (_, i) => `R${i}`),
      requests: [],
    };
    expect(value(analyzeGraph(max)).events).toHaveLength(49);
  });
});
