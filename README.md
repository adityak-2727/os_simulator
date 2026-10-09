# OS Lab Simulator

A browser-only educational OS workbench with real CPU scheduling, contiguous memory allocation, and page replacement. Edit a workload, inspect its deterministic replay, and compare algorithms on identical inputs. No backend, account, telemetry, or runtime AI service is used.

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

## Commands

| Command                | Purpose                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `npm run dev`          | Start local Vite development server                                     |
| `npm run typecheck`    | Strict TypeScript checking of source, configurations, and tests         |
| `npm run lint`         | ESLint TypeScript and React rules                                       |
| `npm run format`       | Format application files and README, preserving specification documents |
| `npm run format:check` | Check application formatting                                            |
| `npm test`             | Vitest watch mode                                                       |
| `npm run test:run`     | One-shot unit and replay tests                                          |
| `npm run test:e2e`     | Playwright checks at 1440, 1024, 768, and 390 px                        |
| `npm run build`        | Typecheck and production build into `dist/`                             |
| `npm run preview`      | Locally serve the production build                                      |

Playwright starts its own server at port 4173 and uses installed Google Chrome (`channel: 'chrome'`). Install Chrome first if unavailable; alternatively configure Playwright's bundled Chromium and install it with `npx playwright install chromium`. Screenshots are written to `artifacts/`; failure traces are in ignored `test-results/`. Port 4173 must be available or already serving this app.

## Architecture

- `src/engine/cpu/`: pure validation, four schedulers, immutable snapshots, metrics, and same-input comparison; no React, DOM, timers, or storage. `src/engine/preview.ts` retains the scripted foundation preview.
- `src/engine/memory/`: pure allocation/paging validation, immutable operation/reference snapshots, actual decision reasons, and three-algorithm comparisons.
- `src/app/`: Context and reducers, hash navigation, cursor playback, and the timer adapter. The timer selects frames; it never recalculates a result.
- `src/features/foundation/`: editable fixture, selected-frame timeline/queue/ledger, and event explanations.
- `src/features/cpu/`: workload editing, Context/reducer state, SVG timeline, queue, process results, actual-event explanations, and lazily loaded Recharts comparison.
- `src/features/memory/`: independent allocation/paging draft and replay states, ordered operation editing, address-labeled SVG map and ledger, reference cursor/history, event inspection, and lazy Recharts comparisons.
- `src/components/`: accessible primitives and native SVG timeline with an equivalent table.
- `src/styles/`: specification tokens and responsive workbench.
- `tests/unit/` and `tests/browser/`: deterministic transitions, invariants, replay immutability, validation, keyboard, routes, and layout evidence.

An event at sequence `n` produces frame `n + 1`; frame 0 has no event. Results and nested snapshots are frozen. Source edits pause playback and invalidate the trace. Navigating away pauses playback and preserves inputs. Timeline, metrics, ready queue, process rows, and inspector all use the same frame. Completed-only averages are labeled separately from final averages; incomplete CT/TAT/WT values show “—”.

The CPU model uses integer time units, one positive burst per process, zero context-switch cost, and no I/O. Smaller priority numbers win. Ties preserve arrival/input order. At a Round Robin boundary, completion precedes same-time arrivals, which precede an unfinished process's requeue. Inputs allow 1–50 processes, arrivals 0–10,000, burst/quantum 1–1,000, and priority 0–999. A 50,000-event budget rejects overly dense traces with a descriptive error. Long timelines use labeled windows with Earlier/Later/Follow cursor controls and an equivalent interval table.

Memory uses integer KiB and half-open ranges `[start, end)`, with capacity 1–65,536 KiB and 1–200 operations. Allocation consumes the low-address end of the selected hole; free coalesces both sides. Failed fits, duplicate live IDs, and unknown frees are visible rejected steps with unchanged memory. Malformed fields stop a run. Free space outside the largest hole is labeled as a KiB count, not a fragmentation percentage; exact partitions add no internal overhead.

Paging supports 1–12 frames, 1–200 references, and page IDs 0–9,999. Empty frames fill from index 0 upward. FIFO hits preserve insertion order; LRU hits update recency; Optimal knows future references and breaks ties by frame index. Counts and ratios use only processed references; ratios are unavailable at step 0. Memory and paging use steps, without a simulated millisecond cost. Navigating away pauses playback and preserves each lab's independent inputs.

## Build boundaries

Foundation, CPU scheduling, allocation, and paging are implemented. The next task is `prompts/PHASE_04_DEADLOCK.md`: resource graphs and Banker's calculations. Later routes are honest availability screens. Save/export, versioned localStorage, JSON transfer, and integrated experiments belong to the integration milestone; React Flow arrives with resource graphs. No deployment has been performed.

The Markdown specification pack is the implementation contract. See `BUILD_STATUS.md` for commands actually run, verification evidence, limitations, and the next task.

Setup was checked against the official [Vite guide](https://vite.dev/guide/), [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite), and [Playwright installation requirements](https://playwright.dev/docs/intro). Dependencies resolve once into the committed npm lockfile; use `npm ci` afterward.
