# Screens and interaction specification

## Navigation

Use Dashboard, CPU scheduling, Memory allocation, Page replacement, Deadlock, Synchronization, Disk scheduling, Integrated system, Experiments, and Help. During development, unimplemented routes show a short honest phase status. By final delivery every v1 route has a real workflow.

Dashboard is an experiment launch surface and a summary of the active integrated run. It shows module availability, saved experiments, and a clear Continue run action when applicable. It must not combine unrelated standalone lab snapshots into a fictitious global operating-system state.

## Shared run lifecycle

1. User loads a labeled example or enters a scenario.
2. Inputs validate inline. Run stays disabled while input is invalid.
3. Run creates a deterministic result and starts playback from the initial frame.
4. Pause retains the current frame. Previous and Next step through events. Speed changes only playback timing.
5. At the final frame, status becomes Completed, Unsafe, Deadlocked, or Stalled as appropriate to the module. A CPU run does not become unsafe; a Banker analysis does not claim a completed CPU workload.
6. Editing an input pauses playback and clears the stale result with "Inputs changed. Run again to update results." Existing edited values remain in place.
7. Reset returns the current computed trace to its initial frame. A distinct Clear inputs action empties inputs and requires confirmation only if it would discard unsaved edits.

Disable Previous at frame 0 and Next at the final frame. Disable Play while already playing, expose Pause instead, and label Replay on a completed result. Do not bind global space-bar shortcuts while an input is focused. Announce user-selected steps to assistive technology without announcing every autoplay animation frame.

## Screen specifications

| Screen | Inputs | Main visual | Inspector and output |
| --- | --- | --- | --- |
| CPU | Process rows, algorithm, quantum for RR | Gantt chart, CPU, ready queue | Dispatch reason, per-process CT/TAT/WT/RT, utilization |
| Allocation | Capacity, strategy, ordered allocate/free operations | Address-labeled memory strip | Hole selection, failure reason, allocation ledger |
| Paging | Reference string, frames, algorithm | Reference cursor and frame history | Hit/fault, eviction reason, counts and ratio |
| Deadlock graph | Processes, resources, allocations, requests | Directed resource graph | Cycle path and matching allocation table |
| Banker | Total, Allocation, Max, optional Request | Matrices and Work/Finish trace | Need/Available, safe sequence or request decision |
| Synchronization | Preset, manual/scripted scheduler, process step | Program counters, local/shared data, buffer | Lock owner, semaphore counters, wait queues |
| Disk | Cylinders, head, direction, request list | Scaled head path | Service order, movement ledger, totals |
| Integrated system | Arrival, memory, program instructions, quantum | CPU timeline, memory, resources, queues | Current event and per-state waiting totals |
| Experiments | Name, module filter, import file | Saved experiment list | Open, rename, duplicate, export, delete |

## CPU layout detail

The top row contains lab title, scenario name, status, and secondary save/export controls. The input column contains the editable process table, algorithm selector, relevant parameters, and a compact Assumptions disclosure. The central region contains playback, timeline, queue, and results. The inspector shows the selected event and calculations. Compare algorithms opens a results workspace using the current validated scenario.

Do not show time quantum as an active field for FCFS/SJF/Priority. Priority values remain available in the scenario but are described as relevant only to Priority scheduling. The Gantt chart can horizontally scroll at a user-chosen scale; do not compress tiny intervals until labels overlap.

## Comparisons

CPU compares four algorithms on the same process list; only RR uses the configured quantum. Allocation compares the same ordered operations starting from empty memory. Paging compares the same reference sequence and frame count. Disk compares the same head, cylinder range, requests, and direction convention. Show a numeric table beside any chart. Label which direction of a metric is desirable, but do not declare a universally best algorithm.

## Errors and recovery

| Condition | Required behavior |
| --- | --- |
| Empty input | Explain the required data and offer Load example |
| Invalid field | Keep value visible; label the issue beside the field; no run |
| Input changed after run | Clear stale metrics and explain rerun requirement |
| Allocation cannot fit | Explain lack of total space versus fragmentation; preserve state |
| Unsafe Banker request | Explain tentative safety failure; restore original state |
| Storage unavailable | Keep active work; offer JSON export; do not show Saved |
| Invalid import | List useful validation errors; preserve current scenario |
| Event budget exceeded | Explain limit and which input to reduce; no partial success |
| Unknown error | Preserve inputs where possible; show recovery action and honest error |

## Learning content

Each lab has a short What to observe disclosure and one guided exercise. Explanations use structured engine events and templates. Example CPU explanation: "P2 starts at t = 6 because its burst of 3 is now the shortest among ready processes." Verify values against the frame. Explain formulas with the selected process's actual numbers. Help includes a glossary and the app's model assumptions.

## Storage and exports

Save gives a meaningful name and validates success. Duplicate creates a new experiment identity while preserving source settings. Delete identifies the experiment and uses a targeted confirmation. Import displays name, module, and validation outcome before replacing unsaved current input. Export scenario JSON and results CSV are separate actions. Escape CSV cells starting with spreadsheet formula markers when any user-controlled string is exported.
