# Eight phase development roadmap

Planning estimate: 10 to 12 weeks for a small team with basic React and OS knowledge. The calendar is adjustable; phase completion is determined by the acceptance gates. The project contains exactly eight implementation phases.

| Phase | Suggested weeks | Main delivery | Completion evidence |
| --- | --- | --- | --- |
| 1 Foundation | 1 | App shell, style tokens, domain contracts, replay infrastructure | Shell usable by keyboard; deterministic replay test; typecheck and build |
| 2 CPU | 2 to 3 | Four schedulers, timeline, queues, metrics, comparison | CPU fixtures, tie cases, idle gaps, playback invariance |
| 3 Memory | 4 to 5 | Allocation plus page replacement | Conservation, coalescing, and expected page-fault counts |
| 4 Deadlock | 6 | Graph, Banker's safety and request flow | Cycle, safe sequence, safe grant, unsafe rollback |
| 5 Synchronization | 7 | Race, mutex, semaphores, producer-consumer | Lost update reproduced; protection and bounds verified |
| 6 Disk | 8 | Four disk algorithms and comparisons | Exact head paths and movement totals including wrap |
| 7 Integration | 9 to 10 | Integrated scenario, saved experiments, explanations | Cross-panel consistency, waiting-time decomposition, import/export |
| 8 Release | 11 to 12 | Audit, usability fixes, docs, deployment preparation | Full required checks and a reproducible demo |

## Phase 1 Foundation

Create the project beside these documents. Establish the light workbench style, navigation, page layouts, accessible primitives, form validation pattern, event inspector, replay controller, and engine interfaces. Add a tiny explicitly labeled fixture preview to prove playback; do not imply an unimplemented algorithm is working. Provide a useful initial view and honest unavailable routes. Set up formatting, lint, strict TypeScript, and unit-test scripts.

Gate: previous/next/reset operate on a deterministic test trace; keyboard focus is visible; routes and narrow layouts work; production build succeeds. Deliver a working shell with a clearly stated Phase 1 scope.

## Phase 2 CPU scheduling

Implement pure schedulers and numeric fixtures before wiring visual animation. Build the process editor, ready queue, CPU status, Gantt timeline, metrics table, explanations, and comparison view. Use the precise event precedence and time definitions in the CPU specification.

Gate: all four schedules match fixtures; arrival/quantum ties are correct; idle intervals are visible; speed and rewind leave results unchanged; editing an input invalidates the old result. This is the first end-to-end lab.

## Phase 3 Memory and paging

Add separate allocation and page replacement tabs. Allocation supports allocate/free operations and merged free holes. Paging supports an editable reference sequence and frame count. Both expose each decision and an equivalent table. Comparison uses identical starting state and operations.

Gate: allocated plus free memory equals capacity after every operation; holes coalesce; exact fits work; rejected allocations do not alter state; FIFO/LRU/Optimal fixtures and tie rules pass.

## Phase 4 Deadlock

Build a single-instance graph backed by an accessible allocation/request editor. Add a separate matrix mode for Banker's safety algorithm and resource requests. Display work-vector changes and the selected safe sequence. Show why a request was rejected or deferred.

Gate: graph directions and cycle detection are correct; safe cases yield a valid sequence; unsafe requests restore the original matrices; unsafe and deadlocked are distinct states.

## Phase 5 Synchronization

Create a tiny instruction interpreter for educational processes. Support manual process stepping and deterministic scripted schedules. Demonstrate a lost update, its mutex-protected version, and producer-consumer with counting semaphores. Display local variables, program counters, lock ownership, wait queues, and buffer contents.

Gate: the supplied race ends at 1, its protected version at 2; blocked waits resume once; mutex ownership is enforced; buffer contents preserve FIFO order and capacity bounds.

## Phase 6 Disk scheduling

Create the request editor, head-path view, service-order table, movement ledger, and comparison table. Implement exact SCAN endpoint and C-SCAN wrap conventions. Use cylinders as the distance unit; do not invent seek-time measurements.

Gate: reference totals and paths pass; duplicates are distinct requests; endpoint and wrap movements are explicit; direction changes and tie cases are deterministic.

## Phase 7 Integration and experiments

Integrate CPU, first-fit memory admission, and blocking resource acquisition. Add saved scenarios, versioned import/export, CSV outputs, built-in presets, and guided questions with deterministic explanations. All dashboard panels use the same integrated snapshot. Disk and paging remain separate labs.

Gate: the integrated fixture timeline and memory/resource waits match; storage failures are recoverable; invalid imports leave the current experiment intact; export/import reproduces results; user-defined workloads also run.

## Phase 8 Verification and release

Audit engine correctness and interface quality, fix observed defects, test keyboard and narrow layouts, and document setup and the project demo. Pin dependency versions in the lockfile. Prepare static-host deployment instructions, base-path settings, and a repeatable CI check. No claim of deployment until an authorized deployment actually succeeds.

Gate: required checks pass or are explicitly documented as blocked; supported cases are verified; no broken action or misleading metric remains; handover explains architecture, assumptions, known limitations, and how to reproduce results.

## Gate policy

Run targeted checks during development and the shared phase gate at completion. Do not reset the repository when one gate fails. Fix the underlying behavior, rerun relevant checks, and record evidence. A screenshot alone cannot complete an algorithm phase. Later phases may extend types, but must preserve earlier lab results.
