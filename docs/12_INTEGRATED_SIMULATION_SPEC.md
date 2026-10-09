# Integrated system simulation

## Purpose and scope

Demonstrate how CPU scheduling, memory admission, and resource blocking interact in a single run. V1 uses one CPU, Round Robin, zero context-switch cost, first-fit contiguous memory, and reusable resources with one instance each. Programs contain finite cpu, acquire, and release instructions. Paging and disk behavior remain independent teaching labs.

The dashboard reads one integrated snapshot. It never combines a CPU result from one workload with a memory animation from another. The engine is a deterministic state machine; instructions are data, never executable user code.

## Admission and states

A process arrives at its specified time and requests its full memory allocation. A process whose requirement exceeds total capacity is rejected before execution. If a suitable hole exists and no earlier admission waiter prevents admission, allocate memory and append the process to the ready queue. Otherwise enqueue it in a FIFO memory-wait queue. Use strict FIFO admission: retry its head after memory is freed, and continue only while the head fits. Explain head-of-line waiting if a later smaller process could fit.

States are new, memory-wait, ready, running, blocked, and terminated. Keep ready-queue waiting, resource-blocked time, and memory-admission waiting separate. A process retains memory while waiting for a resource. Termination frees memory and releases any remaining owned resources, with explicit cleanup events.

## CPU and resource behavior

Each dispatch grants a fresh RR quantum. Positive-duration CPU instructions consume time. Acquire/release instructions consume zero simulated time and create ordered events. Their instructions must still be visible in the replay.

Acquire grants an unowned resource immediately, advances the program counter, and continues with the current process. If owned, it blocks the requester in the resource FIFO queue without completing acquire. A blocked process loses the rest of its quantum. Release is owner-only and hands ownership directly to the first blocked waiter, completes its pending acquire exactly once, and makes it ready; otherwise the resource becomes free.

When a CPU instruction finishes, advance past it and process immediately following acquire/release operations before applying an exhausted-quantum requeue. If the next CPU instruction exists and quantum remains, continue; if quantum is exhausted, requeue. Termination wins over requeue. A same-process redispatch is valid and may be visually merged while preserving its events.

## Same-time precedence

At each timestamp:
1. Account for CPU service since the preceding event boundary.
2. Finish the CPU instruction if appropriate; drain the running process's following zero-time instructions and termination cleanup, which may release resources or memory.
3. Register new arrivals in input order and append any new memory waiters.
4. Apply resource wake-ups and retry memory admission in FIFO order. Ready processes already queued keep their positions; simultaneous wake-ups precede newly admitted processes, each using stable event/input order.
5. Append a still-runnable quantum-expired process to the ready queue.
6. Dispatch the ready head, draining its zero-time instructions until it runs positive CPU time, blocks, or terminates. Repeat dispatch at this timestamp as needed.

Process arrivals inside a running quantum at their actual times without resetting the quantum. The next event boundary is the earliest future arrival, CPU instruction finish, or quantum expiry. Bound zero-time processing by the finite program and event budget. If ready is empty, jump to the next future arrival. If no future arrival exists and unfinished processes cannot progress, report stalled with reasons; identify deadlock only when the single-instance wait graph contains a cycle.

## Metrics

Completion and turnaround use the same time definitions as CPU scheduling. Response = first positive CPU service start - arrival. Ready waiting is accumulated only in the ready state. Memory waiting and resource waiting are accumulated in their respective states.

For every completed process, turnaround = CPU service + ready waiting + memory waiting + resource waiting. Zero-time bookkeeping adds no duration. Utilization uses busy CPU time divided by the observation duration from 0 through last completion. Do not relabel all non-CPU time as CPU queue waiting.

## Required integrated example

Memory is 96 KiB, quantum 2, and resource R1 has one instance.

| Process | Arrival | Memory | Program |
| --- | --- | --- | --- |
| P1 | 0 | 64 | acquire R1, cpu 4, release R1, cpu 1 |
| P2 | 1 | 32 | acquire R1, cpu 2, release R1 |
| P3 | 2 | 32 | cpu 1 |

Expected CPU dispatch intervals: P1 [0,2), P1 [2,4), P2 [4,6), P1 [6,7), P3 [7,8). P2 attempts R1 at t=2 and blocks until t=4. P3 waits for memory from t=2 to t=6, when P2 completes and frees its block. At t=6, P1 is already queued, so P3 goes behind it.

| Process | Completion | Turnaround | CPU service | Ready wait | Resource wait | Memory wait | Response |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | 7 | 7 | 5 | 2 | 0 | 0 | 0 |
| P2 | 6 | 5 | 2 | 1 | 2 | 0 | 3 |
| P3 | 8 | 6 | 1 | 1 | 0 | 4 | 5 |

Busy time is 8 and utilization is 100%. A timeline may merge P1's adjacent intervals into [0,4), but the quantum expiry and failed P2 acquire at t=2 must remain in the event log.

## Completion gate

Verify this example and at least one different user-created workload, an idle gap, a no-resource workload, memory release/coalescing, simultaneous arrival/completion, resource wake-up exactly once, and a genuine two-resource cycle. At every frame there is at most one running process, each resource has at most one owner, and memory partitions conserve capacity.
