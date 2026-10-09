# OS Lab Simulator

A browser-only educational OS workbench. **Phase 1 is implemented:** application shell, accessible navigation, typed engine contracts, immutable fixture frames, event inspection, and deterministic replay. CPU algorithms are the next phase. No backend, account, telemetry, or runtime AI service is used.

## Local setup

Use Node **24.13.0** (also recorded in `.nvmrc`) and npm. From this folder:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally **http://127.0.0.1:5173**. The default route is the CPU workspace's explicitly labeled fixture preview. Hash routes work on refresh. The fixture scripts P1 then P2; it is not a CPU scheduler. Edit durations, run, pause, step, select an event, reset, and replay. Speed changes cursor timing only.

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
| `npm run test:e2e`     | Playwright desktop, tablet, and narrow browser checks                   |
| `npm run build`        | Typecheck and production build into `dist/`                             |
| `npm run preview`      | Locally serve the production build                                      |

Playwright starts its own server at port 4173 and uses installed Google Chrome (`channel: 'chrome'`). Install Chrome first if unavailable; alternatively configure Playwright's bundled Chromium and install it with `npx playwright install chromium`. Screenshots are written to `artifacts/`; failure traces are in ignored `test-results/`. Port 4173 must be available or already serving this app.

## Architecture

- `src/engine/`: pure typed input/result/event contracts and an explicitly scripted preview; no React, DOM, timers, or storage.
- `src/app/`: Context and reducers, hash navigation, cursor playback, and the timer adapter. The timer selects frames; it never recalculates a result.
- `src/features/foundation/`: editable fixture, selected-frame timeline/queue/ledger, and event explanations.
- `src/components/`: accessible primitives and native SVG timeline with an equivalent table.
- `src/styles/`: specification tokens and responsive workbench.
- `tests/unit/` and `tests/browser/`: deterministic transitions, invariants, replay immutability, validation, keyboard, routes, and layout evidence.

An event at sequence `n` produces frame `n + 1`; frame 0 has no event. Results and nested snapshots are frozen. Source edits pause playback and invalidate the trace. Navigating away pauses playback and preserves the fixture. Inspector selections, metrics so far, queue, and ledger all use the same frame.

## Phase boundaries

Phase 2 adds FCFS, non-preemptive SJF, non-preemptive Priority, and Round Robin using `prompts/PHASE_02_CPU.md`. Later routes are honest availability screens. Recharts, React Flow, localStorage, JSON transfer, comparisons, and integrated behavior will be introduced in their specified phases. No deployment has been performed.

The Markdown specification pack is the implementation contract. See `BUILD_STATUS.md` for commands actually run, verification evidence, limitations, and the next task.

Setup was checked against the official [Vite guide](https://vite.dev/guide/), [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite), and [Playwright installation requirements](https://playwright.dev/docs/intro). Dependencies resolve once into the committed npm lockfile; use `npm ci` afterward.
