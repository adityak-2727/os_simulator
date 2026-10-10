# OS Lab Simulator

A browser-only educational OS workbench with CPU scheduling, contiguous allocation, paging, resource safety, synchronization, disk scheduling, and an integrated CPU-memory-resource engine. Edit a workload, inspect its deterministic replay, compare algorithms on identical inputs, and save source experiments locally. No backend, account, telemetry, or runtime AI service is used.

## Local setup

Use Node **24.13.0** (also recorded in `.nvmrc`) and npm. From this folder:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally **http://127.0.0.1:5173**. The default route is **`#/cpu`**. Load the reference example, run or step through it, inspect the ready queue and event explanation, and select **Compare algorithms**. The comparison includes exact metric tables and links to each computed trace. Hash routes work on refresh. Speed changes playback timing only; editing an input stops playback and invalidates the result.

The original scripted foundation preview remains available through Help at **`#/replay-preview`**. It is explicitly labeled and independent of the real scheduler.

Open **`#/allocation`** for First Fit, Best Fit, and Worst Fit. Load Hole selection to compare E's address, Fragmentation failure to inspect a rejected 400 KiB request, or Free and coalesce to see adjacent holes merge. Edit, add, remove, and reorder allocate/free operations. The address map, exact ledger, metrics, and explanation all use the selected operation step.

Open **`#/paging`** for FIFO, LRU, and Optimal. Enter page IDs separated by commas or spaces, select a frame count, and inspect references, resident pages, and frame history. The reference example produces 10, 9, and 7 faults respectively. These results are calculated by the engines; reference fixtures are only imported by tests. Comparisons include exact tables and links to each computed trace.

## Resource safety

Open **`#/deadlock`** for single-instance resource graphs and **Banker’s algorithm**. Graph configuration supports keyboard operations to request, cancel, grant, and release resources; the React Flow canvas and edge/ownership tables show the same selected frame. Run the cycle example to inspect `P1 → R2 → P2 → R1 → P1`. Graph mode supports one instance per resource; multiple instances belong in Banker mode.

Banker derives Available and Need from the editable Total, Allocation, and Max inputs. **Run** starts safety analysis when no trace exists, or resumes/replays the current trace. **Evaluate request** starts a new transactional trace. The reference calculation selects `P1, P3, P0, P2, P4` by restarting at input row 0 after every simulated completion. Work and Finish simulate potential completion without releasing actual resources. A grant commits at the decision frame; a rejected request retains the exact original state. The request examples reset to the original matrices independently. **Continue from granted state** explicitly adopts the committed allocation for your next request while keeping the current run’s source immutable until then.

Safe, unsafe, availability wait, safety wait, invalid request, and graph-deadlocked conclusions are distinct. Unsafe does not prove current deadlock, and an acyclic graph can still contain pending requests. Resource steps represent ordered decisions, not elapsed simulation time.

## Synchronization

Open **`#/synchronization`** for the shared-counter race, mutex-protected counter, and bounded FIFO producer-consumer presets. Each process executes one atomic model instruction per selected choice. Programs use one instruction per line, such as `read-counter r`, `add-local r 1`, `write-counter r`, `lock m`, `unlock m`, `wait empty`, `signal full`, `enqueue A`, or `dequeue item`. The instruction reference in the editor describes the syntax and limits. This interpreter does not execute arbitrary JavaScript.

**Run** consumes the supplied process schedule. **Manual choices** lets you step a runnable process from the selected frame. A matching recorded choice advances through the existing trace. A different choice after rewind requires **Branch and step**, which visibly discards the future schedule; Cancel preserves it. **Start empty manual schedule** clears the schedule for a new experiment. Program edits invalidate the trace; switching selection mode or playback speed preserves it.

The alternating unprotected increments calculate x=1; the protected example calculates x=2. Inspect PCs, local registers, and the source-read explanation to see the lost update. A blocked lock or wait keeps its PC until a FIFO handoff completes the instruction exactly once. Mutex unlock is owner-only; counting semaphores have no ownership. Producer-consumer shows actual FIFO contents, consumed items, and in-flight permits before and after the buffer change. Semaphore counts do not equal immediate occupancy between wait and signal.

An exhausted schedule with runnable programs is **Awaiting choice**. All programs finished means **Completed**; unfinished programs with no runnable process means **Stalled**, without asserting a proven deadlock. Invalid source input prevents execution. Recursive locks, non-owner unlocks, uninitialized arithmetic, and full/empty or unowned buffer access produce explicit atomic model errors with unchanged instruction state. Scripted blocked/completed choices are visible rejected events; manual invalid choices leave the trace unchanged.

