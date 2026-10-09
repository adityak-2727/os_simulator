Build OS Lab Simulator in this workspace using the attached specification pack. I am using Codex with GPT-6.1 Sol. Implement working application code, run the available checks, and show the resulting local application. This is an educational OS laboratory with real algorithm implementations and replayable visual explanations.

Start by inspecting the existing workspace and its instructions. Preserve existing work. Read `00_START_HERE.md`, `BUILD_STATUS.md`, `docs/01_PRODUCT_REQUIREMENTS.md`, `docs/02_EIGHT_PHASE_ROADMAP.md`, `docs/03_TECH_STACK_AND_SETUP.md`, and the architecture and design documents needed for the current phase. Read individual algorithm documents when you implement those modules. Treat the Markdown specifications as the implementation contract.

Use React, TypeScript strict mode, Vite, Tailwind CSS, React Context and reducers, native SVG for timelines and memory, Recharts for comparison charts, React Flow for resource graphs, Vitest for engine tests, and Playwright for browser checks. Run the simulator entirely in the browser. Use versioned localStorage and JSON import/export for small saved experiments. Add no backend, authentication, external AI service, or database to v1.

Build exactly these eight phases in order:
1. Foundation, design system, app shell, and deterministic replay infrastructure.
2. CPU scheduling with FCFS, non-preemptive SJF, non-preemptive Priority, and Round Robin.
3. First Fit, Best Fit, Worst Fit, FIFO page replacement, LRU, and Optimal.
4. Single-instance resource graphs, Banker's safety calculation, and transactional resource requests.
5. Shared-counter races, mutexes, and semaphore-based producer-consumer interleavings.
6. FCFS, SSTF, SCAN, and C-SCAN disk scheduling.
7. Integrated CPU-memory-resource behavior, saved experiments, comparison, and learning workflows.
8. Correctness, usability, accessibility, release preparation, documentation, and demo.

Keep algorithm engines pure and independent of the interface. Produce ordered events and immutable replay frames, with separate simulation time and animation speed. All panels must describe the same frame of the same run. CPU charts, metrics, event explanations, and queue views must derive from engine data. Preserve input order for the specified ties. Use the fixtures as test oracles, never as precomputed answers presented as if calculated by the application.

Make the product feel like a carefully designed technical lab tool. Use the light neutral workbench, graphite text, restrained blue actions, thin dividers, compact tables, tabular numerals, and modest corner radii specified in the design document. The central canvas should dominate; configuration belongs on the left and the selected event explanation on the right. Give timelines a clear scale and label memory addresses and disk cylinders. Use process color consistently, with text labels as well. Prefer precise domain content over decorative cards. Do not add a hero banner, fake user statistics, testimonial content, neon gradients, glass panels, or arbitrary animations. This request is about professional visual quality and complete behavior, not concealing AI assistance.

The learning layer must explain the actual event. Show why a process was selected, which page was evicted, why a request must wait, or how a semaphore changed. Do not add a generative chatbot. Include explicit empty, invalid, running, paused, completed, blocked, unsafe, and stalled states where appropriate.

Use the phase-specific prompt and completion gate. Complete the current phase's implementation and reasonable fixes without repeatedly requesting approval for routine decisions. Verify meaningful cases, inspect the interface at desktop and narrow widths, and update `BUILD_STATUS.md`. Report commands actually executed and their results. If a tool or dependency cannot run, state that limitation and leave the relevant gate unverified. Never present planned tests as passed tests.

By default, implement PHASE 1 now, using `prompts/PHASE_01_FOUNDATION.md`, and stop after its completed implementation, checks, and handover report. Do not silently start later phases. If Phase 1 is already complete, identify the next unfinished phase from repository evidence and tell me which phase prompt applies; do not rebuild completed work. If I explicitly request multiple phases or the entire remaining build, continue through those phases in sequence with a verified checkpoint after each one.

At the end of this task provide: what now works, the important files changed, the commands and results, how to run the app locally, any remaining limitations, and the next phase prompt to use. Begin implementation after a brief plan; do not stop at a proposal.
