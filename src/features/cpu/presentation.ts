import type { CSSProperties } from 'react';
import type { CpuAlgorithm, CpuEvent } from '../../engine/contracts';
import type { CpuSnapshot } from '../../engine/cpu/types';

export const ALGORITHM_LABELS: Record<CpuAlgorithm, string> = {
  fcfs: 'FCFS',
  sjf: 'SJF',
  priority: 'Priority',
  rr: 'Round Robin',
};
export const ALGORITHM_NAMES: Record<CpuAlgorithm, string> = {
  fcfs: 'First come first served',
  sjf: 'Shortest job first',
  priority: 'Priority scheduling',
  rr: 'Round Robin',
};
const colors = [
  '#275DAD',
  '#8A5B12',
  '#2E7656',
  '#784B93',
  '#A3463F',
  '#226F7C',
];
export function processColor(order: number) {
  return colors[order % colors.length] ?? '#275DAD';
}
export function processStyle(order: number): CSSProperties {
  return {
    '--process': processColor(order),
    borderStyle: order >= 6 ? 'dashed' : 'solid',
  } as CSSProperties;
}
export function formatMetric(value: number | null, decimals = 2) {
  return value === null ? '—' : value.toFixed(decimals);
}
export function describeCpuEvent(
  event: CpuEvent | null,
  snapshot: CpuSnapshot,
  quantum: number,
) {
  if (!event)
    return {
      title: 'Initial frame',
      reason: 'The clock starts at t = 0. No process has arrived or run yet.',
      rule: 'Frame 0 precedes the first event. Metrics are unavailable until their inputs exist.',
    };
  switch (event.kind) {
    case 'idle-started':
      return {
        title: 'CPU becomes idle',
        reason: `No process is ready at t = ${event.simTime}. The CPU waits until the next arrival at t = ${event.until}.`,
        rule: 'An empty ready queue advances the simulation clock to the next arrival. Idle time is included in utilization.',
      };
    case 'idle-ended':
      return {
        title: 'Idle interval ends',
        reason: `The CPU has reached the next arrival time, t = ${event.simTime}. Arrival events will populate the ready queue next.`,
        rule: 'Idle intervals use the same uniform time scale as CPU service.',
      };
    case 'process-arrived':
      return {
        title: `${event.processId} arrives`,
        reason: `${event.processId} enters the ready queue at t = ${event.simTime}.${snapshot.running ? ` ${snapshot.running} retains the CPU until completion or quantum expiry.` : ''}`,
        rule: 'Arrivals at the same time preserve input order. At a Round Robin boundary, arrivals precede the expired process being requeued.',
      };
    case 'quantum-expired':
      return {
        title: `${event.processId} quantum expires`,
        reason: `${event.processId} used its ${quantum}-unit quantum and has ${event.remaining} time units remaining. It is requeued ${event.ahead.length ? `after ${event.ahead.join(', ')}` : 'at the head of the otherwise empty queue'}.`,
        rule: 'FIFO ready queue: arrivals at the boundary are enqueued before the unfinished process. Completed processes are never requeued.',
      };
    case 'process-completed': {
      const p = snapshot.processes.find((p) => p.id === event.processId);
      return {
        title: `${event.processId} completes`,
        reason: `${event.processId} finishes at t = ${event.simTime}. ${snapshot.summary.completedCount} of ${snapshot.processes.length} processes have completed.`,
        rule: p
          ? `Waiting = completion − arrival − burst = ${p.completion} − ${p.arrival} − ${p.burst} = ${p.waiting} time units.`
          : 'Completion occurs before same-time arrivals.',
      };
    }
    case 'dispatch': {
      const p = snapshot.processes.find((p) => p.id === event.processId);
      const choice =
        event.algorithm === 'sjf'
          ? `has the smallest original burst (${p?.burst} time units)`
          : event.algorithm === 'priority'
            ? `has the smallest priority number (${p?.priority})`
            : event.algorithm === 'fcfs'
              ? `has the earliest arrival (${p?.arrival})`
              : 'is at the head of the FIFO ready queue';
      return {
        title: `${event.processId} starts${p?.serviced ? ' again' : ''}`,
        reason: `${event.processId} starts at t = ${event.simTime} because it ${choice} among ready processes: ${event.candidates.join(', ')}.`,
        rule:
          event.algorithm === 'rr'
            ? `Execute for at most ${quantum} time units or the remaining burst. Preserve queue order.`
            : 'Non-preemptive selection. Equal primary keys use arrival time, then input order.',
      };
    }
  }
}
