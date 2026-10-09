# Reference cases

These small JSON files provide inputs and expected outcomes. They are test oracles, not a working simulator. Numerical schedules, page-fault counts, Banker sequences, synchronization traces, and disk movement totals were checked while preparing this specification. The integrated scenario was checked against its stated event ordering and wait-time decomposition. The future application still needs its own tests.

Each fixture has format `os-lab-fixture`, schemaVersion 1, and a cases array. Each case has a name, a module input, and expected output fields. Compare only the fields asserted by the case; an application result can contain additional typed detail. Use a small tolerance for non-integer averages, and assert integer times and counts exactly. Half-open CPU intervals include start and exclude end.

Only experiment-import.json uses the application's os-lab-simulator envelope and is intended for the Import experiment action. The other fixture wrappers must not be treated as saved experiments. A preset can copy the case input, but displayed results must always come from running the engine.

Additional edge cases listed in the specifications remain required. Passing these examples alone does not prove algorithm correctness for every workload.
