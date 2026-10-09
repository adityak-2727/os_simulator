# CPU scheduling specification

## Model

One CPU, integer time units, finite processes, one positive CPU burst per process, no I/O blocking, and zero context-switch cost. The clock starts at 0. Arrival times are nonnegative integers; burst lengths and RR quantum are positive integers. IDs are unique and input order is a stable tie breaker. Smaller priority numbers mean higher priority.

FCFS, SJF, and Priority are non-preemptive. RR is preemptive. Show these assumptions beside algorithm selection. Do not silently implement SRTF when SJF is selected.

## Selection rules

| Algorithm | Rule |
| --- | --- |
| FCFS | Earliest arrival among ready processes; input order for equal arrivals |
| SJF | Smallest original burst among ready processes; then arrival, then input order |
| Priority | Smallest priority number among ready processes; then arrival, then input order |
| RR | FIFO ready queue; execute at most quantum or remaining burst; append unfinished process to tail |

If no process is ready, record an idle interval ending at the next arrival. Non-preemptive algorithms keep the selected process until it completes even if a better candidate arrives. Arrival events still update the visible queue during that interval.

## Same-time ordering

At time t, first account for execution that ended at t and record completion if remaining burst reached zero. Enqueue all arrivals at t in input order. If the quantum expired and the running process remains unfinished, append it after those arrivals. Then dispatch the next ready process. Arrivals strictly inside the preceding quantum were already enqueued in arrival/input order.

A completed process is never requeued, even when completion coincides with quantum expiry. If RR is the only ready process, it can be selected again; preserve quantum events even if adjacent Gantt segments are visually merged. Never use frame rate, Date.now(), or timeout timing for queue ordering.

## Metrics

For each process: completion CT is the end of its last CPU interval; turnaround TAT = CT - arrival; waiting WT = TAT - burst; response RT = first CPU start - arrival. For this CPU-only model WT and RT are equal for non-preemptive algorithms, but generally differ for RR.

For the run: busy time = sum of bursts; observation interval = [0, last completion]; utilization = busy time / last completion times 100. Include initial and intermediate idle time. Throughput = completed processes / last completion, in processes per time unit. Keep full precision internally; display averages to two decimal places. Context-switch overhead remains fixed at zero in v1.

The integrated system has a different waiting-time decomposition because processes can wait for memory and resources; do not reuse WT = TAT - CPU time as its ready-queue waiting time.

## Reference workload

| Process | Arrival | Burst | Priority |
| --- | --- | --- | --- |
| P1 | 0 | 5 | 2 |
| P2 | 1 | 3 | 1 |
| P3 | 2 | 1 | 3 |

RR quantum is 2. FCFS and Priority intervals are P1 [0,5), P2 [5,8), P3 [8,9). SJF intervals are P1 [0,5), P3 [5,6), P2 [6,9). RR intervals are P1 [0,2), P2 [2,4), P3 [4,5), P1 [5,7), P2 [7,8), P1 [8,9).

| Algorithm | CT in P1 P2 P3 order | WT in P1 P2 P3 order | TAT in P1 P2 P3 order | RT in P1 P2 P3 order |
| --- | --- | --- | --- | --- |
| FCFS | 5, 8, 9 | 0, 4, 6 | 5, 7, 7 | 0, 4, 6 |
| SJF | 5, 9, 6 | 0, 5, 3 | 5, 8, 4 | 0, 5, 3 |
| Priority | 5, 8, 9 | 0, 4, 6 | 5, 7, 7 | 0, 4, 6 |
| RR | 9, 8, 5 | 4, 4, 2 | 9, 7, 3 | 0, 1, 2 |

All four have utilization 100% for this workload; equal utilization does not imply equal waiting or response time. A separate fixture with P1 arrival 3 and burst 2 has idle [0,3), execution [3,5), and utilization 40%.

## Required tests

Reference workload; empty input rejection; one process; all arrivals equal; idle gaps; priorities tied; arrival at quantum boundary; completion at quantum boundary; quantum larger than every burst; large numeric values within limits; duplicate IDs; zero burst/quantum rejection; run/replay determinism. Verify total executed service equals every requested burst and that no execution starts before arrival.
