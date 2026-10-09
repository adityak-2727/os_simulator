# Synchronization specification

## Model

Simulate interleavings with a small instruction interpreter. JavaScript itself is not used to create an actual data race. One selected process executes one atomic model instruction per step. Shared reads and writes are separate instructions so a lost update can be reproduced. Each frame shows shared values, local registers, program counters, runnable/blocked/completed states, lock ownership, and wait queues.

The supported first release has a shared counter and a bounded FIFO buffer. Use a finite instruction list and an explicit scripted or manual process selection. No random scheduler is required.

## Contracts

```ts
type SyncInstruction =
  | { op: 'read-counter'; register: string }
  | { op: 'add-local'; register: string; value: number }
  | { op: 'write-counter'; register: string }
  | { op: 'lock'; mutex: string }
  | { op: 'unlock'; mutex: string }
  | { op: 'wait'; semaphore: string }
  | { op: 'signal'; semaphore: string }
  | { op: 'enqueue'; value: string }
  | { op: 'dequeue'; register: string };
interface SyncScenario {
  kind: 'synchronization';
  preset: 'counter-race' | 'counter-mutex' | 'producer-consumer';
  initialCounter: number;
  capacity: number;
  mutexIds: string[];
  semaphores: Array<{ id: string; initial: number }>;
  processes: Array<{ id: string; instructions: SyncInstruction[] }>;
  schedule: string[];
}
```

Run consumes the supplied schedule. A manual Step process action appends one valid choice to the current schedule and produces its next transition. Reject selection of an already blocked or completed process with a clear message; do not consume an instruction. Rewinding then selecting a different process explicitly branches the schedule by discarding its future choices, with a visible indication.

An exhausted schedule with runnable processes is paused/awaiting-choice, not completed. All processes finished means completed. If no process can run and unfinished blocked processes remain with no pending external action, mark stalled; call it deadlock only if the model establishes the corresponding wait cycle.

## Mutex semantics

Lock on a free mutex acquires ownership and advances the program counter. Lock on an owned mutex enqueues the requester in FIFO order and blocks it without consuming the lock instruction yet. Recursive locking is unsupported and reported as an invalid operation.

Only the owner can unlock. Unlock hands ownership directly to the first waiter when one exists. The waiter becomes runnable and its pending lock instruction completes exactly once, advancing its program counter. Otherwise the mutex becomes free. The old owner advances past unlock. Never let a newly arriving process steal a lock already handed to a waiter.

## Counting semaphore semantics

Counters are nonnegative. Wait with value > 0 decrements and proceeds; wait with value = 0 queues and blocks. Signal hands one permit directly to the first waiter, completing that wait exactly once, without incrementing the counter; if no waiter exists it increments the counter. Use a mutex for ownership-sensitive critical sections; a counting semaphore does not imply ownership.

## Counter reference

Both P1 and P2 execute read x into local r, add 1 to r, write r into x. Starting x=0, schedule P1,P2,P1,P2,P1,P2 ends at x=1. The mathematical target for two protected increments is 2.

In the protected variant, surround the same three instructions with lock m and unlock m. Schedule P1,P2,P1,P1,P1,P1,P2,P2,P2,P2 ends at x=2. P2's initial lock attempt blocks; P1's unlock hands it ownership and completes its pending lock. A supplied fixture records each frame so program-counter mistakes are caught.

## Producer consumer

Use buffer capacity 2, empty=2, full=0, and mutex m. Producer repeats wait(empty), lock(m), enqueue(value), unlock(m), signal(full). Consumer repeats wait(full), lock(m), dequeue(register), unlock(m), signal(empty). Default values are A and B, consumed in that order.

Record reserved permits while an operation is in flight so explanations do not falsely equate semaphore counters with immediate occupancy. The simple identity empty+full=capacity need not hold between wait and signal. Check actual buffer bounds, FIFO order, no duplicated/lost items, and exclusive buffer access. Enqueue to a full buffer or dequeue from an empty buffer is an explicit model error if a malformed custom schedule/program reaches it; never silently drop data.

## Required tests

Lost update; protected final value; FIFO wake-up; blocked program counter; owner-only unlock; direct permit handoff; zero semaphore; multiple waiters; producer/consumer starting in either order; capacity bounds; consumed sequence; repeated replay; schedule exhaustion distinct from termination; branch-after-rewind behavior.
