# OS Lab Simulator repository instructions

Build the phase requested by the user. Read `BUILD_STATUS.md`, the relevant phase prompt, and only the specifications needed for the affected behavior. Preserve unrelated code and user changes. Do not replace the application just to restyle a screen.

## Product and architecture

- Use React, TypeScript strict mode, Vite, Tailwind, SVG, Recharts, and React Flow as specified. Use React Context and reducers before adding another state library.
- Keep `src/engine/` independent of React, DOM APIs, timers, storage, and chart libraries. Inputs and configuration determine results.
- Display state from one selected replay frame. Never compute chart numbers independently from the engine result.
- Separate simulation time from playback time. Replay, stepping, and speed changes must preserve the computed result.
- Keep source scenarios immutable during a run. Input edits invalidate the active result and stop playback.
- Implement the algorithm conventions and reference cases exactly. If a case conflicts with a specification, investigate and document the conflict; never change an expected result only to make a test pass.
- Use typed error results and descriptive validation. No `any` to bypass domain types, swallowed exceptions, or fake success states.

## Interface

Follow `docs/05_DESIGN_SYSTEM.md` and `docs/06_SCREEN_AND_INTERACTION_SPEC.md`. Build a compact lab workbench with aligned data tables, timelines, queue views, and a useful event inspector. Every displayed metric needs a unit or a clear definition. Every action needs implemented behavior or an honest unavailable state.

Use restrained color, consistent process identifiers, readable numerals, visible focus, meaningful empty states, and keyboard alternatives to graph interaction. Avoid generic marketing sections, fabricated usage metrics, decorative gradients, excessive rounded cards, and continuous ornamental animation.

## Verification and continuation

Use hand-derived fixtures and independent invariants for engine tests. Run affected tests after changes; run typecheck, lint, unit tests, and production build at a phase gate. Run browser checks for the flows changed in that phase when a browser runner is available. If a check cannot execute, record the exact limitation and leave it unverified.

Update `BUILD_STATUS.md` with changed files, commands actually run, results, limitations, and the next phase. Do not mark later phases complete. End a phase report with what works, evidence, limitations, and the next task. Routine implementation choices and local fixes do not need repeated confirmation. Document material scope or behavior changes.

Do not add credentials, external data collection, account systems, or paid dependencies. Prepare deployment files in Phase 8; publish only when the user requests deployment. Existing access controls and approval rules still apply.
