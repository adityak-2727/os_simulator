# Validation and test plan

## Input limits and rationale

Use finite teaching-size scenarios to keep visualization useful and avoid unbounded trace generation. These are product limits, not OS limits. Validate before running or importing; explain the limit near the affected input.

| Domain | Initial supported limits |
| --- | --- |
| Process and resource IDs | Unique within their scope; 1 to 24 characters; letters, digits, underscore, hyphen |
| Scenario names | 1 to 80 characters after trimming |
| CPU | 1 to 50 processes; arrival 0 to 10,000; burst and quantum 1 to 1,000; priority 0 to 999 |
| Allocation | Capacity 1 to 65,536 KiB; 1 to 200 operations; positive integer sizes no greater than capacity |
| Paging | 1 to 12 frames; 1 to 200 references; page IDs 0 to 9,999 |
| Banker | 1 to 10 processes and 1 to 8 resources; integer instances 0 to 1,000; cross-field constraints apply |
| Graph | 1 to 12 processes and 1 to 12 single-instance resources |
| Synchronization | 2 to 4 processes; 1 to 100 instructions each; 1 to 10 buffer capacity; at most 1,000 scheduled choices |
| Disk | 1 to 100 requests; max cylinder 1 to 100,000; head and requests inside the range |
| Integrated | 1 to 20 processes; up to 8 resources; 1 to 100 instructions per process; CPU durations 1 to 1,000 |
| Import and storage | Maximum JSON file 1 MiB; at most 30 locally saved experiments; trace cap 50,000 events |

Integrated arrivals and memory limits follow CPU and allocation bounds. A process must contain positive CPU work; reject an all-zero-time program in v1 so response and throughput meanings stay clear. Check integer values with Number.isInteger and bounded ranges; do not accept NaN, Infinity, negative zero as a distinct identity, or numeric strings without explicit field parsing.

## Test levels

1. Unit tests cover engine rules using the supplied numeric fixtures and independent invariants.
2. Integration tests cover event reduction, replay, scenario invalidation, serialization, migrations, and combined CPU-memory-resource state.
3. Browser tests cover entering data, running, inspecting a result, stepping, editing, comparing, saving, importing, exporting, and narrow layouts.
4. Manual review checks readability, chart labels, keyboard sequence, visible state transitions, and explanations tied to the actual event.

Do not write tests that only mirror implementation branches or snapshot huge unreviewed DOM trees. Expected numerical outcomes must be derived independently of the application code. When a fixture fails, inspect the disagreement before changing either side.

## Requirements traceability

| Requirement | Reference and checks | Phase |
| --- | --- | --- |
| FR01 and FR02 | Shell keyboard flow, immutable replay, reset, speed invariance | 1 and 2 |
| FR03 | `fixtures/cpu.json`, idle and quantum-boundary cases, scheduling invariants | 2 |
| FR04 | `fixtures/allocation.json`, memory conservation and coalescing | 3 |
| FR05 | `fixtures/paging.json`, hit/fault and frame history | 3 |
| FR06 and FR07 | `fixtures/deadlock.json`, safe sequence and rollback | 4 |
| FR08 | `fixtures/synchronization.json`, race/mutex/buffer states | 5 |
| FR09 | `fixtures/disk.json`, exact service paths and movement | 6 |
| FR10 | `fixtures/integrated.json`, state-time decomposition and snapshot consistency | 7 |
| FR11 | `fixtures/experiment-import.json`, invalid import, save failure, round trip | 7 |
| FR12 | Event text references correct IDs/values and displayed algorithm rule | 7 |
| FR13 | Full checks, desktop/narrow review, demo and release documentation | 8 |

## Invariants

CPU: no execution before arrival; no overlapping CPU intervals; all burst time is accounted for; WT and RT are nonnegative; ready queues contain no duplicate process; clock is monotonic.

Memory: address ranges cover capacity with no overlaps; free neighbors are coalesced; failed allocation leaves state unchanged; every live ID occurs once.

Paging: occupied frame pages are unique; hits+faults=references processed; a hit changes no frame content; frame count is constant.

Banker: Available plus allocated columns equals Total; Need=Max-Allocation; safety analysis does not mutate actual matrices; rejected requests roll back exactly.

Synchronization: at most one mutex owner; blocked processes execute no ordinary instruction; wake-up consumes the pending wait once; buffer size stays between zero and capacity; consumed values preserve enqueue order.

Disk: every request is served exactly once; all positions lie within bounds; total movement equals sum(abs(to-from)); FCFS preserves request order.

Integrated: at most one running process; each resource has one owner at most; no terminated process remains queued; memory is conserved; completed turnaround decomposes into CPU plus three waiting categories.

## Browser workflows

- Load RR example, run, verify CT values 9/8/5, rewind, change speed, and verify the final result stays the same.
- Edit a burst after a run and confirm old results are cleared and Run is required.
- Compare algorithms and confirm identical input identifiers and assumptions.
- Trigger memory fragmentation and read the reason without losing prior allocations.
- Submit an unsafe Banker request and verify matrices remain unchanged.
- Reproduce the lost update, then run the protected preset and obtain 2.
- Switch SCAN direction and confirm an endpoint move is distinguishable from service.
- Run the integrated fixture and inspect P2 resource waiting and P3 memory waiting.
- Save, rename, duplicate, export, import, and recompute; test storage failure and malformed JSON.
- Complete key flows using only keyboard; inspect at 1440, 1024, 768, and 390 px widths.

## Phase gate commands

Run `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run build` at each completed phase. Run relevant Playwright flows once they exist. Phase 1 needs a shell smoke check; do not demand a nonexistent CPU implementation. Phase 8 runs the complete required browser suite. Record exact results and environment limitations in `BUILD_STATUS.md`.

## Performance evidence

Measure engine duration for representative small and near-limit workloads and check that input and navigation remain responsive. Record browser, machine, scenario size, event count, and duration. Add a Web Worker only if measured blocking justifies it. Trace limits and explicit errors are required even if performance is good.

## Fixture interpretation

Files with `format: os-lab-fixture` are test oracles. They can contain multiple cases and expected results and are not the app's import format. `experiment-import.json` is the valid app envelope. Never bundle expected results as the source of displayed answers; run the engine on scenario input.
