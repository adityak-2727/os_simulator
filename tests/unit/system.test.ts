import { describe, it, expect } from 'vitest';
import fixture from '../../fixtures/integrated.json';
import { runSystem } from '../../src/engine/system/schedule';
import { validateScenario } from '../../src/experiments/format';
import type {
  SystemScenario,
  SystemResult,
} from '../../src/engine/system/types';
function run(s: SystemScenario): SystemResult {
  const r = runSystem(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.result;
}
const parsed = validateScenario(fixture.cases[0]!.input);
if (!parsed.ok || parsed.result.kind !== 'system')
  throw new Error('Invalid test input');
const reference = parsed.result;
const simple = (patch: Partial<SystemScenario> = {}): SystemScenario => ({
  kind: 'system',
  totalKiB: 10,
  algorithm: 'rr',
  quantum: 2,
  resources: [],
  processes: [
    {
      id: 'Z',
      arrival: 0,
      memoryKiB: 5,
      program: [{ op: 'cpu', duration: 3 }],
    },
  ],
  ...patch,
});
describe('integrated deterministic state machine', () => {
  it('hands resource ownership to successive FIFO waiters once, including cleanup', () => {
    const s = simple({
        quantum: 1,
        resources: [{ id: 'R', instances: 1 }],
        processes: [
          {
            id: 'A',
            arrival: 0,
            memoryKiB: 2,
            program: [
              { op: 'acquire', resourceId: 'R' },
              { op: 'cpu', duration: 3 },
            ],
          },
          {
            id: 'B',
            arrival: 0,
            memoryKiB: 2,
            program: [
              { op: 'acquire', resourceId: 'R' },
              { op: 'cpu', duration: 1 },
            ],
          },
          {
            id: 'C',
            arrival: 0,
            memoryKiB: 2,
            program: [
              { op: 'acquire', resourceId: 'R' },
              { op: 'cpu', duration: 1 },
            ],
          },
        ],
      }),
      r = run(s);
    expect(
      r.events
        .filter((e) => e.kind === 'resource-wake')
        .map((e) => e.processId),
    ).toEqual(['B', 'C']);
    expect(
      r.events.filter((e) => e.kind === 'resource-wake').map((e) => e.simTime),
    ).toEqual([3, 4]);
    expect(r.metrics.map((p) => p.completion)).toEqual([3, 4, 5]);
    expect(r.metrics.every((p) => p.pc === 2)).toBe(true);
    expect(r.summary.resources[0]?.owner).toBeNull();
  });
  it('wake-ups precede simultaneous new admissions and quantum requeue', () => {
    const r = run(
      simple({
        quantum: 1,
        resources: [{ id: 'R', instances: 1 }],
        processes: [
          {
            id: 'A',
            arrival: 0,
            memoryKiB: 4,
            program: [
              { op: 'acquire', resourceId: 'R' },
              { op: 'cpu', duration: 2 },
              { op: 'release', resourceId: 'R' },
              { op: 'cpu', duration: 1 },
            ],
          },
          {
            id: 'B',
            arrival: 0,
            memoryKiB: 3,
            program: [
              { op: 'acquire', resourceId: 'R' },
              { op: 'cpu', duration: 1 },
            ],
          },
          {
            id: 'C',
            arrival: 2,
            memoryKiB: 3,
            program: [{ op: 'cpu', duration: 1 }],
          },
        ],
      }),
    );
    const at = r.frames.find(
      (f) => f.event?.kind === 'quantum-expired' && f.event.simTime === 2,
    );
    expect(at?.snapshot.ready).toEqual(['B', 'C', 'A']);
    expect(r.intervals.map((x) => x.id)).toEqual(['A', 'A', 'B', 'C', 'A']);
  });
  it('matches every reference interval and separate wait total', () => {
    const r = run(reference),
      e = fixture.cases[0]!.expected;
    expect(r.intervals).toEqual(e.dispatchIntervals);
    expect(
      r.metrics.map(
        ({
          id,
          completion,
          turnaround,
          cpuService,
          readyWait,
          resourceWait,
          memoryWait,
          response,
        }) => ({
          id,
          completion,
          turnaround,
          cpuService,
          readyWait,
          resourceWait,
          memoryWait,
          response,
        }),
      ),
    ).toEqual(e.metrics);
    expect(r.summary.busyTime).toBe(e.busyTime);
    expect(r.summary.simTime).toBe(e.finishTime);
    expect(r.summary.utilizationPercent).toBe(e.utilizationPercent);
    for (const block of e.resourceBlockedIntervals) {
      const start = r.frames.find(
        (f) =>
          f.event?.kind === 'resource-blocked' &&
          f.event.processId === block.id,
      );
      const end = r.frames.find(
        (f) =>
          f.event?.kind === 'resource-wake' && f.event.processId === block.id,
      );
      expect(start?.snapshot.simTime).toBe(block.start);
      expect(end?.snapshot.simTime).toBe(block.end);
    }
    for (const block of e.memoryWaitIntervals) {
      expect(
        r.events.find(
          (x) => x.kind === 'process-arrived' && x.processId === block.id,
        )?.simTime,
      ).toBe(block.start);
      expect(
        r.events.find(
          (x) => x.kind === 'memory-allocated' && x.processId === block.id,
        )?.simTime,
      ).toBe(block.end);
    }
    for (const owned of e.resourceOwnership) {
      expect(
        r.events.find(
          (x) => x.kind === 'resource-granted' && x.processId === owned.owner,
        )?.simTime ??
          r.events.find(
            (x) => x.kind === 'resource-released' && x.simTime === owned.start,
          )?.simTime,
      ).toBe(owned.start);
      expect(
        r.events.find(
          (x) => x.kind === 'resource-released' && x.processId === owned.owner,
        )?.simTime,
      ).toBe(owned.end);
    }
  });
  it('conserves memory, ownership, queues and per-state elapsed time in every frame', () => {
    for (const s of [
      reference,
      simple(),
      simple({
        processes: [
          {
            id: 'A',
            arrival: 5,
            memoryKiB: 10,
            program: [{ op: 'cpu', duration: 2 }],
          },
          {
            id: 'B',
            arrival: 8,
            memoryKiB: 10,
            program: [{ op: 'cpu', duration: 1 }],
          },
        ],
      }),
    ]) {
      const r = run(s);
      let previous = 0;
      for (const f of r.frames) {
        const x = f.snapshot;
        expect(x.simTime).toBeGreaterThanOrEqual(previous);
        previous = x.simTime;
        expect(x.segments[0]?.start).toBe(0);
        expect(x.segments.at(-1)?.end).toBe(s.totalKiB);
        for (let i = 1; i < x.segments.length; i++) {
          expect(x.segments[i]!.start).toBe(x.segments[i - 1]!.end);
          expect(
            x.segments[i]!.id === null && x.segments[i - 1]!.id === null,
          ).toBe(false);
        }
        expect(
          x.processes.filter((p) => p.state === 'running').length,
        ).toBeLessThanOrEqual(1);
        expect(
          new Set([...x.ready, ...x.memoryWait, ...x.pendingWake]).size,
        ).toBe(x.ready.length + x.memoryWait.length + x.pendingWake.length);
        for (const p of x.processes) {
          if (p.state === 'terminated') {
            expect(x.ready).not.toContain(p.id);
            expect(x.segments.some((b) => b.id === p.id)).toBe(false);
            expect(x.resources.some((b) => b.owner === p.id)).toBe(false);
            expect(p.turnaround).toBe(
              p.cpuService + p.readyWait + p.resourceWait + p.memoryWait,
            );
          }
          if (['ready', 'running', 'blocked'].includes(p.state))
            expect(x.segments.filter((b) => b.id === p.id)).toHaveLength(1);
        }
        for (const res of x.resources) {
          expect(new Set(res.queue).size).toBe(res.queue.length);
          for (const id of res.queue)
            expect(x.processes.find((p) => p.id === id)?.waitingFor).toBe(
              res.id,
            );
        }
      }
    }
  });
  it('arrivals inside quantum do not renew it, and idle includes initial time', () => {
    const r = run(
      simple({
        processes: [
          {
            id: 'A',
            arrival: 3,
            memoryKiB: 5,
            program: [{ op: 'cpu', duration: 3 }],
          },
          {
            id: 'B',
            arrival: 4,
            memoryKiB: 5,
            program: [{ op: 'cpu', duration: 1 }],
          },
        ],
      }),
    );
    expect(r.intervals).toEqual([
      { id: null, start: 0, end: 3 },
      { id: 'A', start: 3, end: 5 },
      { id: 'B', start: 5, end: 6 },
      { id: 'A', start: 6, end: 7 },
    ]);
    expect(r.summary.utilizationPercent).toBeCloseTo(400 / 7);
  });
  it('completes zero-time release and termination before arrival/quantum requeue', () => {
    const r = run(reference);
    const at4 = r.events.filter((e) => e.simTime === 4);
    expect(at4.findIndex((e) => e.kind === 'resource-released')).toBeLessThan(
      at4.findIndex((e) => e.kind === 'quantum-expired'),
    );
    expect(
      r.events.filter(
        (e) => e.kind === 'resource-wake' && e.processId === 'P2',
      ),
    ).toHaveLength(1);
    expect(r.metrics.find((p) => p.id === 'P2')?.pc).toBe(3);
  });
  it('FIFO memory admission prevents bypass even when a later small process fits', () => {
    const r = run(
      simple({
        quantum: 10,
        processes: [
          {
            id: 'A',
            arrival: 0,
            memoryKiB: 6,
            program: [{ op: 'cpu', duration: 4 }],
          },
          {
            id: 'B',
            arrival: 1,
            memoryKiB: 8,
            program: [{ op: 'cpu', duration: 1 }],
          },
          {
            id: 'C',
            arrival: 2,
            memoryKiB: 2,
            program: [{ op: 'cpu', duration: 1 }],
          },
        ],
      }),
    );
    expect(
      r.events.find((e) => e.kind === 'memory-allocated' && e.processId === 'C')
        ?.simTime,
    ).toBe(4);
    expect(r.metrics.find((p) => p.id === 'C')?.memoryWait).toBe(2);
    expect(r.summary.segments).toEqual([{ id: null, start: 0, end: 10 }]);
  });
  it('proves a genuine two-resource cycle and retains blocked memory', () => {
    const r = run(
      simple({
        quantum: 1,
        resources: [
          { id: 'R1', instances: 1 },
          { id: 'R2', instances: 1 },
        ],
        processes: [
          {
            id: 'A',
            arrival: 0,
            memoryKiB: 5,
            program: [
              { op: 'acquire', resourceId: 'R1' },
              { op: 'cpu', duration: 2 },
              { op: 'acquire', resourceId: 'R2' },
              { op: 'cpu', duration: 1 },
            ],
          },
          {
            id: 'B',
            arrival: 0,
            memoryKiB: 5,
            program: [
              { op: 'acquire', resourceId: 'R2' },
              { op: 'cpu', duration: 2 },
              { op: 'acquire', resourceId: 'R1' },
              { op: 'cpu', duration: 1 },
            ],
          },
        ],
      }),
    );
    expect(r.outcome).toBe('deadlocked');
    expect(r.summary.cycle.length).toBe(5);
    expect(r.metrics.every((p) => p.state === 'blocked')).toBe(true);
    expect(r.summary.segments.every((s) => s.id !== null)).toBe(true);
  });
  it('reports self-acquire deadlock and invalid owner release as distinct outcomes', () => {
    expect(
      run(
        simple({
          resources: [{ id: 'R', instances: 1 }],
          processes: [
            {
              id: 'A',
              arrival: 0,
              memoryKiB: 5,
              program: [
                { op: 'acquire', resourceId: 'R' },
                { op: 'acquire', resourceId: 'R' },
                { op: 'cpu', duration: 1 },
              ],
            },
          ],
        }),
      ).outcome,
    ).toBe('deadlocked');
    expect(
      run(
        simple({
          resources: [{ id: 'R', instances: 1 }],
          processes: [
            {
              id: 'A',
              arrival: 0,
              memoryKiB: 5,
              program: [
                { op: 'release', resourceId: 'R' },
                { op: 'cpu', duration: 1 },
              ],
            },
          ],
        }),
      ).outcome,
    ).toBe('model-error');
    const stopped = run(
      simple({
        resources: [{ id: 'R', instances: 1 }],
        processes: [
          {
            id: 'A',
            arrival: 0,
            memoryKiB: 5,
            program: [
              { op: 'cpu', duration: 1 },
              { op: 'release', resourceId: 'R' },
            ],
          },
        ],
      }),
    );
    expect(stopped.outcome).toBe('model-error');
    expect(stopped.intervals).toEqual([{ id: 'A', start: 0, end: 1 }]);
    expect(stopped.summary.busyTime).toBe(1);
  });
  it('rejects oversized memory, all-zero programs, unknown resources and invalid quantum', () => {
    for (const s of [
      simple({ totalKiB: 1 }),
      simple({ quantum: 0 }),
      simple({
        processes: [{ id: 'A', arrival: 0, memoryKiB: 1, program: [] }],
      }),
      simple({
        processes: [
          {
            id: 'A',
            arrival: 0,
            memoryKiB: 1,
            program: [
              { op: 'cpu', duration: 1 },
              { op: 'acquire', resourceId: 'missing' },
            ],
          },
        ],
      }),
    ])
      expect(runSystem(s).ok).toBe(false);
  });
  it('is immutable, deterministic and gives an error instead of truncated success', () => {
    const s = structuredClone(reference),
      r = run(s);
    expect(run(s)).toEqual(r);
    expect(s).toEqual(reference);
    expect(Object.isFrozen(r.frames[2]?.snapshot.processes[0])).toBe(true);
    expect(runSystem(reference, 3)).toMatchObject({
      ok: false,
      error: { code: 'limit-exceeded' },
    });
  });
  it('conserves CPU service and waiting across diverse quantum/arrival workloads', () => {
    for (let q = 1; q <= 5; q++)
      for (let a = 0; a <= 4; a++) {
        const s = simple({
            quantum: q,
            processes: [
              {
                id: 'P10',
                arrival: a,
                memoryKiB: 7,
                program: [
                  { op: 'cpu', duration: 4 },
                  { op: 'cpu', duration: 2 },
                ],
              },
              {
                id: 'P2',
                arrival: a,
                memoryKiB: 3,
                program: [{ op: 'cpu', duration: 3 }],
              },
              {
                id: 'P1',
                arrival: a + 1,
                memoryKiB: 2,
                program: [{ op: 'cpu', duration: 2 }],
              },
            ],
          }),
          r = run(s);
        expect(r.summary.busyTime).toBe(11);
        expect(
          r.intervals
            .filter((x) => x.id !== null)
            .reduce((n, x) => n + x.end - x.start, 0),
        ).toBe(11);
        for (const p of r.metrics)
          expect(p.turnaround).toBe(
            p.cpuService + p.readyWait + p.memoryWait + p.resourceWait,
          );
      }
  });
});
