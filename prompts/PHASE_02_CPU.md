Implement Phase 2 of OS Lab Simulator: CPU scheduling.

Inspect the current repository and read AGENTS.md and BUILD_STATUS.md. Preserve completed work and unrelated changes. If the prerequisite phases have a concrete defect that prevents this phase, fix that dependency and record it; do not silently mark prerequisites complete.

Read these specifications for this task:
- docs/04_ARCHITECTURE_AND_DATA_CONTRACTS.md
- docs/05_DESIGN_SYSTEM.md
- docs/06_SCREEN_AND_INTERACTION_SPEC.md
- docs/07_CPU_SCHEDULING_SPEC.md
- docs/13_VALIDATION_AND_TEST_PLAN.md

Required implementation:
1. Implement pure FCFS, non-preemptive SJF, non-preemptive Priority, and RR engines with the defined same-time ordering.
2. Build editable process inputs, conditional quantum controls, the ready queue, CPU state, scaled Gantt chart, metrics, event explanation, and four-algorithm comparison.
3. Wire all views to the same replay frame and result; keep so-far values separate from final values. Invalidate stale results after input edits.
4. Add the reference, idle, tie, quantum-boundary, and invalid-input tests before final visual refinement.

Completion gate:
- fixtures/cpu.json matches intervals and every CT/TAT/WT/RT value.
- RR arrivals at a quantum boundary enter before the expired process is requeued.
- Changing speed, pausing, stepping, and replaying preserve the result.
- Compare uses identical process inputs; desktop and narrow workflows are usable.

Keep engine calculations separate from playback and UI. Follow the established workbench design. Implement behavior fully; do not substitute hardcoded answers, decorative controls, or generic filler for required functionality.

Run the affected tests and the shared phase gate: npm run typecheck, npm run lint, npm run test:run, and npm run build. Run relevant browser checks when the environment supports them and inspect the actual interface. Do not claim any check passed unless it ran successfully. Update BUILD_STATUS.md with changes, commands/results, limitations, and the next task.

Finish with a concise implementation report and how to verify this phase locally. Complete this phase and its necessary fixes; do not start the next phase unless I ask. Begin the work after a brief plan.
