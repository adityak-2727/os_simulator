# Decisions and scope control

## Accepted initial decisions

| ID | Decision | Reason and consequence |
| --- | --- | --- |
| D01 | Browser-only TypeScript simulation engine | Easy classroom access and reproducible typed tests; no native OS execution |
| D02 | Eight sequential implementation phases | Produces an early working CPU lab and isolates defects |
| D03 | One CPU and zero context-switch cost in CPU v1 | Keeps textbook metrics and event ordering explicit |
| D04 | Non-preemptive SJF and Priority | Matches chosen scope; SRTF and preemptive Priority are future work |
| D05 | Arrival before RR requeue at the same timestamp | Deterministic, documented queue semantics |
| D06 | All clocks start at zero | CPU utilization includes initial idle time |
| D07 | Light technical workbench | Information hierarchy and precise data are the visual identity |
| D08 | Graph limited to single-instance resources | Avoids invalid cycle-based conclusions for multi-instance resources |
| D09 | Banker uses lowest eligible input index after every completion | Produces a reproducible safe sequence |
| D10 | C-SCAN wrap movement is counted | Distance convention is explicit and testable |
| D11 | Integrated lab joins RR, first-fit admission, and single-instance blocking | Bounded integration scope with a meaningful causal example |
| D12 | Pure engines and immutable replay | Animation speed cannot alter mathematical output |
| D13 | Versioned localStorage and JSON | No backend required; exported scenarios transfer between origins |
| D14 | Documentation and prompts target GPT-6.1 Sol | Preserve the requested development model; no runtime model dependency |

## Changes

For a material change, add a dated entry with the proposed behavior, reason, affected specifications, tests, and migration implications. Do not let UI preferences silently change numerical semantics. If a course requires C/C++, record an engine choice and integration approach before writing a second competing engine.

Minor implementation details such as component filenames or an internal selector can be chosen locally. New accounts, paid services, backend infrastructure, multi-core simulation, or public deployment change the scope and should be requested explicitly.

## Risk register

| Risk | Control |
| --- | --- |
| Large scope produces disconnected demos | Phase gates and one bounded integrated reference workload |
| Beautiful chart hides incorrect calculations | Independent fixtures, invariants, and numeric tables |
| Replay changes the result | Pure engine, immutable run, cursor-only playback |
| Different modules disagree about a process | One integrated snapshot and typed state transitions |
| Generic visual output | Concrete design tokens, workbench layout, and actual-state review |
| Excessive traces freeze the page | Size limits, event budget, compressed intervals, measured performance |
| Agent forgets decisions across sessions | Concise AGENTS.md, BUILD_STATUS.md, phase prompts, and resume prompt |
| New dependency versions break setup | Verify official setup, pin a lockfile, record the Node version |

## Open extensions

No extension is required to declare v1 complete. Evaluate an extension by its learning value, implementation cost, required tests, and whether it changes saved scenario semantics.
