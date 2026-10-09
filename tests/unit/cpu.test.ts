import { describe, expect, it } from 'vitest';
import fixtures from '../../fixtures/cpu.json';
import type { CpuAlgorithm, CpuScenario } from '../../src/engine/contracts';
import { compareCpu } from '../../src/engine/cpu/compare';
import { intervalsAtFrame, scheduleCpu } from '../../src/engine/cpu/schedule';
import {
  CPU_ALGORITHMS,
  isCpuAlgorithm,
} from '../../src/engine/cpu/validation';
import { initialReplay, replayReducer } from '../../src/app/replay';

const process = (id: string, arrival = 0, burst = 1, priority = 1) => ({
  id,
  arrival,
  burst,
  priority,
});
const scenario = (
  processes: CpuScenario['processes'],
  algorithm: CpuAlgorithm = 'rr',
  quantum = 2,
): CpuScenario => ({
  kind: 'cpu',
  processes,
  algorithm,
  quantum,
  contextSwitchCost: 0,
});
function run(input: CpuScenario) {
  const response = scheduleCpu(input);
  if (!response.ok) throw new Error(response.error.message);
  return response.result;
}

describe('CPU reference oracles', () => {
  for (const fixture of fixtures.cases) {
    it(fixture.name, () => {
      if (!isCpuAlgorithm(fixture.input.algorithm))
        throw new Error('Unsupported fixture algorithm.');
      const result = run(
        scenario(
          fixture.input.processes,
          fixture.input.algorithm,
          fixture.input.quantum,
        ),
      );
      expect(result.intervals).toEqual(fixture.expected.intervals);
      if ('metrics' in fixture.expected)
        expect(
          result.metrics.map(
            ({ id, completion, turnaround, waiting, response }) => ({
              id,
              completion,
              turnaround,
              waiting,
              response,
            }),
          ),
        ).toEqual(fixture.expected.metrics);
      for (const key of [
        'busyTime',
        'finishTime',
        'utilizationPercent',
        'averageWaiting',
        'averageTurnaround',
        'averageResponse',
      ] as const) {
        if (key in fixture.expected)
          expect(result.summary[key]).toBeCloseTo(
            fixture.expected[key] ?? 0,
            12,
          );
      }
      if ('completion' in fixture.expected)
        expect(result.metrics[0]).toMatchObject({
          completion: fixture.expected.completion,
          waiting: fixture.expected.waiting,
          turnaround: fixture.expected.turnaround,
          response: fixture.expected.response,
        });
      if ('completionById' in fixture.expected)
        expect(
          Object.fromEntries(result.metrics.map((p) => [p.id, p.completion])),
        ).toEqual(fixture.expected.completionById);
    });
  }
});

