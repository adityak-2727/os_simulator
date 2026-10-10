import { describe, expect, it } from 'vitest';
import fixtures from '../../fixtures/synchronization.json';
import {
  runSync,
  chooseProcess,
} from '../../src/engine/synchronization/interpreter';
import { validateSync } from '../../src/engine/synchronization/validation';
import { syncExample } from '../../src/features/synchronization/presets';
import type {
  SyncInstruction,
  SyncScenario,
} from '../../src/engine/synchronization/types';
import type { EngineResponse } from '../../src/engine/contracts';
function value<T>(r: EngineResponse<T>): T {
  if (!r.ok) throw new Error(r.error.message);
  return r.result;
}
// JSON discriminants are narrowed after independently recognizing every instruction.
function fixtureInstruction(input: {
  op: string;
  register?: string;
  value?: number | string;
  mutex?: string;
  semaphore?: string;
}): SyncInstruction {
  switch (input.op) {
    case 'read-counter':
    case 'write-counter':
    case 'dequeue':
      if (input.register) return { op: input.op, register: input.register };
      break;
    case 'add-local':
      if (input.register && typeof input.value === 'number')
        return { op: input.op, register: input.register, value: input.value };
      break;
    case 'lock':
    case 'unlock':
      if (input.mutex) return { op: input.op, mutex: input.mutex };
      break;
    case 'wait':
    case 'signal':
      if (input.semaphore) return { op: input.op, semaphore: input.semaphore };
      break;
    case 'enqueue':
      if (typeof input.value === 'string')
        return { op: input.op, value: input.value };
  }
  throw new Error('Unrecognized fixture instruction');
}
describe('synchronization fixtures', () => {
  for (const fixture of fixtures.cases)
    it(fixture.name, () => {
      const preset = fixture.input.preset;
      if (
        preset !== 'counter-race' &&
        preset !== 'counter-mutex' &&
        preset !== 'producer-consumer'
      )
        throw new Error('Bad preset');
      const source: SyncScenario = {
        ...fixture.input,
        kind: 'synchronization',
        preset,
        processes: fixture.input.processes.map((p) => ({
          ...p,
          instructions: p.instructions.map(fixtureInstruction),
        })),
      };
      const result = value(runSync(source));
      expect(result.summary.status).toBe('completed');
      if (fixture.expected.counter !== undefined)
        expect(result.summary.counter).toBe(fixture.expected.counter);
      fixture.expected.trace?.forEach((expected, i) => {
        const frame = result.frames[i + 1];
        expect(frame?.event?.processId).toBe(expected.selected);
        expect(frame?.event?.instruction?.op).toBe(expected.instruction);
        expect(frame?.snapshot.counter).toBe(expected.counter);
        expect(
          Object.fromEntries(
            frame?.snapshot.processes.map((p) => [p.id, p.pc]) ?? [],
          ),
        ).toEqual(expected.programCounters);
        expect(
          Object.fromEntries(
            frame?.snapshot.processes
              .filter((p) => 'r' in p.locals)
              .map((p) => [p.id, p.locals.r]) ?? [],
          ),
        ).toEqual(expected.localR);
        expect(frame?.snapshot.mutexes[0]?.owner ?? null).toBe(
          expected.mutexOwner,
        );
        expect(frame?.snapshot.mutexes[0]?.queue ?? []).toEqual(
          expected.waitQueue,
        );
      });
      if (fixture.expected.consumed)
        expect(result.summary.consumed.map((x) => x.value)).toEqual(
          fixture.expected.consumed,
        );
      if (fixture.expected.finalBuffer)
        expect(result.summary.buffer.map((x) => x.value)).toEqual(
          fixture.expected.finalBuffer,
        );
      if (fixture.expected.maxBufferOccupancy !== undefined)
        expect(result.summary.maxBufferOccupancy).toBe(
          fixture.expected.maxBufferOccupancy,
        );
      if (fixture.expected.finalSemaphores)
        expect(
          Object.fromEntries(
            result.summary.semaphores.map((s) => [s.id, s.count]),
          ),
        ).toEqual(fixture.expected.finalSemaphores);
      if ('finalMutexOwner' in fixture.expected)
        expect(result.summary.mutexes[0]?.owner).toBe(
          fixture.expected.finalMutexOwner,
        );
    });
});
const custom = (
  programs: readonly (readonly SyncInstruction[])[],
  schedule: readonly string[],
  options: Partial<SyncScenario> = {},
): SyncScenario => ({
  ...syncExample('counter-mutex'),
  processes: programs.map((instructions, i) => ({
    id: `P${i + 1}`,
    instructions,
  })),
  schedule,
  ...options,
});
describe('mutex and semaphore invariants', () => {
  it('FIFO mutex handoff advances a blocked lock once and excludes a new arrival', () => {
    const program: SyncInstruction[] = [
      { op: 'lock', mutex: 'm' },
      { op: 'unlock', mutex: 'm' },
    ];
    const r = value(
      runSync(
        custom(
          [program, program, program, program],
          ['P1', 'P2', 'P3', 'P1', 'P4', 'P2', 'P3', 'P4'],
        ),
      ),
    );
    expect(r.frames[3]?.snapshot.mutexes[0]?.queue).toEqual(['P2', 'P3']);
    expect(r.frames[4]?.snapshot.mutexes[0]?.owner).toBe('P2');
    expect(r.frames[5]?.snapshot.processes[3]?.pc).toBe(0);
    expect(r.frames[5]?.snapshot.mutexes[0]?.queue).toEqual(['P3', 'P4']);
    expect(r.summary.status).toBe('completed');
    expect(r.summary.processes.map((p) => p.pc)).toEqual([2, 2, 2, 2]);
  });
  it('rejects blocked and completed selections without executing or adding duplicate waits', () => {
    const r = value(
      runSync({
        ...syncExample('counter-mutex'),
        schedule: ['P1', 'P2', 'P2', 'P1', 'P1', 'P1', 'P1', 'P1'],
      }),
    );
    expect(r.events[2]?.kind).toBe('selection-rejected');
    expect(r.frames[3]?.snapshot.mutexes[0]?.queue).toEqual(['P2']);
    expect(r.frames[3]?.snapshot.processes[1]?.pc).toBe(0);
    expect(r.events.at(-1)?.kind).toBe('selection-rejected');
    expect(chooseProcess(r, 2, 'P2').ok).toBe(false);
    expect(chooseProcess(r, 7, 'P1').ok).toBe(false);
  });
  it('owner-only unlock and recursive lock are atomic model errors', () => {
    for (const scenario of [
      custom(
        [[{ op: 'lock', mutex: 'm' }], [{ op: 'unlock', mutex: 'm' }]],
        ['P1', 'P2'],
      ),
      custom(
        [
          [
            { op: 'lock', mutex: 'm' },
            { op: 'lock', mutex: 'm' },
          ],
          [{ op: 'read-counter', register: 'r' }],
        ],
        ['P1', 'P1'],
      ),
    ]) {
      const r = value(runSync(scenario));
      expect(r.summary.status).toBe('model-error');
      expect(r.summary.mutexes[0]?.owner).toBe('P1');
      expect(r.frames.at(-1)?.event?.pcAfter).toBe(
        r.frames.at(-1)?.event?.pcBefore,
      );
    }
  });
  it('zero-count semaphore hands permits to FIFO waiters without increment or second wait', () => {
    const r = value(
      runSync(
        custom(
          [
            [
              { op: 'wait', semaphore: 's' },
              { op: 'read-counter', register: 'r' },
            ],
            [
              { op: 'wait', semaphore: 's' },
              { op: 'read-counter', register: 'r' },
            ],
            [
              { op: 'signal', semaphore: 's' },
              { op: 'signal', semaphore: 's' },
            ],
          ],
          ['P1', 'P2', 'P3', 'P3', 'P1', 'P2'],
          { semaphores: [{ id: 's', initial: 0 }] },
        ),
      ),
    );
    expect(r.frames[2]?.snapshot.semaphores[0]?.queue).toEqual(['P1', 'P2']);
    expect(r.frames[3]?.snapshot.processes[0]?.pc).toBe(1);
    expect(r.frames[3]?.snapshot.processes[1]?.pc).toBe(0);
    expect(r.frames[4]?.snapshot.semaphores[0]?.count).toBe(0);
    expect(r.summary.status).toBe('completed');
  });
  it('semaphore signaling has no owner requirement and permits remain nonnegative', () => {
    const r = value(
      runSync(
        custom(
          [
            [{ op: 'signal', semaphore: 's' }],
            [{ op: 'wait', semaphore: 's' }],
          ],
          ['P1', 'P2'],
          { semaphores: [{ id: 's', initial: 0 }] },
        ),
      ),
    );
    expect(r.summary.semaphores[0]?.count).toBe(0);
    expect(r.summary.status).toBe('completed');
  });
});
describe('buffer and lifecycle', () => {
  it('explains the actual stale read rather than labeling protected writes as races', () => {
    const race = value(runSync(syncExample('counter-race'))),
      protectedRun = value(runSync(syncExample('counter-mutex')));
    expect(race.events.at(-1)?.readCounter).toBe(0);
    expect(race.events.at(-1)?.interveningWrite).toBe(true);
    expect(race.events.at(-1)?.reason).toContain('current x=1 with 1');
    expect(
      protectedRun.events
        .filter((e) => e.instruction?.op === 'write-counter')
        .every((e) => !e.interveningWrite),
    ).toBe(true);
  });
  it('exhaustively checks runnable choices: every protected interleaving reaches 2, race can reach 1 or 2', () => {
    function explore(preset: SyncScenario['preset']) {
      const finals = new Set<number>();
      function visit(r: ReturnType<typeof runSync>) {
        if (!r.ok) throw new Error(r.error.message);
        const s = r.result.summary;
        if (s.status === 'completed') {
          finals.add(s.counter);
          return;
        }
        expect(r.result.events.length).toBeLessThanOrEqual(12);
        for (const p of s.processes.filter((p) => p.state === 'runnable'))
          visit(chooseProcess(r.result, r.result.events.length, p.id));
      }
      visit(runSync({ ...syncExample(preset), schedule: [] }));
      return [...finals].sort();
    }
    expect(explore('counter-mutex')).toEqual([2]);
    expect(explore('counter-race')).toEqual([1, 2]);
  });
  it('consumer-first reservations and handoff preserve A then B and FIFO conservation at every frame', () => {
    const source = syncExample('producer-consumer'),
      schedule = [
        'Consumer',
        ...Array.from({ length: 5 }, () => 'Producer'),
        ...Array.from({ length: 4 }, () => 'Consumer'),
        ...Array.from({ length: 5 }, () => 'Producer'),
        ...Array.from({ length: 5 }, () => 'Consumer'),
      ];
    const r = value(runSync({ ...source, schedule }));
    expect(r.summary.status).toBe('completed');
    expect(r.summary.consumed.map((x) => x.value)).toEqual(['A', 'B']);
    expect(r.frames[2]?.snapshot.processes[0]?.reservations).toEqual([
      { semaphore: 'empty', phase: 'before-buffer' },
    ]);
    expect(r.frames[4]?.snapshot.processes[0]?.reservations).toEqual([
      { semaphore: 'empty', phase: 'after-buffer' },
    ]);
    expect(r.frames[6]?.snapshot.processes[1]?.reservations).toEqual([
      { semaphore: 'full', phase: 'before-buffer' },
    ]);
    for (const frame of r.frames) {
      const s = frame.snapshot;
      expect(s.buffer.length).toBeLessThanOrEqual(source.capacity);
      expect(s.produced.map((x) => x.sequence)).toEqual(
        [...s.consumed, ...s.buffer].map((x) => x.sequence),
      );
      expect(s.semaphores.every((x) => x.count >= 0)).toBe(true);
      if (
        frame.event?.instruction?.op === 'enqueue' ||
        frame.event?.instruction?.op === 'dequeue'
      )
        expect(s.mutexes[0]?.owner).toBe(frame.event.processId);
    }
    expect(r.summary.processes.every((p) => p.reservations.length === 0)).toBe(
      true,
    );
  });
  it('blocked producer receives empty permit exactly once from consumer', () => {
    const source = syncExample('producer-consumer');
    const schedule = [
      ...Array.from({ length: 5 }, () => 'Producer'),
      'Producer',
      ...Array.from({ length: 5 }, () => 'Consumer'),
      ...Array.from({ length: 4 }, () => 'Producer'),
      ...Array.from({ length: 5 }, () => 'Consumer'),
    ];
    const r = value(
      runSync({
        ...source,
        capacity: 1,
        semaphores: [
          { id: 'empty', initial: 1 },
          { id: 'full', initial: 0 },
        ],
        schedule,
      }),
    );
    expect(r.frames[6]?.snapshot.processes[0]?.pc).toBe(5);
    expect(r.frames[11]?.snapshot.processes[0]?.pc).toBe(6);
    expect(r.summary.status).toBe('completed');
    expect(r.summary.consumed.map((x) => x.value)).toEqual(['A', 'B']);
  });
  it('reports full, empty and unowned buffer operations without losing or fabricating data', () => {
    const full = value(
      runSync(
        custom(
          [
            [
              { op: 'lock', mutex: 'm' },
              { op: 'enqueue', value: 'A' },
              { op: 'enqueue', value: 'B' },
            ],
            [{ op: 'read-counter', register: 'r' }],
          ],
          ['P1', 'P1', 'P1'],
          { capacity: 1 },
        ),
      ),
    );
    expect(full.summary.status).toBe('model-error');
    expect(full.summary.buffer.map((x) => x.value)).toEqual(['A']);
    const empty = value(
      runSync(
        custom(
          [
            [
              { op: 'lock', mutex: 'm' },
              { op: 'dequeue', register: 'item' },
            ],
            [{ op: 'read-counter', register: 'r' }],
          ],
          ['P1', 'P1'],
        ),
      ),
    );
    expect(empty.summary.status).toBe('model-error');
    expect(empty.summary.consumed).toHaveLength(0);
    const unowned = value(
      runSync(
        custom(
          [
            [{ op: 'enqueue', value: 'A' }],
            [{ op: 'read-counter', register: 'r' }],
          ],
          ['P1'],
        ),
      ),
    );
    expect(unowned.summary.status).toBe('model-error');
    expect(unowned.summary.produced).toHaveLength(0);
  });
  it('schedule exhaustion awaits a choice; no runnable unfinished process is stalled', () => {
    expect(
      value(runSync({ ...syncExample('counter-race'), schedule: [] })).outcome,
    ).toBe('awaiting-choice');
    const stalled = value(
      runSync(
        custom(
          [[{ op: 'wait', semaphore: 's' }], [{ op: 'wait', semaphore: 's' }]],
          ['P1', 'P2'],
          { semaphores: [{ id: 's', initial: 0 }] },
        ),
      ),
    );
    expect(stalled.outcome).toBe('stalled');
    expect(stalled.summary.processes.every((p) => p.pc === 0)).toBe(true);
  });
  it('manual choices reconstruct a branch and preserve immutable prior frames and original inputs', () => {
    const original = syncExample('counter-race'),
      source = JSON.stringify(original),
      r = value(runSync(original)),
      branch = value(chooseProcess(r, 1, 'P1'));
    expect(branch.scenario.schedule).toEqual(['P1', 'P1']);
    expect(branch.summary.processes[0]?.pc).toBe(2);
    expect(r.summary.counter).toBe(1);
    expect(r.scenario.schedule).toHaveLength(6);
    expect(JSON.stringify(original)).toBe(source);
    expect(runSync(original)).toEqual({ ok: true, result: r });
    expect(Object.isFrozen(r.frames[1]?.snapshot.processes[0]?.locals)).toBe(
      true,
    );
    expect(Object.isFrozen(r.events[0]?.instruction)).toBe(true);
  });
  it('uninitialized/string locals and unsafe arithmetic are explicit model errors', () => {
    const r = value(
      runSync(
        custom(
          [
            [{ op: 'write-counter', register: 'r' }],
            [{ op: 'read-counter', register: 'r' }],
          ],
          ['P1'],
        ),
      ),
    );
    expect(r.summary.status).toBe('model-error');
    expect(r.summary.counter).toBe(0);
    const overflow = value(
      runSync(
        custom(
          [
            [
              { op: 'read-counter', register: 'r' },
              { op: 'add-local', register: 'r', value: 1 },
            ],
            [{ op: 'read-counter', register: 'r' }],
          ],
          ['P1', 'P1'],
          { initialCounter: Number.MAX_SAFE_INTEGER },
        ),
      ),
    );
    expect(overflow.summary.status).toBe('model-error');
    expect(overflow.summary.processes[0]?.locals.r).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
  it('validates bounded dimensions and references before running', () => {
    const base = syncExample('counter-race');
    for (const patch of [
      { processes: [] },
      { capacity: 0 },
      { capacity: 11 },
      { initialCounter: NaN },
      { schedule: ['Unknown'] },
      { processes: [...base.processes, ...base.processes] },
      { semaphores: [{ id: 's', initial: -1 }] },
      { mutexIds: ['m', 'm'] },
      { schedule: Array.from({ length: 1001 }, () => 'P1') },
    ])
      expect(validateSync({ ...base, ...patch })).not.toBeNull();
    expect(runSync(base, 1).ok).toBe(false);
  });
});
