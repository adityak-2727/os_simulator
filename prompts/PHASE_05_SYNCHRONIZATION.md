Implement Phase 5 of OS Lab Simulator: Synchronization and interleavings.

Inspect the current repository and read AGENTS.md and BUILD_STATUS.md. Preserve completed work and unrelated changes. If the prerequisite phases have a concrete defect that prevents this phase, fix that dependency and record it; do not silently mark prerequisites complete.

Read these specifications for this task:
- docs/04_ARCHITECTURE_AND_DATA_CONTRACTS.md
- docs/06_SCREEN_AND_INTERACTION_SPEC.md
- docs/10_SYNCHRONIZATION_SPEC.md
- docs/13_VALIDATION_AND_TEST_PLAN.md

Required implementation:
1. Build the typed instruction interpreter, manual and scripted process selection, replay, and explicit branch-after-rewind behavior.
2. Implement shared-counter race and mutex-protected presets, owner-only unlock, FIFO waits, and direct handoff.
3. Add counting semaphores and the bounded FIFO producer-consumer scenario with visible in-flight reservations.
4. Render code steps, local/shared variables, program counters, lock state, semaphore counts, wait queues, and buffer contents.

Completion gate:
- fixtures/synchronization.json reproduces unprotected 1 and protected 2.
- Blocked wait instructions complete exactly once when granted.
- Producer-consumer preserves A then B, capacity bounds, and exclusive access.
- Schedule exhaustion is waiting for a choice, not false completion.

Keep engine calculations separate from playback and UI. Follow the established workbench design. Implement behavior fully; do not substitute hardcoded answers, decorative controls, or generic filler for required functionality.

Run the affected tests and the shared phase gate: npm run typecheck, npm run lint, npm run test:run, and npm run build. Run relevant browser checks when the environment supports them and inspect the actual interface. Do not claim any check passed unless it ran successfully. Update BUILD_STATUS.md with changes, commands/results, limitations, and the next task.

Finish with a concise implementation report and how to verify this phase locally. Complete this phase and its necessary fixes; do not start the next phase unless I ask. Begin the work after a brief plan.