The model supports 2–4 processes, 1–100 instructions per process, buffer capacity 1–10, and 0–1,000 scheduled choices. Steps and PCs are instruction positions, not elapsed CPU time. All calculations run synchronously in the pure interpreter; playback only selects immutable frames.

## Disk scheduling

Open **`#/disk`** for FCFS, SSTF, SCAN, and C-SCAN over a static batch. Edit the initial head, inclusive range `0..maxCylinder`, sweep direction, request IDs, cylinders, and input order. Add/remove and earlier/later controls preserve request identity. Duplicate cylinder values are valid separate requests; request IDs are unique. Inputs support 1–100 requests and maximum cylinder 1–100,000. Empty input asks for a request and disables execution.

The native SVG path uses a uniform cylinder axis and a **step** axis. Only processed moves are drawn. Blue service moves consume one request ID, ochre endpoint decisions consume none, and dashed violet wraps consume none. Long paths use 12-move windows with Earlier/Later/Follow cursor controls and a keyboard-selectable equivalent ledger. Long request labels shorten in the plot with full IDs in tooltips and tables. Head position, pending/served rows, service order, movement metrics, and event explanation share one selected replay frame.

SCAN and C-SCAN reach the physical endpoint if opposite-side requests remain, even if the first direction has no requests. C-SCAN counts the entire wrap distance and performs no service along the wrap. An already-reached endpoint decision is visible with zero distance. All algorithms stop after the last service. SSTF ties use smaller cylinder, then input order; sweeps serve initial-head requests first and preserve duplicate order. FCFS preserves input order even when a later request is already at the head.

**Compare algorithms** calculates four final results from identical inputs: the reference batch produces **640, 236, 331, and 382 cylinders**. The numeric table includes average cylinders per request, endpoint travel, and wrap travel; Trace opens each computed replay. These values come from engines, not bundled fixture answers. Replay metrics are labeled so far; the average divides movement so far, including overhead, by requests served and is unavailable before the first service. Movement is not latency; arrivals, rotational/transfer costs, caching, and SSD behavior are outside the model.

## Commands

Open **`#/system`** for integrated Round Robin, first-fit memory admission and single-instance resource FIFO queues. Programs contain finite `cpu <duration>`, `acquire <resource>` and `release <resource>` instructions. Acquire/release consume zero time. Each dispatch grants a fresh quantum; arrivals inside it do not renew it. Following zero-time operations and completion cleanup precede arrivals, wake-ups, memory admission and quantum requeue. Strict FIFO memory admission can prevent a smaller later process from bypassing the head. Blocked processes retain memory.

The reference calculates completion times **7, 6, 8**. P2 resource wait is **2 t**; P3 memory wait is **4 t**. CPU service, ready waiting, resource waiting and memory waiting stay separate; their sum equals completed turnaround. First positive CPU service determines response. Timeline intervals, memory addresses, ownership, queues, PCs, metrics and explanations all use the same immutable selected frame. The cycle example proves a two-resource wait cycle; invalid owner release produces a model error. Paging and disk remain independent labs. Dashboard summarizes only the active integrated frame and links to saved experiments.

Use **Save experiment**, **Export JSON**, or **Export results CSV** from any real lab. **`#/experiments`** supports module filtering, rename, duplicate with a new identity, targeted delete confirmation, import review and opening. Opening revalidates and recomputes a fresh trace, paused at frame 0. CSV clearly exports final results, including the complete integrated event/interval ledger, and escapes spreadsheet formula markers in user text.

Experiment JSON uses `format: os-lab-simulator`, schema version 1, save metadata, the module's engine semantic version and its source scenario. Expected-result fixture packs are not importable experiments. JSON imports are limited to 1 MiB, local collections to 30 experiments, integrated input to 20 processes/8 resources/100 instructions per process, and traces to 50,000 events. Storage uses `os-lab-simulator.experiments.v1` and a separate `os-lab-simulator.preferences.v1` key. Quota, security and corrupt-storage failures preserve active work and offer JSON export. A collection that cannot be validated is not overwritten. Existing saves can be exported from the list; an unavailable browser storage policy must be resolved in browser settings before saving.

Source specifications in `docs/`, phase prompts in `prompts/`, and generated `artifacts/` are intentionally local and ignored by Git at the user's request. Numerical fixtures remain tracked as test oracles. See [RELEASE_HANDOVER.md](RELEASE_HANDOVER.md) for the requirements-to-tests map, architecture explanation, five-minute demo and remaining limits. No deployment has been performed.

