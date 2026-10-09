Implement Phase 6 of OS Lab Simulator: Disk scheduling.

Inspect the current repository and read AGENTS.md and BUILD_STATUS.md. Preserve completed work and unrelated changes. If the prerequisite phases have a concrete defect that prevents this phase, fix that dependency and record it; do not silently mark prerequisites complete.

Read these specifications for this task:
- docs/04_ARCHITECTURE_AND_DATA_CONTRACTS.md
- docs/06_SCREEN_AND_INTERACTION_SPEC.md
- docs/11_DISK_SCHEDULING_SPEC.md
- docs/13_VALIDATION_AND_TEST_PLAN.md

Required implementation:
1. Implement FCFS, SSTF, SCAN, and C-SCAN over a static batch with unique request IDs.
2. Build request editing, head and direction controls, a scaled movement path, service order, movement ledger, and comparison.
3. Represent service, endpoint, and wrap moves separately and count wrap distance.
4. Test duplicates, requests at the head/endpoints, lower direction, ties, and stopping at the last request.

Completion gate:
- fixtures/disk.json matches paths and totals 640, 236, 331, and 382.
- C-SCAN wrap and SCAN endpoint movements are visible and included.
- Every request is served once, including zero-distance duplicates.
- Metrics are cylinders moved, not invented latency.

Keep engine calculations separate from playback and UI. Follow the established workbench design. Implement behavior fully; do not substitute hardcoded answers, decorative controls, or generic filler for required functionality.

Run the affected tests and the shared phase gate: npm run typecheck, npm run lint, npm run test:run, and npm run build. Run relevant browser checks when the environment supports them and inspect the actual interface. Do not claim any check passed unless it ran successfully. Update BUILD_STATUS.md with changes, commands/results, limitations, and the next task.

Finish with a concise implementation report and how to verify this phase locally. Complete this phase and its necessary fixes; do not start the next phase unless I ask. Begin the work after a brief plan.
