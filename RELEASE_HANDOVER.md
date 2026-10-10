# OS Lab Simulator v1.0.0 handover

Release preparation date: 2026-10-10. The release changes are identified by the Git commit containing this document. All eight implementation stages are complete; the final gate is recorded in BUILD_STATUS.md. No public deployment has been performed.

## What works

The browser workbench implements four CPU schedulers, three allocation strategies, three page replacement algorithms, single-instance resource graphs, Banker safety and transactional requests, counter/mutex/semaphore interleavings, four disk schedulers, and integrated RR/first-fit/resource blocking. All real labs support validated source JSON and final-result CSV export. Experiments support local save, rename, duplicate, targeted deletion, import review, and fresh recomputation. Help and guided exercises explain the actual model.

Release fixes preserve Banker safety when exporting and reopening an analysis, improve graph attribution contrast, and announce manually selected resource/synchronization/integrated steps while suppressing autoplay announcements. Runtime licenses ship with the static build. CI checks the lockfile install, engines, development browser flows, production browser flows, and repository-path assets. It has read-only repository permissions and no publishing job.

## Requirements and verification map

| Requirement                                 | Independent evidence                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| FR01 shell, navigation, accessibility       | foundation.spec.ts; release.spec.ts; four viewport projects                                               |
| FR02 immutable replay, clocks, invalidation | replay.test.ts; module reducer tests; browser stepping/rewind/speed/edit cases                            |
| FR03 CPU                                    | cpu.json oracle; cpu.test.ts; cpu.spec.ts; cpu-performance.spec.ts                                        |
| FR04 allocation                             | allocation.json oracle; memory.test.ts; memory.spec.ts; address conservation/coalescing                   |
| FR05 paging                                 | paging.json oracle; memory.test.ts; memory.spec.ts; frame/hit/fault invariants                            |
| FR06 graph                                  | deadlock.json oracle; deadlock.test.ts; deadlock.spec.ts; keyboard edge editing                           |
| FR07 Banker                                 | deadlock.test.ts; deadlockState.test.ts; deadlock.spec.ts; release.spec.ts safety export regression       |
| FR08 synchronization                        | synchronization.json oracle; synchronization.test.ts; syncState.test.ts; synchronization.spec.ts          |
| FR09 disk                                   | disk.json oracle; disk.test.ts; diskState.test.ts; disk.spec.ts; exact movement ledgers                   |
| FR10 integration                            | integrated.json oracle; system.test.ts; systemState.test.ts; system.spec.ts; waiting decomposition        |
| FR11 storage and transfer                   | experiment-import.json; experiments.test.ts; experiments-storage.spec.ts; system.spec.ts; hosting.spec.ts |
| FR12 explanations and learning              | module browser assertions of actual IDs/reasons/metrics; visible Help and exercises                       |
| FR13 release                                | full recorded gate in BUILD_STATUS.md; release.spec.ts; hosting.spec.ts; this handover                    |

All fixture answers remain test oracles. Application engines calculate results from inputs. An axe audit checks selected WCAG A/AA rules; it is not a claim of formal accessibility certification or testing with every assistive technology.

## Architecture explanation

Pure functions in src/engine accept typed source scenarios and produce ordered events, immutable frames, and typed errors. Simulation time belongs to those results. Context/reducers select one cursor; playback timers only advance it. All integrated panels consume the same snapshot. Editing pauses and invalidates the result; navigation preserves input and pauses playback. Large CPU timelines retain interval prefixes and show bounded windows. Optional comparison charts and the resource graph are lazy-loaded.

Graph cycles prove deadlock only for single-instance reusable resources. Banker safety simulates a possible completion sequence without modifying actual allocation; requests commit only after tentative safety succeeds. Synchronization runs one typed model instruction per choice, with FIFO handoff completing a pending lock/wait exactly once. Integrated turnaround equals CPU service plus ready, resource, and memory waiting; response starts at the first positive CPU service. These are teaching models, not host kernel execution or native threads.

## Reproduction and hosting

Use Node 24.13.0 and npm 11.6.2 with the committed lockfile. Run npm ci, npm run typecheck, npm run lint, npm run format:check, npm run test:run, npm run licenses:check, and npm run build. npm run preview serves dist locally. npm run test:e2e runs development browser flows and measurements; npm run test:production runs functional checks against an automatically started production preview. Stop other servers on port 4173 first. Local tests use installed Chrome; set PLAYWRIGHT_CHANNEL=chromium and install Chromium for CI or another machine.

