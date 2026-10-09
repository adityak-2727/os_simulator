Implement Phase 1 of OS Lab Simulator: Foundation and visual system.

Inspect the current repository and read AGENTS.md and BUILD_STATUS.md. Preserve completed work and unrelated changes. If the prerequisite phases have a concrete defect that prevents this phase, fix that dependency and record it; do not silently mark prerequisites complete.

Read these specifications for this task:
- docs/01_PRODUCT_REQUIREMENTS.md
- docs/02_EIGHT_PHASE_ROADMAP.md
- docs/03_TECH_STACK_AND_SETUP.md
- docs/04_ARCHITECTURE_AND_DATA_CONTRACTS.md
- docs/05_DESIGN_SYSTEM.md
- docs/06_SCREEN_AND_INTERACTION_SPEC.md

Required implementation:
1. Inspect the workspace and scaffold React, TypeScript strict mode, Vite, and the compatible Tailwind integration without overwriting this pack.
2. Create the navigation, lab layout, accessible forms/buttons/tables, status treatments, event inspector, and responsive workbench. Follow design/CPU_Workbench_Reference.png for the intended final visual language; do not fake a finished CPU engine.
3. Define domain contracts, typed engine errors, module event/frame types, and a cursor-based playback controller. Prove previous/next/reset/speed behavior with a tiny explicitly labeled fixture preview.
4. Configure lint, typecheck, Vitest, production build, and the initial browser smoke workflow. Document local scripts. Show later labs as honestly unavailable.

Completion gate:
- The shell opens directly into a useful lab workspace and works at 1440 and 390 px widths.
- Keyboard focus, labels, disabled controls, and narrow-layout scrolling are intentional.
- Replay tests show cursor operations do not mutate results.
- Typecheck, lint, unit tests, and production build run successfully, or precise environmental blockers are recorded.

Keep engine calculations separate from playback and UI. Follow the established workbench design. Implement behavior fully; do not substitute hardcoded answers, decorative controls, or generic filler for required functionality.

Run the affected tests and the shared phase gate: npm run typecheck, npm run lint, npm run test:run, and npm run build. Run relevant browser checks when the environment supports them and inspect the actual interface. Do not claim any check passed unless it ran successfully. Update BUILD_STATUS.md with changes, commands/results, limitations, and the next task.

Finish with a concise implementation report and how to verify this phase locally. Complete this phase and its necessary fixes; do not start the next phase unless I ask. Begin the work after a brief plan.
