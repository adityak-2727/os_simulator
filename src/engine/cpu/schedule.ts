import {
  TRACE_EVENT_BUDGET,
  type CpuEvent,
  type CpuEventPayload,
  type CpuScenario,
  type EngineResponse,
  type ReplayFrame,
} from '../contracts';
import type {
  CpuInterval,
  CpuProcessFrame,
  CpuResult,
  CpuSnapshot,
  CpuSummary,
} from './types';
import { validateCpuScenario } from './validation';

interface Entry {
  readonly order: number;
  frame: CpuProcessFrame;
}
export function scheduleCpu(
  input: CpuScenario,
  budget = TRACE_EVENT_BUDGET,
): EngineResponse<CpuResult> {
  const error = validateCpuScenario(input);
  if (error) return { ok: false, error };
  const limitError: EngineResponse<CpuResult> = {
    ok: false,
    error: {
      code: 'limit-exceeded',
      message: `This workload exceeds the ${budget.toLocaleString('en-US')} event budget. Increase the Round Robin quantum or reduce processes and bursts.`,
      issues: [
        {
          path: 'quantum',
          message: 'Use a larger quantum or a smaller workload.',
        },
      ],
    },
  };
  const slices = input.processes.reduce(
    (sum, p) =>
      sum + (input.algorithm === 'rr' ? Math.ceil(p.burst / input.quantum) : 1),
    0,
  );
  if (
    !Number.isInteger(budget) ||
    budget < input.processes.length + 2 * slices ||
    budget > TRACE_EVENT_BUDGET
  )
    return limitError;
  const scenario: CpuScenario = Object.freeze({
    ...input,
    processes: Object.freeze(
      input.processes.map((p) => Object.freeze({ ...p })),
    ),
  });
  const entries: Entry[] = scenario.processes.map((p, order) => ({
    order,
    frame: Object.freeze({
      ...p,
      state: 'new',
      remaining: p.burst,
      serviced: 0,
      firstStart: null,
      completion: null,
      turnaround: null,
      waiting: null,
      response: null,
    }),
  }));
  const arrivals = [...entries].sort(
    (a, b) => a.frame.arrival - b.frame.arrival || a.order - b.order,
  );
  const rank = (a: Entry, b: Entry) =>
    (scenario.algorithm === 'sjf'
      ? a.frame.burst - b.frame.burst
      : scenario.algorithm === 'priority'
        ? a.frame.priority - b.frame.priority
        : 0) ||
    a.frame.arrival - b.frame.arrival ||
    a.order - b.order;
  const ready: Entry[] = [];
  let arrivalCursor = 0;
  let time = 0;
  let busyTime = 0;
  let finished = 0;
  let running: Entry | null = null;
  let activeInterval: CpuSnapshot['activeInterval'] = null;
  const intervals: CpuInterval[] = [];
  const events: CpuEvent[] = [];
  const frames: ReplayFrame<CpuEvent, CpuSnapshot>[] = [];
  let completedWaiting = 0,
    completedTurnaround = 0,
    completedResponse = 0;
  function snapshot(): CpuSnapshot {
    const summary: CpuSummary = Object.freeze({
      completedCount: finished,
      busyTime,
      finishTime: time,
      utilizationPercent: time ? (busyTime / time) * 100 : null,
      throughput: time ? finished / time : null,
      averageWaiting: finished ? completedWaiting / finished : null,
      averageTurnaround: finished ? completedTurnaround / finished : null,
      averageResponse: finished ? completedResponse / finished : null,
    });
    return Object.freeze({
      simTime: time,
      processes: Object.freeze(entries.map((p) => p.frame)),
      ready: Object.freeze(ready.map((p) => p.frame.id)),
      running: running?.frame.id ?? null,
      activeInterval,
      intervalCount: intervals.length,
      summary,
    });
  }
  function emit(payload: CpuEventPayload): boolean {
    if (events.length >= budget) return false;
    const event: CpuEvent = Object.freeze({
      ...payload,
      seq: events.length,
      simTime: time,
      explanationKey: `cpu.${payload.kind}`,
    });
    events.push(event);
    frames.push(
      Object.freeze({ index: frames.length, event, snapshot: snapshot() }),
    );
    return true;
  }
  function advance(to: number) {
    const elapsed = to - time;
    if (running && elapsed) {
      running.frame = Object.freeze({
        ...running.frame,
        serviced: running.frame.serviced + elapsed,
        remaining: running.frame.remaining - elapsed,
      });
      busyTime += elapsed;
    }
    time = to;
  }
  function enqueueArrivals(): boolean {
    while (arrivals[arrivalCursor]?.frame.arrival === time) {
      const entry = arrivals[arrivalCursor];
      if (!entry) break;
      entry.frame = Object.freeze({ ...entry.frame, state: 'ready' });
      ready.push(entry);
      if (scenario.algorithm !== 'rr') ready.sort(rank);
      arrivalCursor++;
      if (!emit({ kind: 'process-arrived', processId: entry.frame.id }))
        return false;
    }
    return true;
  }
  function closeInterval() {
    if (activeInterval && time > activeInterval.start)
      intervals.push(Object.freeze({ ...activeInterval, end: time }));
    activeInterval = null;
  }
  frames.push(Object.freeze({ index: 0, event: null, snapshot: snapshot() }));
  while (finished < entries.length) {
    if (!enqueueArrivals()) return limitError;
    if (!ready.length) {
      const next = arrivals[arrivalCursor];
      if (!next)
        return {
          ok: false,
          error: {
            code: 'validation',
            message:
              'No ready process or future arrival exists for this unfinished workload.',
            issues: [],
          },
        };
      activeInterval = Object.freeze({ id: null, start: time });
      if (!emit({ kind: 'idle-started', until: next.frame.arrival }))
        return limitError;
      advance(next.frame.arrival);
      closeInterval();
      if (!emit({ kind: 'idle-ended' }) || !enqueueArrivals())
        return limitError;
    }
    const candidates = Object.freeze(ready.map((p) => p.frame.id));
    const selected = ready.shift();
    if (!selected)
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'No process is available for dispatch.',
          issues: [],
        },
      };
    running = selected;
    const firstStart = selected.frame.firstStart ?? time;
    selected.frame = Object.freeze({
      ...selected.frame,
      state: 'running',
      firstStart,
      response: firstStart - selected.frame.arrival,
    });
    activeInterval = Object.freeze({ id: selected.frame.id, start: time });
    if (
      !emit({
        kind: 'dispatch',
        processId: selected.frame.id,
        algorithm: scenario.algorithm,
        candidates,
      })
    )
      return limitError;
    const end =
      time +
      Math.min(
        selected.frame.remaining,
        scenario.algorithm === 'rr'
          ? scenario.quantum
          : selected.frame.remaining,
      );
    while ((arrivals[arrivalCursor]?.frame.arrival ?? Infinity) < end) {
      const next = arrivals[arrivalCursor];
      if (!next) break;
      advance(next.frame.arrival);
      if (!enqueueArrivals()) return limitError;
    }
    advance(end);
    if (selected.frame.remaining === 0) {
      const turnaround = time - selected.frame.arrival;
      const waiting = turnaround - selected.frame.burst;
      selected.frame = Object.freeze({
        ...selected.frame,
        state: 'terminated',
        completion: time,
        turnaround,
        waiting,
      });
      finished++;
      completedWaiting += waiting;
      completedTurnaround += turnaround;
      completedResponse += selected.frame.response ?? 0;
      running = null;
      closeInterval();
      if (!emit({ kind: 'process-completed', processId: selected.frame.id }))
        return limitError;
      if (!enqueueArrivals()) return limitError;
    } else {
      // Execution is accounted first; arrivals at the slice boundary precede requeue.
      if (!enqueueArrivals()) return limitError;
      const ahead = Object.freeze(ready.map((p) => p.frame.id));
      selected.frame = Object.freeze({ ...selected.frame, state: 'ready' });
      ready.push(selected);
      running = null;
      closeInterval();
      if (
        !emit({
          kind: 'quantum-expired',
          processId: selected.frame.id,
          remaining: selected.frame.remaining,
          ahead,
        })
      )
        return limitError;
    }
  }
  const finalSnapshot = snapshot();
  return {
    ok: true,
    result: Object.freeze({
      engineVersion: '0.2.0',
      scenario,
      events: Object.freeze(events),
      frames: Object.freeze(frames),
      intervals: Object.freeze(intervals),
      metrics: finalSnapshot.processes,
      summary: finalSnapshot.summary,
      outcome: 'completed',
    }),
  };
}

/** Current trace prefix; no future intervals are exposed during replay. */
export function intervalsAtFrame(
  result: CpuResult,
  frame: CpuSnapshot,
): readonly CpuInterval[] {
  const completed = result.intervals.slice(0, frame.intervalCount);
  return frame.activeInterval && frame.simTime > frame.activeInterval.start
    ? [...completed, { ...frame.activeInterval, end: frame.simTime }]
    : completed;
}
