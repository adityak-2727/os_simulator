# Technology stack and local setup

## Chosen stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Build and UI | Vite, React, TypeScript strict mode | Browser application with typed state and reusable views |
| Styling | Tailwind with explicit CSS design tokens | Consistent density and targeted custom visualization styles |
| State | React useReducer and Context, scoped by lab | Predictable actions without a global dependency-heavy store |
| Engine | Plain TypeScript | Pure functions and deterministic, framework-independent tests |
| Timeline and memory | Native SVG with HTML tables | Exact scales, addresses, selection, and accessible alternatives |
| Comparison plots | Recharts | Small bar and line charts backed by the same metric data |
| Resource graph | React Flow package `@xyflow/react` | Nodes, directional edges, and inspection |
| Persistence | Versioned localStorage and JSON files | Small saved scenarios with no backend |
| Unit tests | Vitest | Algorithm fixtures and invariant checks |
| Browser tests | Playwright | Workflow, keyboard, import/export, and layout checks |
| Version control | Git with a committed npm lockfile | Reproducible dependency resolution and reviewable changes |
| Hosting | Static build, with GitHub Pages as the documented default | Client-only deployment; configurable Vite base path |

## Dependency policy

Use a supported Node LTS version satisfying the installed Vite and Playwright requirements. Check the official installation pages at implementation time, write the chosen Node version to `.nvmrc`, and record it in the application README. This pack intentionally does not freeze potentially stale package version numbers.

Resolve compatible stable versions once, commit `package-lock.json`, and use `npm ci` for reproducible later installs. Install React Flow and Recharts in the phases that use them, or earlier if their imports are not loaded by unused screens. Do not add a full component framework just to reproduce a generic dashboard. An accessible small primitive library is permissible if a demonstrated need is recorded.

## Scaffolding in a workspace containing these documents

Do not run a scaffold command that deletes or overwrites the specification files. Create the Vite scaffold in a temporary child directory, then deliberately copy its application and configuration files to the project root, preserving this pack. Alternatively author the small scaffold directly. Remove the temporary scaffold after inspection.

Tailwind integration must match the installed major version. Use the current Vite plugin setup from the official documentation; do not mix incompatible older configuration recipes. Import React Flow's required styles when the graph module is introduced.

## Required npm scripts

| Script | Intended behavior |
| --- | --- |
| `dev` | Start Vite locally |
| `build` | Run type checking and produce the production build |
| `preview` | Serve the production build for local review |
| `typecheck` | Validate application and test types without emitting files |
| `lint` | Check configured TypeScript and React lint rules |
| `test` | Run Vitest in interactive watch mode |
| `test:run` | Run the unit suite once |
| `test:e2e` | Run Playwright against a local test server |

Document the exact implemented commands; do not leave script names in the guide that the repository does not provide. Configure browser tests to start their own local server or document the required server command. Keep lint and test tools in devDependencies.

## Proposed application paths

| Path | Responsibility |
| --- | --- |
| `src/app/` | Shell, routes, providers, top-level errors |
| `src/components/` | Shared controls, tables, timeline, inspector |
| `src/features/cpu/` | CPU editor and views |
| `src/features/memory/` | Allocation and paging editors and views |
| `src/features/deadlock/` | Graph and Banker views |
| `src/features/synchronization/` | Instruction and synchronization views |
| `src/features/disk/` | Disk request and path views |
| `src/features/system/` | Integrated run views |
| `src/features/experiments/` | Saved scenarios and transfers |
| `src/engine/` | Pure domain models, algorithms, events, and results |
| `src/storage/` | Versioning, validation, persistence, import/export |
| `src/styles/` | Tokens and visualization styling |
| `tests/` | Unit, integration, and browser checks |

This is a browser SPA. Hash-based routes are a reasonable default for static hosting so refreshing a lab route works without server rewrites. Use a router only if needed; avoid inventing a custom complex routing framework.

No OpenAI SDK is part of the product. Codex is the development tool; the simulator does not call a model at runtime.
