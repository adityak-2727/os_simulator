# Product requirements

## Product purpose

OS Lab Simulator helps students inspect how a chosen operating-system algorithm transforms a workload. The user enters a small scenario, runs it, inspects each decision, changes one parameter, and compares the resulting behavior. A faculty reviewer should be able to verify a numerical answer against a visible execution trace.

## Primary users and tasks

| User | Task | Evidence of success |
| --- | --- | --- |
| Student learning an algorithm | Run a preset and step through every decision | Can explain why the next process, page, or request was chosen |
| Student solving a numerical problem | Enter their own workload and inspect metrics | Inputs and results are exportable and match the stated rules |
| Lab instructor or evaluator | Reproduce a result and challenge an edge case | Result is deterministic and its assumptions are visible |
| Student developer | Extend one module | Can do so without changing unrelated engine behavior |

## Functional requirements

| ID | Requirement | Phase |
| --- | --- | --- |
| FR01 | Shared shell, accessible navigation, consistent controls, explanatory inspector | 1 |
| FR02 | Deterministic event/frame playback with pause, previous, next, reset, and speed | 1 and 2 |
| FR03 | Four CPU algorithms with process editing, Gantt chart, queues, metrics, comparison | 2 |
| FR04 | Three contiguous allocation strategies, allocation/deallocation, hole coalescing | 3 |
| FR05 | FIFO, LRU, Optimal page replacement with frame history and faults | 3 |
| FR06 | Single-instance resource graph and cycle-based deadlock detection | 4 |
| FR07 | Banker's safety steps and safe transactional resource request handling | 4 |
| FR08 | Reproducible race and mutex scenarios, counting semaphores, bounded buffer | 5 |
| FR09 | Four disk scheduling algorithms, exact paths, total movement, comparison | 6 |
| FR10 | Integrated CPU-memory-resource execution driven by one clock | 7 |
| FR11 | Saved scenarios, duplicate, rename, delete, JSON transfer, CSV results | 7 |
| FR12 | Presets, actual-event explanations, assumptions, glossary, guided exercises | 7 |
| FR13 | Verified build, meaningful tests, responsive interface, release and demo guide | 8 |

## Nonfunctional requirements

- Correctness: provided reference cases and engine invariants pass. Every algorithm assumption is stated in the app.
- Reproducibility: identical scenario, algorithm version, and settings produce the same ordered result. Wall-clock timestamps and random IDs cannot affect a schedule.
- Responsiveness: common teaching examples remain interactive. Support limits are explicit in the validation document. Record actual performance on the test machine rather than claiming universal timing guarantees.
- Accessibility: all editing and simulation controls work by keyboard. Charts have equivalent tables. Status is conveyed by text, not color alone.
- Privacy: no analytics, login, remote execution, or network transfer of scenarios in v1. Browser storage failure does not destroy the active scenario.
- Maintainability: engine code is independent of UI and has typed inputs, events, states, results, and errors.
- Honesty: future modules are labeled unavailable during development. No fabricated live-system data, saved status, success toast, or passing test claims.

## First usable release

At the end of Phase 2, a user can enter a CPU scheduling problem, run four algorithms, inspect the timeline and per-process metrics, pause and step, and compare algorithms using the same input. This is the earliest complete learning workflow.

## Full v1 definition

All FR01 through FR13 work. The app contains six standalone labs (CPU, allocation, paging, deadlock, synchronization, disk), an integrated system lab, experiments, and concise help. The integrated lab joins CPU, contiguous memory, and single-instance resources. Paging and disk remain standalone in v1; their numerical results are never presented as interacting with the integrated workload.

## Explicit exclusions

Kernel development, VM emulation, host process monitoring, arbitrary C execution, distributed systems, live multiuser collaboration, accounts, AI tutors, cloud databases, multi-core CPU scheduling, I/O burst scheduling, priority aging, preemptive priority, SRTF, LOOK/C-LOOK, and teacher grading portals are outside v1. Document a scope decision before adding any of them.

## Review evidence

Demonstrate numerical correctness, an edge case, a visible scheduling decision, a saved/imported scenario, and one integrated blocking example. Explain the chosen assumptions and where the model simplifies an actual OS. A polished screen with incorrect metrics does not satisfy the project.
