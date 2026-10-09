# Release and project handover

## Build and deployment preparation

Verify a clean install with the recorded Node version and lockfile. Run typecheck, lint, unit tests, production build, and the required browser suite. Review the built application through the local preview server rather than relying only on development mode.

For the documented GitHub Pages path, configure Vite's base path for the actual repository route and hash-based navigation. Prepare a CI workflow using currently supported action versions, npm ci, the quality checks, and the static build. Keep workflow permissions limited to what deployment requires. Document the exact host configuration after it is chosen. Deployment is a separate requested action; preparing files does not mean the site is live.

Verify initial load, refresh on a lab route, static assets under the configured base, import/export, and persistent experiments in the deployed origin. Data saved on localhost does not automatically transfer to a hosted origin; use JSON export/import. No server secrets or API keys belong in the static bundle.

## Release checklist

- All v1 routes have implemented workflows and no misleading unavailable controls.
- Algorithm fixtures, edge cases, and domain invariants pass.
- Final charts and tables agree; same-time ordering and units are visible.
- All run controls work, including edit invalidation and rewind.
- Banker unsafe and graph deadlocked states are distinct.
- Disk endpoint/wrap convention and Optimal's future knowledge are disclosed.
- Integrated panels share a run ID/frame and report separate wait categories.
- Storage and import failures preserve work.
- Keyboard, focus, chart alternatives, narrow layout, and reduced motion are reviewed.
- Console errors, uncaught promises, accidental placeholder text, and dead links are addressed.
- Dependencies and their licenses are recorded; required notices are preserved.
- Application README covers install, scripts, assumptions, supported limits, and hosting.
- Known limitations are explicit. Failed or unavailable checks are not called passed.

## Five minute review demonstration

1. Explain the model and its simulated units in 30 seconds.
2. Enter or load the CPU example, run RR, inspect one dispatch, then compare with SJF in 60 seconds.
3. Show a fragmented allocation failure and a page eviction in 45 seconds.
4. Show the Banker safe sequence and an unsafe request rollback in 45 seconds.
5. Reproduce a lost update, then its protected result in 45 seconds.
6. Show disk head movement and the C-SCAN wrap in 30 seconds.
7. Show P2 blocking and P3 memory waiting in the integrated example, then export the experiment in 45 seconds.

Prepare screenshots from the actual app, a short video if useful, the repository, the README, a requirements-to-tests matrix, and a concise limitations list. Do not claim user research, real deployments, or performance measurements that were not performed.

## Engineering explanation for the project review

Be ready to explain pure engine functions, event ordering, separation of simulation and playback clocks, immutable replay, input validation, graph versus Banker semantics, synchronization modeling, and the integrated wait-time equation. Explain why browser simulation suits this learning project and what would change for a real kernel or native threading implementation.

## Handover report format

State the release revision, features that work, commands actually run, evidence paths, remaining defects, limits, local run instructions, deployment status, and a prioritized future backlog. The backlog may include SRTF, aging, additional synchronization problems, disk LOOK/C-LOOK, full offline reload support, accounts, or instructor workflows; none is silently required for v1.