| Command                   | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`             | Start local Vite development server                                     |
| `npm run typecheck`       | Strict TypeScript checking of source, configurations, and tests         |
| `npm run lint`            | ESLint TypeScript and React rules                                       |
| `npm run format`          | Format application files and README, preserving specification documents |
| `npm run format:check`    | Check application formatting                                            |
| `npm test`                | Vitest watch mode                                                       |
| `npm run test:run`        | One-shot unit and replay tests                                          |
| `npm run test:e2e`        | Playwright checks at 1440, 1024, 768, and 390 px                        |
| `npm run test:production` | Functional and accessibility checks against the built production app    |
| `npm run build:pages`     | Build assets for the exact `/os_simulator/` repository path             |
| `npm run test:pages`      | Verify repository-path assets, hash refresh and experiment transfer     |
| `npm run licenses`        | Regenerate locked dependency inventory and runtime notices              |
| `npm run licenses:check`  | Check inventory and license notices against the lockfile                |
| `npm run build`           | Typecheck and production build into `dist/`                             |
| `npm run preview`         | Locally serve the production build                                      |

Playwright starts its own server at port 4173. Local checks use installed Google Chrome; CI uses bundled Chromium installed with `npx playwright install --with-deps chromium`. To use Chromium locally, set `PLAYWRIGHT_CHANNEL=chromium` and run `npx playwright install chromium`. Generated screenshots in `artifacts/`, failure traces in `test-results/`, and reports in `playwright-report/` are ignored by Git. Existing local screenshots are preserved. Stop other servers on port 4173 before production/path checks. Performance checks import pure source engines from the development server and are excluded from the production runner. Use `npm run test:production -- --workers=1` after building; a single worker avoids concurrent Chrome startup contention on this machine. The hosting smoke test runs only with `npm run test:pages` after `npm run build:pages`.

## Architecture

- `src/engine/cpu/`: pure validation, four schedulers, immutable snapshots, metrics, and same-input comparison; no React, DOM, timers, or storage. `src/engine/preview.ts` retains the scripted foundation preview.
- `src/engine/memory/`: pure allocation/paging validation, immutable operation/reference snapshots, actual decision reasons, and three-algorithm comparisons.
- `src/engine/deadlock/`: pure single-instance graph validation/editing/cycle search, matrix validation, deterministic Banker safety, and tentative requests with atomic commit or exact rollback.
- `src/engine/synchronization/`: pure typed instruction interpretation, FIFO mutex/semaphore handoffs, counter-read provenance, bounded buffer and permit reservations, immutable transitions, and schedule branching. `src/engine/scenarios.ts` collects the implemented scenario types.
- `src/engine/disk/`: pure disk validation, static-batch scheduling, typed service/endpoint/wrap events, immutable snapshots, movement metrics, and same-input comparison.
- `src/app/`: Context and reducers, hash navigation, cursor playback, and the timer adapter. The timer selects frames; it never recalculates a result.
- `src/features/foundation/`: editable fixture, selected-frame timeline/queue/ledger, and event explanations.
- `src/features/cpu/`: workload editing, Context/reducer state, SVG timeline, queue, process results, actual-event explanations, and lazily loaded Recharts comparison.
- `src/features/memory/`: independent allocation/paging draft and replay states, ordered operation editing, address-labeled SVG map and ledger, reference cursor/history, event inspection, and lazy Recharts comparisons.
- `src/features/deadlock/`: independent graph/Banker drafts, Context/reducer playback, keyboard editors, lazy React Flow canvas, actual/tentative matrices, Work/Finish traces, and actual-event explanations.
- `src/features/synchronization/`: typed program editor, scripted/manual selection, explicit branch review, Context/reducer playback, code PCs, local/shared data, ownership/wait tables, FIFO slots, and actual-event learning content.
- `src/features/disk/`: request editor, Context/reducer playback, cylinder-scaled windowed SVG path, equivalent movement ledger, pending/service rows, actual decision explanations, and lazy Recharts comparison.
- `src/engine/system/` and `src/features/system/`: pure integrated scheduling and one-frame CPU/memory/resource/queue/waiting views.
- `src/experiments/`: strict versioned envelope validation, storage failure recovery, source loading and exports.
- `src/components/`: accessible primitives and native SVG timeline with an equivalent table.
- `src/styles/`: specification tokens and responsive workbench.
- `tests/unit/` and `tests/browser/`: deterministic transitions, invariants, replay immutability, validation, keyboard, routes, and layout evidence.

An event at sequence `n` produces frame `n + 1`; frame 0 has no event. Results and nested snapshots are frozen. Source edits pause playback and invalidate the trace. Navigating away pauses playback and preserves inputs. Timeline, metrics, ready queue, process rows, and inspector all use the same frame. Completed-only averages are labeled separately from final averages; incomplete CT/TAT/WT values show “—”.

The CPU model uses integer time units, one positive burst per process, zero context-switch cost, and no I/O. Smaller priority numbers win. Ties preserve arrival/input order. At a Round Robin boundary, completion precedes same-time arrivals, which precede an unfinished process's requeue. Inputs allow 1–50 processes, arrivals 0–10,000, burst/quantum 1–1,000, and priority 0–999. A 50,000-event budget rejects overly dense traces with a descriptive error. Long timelines use labeled windows with Earlier/Later/Follow cursor controls and an equivalent interval table.

Memory uses integer KiB and half-open ranges `[start, end)`, with capacity 1–65,536 KiB and 1–200 operations. Allocation consumes the low-address end of the selected hole; free coalesces both sides. Failed fits, duplicate live IDs, and unknown frees are visible rejected steps with unchanged memory. Malformed fields stop a run. Free space outside the largest hole is labeled as a KiB count, not a fragmentation percentage; exact partitions add no internal overhead.

Paging supports 1–12 frames, 1–200 references, and page IDs 0–9,999. Empty frames fill from index 0 upward. FIFO hits preserve insertion order; LRU hits update recency; Optimal knows future references and breaks ties by frame index. Counts and ratios use only processed references; ratios are unavailable at step 0. Memory and paging use steps, without a simulated millisecond cost. Navigating away pauses playback and preserves each lab's independent inputs.

## Supported limits

| Model                       | Bound                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| IDs / experiment names      | IDs: 1–24 letters, digits, underscore or hyphen; names: 1–80 trimmed characters                                                  |
| CPU                         | 1–50 processes; arrivals 0–10,000 t; burst/quantum 1–1,000 t; priority 0–999                                                     |
| Allocation                  | Capacity 1–65,536 KiB; 1–200 ordered operations                                                                                  |
| Paging                      | 1–12 frames; 1–200 references; pages 0–9,999                                                                                     |
| Resource graph              | 1–12 processes and 1–12 single-instance resources                                                                                |
| Banker                      | 1–10 processes; 1–8 resources; instance values 0–1,000; Allocation ≤ Max and column allocation ≤ Total                           |
| Synchronization             | 2–4 processes; 1–100 instructions each; buffer 1–10 items; at most 1,000 choices                                                 |
| Disk                        | 1–100 requests; maximum cylinder 1–100,000; head and requests within 0..maximum                                                  |
| Integrated                  | 1–20 processes; up to 8 resources; 1–100 instructions each; positive CPU work required; CPU/allocation arrival and memory bounds |
| Transfer / storage / replay | JSON ≤1 MiB; 30 saved experiments; 50,000 events per trace                                                                       |

Malformed fields remain editable. Valid model operations can still fail, block or produce unsafe/stalled states with explanations. Unsafe Banker requests retain source matrices. Saving a computed Banker analysis preserves whether it was safety-only or a request; when no analysis exists, export uses the configured request fields.

## Static hosting and release scope

`npm run build` creates a root-path static bundle. `npm run build:pages` uses `/os_simulator/` for the supplied repository. Verify it locally with `npm run test:pages -- --workers=1`. Hash navigation supports direct lab refresh without host rewrites. The prepared candidate GitHub Pages address is `https://adityak-2727.github.io/os_simulator/`; this does not claim the site is live. The inactive template `deployment/github-pages.yml.example` must be enabled only when publication is requested. `.github/workflows/quality.yml` runs checks only with read-only permissions. Hosted-origin asset/refresh/storage/import checks remain pending until a deployment is requested. Origin-specific saves transfer using JSON.

The action and path configuration follows the official [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [Vite static deployment](https://vite.dev/guide/static-deploy.html), and [Playwright CI](https://playwright.dev/docs/ci) documentation. Locked dependency versions and licenses are in [DEPENDENCIES.md](DEPENDENCIES.md). Runtime notices ship as `THIRD_PARTY_NOTICES.txt` in `dist/`; `npm run licenses:check` prevents stale notices.

Foundation, all six standalone labs, integrated CPU-memory-resource replay, saved experiments, comparison and learning workflows are implemented. This is v1.0.0 release preparation. Engines are synchronous teaching models, not kernel monitoring or native execution. There is no full offline reload guarantee or cross-device storage. Browser/axe coverage does not replace screen-reader and user evaluation. No deployment has been performed. No later implementation phase is required after the recorded release gate.

The Markdown specification pack is the implementation contract. See `BUILD_STATUS.md` for commands actually run, verification evidence, limitations, and the next task.

Setup was checked against the official [Vite guide](https://vite.dev/guide/), [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite), [Playwright installation requirements](https://playwright.dev/docs/intro), and [React Flow documentation](https://reactflow.dev/learn). Dependencies resolve once into the committed npm lockfile; use `npm ci` afterward.
