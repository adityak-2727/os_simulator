Implement Phase 8 of OS Lab Simulator: Verification and project handover.

Inspect the current repository and read AGENTS.md and BUILD_STATUS.md. Preserve completed work and unrelated changes. If the prerequisite phases have a concrete defect that prevents this phase, fix that dependency and record it; do not silently mark prerequisites complete.

Read these specifications for this task:
- docs/01_PRODUCT_REQUIREMENTS.md
- docs/05_DESIGN_SYSTEM.md
- docs/06_SCREEN_AND_INTERACTION_SPEC.md
- docs/13_VALIDATION_AND_TEST_PLAN.md
- docs/14_RELEASE_AND_HANDOVER.md
- docs/15_DECISIONS_AND_SCOPE.md

Required implementation:
1. Audit the completed application against every v1 requirement, fixture, invariant, and meaningful browser flow. Fix observed defects without gratuitous rewrites.
2. Review actual screens at 1440, 1024, 768, and 390 px, including invalid/empty/paused/completed states, keyboard navigation, and reduced motion.
3. Measure representative workloads, inspect the production build, finalize README and assumptions, and prepare compatible CI/static-host configuration.
4. Write a release handover with actual test evidence, remaining limitations, architecture explanation, and the five-minute demo script. Prepare deployment without claiming or performing publication unless separately requested.

Completion gate:
- All required quality checks pass or are clearly marked blocked with a reason.
- All v1 routes have working controls and truthful state/metric displays.
- Clean install and production preview are reproducible using the recorded Node version.
- Documentation, supported limits, test evidence, and deployment status are accurate.

Keep engine calculations separate from playback and UI. Follow the established workbench design. Implement behavior fully; do not substitute hardcoded answers, decorative controls, or generic filler for required functionality.

Run the affected tests and the shared phase gate: npm run typecheck, npm run lint, npm run test:run, and npm run build. Run relevant browser checks when the environment supports them and inspect the actual interface. Do not claim any check passed unless it ran successfully. Update BUILD_STATUS.md with changes, commands/results, limitations, and the next task.

Finish with a concise implementation report and how to verify this phase locally. Complete this phase and its necessary fixes; do not start the next phase unless I ask. Begin the work after a brief plan.