describe('scheduling rules and event order', () => {
  it.each(CPU_ALGORITHMS)(
    '%s preserves input order for equal selection keys, not lexical IDs',
    (algorithm) => {
      const result = run(
        scenario(
          [
            process('P10', 0, 2, 1),
            process('P2', 0, 2, 1),
            process('P1', 0, 2, 1),
          ],
          algorithm,
          2,
        ),
      );
      expect(result.intervals.map((i) => i.id)).toEqual(['P10', 'P2', 'P1']);
    },
  );
  it('FCFS orders by arrival before input order', () => {
    expect(
      run(
        scenario(
          [process('late', 2), process('early', 0), process('middle', 1)],
          'fcfs',
        ),
      ).intervals.map((i) => i.id),
    ).toEqual(['early', 'middle', 'late']);
  });
  it.each(['sjf', 'priority'] as const)(
    '%s uses arrival before input order to break primary ties',
    (algorithm) => {
      const input = scenario(
        [
          process('occupant', 0, 5, 0),
          process('later', 2, 2, 2),
          process('earlier', 1, 2, 2),
        ],
        algorithm,
      );
      expect(run(input).intervals.map((i) => i.id)).toEqual([
        'occupant',
        'earlier',
        'later',
      ]);
    },
  );
  it.each(['sjf', 'priority'] as const)(
    '%s does not preempt for a better arrival, but records its queue transition',
    (algorithm) => {
      const result = run(
        scenario(
          [process('long', 0, 5, 5), process('short', 1, 1, 0)],
          algorithm,
        ),
      );
      expect(result.intervals).toEqual([
        { id: 'long', start: 0, end: 5 },
        { id: 'short', start: 5, end: 6 },
      ]);
      const arrival = result.frames.find(
        (f) =>
          f.event?.kind === 'process-arrived' && f.event.processId === 'short',
      );
      expect(arrival?.snapshot).toMatchObject({
        simTime: 1,
        running: 'long',
        ready: ['short'],
        summary: { busyTime: 1 },
      });
    },
  );
  it('RR admits arrivals before requeue, preserving arrivals inside the quantum', () => {
    const result = run(
      scenario(
        [
          process('P1', 0, 4),
          process('P2', 1, 1),
          process('P3', 2, 1),
          process('P4', 2, 1),
        ],
        'rr',
        2,
      ),
    );
    expect(
      result.events.filter((e) => e.simTime === 2).map((e) => e.kind),
    ).toEqual([
      'process-arrived',
      'process-arrived',
      'quantum-expired',
      'dispatch',
    ]);
    const expired = result.frames.find(
      (f) => f.event?.kind === 'quantum-expired',
    );
    expect(expired?.snapshot.ready).toEqual(['P2', 'P3', 'P4', 'P1']);
    expect(result.intervals.map((i) => i.id)).toEqual([
      'P1',
      'P2',
      'P3',
      'P4',
      'P1',
    ]);
  });
  it('completion at a quantum boundary precedes arrivals and is never requeued', () => {
    const result = run(
      scenario([process('P1', 0, 2), process('P2', 2, 1)], 'rr', 2),
    );
    expect(
      result.events.filter((e) => e.simTime === 2).map((e) => e.kind),
    ).toEqual(['process-completed', 'process-arrived', 'dispatch']);
    expect(result.events.some((e) => e.kind === 'quantum-expired')).toBe(false);
  });
  it('retains quantum events for a sole process', () => {
    const result = run(scenario([process('only', 0, 5)], 'rr', 2));
    expect(result.intervals.map((i) => [i.start, i.end])).toEqual([
      [0, 2],
      [2, 4],
      [4, 5],
    ]);
    expect(
      result.events.filter((e) => e.kind === 'quantum-expired'),
    ).toHaveLength(2);
    expect(result.metrics[0]).toMatchObject({
      waiting: 0,
      response: 0,
      completion: 5,
    });
  });
  it('RR with a large quantum agrees with FCFS', () => {
    const inputs = [
      process('P1', 0, 5),
      process('P2', 1, 3),
      process('P3', 2, 1),
    ];
    expect(run(scenario(inputs, 'rr', 1000)).intervals).toEqual(
      run(scenario(inputs, 'fcfs')).intervals,
    );
  });
  it('accounts for initial and intermediate idle gaps from clock zero', () => {
    const result = run(
      scenario([process('P1', 3, 2), process('P2', 8, 2)], 'fcfs'),
    );
    expect(result.intervals).toEqual([
      { id: null, start: 0, end: 3 },
      { id: 'P1', start: 3, end: 5 },
      { id: null, start: 5, end: 8 },
      { id: 'P2', start: 8, end: 10 },
    ]);
    expect(result.summary).toMatchObject({
      busyTime: 4,
      finishTime: 10,
      utilizationPercent: 40,
      throughput: 0.2,
    });
  });
});

