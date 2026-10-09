Implement Phase 7 of OS Lab Simulator: Integrated system and saved experiments.

Inspect the current repository and read AGENTS.md and BUILD_STATUS.md. Preserve completed work and unrelated changes. If the prerequisite phases have a concrete defect that prevents this phase, fix that dependency and record it; do not silently mark prerequisites complete.

Read these specifications for this task:
- docs/01_PRODUCT_REQUIREMENTS.md
- docs/04_ARCHITECTURE_AND_DATA_CONTRACTS.md
- docs/06_SCREEN_AND_INTERACTION_SPEC.md
- docs/12_INTEGRATED_SIMULATION_SPEC.md
- docs/13_VALIDATION_AND_TEST_PLAN.md

Required implementation:
1. Implement the integrated RR engine with first-fit memory admission, FIFO resource blocking, same-time precedence, and finite instruction programs.
2. Connect dashboard CPU, memory, resources, queues, and event explanations to one run and frame. Keep paging/disk standalone.
3. Implement versioned scenario saving, rename/duplicate/delete, validated JSON import/export, and safe CSV result export.
4. Complete preset loading, algorithm assumptions, deterministic explanations, glossary, and guided exercises.

Completion gate:
- fixtures/integrated.json matches CPU timeline and separate wait totals.
- At every frame, resource ownership, process state, and memory conservation agree.
- fixtures/experiment-import.json round-trips and recomputes the same result.
- Invalid imports and storage failures preserve current work; all standalone labs still pass.

Keep engine calculations separate from playback and UI. Follow the established workbench design. Implement behavior fully; do not substitute hardcoded answers, decorative controls, or generic filler for required functionality.

Run the affected tests and the shared phase gate: npm run typecheck, npm run lint, npm run test:run, and npm run build. Run relevant browser checks when the environment supports them and inspect the actual interface. Do not claim any check passed unless it ran successfully. Update BUILD_STATUS.md with changes, commands/results, limitations, and the next task.

Finish with a concise implementation report and how to verify this phase locally. Complete this phase and its necessary fixes; do not start the next phase unless I ask. Begin the work after a brief plan.