npm run build:pages creates assets for /os_simulator/. npm run test:pages verifies that exact local prefix. Hash routes need no server rewrite. For a future GitHub Pages publication the candidate origin is https://adityak-2727.github.io/os_simulator/; it is not a live-site claim. deployment/github-pages.yml.example is an inactive manual publication template. Copy it into .github/workflows only after deployment is requested, choose GitHub Actions as the Pages source, and perform hosted-origin checks then. Other root static hosts use npm run build and upload dist. Vite preview is a local review server.

Storage is origin-specific: localhost, a custom domain, and GitHub Pages do not share saves. Transfer via JSON. There are no server credentials or API keys. DEPENDENCIES.md records locked versions/licenses; public/THIRD_PARTY_NOTICES.txt preserves runtime notices, including vendored D3 licenses. Run npm run licenses after dependency changes.

## Five-minute demonstration

| Time      | Action and explanation                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | Open CPU. Explain integer simulated time, pure computation, and a replay cursor independent of speed.                                                                                       |
| 0:30–1:30 | Load reference RR with quantum 2. Run, pause at a dispatch, explain arrivals before requeue, seek the end (CT 9/8/5). Compare SJF using the identical input.                                |
| 1:30–2:15 | Allocation: choose Fragmentation failure and inspect the rejected 400 KiB fit with 524 KiB free. Paging: step a fault and explain the actual evicted page; compare FIFO/LRU/Optimal.        |
| 2:15–3:00 | Deadlock: Banker reference safe sequence P1/P3/P0/P2/P4. Choose P4 request [3,3,0], evaluate, and show safety wait with original matrices restored. Distinguish unsafe from graph deadlock. |
| 3:00–3:45 | Synchronization: run alternating counter-race to x=1, inspect stale reads; load protected counter to x=2. Explain owner-only unlock and FIFO handoff.                                       |
| 3:45–4:15 | Disk: compare reference movement 640/236/331/382 cylinders. Open C-SCAN trace; identify physical endpoint and counted wrap with no service.                                                 |
| 4:15–5:00 | Integrated reference: inspect P2 resource wait and P3 memory wait; end at t=8 with CT 7/6/8. Save, export JSON, and explain recomputation on import.                                        |

## Evidence and remaining limits

Clean install passed on Node 24.13.0 / npm 11.6.2. Typecheck, lint, formatting, license inventory and production build passed. The unit suite passed 198 tests in 14 files. The complete development browser run passed 160 tests at four widths in 6.5 minutes. Production passed 136 functional/accessibility tests in 3.7 minutes. Each suite reserved four repository-path-only cases for the hosting runner; all four of those passed separately. No retries were needed in these final runs.

On Windows Chrome 156.0.8078.4, Intel i7-14700HX (28 logical processors), the teaching CPU example took 0.1–0.2 ms and its near-budget 48,024-event run took 57.7–74.1 ms. Integrated examples took 0.2–0.3 ms; the 20-process / 100-instruction-per-process run produced 4,101 events in 29.8–34.7 ms. Oversized integrated work was rejected before execution in 0.2–0.3 ms. These are local observations, not timing guarantees.

Actual commands, other module timings, screenshot paths, initial failures and fixes are recorded in BUILD_STATUS.md. Generated screenshots and reports remain in ignored artifacts/ and test-results/; the specs and prompts are also intentionally local. The tracked source, fixtures, README, requirements map, lockfile, and scripts reproduce the checks without the ignored pack.

Supported bounds are teaching-size limits documented in README. Engines execute synchronously; near-budget CPU traces may cause a brief computation pause. The app has no Worker, service worker, full offline reload guarantee, native execution, cross-device synchronization, backend, or accounts. Full screen-reader/device coverage and hosted-origin checks require later review. Prepared CI is not called remotely passed before an observed run. No deployment was requested.

Future work is optional: screen-reader/user evaluation, Worker offloading if new measurements justify it, SRTF/aging, LOOK/C-LOOK, and instructor workflows. No additional build phase remains after this release gate.
