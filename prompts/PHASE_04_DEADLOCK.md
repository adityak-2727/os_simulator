Implement Phase 4 of OS Lab Simulator: Deadlock graphs and Banker analysis.

Inspect the current repository and read AGENTS.md and BUILD_STATUS.md. Preserve completed work and unrelated changes. If the prerequisite phases have a concrete defect that prevents this phase, fix that dependency and record it; do not silently mark prerequisites complete.

Read these specifications for this task:
- docs/04_ARCHITECTURE_AND_DATA_CONTRACTS.md
- docs/06_SCREEN_AND_INTERACTION_SPEC.md
- docs/09_DEADLOCK_SPEC.md
- docs/13_VALIDATION_AND_TEST_PLAN.md

Required implementation:
1. Implement single-instance graph editing through tables plus React Flow visualization, with correct arrow directions and cycle paths.
2. Implement Total/Allocation/Max validation, derived Available/Need, and a deterministic safety trace.
3. Implement requests as tentative transactions with safe commit or exact rollback.
4. Explain safe, unsafe, wait-for-availability, invalid request, and graph-deadlocked results distinctly.

Completion gate:
- fixtures/deadlock.json matches safe sequence and request outcomes.
- The graph proves the specified single-instance cycle and rejects multiple owners.
- Safety checks do not mutate actual state; rejected requests restore matrices.
- Graph behavior has a keyboard-accessible table equivalent.

Keep engine calculations separate from playback and UI. Follow the established workbench design. Implement behavior fully; do not substitute hardcoded answers, decorative controls, or generic filler for required functionality.

Run the affected tests and the shared phase gate: npm run typecheck, npm run lint, npm run test:run, and npm run build. Run relevant browser checks when the environment supports them and inspect the actual interface. Do not claim any check passed unless it ran successfully. Update BUILD_STATUS.md with changes, commands/results, limitations, and the next task.

Finish with a concise implementation report and how to verify this phase locally. Complete this phase and its necessary fixes; do not start the next phase unless I ask. Begin the work after a brief plan.