describe('CPU safety, frame consistency, and comparison', () => {
  it.each(CPU_ALGORITHMS)(
    '%s satisfies independent workload and frame invariants',
    (algorithm) => {
      const inputs = [
        process('Z', 3, 7, 3),
        process('B', 0, 4, 2),
        process('A', 3, 1, 1),
        process('C', 15, 5, 2),
      ];
      const result = run(scenario(inputs, algorithm, 2));
      expect(result.frames).toHaveLength(result.events.length + 1);
      expect(result.frames[0]?.event).toBeNull();
      expect(result.summary.busyTime).toBe(17);
      for (const p of inputs) {
        expect(
          result.intervals
            .filter((i) => i.id === p.id)
            .reduce((sum, i) => sum + i.end - i.start, 0),
        ).toBe(p.burst);
        expect(
          result.intervals
            .filter((i) => i.id === p.id)
            .every((i) => i.start >= p.arrival),
        ).toBe(true);
      }
      result.intervals.forEach((interval, index) => {
        expect(interval.end).toBeGreaterThan(interval.start);
        expect(interval.start).toBe(
          index ? result.intervals[index - 1]?.end : 0,
        );
      });
      result.frames.forEach((frame, index) => {
        const s = frame.snapshot;
        expect(frame.index).toBe(index);
        expect(s.simTime).toBeGreaterThanOrEqual(
          result.frames[Math.max(0, index - 1)]?.snapshot.simTime ?? 0,
        );
        expect(new Set(s.ready).size).toBe(s.ready.length);
        expect(
          s.processes.filter((p) => p.state === 'running').map((p) => p.id),
        ).toEqual(s.running ? [s.running] : []);
        expect(
          s.processes
            .filter((p) => p.state === 'ready')
            .map((p) => p.id)
            .sort(),
        ).toEqual([...s.ready].sort());
        expect(s.processes.reduce((sum, p) => sum + p.serviced, 0)).toBe(
          s.summary.busyTime,
        );
        expect(
          intervalsAtFrame(result, s).every((i) => i.end <= s.simTime),
        ).toBe(true);
        for (const p of s.processes) {
          expect(p.remaining + p.serviced).toBe(p.burst);
          expect(p.waiting === null || p.waiting >= 0).toBe(true);
          expect(p.response === null || p.response >= 0).toBe(true);
          if (p.state !== 'terminated')
            expect([p.completion, p.turnaround, p.waiting]).toEqual([
              null,
              null,
              null,
            ]);
        }
      });
    },
  );
  it('keeps future metrics and intervals out of the initial frame', () => {
    const result = run(scenario([process('P1', 0, 5)]));
    const initial = result.frames[0]?.snapshot;
    expect(initial?.summary).toMatchObject({
      busyTime: 0,
      completedCount: 0,
      averageWaiting: null,
      utilizationPercent: null,
    });
    if (!initial) throw new Error('Missing initial frame');
    expect(intervalsAtFrame(result, initial)).toEqual([]);
  });
  it('copies source data, freezes nested results, and preserves results under replay', () => {
    const inputs = [process('P1', 0, 5), process('P2', 1, 3)];
    const result = run(scenario(inputs));
    const serialized = JSON.stringify(result);
    expect(result).toEqual(run(scenario(inputs)));
    inputs[0]!.burst = 1;
    expect(result.scenario.processes[0]?.burst).toBe(5);
    expect(Object.isFrozen(result.frames[2]?.snapshot.processes[0])).toBe(true);
    expect(Object.isFrozen(result.intervals[0])).toBe(true);
    let replay = replayReducer(
      initialReplay,
      { type: 'play' },
      result.frames.length,
    );
    replay = replayReducer(
      replay,
      { type: 'speed', speed: 4 },
      result.frames.length,
    );
    replay = replayReducer(replay, { type: 'tick' }, result.frames.length);
    replay = replayReducer(replay, { type: 'previous' }, result.frames.length);
    replay = replayReducer(
      replay,
      { type: 'seek', cursor: result.frames.length - 1 },
      result.frames.length,
    );
    replay = replayReducer(replay, { type: 'play' }, result.frames.length);
    replay = replayReducer(replay, { type: 'pause' }, result.frames.length);
    expect(replay.cursor).toBe(0);
    expect(JSON.stringify(result)).toBe(serialized);
  });
  it('compares identical process inputs and uses quantum only for RR', () => {
    const source = scenario(
      [process('P1', 0, 5, 2), process('P2', 1, 3, 1), process('P3', 2, 1, 3)],
      'rr',
      2,
    );
    const comparison = compareCpu(source);
    if (!comparison.ok) throw new Error(comparison.error.message);
    expect(comparison.result.map((r) => r.scenario.algorithm)).toEqual(
      CPU_ALGORITHMS,
    );
    comparison.result.forEach((result) =>
      expect(result.scenario.processes).toEqual(source.processes),
    );
    expect(comparison.result.map((r) => r.summary.averageResponse)).toEqual([
      10 / 3,
      8 / 3,
      10 / 3,
      1,
    ]);
    expect(Object.isFrozen(comparison.result)).toBe(true);
  });
  it('runs near-limit numeric inputs with compressed intervals', () => {
    const result = run(
      scenario(
        Array.from({ length: 50 }, (_, i) =>
          process(`P${i + 1}`, 10_000, 1000, 999),
        ),
        'rr',
        1000,
      ),
    );
    expect(result.summary).toMatchObject({
      busyTime: 50_000,
      finishTime: 60_000,
    });
    expect(result.intervals).toHaveLength(51);
    expect(result.events).toHaveLength(152);
  });
  it('rejects oversized traces before building frames and never returns partial success', () => {
    const response = scheduleCpu(
      scenario(
        Array.from({ length: 50 }, (_, i) => process(`P${i}`, 0, 1000)),
        'rr',
        1,
      ),
    );
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'limit-exceeded' },
    });
    expect(scheduleCpu(scenario([process('P1', 3, 1)]), 3)).toMatchObject({
      ok: false,
      error: { code: 'limit-exceeded' },
    });
  });
  it.each([
    scenario([]),
    scenario([process('same'), process('same')]),
    scenario([process('bad ID')]),
    scenario([process('P1', -1)]),
    scenario([process('P1', 10_001)]),
    scenario([process('P1', 0, 0)]),
    scenario([process('P1', 0, 1.5)]),
    scenario([process('P1', 0, 1001)]),
    scenario([process('P1', 0, NaN)]),
    scenario([process('P1', 0, Infinity)]),
    scenario([process('P1', 0, 1, -1)]),
    scenario([process('P1', 0, 1, 1000)]),
    scenario([process('P1')], 'rr', 0),
    scenario([process('P1')], 'rr', 1001),
    scenario(Array.from({ length: 51 }, (_, i) => process(`P${i}`))),
  ])('rejects an invalid input with descriptive field issues', (input) => {
    const response = scheduleCpu(input);
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'validation' },
    });
    if (response.ok) throw new Error('Invalid input accepted');
    expect(response.error.issues.length).toBeGreaterThan(0);
  });
  it('ignores dormant quantum for a non-RR run but requires it for comparison', () => {
    expect(scheduleCpu(scenario([process('P1')], 'fcfs', 0)).ok).toBe(true);
    expect(compareCpu(scenario([process('P1')], 'fcfs', 0))).toMatchObject({
      ok: false,
      error: { code: 'validation' },
    });
  });
});
