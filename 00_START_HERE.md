# OS Lab Simulator build pack

Build an educational operating-system simulator in exactly eight implementation phases. This pack contains the requirements, interface direction, algorithm contracts, reference cases, acceptance gates, and prompts needed to implement it with Codex using GPT-6.1 Sol.

The product is a browser application with simulated processes, memory, resources, and disk requests. All displayed operating-system measurements describe the model. The application does not execute user-supplied programs or inspect the host operating system.

## Start in Codex

1. Extract this folder into a dedicated project workspace. Keep `AGENTS.md`, `MASTER_PROMPT.md`, `BUILD_STATUS.md`, `docs/`, `prompts/`, and `fixtures/` at the project root. Application files will be created beside them.
2. Open that workspace in your Codex client. Select GPT-6.1 Sol if available in your account. A prompt cannot change the selected model. No OpenAI API key is required by this simulator.
3. Paste the complete contents of `MASTER_PROMPT.md`. The default instruction implements Phase 1 and completes its checks.
4. Use `prompts/PHASE_02_CPU.md` through `prompts/PHASE_08_RELEASE.md` in order. The Phase 1 prompt is also supplied for a focused restart or continuation.
5. Check the phase report and local application before starting the next phase. If a check fails, ask Codex to fix that phase using the existing specifications; do not rewrite the whole application.
6. In a new conversation, use `prompts/RESUME.md`. Codex should inspect the actual repository and `BUILD_STATUS.md` before continuing.

The prompts request completed implementation, verified behavior, and honest reporting. They do not promise a bug-free result or guarantee a particular visual impression. The design requirements turn the request for a realistic application into observable layout, interaction, and content criteria.

## Eight phases

| Phase | Outcome | Dependency |
| --- | --- | --- |
| 1 | Foundation, visual system, app shell, deterministic replay infrastructure | None |
| 2 | CPU scheduling laboratory and comparisons | Phase 1 |
| 3 | Contiguous memory allocation and page replacement laboratories | Phases 1 and 2 |
| 4 | Resource graphs and Banker's safety and request checks | Phases 1 and 2 |
| 5 | Synchronization and reproducible interleavings | Phases 1 and 2 |
| 6 | Disk scheduling and head movement comparison | Phases 1 and 2 |
| 7 | Integrated system scenario, experiment saving, and learning workflows | Phases 1 through 6 |
| 8 | Correctness audit, accessibility, release preparation, and project handover | Phases 1 through 7 |

## Document map

| File | When to read it |
| --- | --- |
| `MASTER_PROMPT.md` | Initial Codex task |
| `AGENTS.md` | Repository-wide coding rules |
| `BUILD_STATUS.md` | Current phase and evidence of progress |
| `docs/01_PRODUCT_REQUIREMENTS.md` | Scope, users, requirements, success criteria |
| `docs/02_EIGHT_PHASE_ROADMAP.md` | Phase outputs and completion gates |
| `docs/03_TECH_STACK_AND_SETUP.md` | Dependencies, scripts, local development |
| `docs/04_ARCHITECTURE_AND_DATA_CONTRACTS.md` | Module boundaries, engine and storage contracts |
| `docs/05_DESIGN_SYSTEM.md` | Colors, typography, density, visual rules |
| `docs/06_SCREEN_AND_INTERACTION_SPEC.md` | Screen layouts, controls, empty and error states |
| `docs/07_CPU_SCHEDULING_SPEC.md` | CPU algorithm semantics and metrics |
| `docs/08_MEMORY_AND_PAGING_SPEC.md` | Allocation, coalescing, FIFO, LRU, Optimal |
| `docs/09_DEADLOCK_SPEC.md` | Graph semantics, safety, resource requests |
| `docs/10_SYNCHRONIZATION_SPEC.md` | Mutexes, semaphores, interleavings |
| `docs/11_DISK_SCHEDULING_SPEC.md` | Movement rules, endpoints, wrap cost |
| `docs/12_INTEGRATED_SIMULATION_SPEC.md` | One clock for CPU, memory, and resource blocking |
| `docs/13_VALIDATION_AND_TEST_PLAN.md` | Inputs, expected outputs, invariants, workflows |
| `docs/14_RELEASE_AND_HANDOVER.md` | Build, hosting preparation, demo, final evidence |
| `docs/15_DECISIONS_AND_SCOPE.md` | Decisions already made and change handling |
| `docs/16_REFERENCE_SOURCES.md` | Official documentation and learning references |
| `prompts/PHASE_*.md` | One executable task prompt per phase |
| `prompts/RESUME.md` | Continue safely after a new session |
| `prompts/DESIGN_REVIEW.md` | Audit and refine the implemented interface |
| `fixtures/*.json` | Explicit inputs and expected results for verification |
| `OS_Lab_Simulator_Review_Guide.docx` | Readable overview for project review |

The Markdown specifications are authoritative for implementation. The Word guide is a review aid. When a requirement changes, update the affected specification and reference case together.

## Boundaries

Core v1 needs no login, server, database, AI chatbot, paid services, or live collaboration. Data stays in this browser unless the user exports it. A first visit requires the hosted site to load; full offline reload support is a later enhancement. A required C or C++ lab implementation would require a separate engine decision before coding.

The pack itself is a development specification, not a completed or tested application. All phase statuses begin as not started.
