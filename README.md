# OS Lab Simulator

An interactive operating systems laboratory for exploring algorithms through calculated, deterministic simulations and replayable events.

- Explore CPU scheduling, memory allocation, page replacement, resource safety, synchronization, disk scheduling, and combined CPU-memory-resource behavior.
- Edit scenarios, run them, step through immutable frames, and compare algorithms on the same input.
- Save experiments in browser storage, transfer them as JSON, and export calculated results as CSV.
- Runs in the browser with no backend, account, telemetry, or AI service.

## Quick start

Use Node.js **24.13.0** (the version in `.nvmrc`) and npm. From the repository folder, run:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. The app starts at `#/cpu`. Keep the terminal open while using it; press **Ctrl+C** to stop the server.

## Labs

| Lab                          | Route               | Algorithms / features                                                                                         | Try this                                                                                                            |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| CPU scheduling               | `#/cpu`             | FCFS, non-preemptive SJF, non-preemptive Priority, and Round Robin; timeline, queue, metrics, and comparisons | Load the Round Robin reference with quantum 2, then step through dispatch and requeue decisions.                    |
| Memory allocation            | `#/allocation`      | First Fit, Best Fit, Worst Fit; allocate, free, and coalesce adjacent holes                                   | Choose **Fragmentation failure** to inspect a rejected 400 KiB request while 524 KiB remains free.                  |
| Page replacement             | `#/paging`          | FIFO, LRU, and Optimal; frame history, hits, faults, and comparisons                                          | The reference sequence produces **10, 9, and 7 faults**, respectively.                                              |
| Deadlock and resource safety | `#/deadlock`        | Single-instance resource graphs and Banker’s safety calculation with transactional requests                   | Inspect the graph cycle, then run Banker’s reference case: `P1, P3, P0, P2, P4`.                                    |
| Synchronization              | `#/synchronization` | Shared-counter race, mutex protection, and semaphore producer-consumer interleavings                          | The unprotected increment ends at **x = 1**; the mutex-protected example ends at **x = 2**.                         |
| Disk scheduling              | `#/disk`            | FCFS, SSTF, SCAN, and C-SCAN; cylinder path, service order, and movement comparison                           | The reference batch moves **640, 236, 331, and 382 cylinders**, in that algorithm order.                            |
| Integrated system            | `#/system`          | Round Robin CPU scheduling, first-fit memory admission, and FIFO resource queues                              | The reference completion times are **7, 6, and 8**; P2 waits 2 time units for a resource and P3 waits 4 for memory. |
| Experiments                  | `#/experiments`     | Browse, rename, duplicate, delete, import, and open saved scenarios                                           | Save a lab scenario, export its JSON, then import it to validate and recompute a fresh trace.                       |
| Replay preview               | `#/replay-preview`  | A small scripted example of replay controls and event explanations                                            | Step through the preview to see how a selected event and frame work together.                                       |

The numbers above are sanity checks for the reference scenarios. The app calculates results from the current inputs; the fixtures in `fixtures/` are test data.

## How to use it

1. Choose a lab and load an example or edit its inputs. Invalid fields stay visible with a description, and the app does not run an invalid scenario.
2. Select **Run** to calculate the trace. Editing an input stops playback and clears the result for that scenario.
3. Use play, pause, step, and seek controls to inspect events. Changing animation speed changes how quickly frames are shown; it does not change simulated time or the result.
4. Use **Compare algorithms** where available to calculate each method against the same inputs and inspect its trace and metrics.
5. Save scenarios in this browser, export or import experiment JSON, and download result CSV from a real lab. CSV contains calculated results; it is not an experiment-import format.

Saved experiments use browser storage for the current site origin. Saves do not sync between browsers or devices. An imported experiment is validated and recomputed from its source scenario.

## Scripts

| Command                   | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `npm run dev`             | Start the local development server.                                  |
| `npm run build`           | Typecheck and create the production site bundle.                     |
| `npm run preview`         | Serve the production bundle locally.                                 |
| `npm run typecheck`       | Check TypeScript types.                                              |
| `npm run lint`            | Run ESLint over the repository.                                      |
| `npm run format`          | Format source, tests, scripts, configuration files, and this README. |
| `npm run format:check`    | Check formatting for the same files without writing changes.         |
| `npm test`                | Start Vitest in watch mode.                                          |
| `npm run test:run`        | Run the unit test suite once.                                        |
| `npm run test:e2e`        | Run the Playwright browser suite against the development server.     |
| `npm run test:production` | Run browser checks against the production preview.                   |
| `npm run test:pages`      | Run the GitHub Pages path and hosting checks.                        |
| `npm run build:pages`     | Create a site bundle for the repository Pages path.                  |
| `npm run licenses`        | Refresh the dependency license inventory and runtime notices.        |
| `npm run licenses:check`  | Check the dependency license inventory and runtime notices.          |

## Testing

- **Unit tests:** `npm run test:run` runs Vitest tests for algorithms, validation, state transitions, and replay behavior.
- **Browser tests:** `npm run test:e2e` runs Playwright flows at 1440, 1024, 768, and 390 pixels wide. It starts the development server on port **4173**.
- **Production checks:** run `npm run build` first, then `npm run test:production`. This starts a local production preview on port **4173** and checks the built app. Performance specs are excluded from this mode.
- **Pages checks:** run `npm run build:pages` first, then `npm run test:pages`. This checks the repository base path and its hosting flow on port **4173**.

