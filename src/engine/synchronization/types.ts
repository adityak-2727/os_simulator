import type { EventBase, TraceResult } from '../contracts';
export type SyncInstruction =
  | { readonly op: 'read-counter' | 'write-counter'; readonly register: string }
  | {
      readonly op: 'add-local';
      readonly register: string;
      readonly value: number;
    }
  | { readonly op: 'lock' | 'unlock'; readonly mutex: string }
  | { readonly op: 'wait' | 'signal'; readonly semaphore: string }
  | { readonly op: 'enqueue'; readonly value: string }
  | { readonly op: 'dequeue'; readonly register: string };
export interface SyncScenario {
  readonly kind: 'synchronization';
  readonly preset: 'counter-race' | 'counter-mutex' | 'producer-consumer';
  readonly initialCounter: number;
  readonly capacity: number;
  readonly mutexIds: readonly string[];
  readonly semaphores: readonly {
    readonly id: string;
    readonly initial: number;
  }[];
  readonly processes: readonly {
    readonly id: string;
    readonly instructions: readonly SyncInstruction[];
  }[];
  readonly schedule: readonly string[];
}
export interface BufferItem {
  readonly sequence: number;
  readonly value: string;
  readonly producer: string;
}
export interface Reservation {
  readonly semaphore: 'empty' | 'full';
  readonly phase: 'before-buffer' | 'after-buffer';
}
export interface SyncProcess {
  readonly id: string;
  readonly pc: number;
  readonly state: 'runnable' | 'blocked' | 'completed';
  readonly locals: Readonly<Record<string, number | string>>;
  readonly waiting: {
    readonly kind: 'mutex' | 'semaphore';
    readonly id: string;
  } | null;
  readonly reservations: readonly Reservation[];
}
export interface MutexState {
  readonly id: string;
  readonly owner: string | null;
  readonly queue: readonly string[];
}
export interface SemaphoreState {
  readonly id: string;
  readonly count: number;
  readonly queue: readonly string[];
}
export type SyncStatus =
  'awaiting-choice' | 'completed' | 'stalled' | 'model-error';
export interface SyncSnapshot {
  readonly step: number;
  readonly counter: number;
  readonly processes: readonly SyncProcess[];
  readonly mutexes: readonly MutexState[];
  readonly semaphores: readonly SemaphoreState[];
  readonly buffer: readonly BufferItem[];
  readonly produced: readonly BufferItem[];
  readonly consumed: readonly BufferItem[];
  readonly maxBufferOccupancy: number;
  readonly status: SyncStatus;
  readonly error: {
    readonly processId: string;
    readonly message: string;
  } | null;
}
export interface SyncEvent extends EventBase<
  | 'instruction'
  | 'process-blocked'
  | 'handoff'
  | 'selection-rejected'
  | 'model-error'
> {
  readonly processId: string;
  readonly instruction: SyncInstruction | null;
  readonly pcBefore: number;
  readonly pcAfter: number;
  readonly woken: readonly string[];
  readonly counterBefore: number;
  readonly counterAfter: number;
  readonly readCounter: number | null;
  readonly interveningWrite: boolean;
  readonly reason: string;
}
export interface SyncResult extends TraceResult<SyncEvent, SyncSnapshot> {
  readonly scenario: SyncScenario;
  readonly summary: SyncSnapshot;
}
