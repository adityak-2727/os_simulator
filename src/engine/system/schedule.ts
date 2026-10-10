import {
  TRACE_EVENT_BUDGET,
  type EngineResponse,
  type ReplayFrame,
} from '../contracts';
import type { CpuInterval } from '../cpu/types';
import type { Segment } from '../memory/types';
import { validateSystem } from './validation';
import type {
  SystemScenario,
  SystemResult,
  SystemProcess,
  SystemSnapshot,
  SystemEvent,
  SystemEventKind,
} from './types';
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export function runSystem(
  input: SystemScenario,
  budget = TRACE_EVENT_BUDGET,
): EngineResponse<SystemResult> {
  const error = validateSystem(input);
  if (error) return { ok: false, error };
  const minimumServiceEvents = input.processes.reduce(
    (n, p) =>
      n +
      Math.ceil(
        p.program.reduce((t, x) => t + (x.op === 'cpu' ? x.duration : 0), 0) /
          input.quantum,
      ),
    0,
  );
  if (minimumServiceEvents > budget)
    return {
      ok: false,
      error: {
        code: 'limit-exceeded',
        message: `At least ${minimumServiceEvents} CPU service events are needed, exceeding the ${budget} event limit. Increase quantum or reduce CPU work.`,
        issues: [],
      },
    };
  const scenario = freeze(structuredClone(input));
  const processes: Mutable<SystemProcess>[] = scenario.processes.map((p) => ({
    id: p.id,
    state: 'new',
    pc: 0,
    remaining: 0,
    cpuService: 0,
    readyWait: 0,
    resourceWait: 0,
    memoryWait: 0,
    completion: null,
    turnaround: null,
    response: null,
    waitingFor: null,
  }));
  const resources = scenario.resources.map((r) => ({
    id: r.id,
    owner: null as string | null,
    queue: [] as string[],
  }));
  let segments: Segment[] = [{ start: 0, end: scenario.totalKiB, id: null }];
  const ready: string[] = [],
    memoryWait: string[] = [],
    pendingWake: string[] = [];
  let time = 0,
    running: string | null = null,
    quantum = 0,
    busy = 0,
    active: { id: string; start: number } | null = null;
  let status: SystemSnapshot['status'] = 'active',
    cycle: string[] = [],
    limit = false;
  const events: SystemEvent[] = [],
    frames: ReplayFrame<SystemEvent, SystemSnapshot>[] = [],
    intervals: CpuInterval[] = [];
  const process = (id: string) => processes.find((p) => p.id === id)!;
  const source = (p: SystemProcess) =>
    scenario.processes.find((x) => x.id === p.id)!;
  function snapshot(): SystemSnapshot {
    return freeze({
      simTime: time,
      processes: processes.map((p) => ({ ...p })),
      resources: resources.map((r) => ({ ...r, queue: [...r.queue] })),
      segments: [...segments],
      ready: [...ready],
      memoryWait: [...memoryWait],
      pendingWake: [...pendingWake],
      running,
      quantumRemaining: quantum,
      intervalCount: intervals.length,
      activeInterval: active ? { ...active } : null,
      busyTime: busy,
      utilizationPercent: time ? (busy / time) * 100 : null,
      status,
      cycle: [...cycle],
    });
  }
  function emit(
    kind: SystemEventKind,
    reason: string,
    p: string | null = null,
    r: string | null = null,
  ) {
    if (events.length >= budget) {
      limit = true;
      return;
    }
    const event = freeze({
      seq: events.length,
      kind,
      simTime: time,
      explanationKey: `system.${kind}`,
      processId: p,
      resourceId: r,
      reason,
    });
    events.push(event);
    frames.push(freeze({ index: frames.length, event, snapshot: snapshot() }));
  }
  frames.push(freeze({ index: 0, event: null, snapshot: snapshot() }));
  function close() {
    if (active && time > active.start)
      intervals.push(freeze({ ...active, end: time }));
    active = null;
  }
  function release(id: string, owner: string, cleanup = false) {
    const r = resources.find((x) => x.id === id)!;
    const next = r.queue.shift();
    r.owner = next ?? null;
    if (next) {
      const p = process(next);
      p.pc++;
      p.waitingFor = null;
      p.state = 'ready';
      pendingWake.push(next);
    }
    emit(
      'resource-released',
      `${owner} ${cleanup ? 'automatically releases' : 'releases'} ${id}. ${next ? `Ownership passes directly to ${next}; its pending acquire completes once.` : 'No waiter; the resource is free.'}`,
      owner,
      id,
    );
  }
  function drain(p: Mutable<SystemProcess>) {
    while (p.state === 'running' && !limit && status === 'active') {
      const x = source(p).program[p.pc];
      if (!x) {
        // Release before publishing terminated state; memory remains owned until atomic completion.
        resources
          .filter((r) => r.owner === p.id)
          .forEach((r) => release(r.id, p.id, true));
        close();
        running = null;
        quantum = 0;
        segments = segments.map((s) =>
          s.id === p.id ? { ...s, id: null } : s,
        );
        const coalesced: Segment[] = [];
        for (const s of segments) {
          const prev = coalesced.at(-1);
          if (prev?.id === null && s.id === null)
            coalesced[coalesced.length - 1] = {
              start: prev.start,
              end: s.end,
              id: null,
            };
          else coalesced.push(s);
        }
        segments = coalesced;
        p.state = 'terminated';
        p.completion = time;
        p.turnaround = time - source(p).arrival;
        emit(
          'process-completed',
          `${p.id} completes at t=${time}. Turnaround ${p.turnaround} = CPU ${p.cpuService} + ready ${p.readyWait} + resource ${p.resourceWait} + memory ${p.memoryWait}. Its memory is freed and adjacent holes coalesced.`,
          p.id,
        );
        emit(
          'memory-freed',
          `${p.id}'s ${source(p).memoryKiB} KiB allocation is free; retry strict FIFO memory admission after arrivals and resource wake-ups.`,
          p.id,
        );
        return;
      }
      if (x.op === 'cpu') {
        if (!p.remaining) p.remaining = x.duration;
        return;
      }
      const r = resources.find((r) => r.id === x.resourceId)!;
      if (x.op === 'release') {
        if (r.owner !== p.id) {
          close();
          status = 'model-error';
          emit(
            'model-error',
            `${p.id} cannot release ${r.id}: owner is ${r.owner ?? 'none'}. No ownership changed.`,
            p.id,
            r.id,
          );
          return;
        }
        p.pc++;
        release(r.id, p.id);
      } else if (!r.owner) {
        r.owner = p.id;
        p.pc++;
        emit(
          'resource-granted',
          `${p.id} acquires free ${r.id}; acquire consumes zero simulated time and the current quantum continues.`,
          p.id,
          r.id,
        );
      } else {
        p.state = 'blocked';
        p.waitingFor = r.id;
        r.queue.push(p.id);
        close();
        running = null;
        quantum = 0;
        emit(
          'resource-blocked',
          `${p.id} waits for ${r.id}, owned by ${r.owner}. It joins the resource FIFO queue, retains ${source(p).memoryKiB} KiB and loses its remaining quantum.`,
          p.id,
          r.id,
        );
        return;
      }
    }
  }
  function settle() {
    for (const p of processes)
      if (p.state === 'new' && source(p).arrival === time) {
        p.state = 'memory-wait';
        memoryWait.push(p.id);
        emit(
          'process-arrived',
          `${p.id} arrives at t=${time} requesting ${source(p).memoryKiB} KiB. Admission respects earlier memory waiters.`,
          p.id,
        );
      }
    while (pendingWake.length && !limit) {
      const id = pendingWake.shift()!;
      process(id).state = 'ready';
      ready.push(id);
      emit(
        'resource-wake',
        `${id} becomes ready after ownership handoff. Wake-ups precede new memory admissions; earlier ready entries retain their positions.`,
        id,
      );
    }
    while (memoryWait.length && !limit) {
      const id = memoryWait[0]!,
        p = process(id),
        size = source(p).memoryKiB,
        i = segments.findIndex((s) => s.id === null && s.end - s.start >= size);
      if (i < 0) {
        const free = segments
          .filter((s) => s.id === null)
          .reduce((a, s) => a + s.end - s.start, 0);
        emit(
          'memory-wait',
          `${id} needs ${size} contiguous KiB; ${free} KiB is free. Strict FIFO admission prevents later processes from bypassing this head.`,
          id,
        );
        break;
      }
      const hole = segments[i]!;
      segments.splice(
        i,
        1,
        { start: hole.start, end: hole.start + size, id },
        ...(hole.end > hole.start + size
          ? [{ start: hole.start + size, end: hole.end, id: null }]
          : []),
      );
      memoryWait.shift();
      p.state = 'ready';
      ready.push(id);
      emit(
        'memory-allocated',
        `${id} takes the first fitting hole at [${hole.start}, ${hole.start + size}) KiB and joins the ready tail.`,
        id,
      );
    }
    if (running && quantum === 0) {
      const p = process(running);
      p.state = 'ready';
      ready.push(p.id);
      close();
      running = null;
      emit(
        'quantum-expired',
        `${p.id}'s quantum expires after zero-time instructions. Ready ahead: ${ready.slice(0, -1).join(', ') || 'none'}. It joins the tail.`,
        p.id,
      );
    }
  }
  function findCycle(): string[] {
    const edges = new Map<string, string>();
    for (const p of processes)
      if (p.waitingFor) edges.set(`P:${p.id}`, `R:${p.waitingFor}`);
    for (const r of resources)
      if (r.owner) edges.set(`R:${r.id}`, `P:${r.owner}`);
    for (const start of edges.keys()) {
      const path: string[] = [];
      let n: string | undefined = start;
      while (n) {
        const i = path.indexOf(n);
        if (i >= 0) return [...path.slice(i), n];
        path.push(n);
        n = edges.get(n);
      }
    }
    return [];
  }
  settle();
  while (!limit && status === 'active') {
    while (!running && ready.length && !limit && status === 'active') {
      const id = ready.shift()!,
        p = process(id);
      p.state = 'running';
      running = id;
      quantum = scenario.quantum;
      active = { id, start: time };
      emit(
        'dispatch',
        `${id} is the ready head; dispatch grants a fresh ${quantum} t quantum. Ready behind: ${ready.join(', ') || 'none'}.`,
        id,
      );
      drain(p);
      settle();
    }
    if (limit || status !== 'active') break;
    if (processes.every((p) => p.state === 'terminated')) {
      status = 'completed';
      break;
    }
    const future = processes
        .filter((p) => p.state === 'new')
        .map((p) => source(p).arrival),
      nextArrival = future.length ? Math.min(...future) : Infinity;
    if (!running) {
      if (nextArrival === Infinity) {
        cycle = findCycle();
        status = cycle.length ? 'deadlocked' : 'stalled';
        emit(
          status,
          cycle.length
            ? `Single-instance wait cycle: ${cycle.join(' → ')}.`
            : `No ready process or future arrival. Memory waiters: ${memoryWait.join(', ') || 'none'}; blocked: ${
                processes
                  .filter((p) => p.state === 'blocked')
                  .map((p) => p.id)
                  .join(', ') || 'none'
              }.`,
        );
        break;
      }
      const start = time;
      const delta = nextArrival - time;
      for (const p of processes) {
        if (p.state === 'blocked') p.resourceWait += delta;
        else if (p.state === 'memory-wait') p.memoryWait += delta;
      }
      time = nextArrival;
      intervals.push({ id: null, start, end: time });
      emit(
        'idle',
        `CPU idle during [${start}, ${time}); jump to the next arrival.`,
      );
      settle();
      continue;
    }
    const p = process(running),
      delta = Math.min(p.remaining, quantum, nextArrival - time);
    if (p.response === null) p.response = time - source(p).arrival;
    for (const q of processes) {
      if (q.state === 'ready') q.readyWait += delta;
      else if (q.state === 'blocked') q.resourceWait += delta;
      else if (q.state === 'memory-wait') q.memoryWait += delta;
    }
    time += delta;
    busy += delta;
    p.cpuService += delta;
    p.remaining -= delta;
    quantum -= delta;
    emit(
      'cpu-service',
      `${p.id} consumes ${delta} t CPU service. Instruction remaining ${p.remaining} t; quantum remaining ${quantum} t.`,
      p.id,
    );
    if (p.remaining === 0) {
      p.pc++;
      emit(
        'instruction-completed',
        `${p.id} finishes its CPU instruction; following acquire/release operations run before quantum requeue.`,
        p.id,
      );
      drain(p);
    }
    settle();
  }
  if (limit)
    return {
      ok: false,
      error: {
        code: 'limit-exceeded',
        message: `Integrated trace exceeds ${budget} events. Reduce program lengths or increase the quantum.`,
        issues: [],
      },
    };
  // Publish completion as a distinct final frame without changing simulated time.
  if (status === 'completed')
    emit(
      'process-completed',
      'All processes completed; final waiting categories and CPU utilization are available.',
    );
  if (limit)
    return {
      ok: false,
      error: {
        code: 'limit-exceeded',
        message: 'Integrated trace budget exceeded.',
        issues: [],
      },
    };
  const summary = snapshot();
  return {
    ok: true,
    result: freeze({
      engineVersion: '1.0.0',
      scenario,
      events,
      frames,
      intervals,
      metrics: summary.processes,
      summary,
      outcome: status === 'active' ? 'stalled' : status,
    }),
  };
}
