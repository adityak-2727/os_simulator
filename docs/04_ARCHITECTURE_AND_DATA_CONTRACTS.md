# Architecture and data contracts

## System structure

The domain engine accepts a validated scenario and configuration, then returns a deterministic result with events and replay frames. A playback controller selects a frame. React views render that frame and the run's derived data. Persistence stores source scenarios and settings, not trusted executable content.

| Boundary | Owns | Must not own |
| --- | --- | --- |
| Input editor | Draft fields and validation messages | Algorithm calculations |
| Domain engine | Scheduling decisions, transitions, metrics, invariants | DOM, timers, storage, React |
| Replay controller | Cursor, play/pause state, playback rate | Domain decisions or metric recomputation |
| View selectors | Derivation of visible rows and shapes from one frame | Independent copies of simulation state |
| Storage adapter | Versioning, serialization, validation, failure recovery | Evaluation of imported code |

## Core data model

Use discriminated unions and module-specific types. The following contracts define required semantics; implementation may refine field organization without weakening type safety.

```ts
type LabKind = 'cpu' | 'allocation' | 'paging' | 'deadlock'
  | 'synchronization' | 'disk' | 'system';
type ProcessId = string;
type ResourceId = string;
type ProcessState = 'new' | 'memory-wait' | 'ready' | 'running'
  | 'blocked' | 'terminated';

interface CpuProcessInput {
  id: ProcessId;
  arrival: number;
  burst: number;
  priority: number;
}
interface CpuScenario {
  kind: 'cpu';
  processes: CpuProcessInput[];
  algorithm: 'fcfs' | 'sjf' | 'priority' | 'rr';
  quantum: number;
  contextSwitchCost: 0;
}
interface AllocationScenario {
  kind: 'allocation';
  totalKiB: number;
  strategy: 'first-fit' | 'best-fit' | 'worst-fit';
  operations: Array<
    { kind: 'allocate'; id: ProcessId; sizeKiB: number } |
    { kind: 'free'; id: ProcessId }
  >;
}
interface PagingScenario {
  kind: 'paging';
  frames: number;
  references: number[];
  algorithm: 'fifo' | 'lru' | 'optimal';
}
interface BankerScenario {
  kind: 'deadlock';
  mode: 'banker';
  processIds: ProcessId[];
  resourceIds: ResourceId[];
  total: number[];
  allocation: number[][];
  max: number[][];
  request?: { processId: ProcessId; amount: number[] };
}
interface GraphScenario {
  kind: 'deadlock';
  mode: 'graph';
  processIds: ProcessId[];
  resourceIds: ResourceId[];
  allocations: Array<{ resourceId: ResourceId; processId: ProcessId }>;
  requests: Array<{ processId: ProcessId; resourceId: ResourceId }>;
}
interface DiskScenario {
  kind: 'disk';
  minCylinder: 0;
  maxCylinder: number;
  initialHead: number;
  direction: 'higher' | 'lower';
  requests: Array<{ id: string; cylinder: number }>;
  algorithm: 'fcfs' | 'sstf' | 'scan' | 'cscan';
}
type SystemInstruction =
  | { op: 'cpu'; duration: number }
  | { op: 'acquire'; resourceId: ResourceId }
  | { op: 'release'; resourceId: ResourceId };
interface SystemScenario {
  kind: 'system';
  totalKiB: number;
  algorithm: 'rr';
  quantum: number;
  resources: Array<{ id: ResourceId; instances: 1 }>;
  processes: Array<{
    id: ProcessId; arrival: number; memoryKiB: number;
    program: SystemInstruction[];
  }>;
}
```

Synchronization scenario and instruction unions are specified in `docs/10_SYNCHRONIZATION_SPEC.md`; include them in the root `Scenario` union. Input arrays preserve row order as the stable tie-breaking order. Never derive tie order from a lexical sort of P1, P10, and P2.

## Trace and replay

Every event contains an increasing `seq`, a module event `kind`, an optional `simTime`, an `explanationKey`, and typed payload. CPU and integrated events use integer simulation time. Paging, allocation, Banker, synchronization, and disk labs use a step index; cylinder movement is not CPU time.

Use module-specific event unions, such as process-arrived, dispatch, quantum-expired, process-completed, memory-allocated, page-hit, page-evicted, resource-granted, semaphore-blocked, and disk-moved. Do not put untyped arbitrary objects behind every event.

The initial replay frame is index 0. After event n, the visible frame is n + 1. Each frame includes the event that produced it and the module snapshot after that event. Same-time events may have different sequence numbers. This lets students see why the state changed without a false clock increment.

Previous and next move one event; reset returns to frame 0 while retaining the loaded scenario. Run computes a new result if necessary and starts playback. Replay from a finished run uses its existing immutable trace. Canceling playback never mutates the result.

Before starting a long run, enforce a bounded trace budget. Proposed v1 budget: 50,000 events. Return a typed limit-exceeded result with actionable guidance; never silently truncate a result or continue forever. Use compressed CPU intervals. Add checkpoints plus deterministic replay if snapshot memory becomes excessive; do not retain thousands of complete duplicated timelines in each frame.

## Error and result semantics

Engine functions return either a valid result or a structured error containing code, message, and field/path information. Validation errors, trace-limit errors, unsafe resource requests, and actual deadlock/stall outcomes are different categories. An unsafe request is an ordinary domain result, not an application crash.

Final metrics belong to the completed run. During replay show metrics explicitly labeled so far, and leave completion-dependent values blank until the process finishes. A final-results tab may show the full run only when clearly labeled as final results.

## Saved experiment envelope

```ts
interface ExperimentV1 {
  format: 'os-lab-simulator';
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  engineVersion: string;
  scenario: Scenario;
}
```

UTC ISO strings describe save metadata only. Save an engine semantic version alongside the scenario so a later behavior change can be explained. Loading always revalidates input and recomputes results. Imported timestamps and IDs never affect scheduling. Store typed validated preferences separately from experiments.

Parse imports into unknown, validate the envelope and discriminated scenario, validate cross-field invariants, then build a fresh allowed-field object. Unknown future schema versions are rejected with guidance. Never call eval, execute strings, insert imported HTML, or deep-merge an untrusted object into application state.

Use one versioned localStorage key for the experiment collection and a separate key for preferences. Catch quota and security failures. Save only after successful serialization and validation. A failed save leaves the current scenario accessible and offers export.

## Naming and compatibility

Use display labels such as First come first served while keeping short stable algorithm IDs in files. Changing a field or algorithm convention requires a migration or schema/engine version change plus updated tests. Design-token changes do not change the engine version.