Playwright uses installed Google Chrome by default on a local run. To use its bundled Chromium instead, set `PLAYWRIGHT_CHANNEL=chromium` and install it with `npx playwright install chromium`. The CI workflow installs Chromium with `npx playwright install --with-deps chromium`. Keep port 4173 available for production and Pages checks; the development run can reuse an existing local server outside CI.

## Project structure

```text
src/
├── engine/        Pure algorithm engines, validators, events, and immutable frames
├── features/      Lab editors, replay views, timelines, and comparisons
├── app/           Navigation, shared context, reducers, and replay cursor
├── experiments/   Browser storage, validation, and JSON/CSV transfer
└── components/    Shared interface components and preview timeline
tests/
├── unit/          Engine, validation, reducer, and replay tests
└── browser/       Playwright lab, interaction, and hosting tests
fixtures/          Hand-derived inputs and expected results for tests
scripts/           Browser-check, Pages-bundle, and license-inventory commands
```

The core rule is that pure engines calculate ordered events and immutable replay frames. The interface selects one frame; timelines, metrics, queues, and explanations all read from that same selection. Playback controls the cursor, not the simulation result. Tests use fixtures as oracles; the app computes answers from user inputs.

Contributors can make algorithm changes under `src/engine/`, lab interface changes under `src/features/`, and cover them with tests under `tests/unit/` or `tests/browser/`. `.github/workflows/quality.yml` runs checks on pushes and pull requests to `main`.

## Deploying to GitHub Pages

Run:

```sh
npm run build:pages
```

The bundle uses the base path **`/os_simulator/`**. `deployment/github-pages.yml.example` is an inactive workflow template; it does not publish the site. No live site is claimed here. Publication requires enabling a workflow and configuring GitHub Pages for the repository.

## Model limits

| Model                         | Supported bounds                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| IDs and experiment names      | IDs: 1–24 letters, digits, underscores, or hyphens; names: 1–80 trimmed characters.                                                              |
| CPU scheduling                | 1–50 processes; arrival 0–10,000 time units; burst and quantum 1–1,000 time units; priority 0–999.                                               |
| Memory allocation             | Capacity 1–65,536 KiB; 1–200 ordered operations.                                                                                                 |
| Page replacement              | 1–12 frames; 1–200 references; page IDs 0–9,999.                                                                                                 |
| Resource graph                | 1–12 processes and 1–12 resources, with one instance per resource.                                                                               |
| Banker’s algorithm            | 1–10 processes; 1–8 resources; instance values 0–1,000; allocation cannot exceed Max or Total.                                                   |
| Synchronization               | 2–4 processes; 1–100 instructions per process; buffer capacity 1–10; at most 1,000 scheduled choices.                                            |
| Disk scheduling               | 1–100 requests; maximum cylinder 1–100,000; head and requests stay within `0..maxCylinder`.                                                      |
| Integrated system             | 1–20 processes; up to 8 resources; 1–100 instructions per process; positive CPU work is required. CPU and memory inputs follow their lab bounds. |
| Transfer, storage, and replay | JSON imports up to 1 MiB; up to 30 saved experiments; up to 50,000 events per trace.                                                             |

<details>
<summary>Algorithm and replay details</summary>

- CPU time uses integer units. Ties preserve input order; smaller priority numbers win. At a Round Robin boundary, completion comes before same-time arrivals, then an unfinished process returns to the queue.
- CPU jobs have one burst, with no I/O or context-switch cost. Allocation uses integer KiB, assigns the low-address end of a free region, and coalesces adjacent freed regions. Address ranges are half-open; a rejected operation leaves memory unchanged.
- Paging starts with empty frames. FIFO hits preserve insertion order, LRU hits update recency, and Optimal uses future references. Fault and hit ratios count only references processed so far.
- Banker’s safety sequence simulates possible completions; it does not release real allocations. An unsafe request is rolled back. A resource-graph cycle proves deadlock only when each resource has one instance.
- Synchronization steps are instruction positions, not elapsed CPU time. A blocked lock or wait retains its instruction position until FIFO handoff completes it once. A stalled schedule does not by itself prove deadlock.
- Disk requests at the same cylinder remain separate requests. SSTF ties use the smaller cylinder, then input order. SCAN and C-SCAN may travel to an endpoint; C-SCAN counts its full wrap distance, and the wrap serves no requests.
- Integrated acquire and release instructions consume no simulated time. CPU service and ready, resource, and memory waits remain separate parts of turnaround.

</details>

### Known limitations

- These are teaching models, not operating-system kernel simulations. They do not run native processes, threads, or device operations.
- Synchronization choices represent modeled instructions; they do not create host threads. Disk paths count cylinder movement, not real latency, rotational delay, caching, or SSD behavior.
- Calculations run synchronously in the browser. Very large valid traces can briefly pause interaction while the engine computes them.
- Saved experiments belong to the browser’s local site storage. They do not sync across devices, and the app does not guarantee a full offline reload.
- Browser automation and accessibility checks do not replace evaluation with screen readers and users.
