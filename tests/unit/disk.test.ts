import { describe, expect, it } from 'vitest';
import fixtures from '../../fixtures/disk.json';
import type { EngineResponse } from '../../src/engine/contracts';
import type {
  DiskAlgorithm,
  DiskResult,
  DiskScenario,
} from '../../src/engine/disk/types';
import { scheduleDisk, compareDisk } from '../../src/engine/disk/schedule';
import {
  DISK_ALGORITHMS,
  validateDisk,
} from '../../src/engine/disk/validation';
function value<T>(response: EngineResponse<T>): T {
  if (!response.ok) throw new Error(response.error.message);
  return response.result;
}
function scenario(
  cylinders: readonly number[],
  config: Partial<DiskScenario> = {},
): DiskScenario {
  return {
    kind: 'disk',
    minCylinder: 0,
    maxCylinder: 100,
    initialHead: 50,
    direction: 'higher',
    algorithm: 'fcfs',
    requests: cylinders.map((cylinder, i) => ({ id: `D${i + 1}`, cylinder })),
    ...config,
  };
}
function algorithm(text: string): DiskAlgorithm {
  if (text === 'fcfs' || text === 'sstf' || text === 'scan' || text === 'cscan')
    return text;
  throw new Error(`Unexpected fixture algorithm ${text}`);
}
function invariants(result: DiskResult) {
  const { events, frames, scenario: source } = result;
  expect(frames).toHaveLength(events.length + 1);
  expect(frames[0]?.snapshot).toMatchObject({
    head: source.initialHead,
    totalMovement: 0,
    serviceOrder: [],
    pendingIds: source.requests.map((r) => r.id),
    averageMovement: null,
  });
  expect(result.summary.serviceOrder).toHaveLength(source.requests.length);
  expect(new Set(result.summary.serviceOrder)).toEqual(
    new Set(source.requests.map((r) => r.id)),
  );
  expect(result.summary.status).toBe('completed');
  expect(events.at(-1)?.kind).toBe('service');
  let movement = 0,
    endpoint = 0,
    wrap = 0;
  const served: string[] = [];
  events.forEach((e, i) => {
    const before = frames[i]!.snapshot,
      after = frames[i + 1]!.snapshot;
    expect(e.seq).toBe(i);
    expect(e.from).toBe(before.head);
    expect(e.directionBefore).toBe(before.direction);
    expect(e.distance).toBe(Math.abs(e.to - e.from));
    expect(e.to).toBeGreaterThanOrEqual(0);
    expect(e.to).toBeLessThanOrEqual(source.maxCylinder);
    expect(e).not.toHaveProperty('simTime');
    movement += e.distance;
    if (e.kind === 'service') {
      expect(served).not.toContain(e.requestId);
      expect(source.requests.find((r) => r.id === e.requestId)?.cylinder).toBe(
        e.to,
      );
      served.push(e.requestId);
    } else expect(e.requestId).toBeNull();
    if (e.kind === 'endpoint') endpoint += e.distance;
    if (e.kind === 'wrap') {
      wrap += e.distance;
      expect(e.distance).toBe(source.maxCylinder);
    }
    expect(after).toMatchObject({
      step: i + 1,
      head: e.to,
      direction: e.directionAfter,
      totalMovement: movement,
      endpointMovement: endpoint,
      wrapMovement: wrap,
      serviceOrder: served,
      pendingIds: source.requests
        .filter((r) => !served.includes(r.id))
        .map((r) => r.id),
      averageMovement: served.length ? movement / served.length : null,
    });
    expect(frames[i + 1]?.event).toBe(e);
  });
  expect(result.headPath).toEqual([
    source.initialHead,
    ...events.map((e) => e.to),
  ]);
  expect(result.summary.totalMovement).toBe(movement);
}
describe('disk fixture oracles', () => {
  for (const fixture of fixtures.cases)
    it(fixture.name, () => {
      expect(fixture.input.minCylinder).toBe(0);
      expect(fixture.input.direction).toBe('higher');
      const input: DiskScenario = {
        ...fixture.input,
        kind: 'disk',
        minCylinder: 0,
        direction: 'higher',
        algorithm: algorithm(fixture.input.algorithm),
      };
      const result = value(scheduleDisk(input));
      expect(result.headPath).toEqual(fixture.expected.headPath);
      expect(result.moves).toEqual(fixture.expected.moves);
      expect(result.summary.totalMovement).toBe(fixture.expected.totalMovement);
      expect(result.summary.serviceOrder).toEqual(
        fixture.expected.serviceOrder,
      );
      invariants(result);
    });
});
describe('disk conventions', () => {
  it('mirrors SCAN and C-SCAN in the lower direction', () => {
    const source = scenario([98, 183, 37, 122, 14, 124, 65, 67], {
      maxCylinder: 199,
      initialHead: 53,
      direction: 'lower',
    });
    const scan = value(scheduleDisk({ ...source, algorithm: 'scan' })),
      circular = value(scheduleDisk({ ...source, algorithm: 'cscan' }));
    expect(scan.headPath).toEqual([53, 37, 14, 0, 65, 67, 98, 122, 124, 183]);
    expect(scan.summary.totalMovement).toBe(236);
    expect(circular.headPath).toEqual([
      53, 37, 14, 0, 199, 183, 124, 122, 98, 67, 65,
    ]);
    expect(circular.summary.totalMovement).toBe(386);
    expect(scan.frames[3]?.snapshot.direction).toBe('higher');
    expect(circular.frames[4]?.snapshot.direction).toBe('lower');
    invariants(scan);
    invariants(circular);
  });
  it.each(DISK_ALGORITHMS)(
    '%s emits one zero-distance service for a single head request and stops',
    (a) => {
      const r = value(scheduleDisk(scenario([50], { algorithm: a })));
      expect(r.moves).toEqual([
        { from: 50, to: 50, distance: 0, kind: 'service', requestId: 'D1' },
      ]);
      expect(r.summary.averageMovement).toBe(0);
      invariants(r);
    },
  );
  it('preserves FCFS input order even when later requests are at the initial head', () => {
    const r = value(scheduleDisk(scenario([70, 50, 50])));
    expect(r.headPath).toEqual([50, 70, 50, 50]);
    expect(r.summary.serviceOrder).toEqual(['D1', 'D2', 'D3']);
    expect(r.summary.totalMovement).toBe(40);
  });
  it.each(['sstf', 'scan', 'cscan'] as const)(
    '%s serves initial-head duplicates first with stable non-lexical IDs',
    (a) => {
      const input = scenario([70, 50, 50], {
        algorithm: a,
        requests: [
          { id: 'P1', cylinder: 70 },
          { id: 'P10', cylinder: 50 },
          { id: 'P2', cylinder: 50 },
        ],
      });
      const r = value(scheduleDisk(input));
      expect(r.summary.serviceOrder).toEqual(['P10', 'P2', 'P1']);
      expect(r.moves.slice(0, 2).map((m) => m.distance)).toEqual([0, 0]);
      invariants(r);
    },
  );
  it('SSTF chooses the smaller equidistant cylinder, then input order for duplicate cylinders', () => {
    const r = value(
      scheduleDisk(scenario([60, 40, 40, 60], { algorithm: 'sstf' })),
    );
    expect(r.summary.serviceOrder).toEqual(['D2', 'D3', 'D1', 'D4']);
    expect(r.summary.totalMovement).toBe(30);
    expect(r.events[0]?.reason).toContain('Smaller cylinder wins');
    expect(r.events[0]?.candidates.map((c) => [c.id, c.distance])).toEqual([
      ['D2', 10],
      ['D3', 10],
      ['D1', 10],
      ['D4', 10],
    ]);
  });
  it.each(['scan', 'cscan'] as const)(
    '%s stops at the last request when no opposite-side request remains',
    (a) => {
      const r = value(scheduleDisk(scenario([70, 60, 60], { algorithm: a })));
      expect(r.headPath).toEqual([50, 60, 60, 70]);
      expect(r.summary.totalMovement).toBe(20);
      expect(r.events.every((e) => e.kind === 'service')).toBe(true);
      invariants(r);
      const lower = value(
        scheduleDisk(scenario([30, 40], { algorithm: a, direction: 'lower' })),
      );
      expect(lower.headPath).toEqual([50, 40, 30]);
    },
  );
  it('reaches the initial-direction endpoint even when that side has no requests', () => {
    const source = scenario([20, 10]);
    const s = value(scheduleDisk({ ...source, algorithm: 'scan' })),
      c = value(scheduleDisk({ ...source, algorithm: 'cscan' }));
    expect(s.headPath).toEqual([50, 100, 20, 10]);
    expect(s.summary.totalMovement).toBe(140);
    expect(c.headPath).toEqual([50, 100, 0, 10, 20]);
    expect(c.summary.totalMovement).toBe(170);
    expect(c.summary.wrapMovement).toBe(100);
    expect(s.frames[1]?.snapshot.averageMovement).toBeNull();
    expect(c.frames[2]?.snapshot.serviceOrder).toEqual([]);
    const lower = value(
      scheduleDisk(scenario([80], { algorithm: 'cscan', direction: 'lower' })),
    );
    expect(lower.headPath).toEqual([50, 0, 100, 80]);
    expect(lower.summary.totalMovement).toBe(170);
  });
  it('services endpoint duplicates once and separates an already-reached endpoint decision', () => {
    const r = value(
      scheduleDisk(scenario([100, 0, 100, 0], { algorithm: 'cscan' })),
    );
    expect(r.summary.serviceOrder).toEqual(['D1', 'D3', 'D2', 'D4']);
    expect(r.summary.totalMovement).toBe(150);
    expect(r.moves.map((m) => m.kind)).toEqual([
      'service',
      'service',
      'endpoint',
      'wrap',
      'service',
      'service',
    ]);
    expect(r.moves[2]).toMatchObject({
      from: 100,
      to: 100,
      distance: 0,
      requestId: null,
    });
    invariants(r);
    const s = value(
      scheduleDisk(scenario([20], { algorithm: 'scan', initialHead: 100 })),
    );
    expect(s.headPath).toEqual([100, 100, 20]);
    expect(s.frames[1]?.snapshot.direction).toBe('lower');
    invariants(s);
  });
  it('keeps source and nested results immutable and deterministic', () => {
    const source = scenario([60, 40], { algorithm: 'sstf' }),
      copy = structuredClone(source),
      r = value(scheduleDisk(source));
    expect(source).toEqual(copy);
    expect(value(scheduleDisk(source))).toEqual(r);
    expect(r.scenario).not.toBe(source);
    for (const obj of [
      r,
      r.scenario,
      r.scenario.requests,
      r.scenario.requests[0],
      r.moves,
      r.moves[0],
      r.headPath,
      r.frames,
      r.frames[0],
      r.frames[0]?.snapshot.pendingIds,
      r.events[0]?.candidates,
      r.events[0]?.candidates[0],
      r.summary.serviceOrder,
    ])
      expect(Object.isFrozen(obj)).toBe(true);
    expect(() => Object.assign(r.frames[0]!.snapshot, { head: 99 })).toThrow();
    expect(r.summary.head).toBe(60);
  });
  it('compares the exact same input batch, head, range and direction without mutating source', () => {
    const input = scenario([98, 183, 37, 122, 14, 124, 65, 67], {
        initialHead: 53,
        maxCylinder: 199,
        algorithm: 'scan',
      }),
      copy = structuredClone(input);
    const comparisons = value(compareDisk(input));
    expect(comparisons.map((r) => r.summary.totalMovement)).toEqual([
      640, 236, 331, 382,
    ]);
    expect(input).toEqual(copy);
    expect(Object.isFrozen(comparisons)).toBe(true);
    for (const r of comparisons) {
      expect(r.scenario.requests).toEqual(input.requests);
      expect(r.scenario.initialHead).toBe(input.initialHead);
      expect(r.scenario.direction).toBe(input.direction);
      invariants(r);
    }
  });
  it('rejects empty input descriptively instead of fabricating a completed workload', () => {
    const r = scheduleDisk(scenario([]));
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.error.issues).toContainEqual({
        path: 'requests',
        message: 'Request count must be a whole number from 1 to 100.',
      });
  });
  it('checks bounds, malformed numbers, unique IDs, algorithm and direction before execution', () => {
    const invalid: DiskScenario[] = [
      scenario([101]),
      scenario([-1]),
      scenario([NaN]),
      scenario([Infinity]),
      scenario([1.5]),
      scenario([0], { maxCylinder: 0 }),
      scenario([0], { maxCylinder: 100001 }),
      scenario([0], { initialHead: 101 }),
      scenario([0], { initialHead: -1 }),
      scenario([0, 1], {
        requests: [
          { id: 'X', cylinder: 0 },
          { id: 'X', cylinder: 1 },
        ],
      }),
      scenario([0], { requests: [{ id: 'bad id', cylinder: 0 }] }),
      scenario(Array.from({ length: 101 }, () => 0)),
    ];
    for (const source of invalid) {
      expect(validateDisk(source)).not.toBeNull();
      expect(scheduleDisk(source).ok).toBe(false);
      expect(compareDisk(source).ok).toBe(false);
    }
    expect(
      value(
        scheduleDisk(
          scenario([0, 100000], { maxCylinder: 100000, initialHead: 100000 }),
        ),
      ).summary.totalMovement,
    ).toBe(200000);
    expect(
      validateDisk({ ...scenario([0]), algorithm: 'look' as DiskAlgorithm }),
    ).not.toBeNull();
    expect(
      validateDisk({
        ...scenario([0]),
        direction: 'sideways' as DiskScenario['direction'],
      }),
    ).not.toBeNull();
  });
  it('preflights move budgets including endpoint and wrap overhead without a partial result', () => {
    const input = scenario([20], { algorithm: 'cscan' });
    expect(value(scheduleDisk(input, 3)).events).toHaveLength(3);
    for (const budget of [0, 2, -1, 2.5, 50001, NaN]) {
      const r = scheduleDisk(input, budget);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('limit-exceeded');
    }
  });
  it('satisfies distance, ownership-of-request, and prefix invariants across diverse bounded batches', () => {
    for (const head of [0, 5, 10, 20])
      for (const direction of ['higher', 'lower'] as const)
        for (const cylinders of [
          [0],
          [20],
          [10, 10, 0, 20],
          [3, 17, 5, 5, 12, 20, 0],
        ])
          for (const a of DISK_ALGORITHMS)
            invariants(
              value(
                scheduleDisk(
                  scenario(cylinders, {
                    maxCylinder: 20,
                    initialHead: head,
                    direction,
                    algorithm: a,
                  }),
                ),
              ),
            );
  });
});
