import {
  TRACE_EVENT_BUDGET,
  type EngineResponse,
  type ReplayFrame,
} from '../contracts';
import type {
  BufferItem,
  Reservation,
  SyncEvent,
  SyncProcess,
  SyncResult,
  SyncScenario,
  SyncSnapshot,
} from './types';
import { validateSync } from './validation';
interface Process {
  id: string;
  pc: number;
  locals: Record<string, number | string>;
  waiting: SyncProcess['waiting'];
  reservations: Reservation[];
}
const freezeArray = <T>(items: readonly T[]) => Object.freeze([...items]);
function freezeScenario(input: SyncScenario): SyncScenario {
  return Object.freeze({
    ...input,
    mutexIds: freezeArray(input.mutexIds),
    semaphores: freezeArray(
      input.semaphores.map((s) => Object.freeze({ ...s })),
    ),
    processes: freezeArray(
      input.processes.map((p) =>
        Object.freeze({
          id: p.id,
          instructions: freezeArray(
            p.instructions.map((i) => Object.freeze({ ...i })),
          ),
        }),
      ),
    ),
    schedule: freezeArray(input.schedule),
  });
}
export function runSync(
  input: SyncScenario,
  budget = TRACE_EVENT_BUDGET,
): EngineResponse<SyncResult> {
  const error = validateSync(input);
  if (error) return { ok: false, error };
  if (
    !Number.isInteger(budget) ||
    budget < input.schedule.length ||
    budget > TRACE_EVENT_BUDGET
  )
    return {
      ok: false,
      error: {
        code: 'limit-exceeded',
        message:
          'The schedule exceeds the trace budget. Reduce choices or use the standard budget.',
        issues: [],
      },
    };
  const scenario = freezeScenario(input),
    processes: Process[] = scenario.processes.map((p) => ({
      id: p.id,
      pc: 0,
      locals: Object.create(null) as Record<string, number | string>,
      waiting: null,
      reservations: [],
    }));
  const mutexes = scenario.mutexIds.map((id) => ({
      id,
      owner: null as string | null,
      queue: [] as string[],
    })),
    semaphores = scenario.semaphores.map((s) => ({
      id: s.id,
      count: s.initial,
      queue: [] as string[],
    }));
  let counter = scenario.initialCounter,
    maxBufferOccupancy = 0,
    modelError: SyncSnapshot['error'] = null;
  const buffer: BufferItem[] = [],
    produced: BufferItem[] = [],
    consumed: BufferItem[] = [],
    events: SyncEvent[] = [],
    frames: ReplayFrame<SyncEvent, SyncSnapshot>[] = [];
  let counterVersion = 0;
  const reads = new Map<
    string,
    Map<string, { value: number; version: number }>
  >();
  const processState = (p: Process): SyncProcess['state'] =>
    p.waiting
      ? 'blocked'
      : p.pc >=
          (scenario.processes.find((s) => s.id === p.id)?.instructions.length ??
            0)
        ? 'completed'
        : 'runnable';
  function snapshot(): SyncSnapshot {
    const status = modelError
      ? 'model-error'
      : processes.every((p) => processState(p) === 'completed')
        ? 'completed'
        : processes.some((p) => processState(p) === 'runnable')
          ? 'awaiting-choice'
          : 'stalled';
    return Object.freeze({
      step: events.length,
      counter,
      maxBufferOccupancy,
      status,
      error: modelError,
      processes: freezeArray(
        processes.map((p) =>
          Object.freeze({
            ...p,
            state: processState(p),
            locals: Object.freeze({ ...p.locals }),
            reservations: freezeArray(
              p.reservations.map((r) => Object.freeze({ ...r })),
            ),
          }),
        ),
      ),
      mutexes: freezeArray(
        mutexes.map((m) =>
          Object.freeze({ ...m, queue: freezeArray(m.queue) }),
        ),
      ),
      semaphores: freezeArray(
        semaphores.map((s) =>
          Object.freeze({ ...s, queue: freezeArray(s.queue) }),
        ),
      ),
      buffer: freezeArray(buffer),
      produced: freezeArray(produced),
      consumed: freezeArray(consumed),
    });
  }
  frames.push(Object.freeze({ index: 0, event: null, snapshot: snapshot() }));
  function reserve(p: Process, semaphore: string) {
    if (semaphore === 'empty' || semaphore === 'full')
      p.reservations.push({ semaphore, phase: 'before-buffer' });
  }
  function markBufferChange(p: Process, semaphore: 'empty' | 'full') {
    const i = p.reservations.findIndex(
      (r) => r.semaphore === semaphore && r.phase === 'before-buffer',
    );
    if (i >= 0) p.reservations[i] = { semaphore, phase: 'after-buffer' };
  }
  function closeReservation(p: Process, signal: string) {
    const kind =
      signal === 'full' ? 'empty' : signal === 'empty' ? 'full' : null;
    const i = p.reservations.findIndex(
      (r) => r.semaphore === kind && r.phase === 'after-buffer',
    );
    if (i >= 0) p.reservations.splice(i, 1);
  }
  function wake(id: string): Process | undefined {
    const waiter = processes.find((p) => p.id === id);
    if (waiter) {
      waiter.waiting = null;
      waiter.pc++;
    }
    return waiter;
  }
  for (const selected of scenario.schedule) {
    const p = processes.find((p) => p.id === selected)!;
    const instruction =
        scenario.processes.find((s) => s.id === selected)?.instructions[p.pc] ??
        null,
      pcBefore = p.pc,
      counterBefore = counter,
      woken: string[] = [];
    let kind: SyncEvent['kind'] = 'instruction',
      reason = '',
      failure = '';
    let readCounter: number | null = null,
      interveningWrite = false;
    const currentState = processState(p);
    if (currentState !== 'runnable') {
      kind = 'selection-rejected';
      reason = `Rejected choice ${selected}: process is ${currentState}. No instruction executes; PC ${p.pc} and shared state stay unchanged.`;
    } else if (instruction) {
      switch (instruction.op) {
        case 'read-counter':
          p.locals[instruction.register] = counter;
          {
            const registers =
              reads.get(selected) ??
              new Map<string, { value: number; version: number }>();
            registers.set(instruction.register, {
              value: counter,
              version: counterVersion,
            });
            reads.set(selected, registers);
          }
          p.pc++;
          reason = `${selected} reads shared x=${counter} into local ${instruction.register}. Reading does not change x.`;
          break;
        case 'add-local': {
          const before = p.locals[instruction.register];
          if (typeof before !== 'number')
            failure = `Local ${instruction.register} must contain a number before add-local.`;
          else if (!Number.isSafeInteger(before + instruction.value))
            failure = 'Local arithmetic exceeds the safe integer range.';
          else {
            p.locals[instruction.register] = before + instruction.value;
            p.pc++;
            reason = `${selected} adds ${instruction.value} to local ${instruction.register}: ${before} → ${before + instruction.value}. Shared x remains ${counter}.`;
          }
          break;
        }
        case 'write-counter': {
          const value = p.locals[instruction.register];
          if (typeof value !== 'number')
            failure = `Local ${instruction.register} must contain a number before write-counter.`;
          else {
            const sourceRead = reads.get(selected)?.get(instruction.register);
            readCounter = sourceRead?.value ?? null;
            interveningWrite =
              sourceRead !== undefined && sourceRead.version !== counterVersion;
            counter = value;
            counterVersion++;
            p.pc++;
            reason = `${selected} writes local ${instruction.register}=${value} into shared x: ${counterBefore} → ${counter}. ${sourceRead ? (interveningWrite ? `Its local value comes from reading x=${sourceRead.value} before another shared write. This stale read overwrites the current x=${counterBefore} with ${value}.` : `Its source read observed x=${sourceRead.value}; no other shared write intervened.`) : 'No counter-read provenance is recorded for this register.'}`;
          }
          break;
        }
        case 'lock': {
          const mutex = mutexes.find((m) => m.id === instruction.mutex)!;
          if (mutex.owner === selected)
            failure = `Recursive lock of ${mutex.id} by ${selected} is unsupported.`;
          else if (mutex.owner === null) {
            mutex.owner = selected;
            p.pc++;
            reason = `${selected} acquires free mutex ${mutex.id}; ownership is now ${selected}.`;
          } else {
            mutex.queue.push(selected);
            p.waiting = Object.freeze({ kind: 'mutex', id: mutex.id });
            kind = 'process-blocked';
            reason = `${selected} blocks on ${mutex.id}, owned by ${mutex.owner}. Join FIFO queue [${mutex.queue.join(', ')}]; pending lock stays at PC ${p.pc} until handed ownership.`;
          }
          break;
        }
        case 'unlock': {
          const mutex = mutexes.find((m) => m.id === instruction.mutex)!;
          if (mutex.owner !== selected)
            failure = `Only owner ${mutex.owner ?? '(none)'} may unlock ${mutex.id}; ${selected} is not its owner.`;
          else {
            const next = mutex.queue.shift();
            mutex.owner = next ?? null;
            p.pc++;
            if (next) {
              wake(next);
              woken.push(next);
              kind = 'handoff';
              reason = `${selected} unlocks ${mutex.id} and hands ownership directly to FIFO waiter ${next}. Its pending lock completes once and PC advances. The mutex never becomes free for another process to steal.`;
            } else
              reason = `${selected} unlocks ${mutex.id}; no waiters remain and the mutex becomes free.`;
          }
          break;
        }
        case 'wait': {
          const semaphore = semaphores.find(
            (s) => s.id === instruction.semaphore,
          )!;
          if (semaphore.count > 0) {
            const before = semaphore.count;
            semaphore.count--;
            p.pc++;
            reserve(p, semaphore.id);
            reason = `${selected} waits on ${semaphore.id}: permit count ${before} → ${semaphore.count}. The wait completes; ${semaphore.id === 'empty' || semaphore.id === 'full' ? 'an in-flight buffer permit is reserved.' : 'no ownership is implied.'}`;
          } else {
            semaphore.queue.push(selected);
            p.waiting = Object.freeze({ kind: 'semaphore', id: semaphore.id });
            kind = 'process-blocked';
            reason = `${selected} blocks because ${semaphore.id}=0. Join FIFO queue [${semaphore.queue.join(', ')}]; wait remains at PC ${p.pc} until a signal hands it a permit.`;
          }
          break;
        }
        case 'signal': {
          const semaphore = semaphores.find(
              (s) => s.id === instruction.semaphore,
            )!,
            next = semaphore.queue.shift();
          p.pc++;
          closeReservation(p, semaphore.id);
          if (next) {
            const waiter = wake(next);
            if (waiter) reserve(waiter, semaphore.id);
            woken.push(next);
            kind = 'handoff';
            reason = `${selected} signals ${semaphore.id}: hand one permit directly to FIFO waiter ${next}. Its pending wait completes exactly once; count remains ${semaphore.count}, with no increment followed by a second wait.`;
          } else {
            const before = semaphore.count;
            semaphore.count++;
            reason = `${selected} signals ${semaphore.id}: no waiters, so permit count ${before} → ${semaphore.count}. A semaphore does not require signal ownership.`;
          }
          break;
        }
        case 'enqueue':
          if (mutexes.find((m) => m.id === 'm')?.owner !== selected)
            failure = 'Enqueue requires ownership of buffer mutex m.';
          else if (buffer.length >= scenario.capacity)
            failure = `Cannot enqueue ${instruction.value}: buffer is full (${buffer.length}/${scenario.capacity}). No item is dropped.`;
          else {
            const item = Object.freeze({
              sequence: produced.length,
              value: instruction.value,
              producer: selected,
            });
            buffer.push(item);
            produced.push(item);
            maxBufferOccupancy = Math.max(maxBufferOccupancy, buffer.length);
            markBufferChange(p, 'empty');
            p.pc++;
            reason = `${selected} enqueues ${instruction.value} at the FIFO tail while owning m. Occupancy ${buffer.length - 1} → ${buffer.length}/${scenario.capacity}. ${p.reservations.some((r) => r.semaphore === 'empty' && r.phase === 'after-buffer') ? 'Its empty permit stays in flight until signal(full).' : 'No empty-permit reservation is recorded in this custom program.'}`;
          }
          break;
        case 'dequeue':
          if (mutexes.find((m) => m.id === 'm')?.owner !== selected)
            failure = 'Dequeue requires ownership of buffer mutex m.';
          else if (!buffer.length)
            failure =
              'Cannot dequeue: buffer is empty. No fabricated value is returned.';
          else {
            const item = buffer.shift()!;
            consumed.push(item);
            p.locals[instruction.register] = item.value;
            markBufferChange(p, 'full');
            p.pc++;
            reason = `${selected} dequeues FIFO head ${item.value} into local ${instruction.register} while owning m. Occupancy ${buffer.length + 1} → ${buffer.length}/${scenario.capacity}. ${p.reservations.some((r) => r.semaphore === 'full' && r.phase === 'after-buffer') ? 'Its full permit stays in flight until signal(empty).' : 'No full-permit reservation is recorded in this custom program.'}`;
          }
          break;
      }
    }
    if (failure) {
      kind = 'model-error';
      modelError = Object.freeze({ processId: selected, message: failure });
      reason = `Model error at ${selected} PC ${pcBefore}: ${failure} Instruction and shared state are unchanged; repair the source program before continuing.`;
    }
    const event: SyncEvent = Object.freeze({
      seq: events.length,
      kind,
      explanationKey: `sync.${kind}`,
      processId: selected,
      instruction,
      pcBefore,
      pcAfter: p.pc,
      woken: freezeArray(woken),
      counterBefore,
      counterAfter: counter,
      readCounter,
      interveningWrite,
      reason,
    });
    events.push(event);
    frames.push(
      Object.freeze({ index: events.length, event, snapshot: snapshot() }),
    );
    if (modelError) break;
  }
  const summary = snapshot();
  return {
    ok: true,
    result: Object.freeze({
      engineVersion: '0.5.0',
      scenario,
      events: freezeArray(events),
      frames: freezeArray(frames),
      summary,
      outcome: summary.status,
    }),
  };
}
export function chooseProcess(
  result: SyncResult,
  cursor: number,
  processId: string,
): EngineResponse<SyncResult> {
  const frame = result.frames[cursor],
    process = frame?.snapshot.processes.find((p) => p.id === processId);
  const fail = (message: string): EngineResponse<SyncResult> => ({
    ok: false,
    error: {
      code: 'validation',
      message,
      issues: [{ path: 'choice', message }],
    },
  });
  if (!Number.isInteger(cursor) || !frame)
    return fail('Choose an existing replay frame.');
  if (frame.snapshot.status === 'model-error')
    return fail('Repair the model error before making another choice.');
  if (!process || process.state !== 'runnable')
    return fail(
      `${processId} is ${process?.state ?? 'unknown'}; no instruction or choice was consumed.`,
    );
  return runSync({
    ...result.scenario,
    schedule: [...result.scenario.schedule.slice(0, cursor), processId],
  });
}
