Implement Phase 3 of OS Lab Simulator: Memory allocation and paging.

Inspect the current repository and read AGENTS.md and BUILD_STATUS.md. Preserve completed work and unrelated changes. If the prerequisite phases have a concrete defect that prevents this phase, fix that dependency and record it; do not silently mark prerequisites complete.

Read these specifications for this task:
- docs/04_ARCHITECTURE_AND_DATA_CONTRACTS.md
- docs/06_SCREEN_AND_INTERACTION_SPEC.md
- docs/08_MEMORY_AND_PAGING_SPEC.md
- docs/13_VALIDATION_AND_TEST_PLAN.md

Required implementation:
1. Implement First Fit, Best Fit, and Worst Fit allocation with exact ranges, splitting, freeing, and coalescing.
2. Build the operation editor, address-labeled map, ledger, hole-selection explanation, and allocation comparison.
3. Implement FIFO, LRU, and Optimal paging with the specified ties; build frame history, reference cursor, hit/fault details, and comparisons.
4. Use fixtures/allocation.json and fixtures/paging.json and validate intermediate states, not only totals.

Completion gate:
- Memory is conserved; exact fits and two-sided coalescing pass.
- Fragmentation failure is explained and leaves state unchanged.
- Paging faults are FIFO 10, LRU 9, and Optimal 7 for the reference sequence.
- Both labs support replay, input invalidation, and equivalent numeric tables.

Keep engine calculations separate from playback and UI. Follow the established workbench design. Implement behavior fully; do not substitute hardcoded answers, decorative controls, or generic filler for required functionality.

Run the affected tests and the shared phase gate: npm run typecheck, npm run lint, npm run test:run, and npm run build. Run relevant browser checks when the environment supports them and inspect the actual interface. Do not claim any check passed unless it ran successfully. Update BUILD_STATUS.md with changes, commands/results, limitations, and the next task.

Finish with a concise implementation report and how to verify this phase locally. Complete this phase and its necessary fixes; do not start the next phase unless I ask. Begin the work after a brief plan.
