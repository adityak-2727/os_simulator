# Deadlock and safety specification

## Two separate modes

Graph mode models reusable resources with exactly one instance each. Banker mode handles multiple resource instances through matrices. Keep their conclusions distinct: a graph cycle under the single-instance model proves deadlock, while a failed Banker safety check identifies an unsafe state, which need not already be deadlocked.

## Single-instance graph

Request edge: process to resource. Allocation edge: resource to process. Each resource has at most one owner. Reject references to unknown nodes, duplicate edges, and multiple owners. For this teaching model, a process may wait for a resource held by another process; a resource is not both free and allocated. Use an explicit editor to grant an available resource or release an owned resource, so arrows reflect state.

Maintain one source of truth in structured arrays and derive graph nodes and edges from it. Provide a table-based editing alternative to dragging. Find a directed cycle and report its path. Example: R1 allocated to P1, P1 requests R2, R2 allocated to P2, P2 requests R1. Highlight the full cycle and identify both blocked processes.

Do not apply the cycle-implies-deadlock conclusion to a graph with multiple resource instances. In v1 those instances belong in Banker mode; no multi-instance deadlock detector is claimed.

## Banker inputs and derived values

Inputs are process IDs, resource IDs, Total vector, Allocation matrix, and Max matrix. Derive Available[j] = Total[j] - sum(Allocation[i][j]) and Need[i][j] = Max[i][j] - Allocation[i][j]. Do not allow independent editing of derived values.

All entries are nonnegative integers. Dimensions match IDs; Allocation <= Max for every cell; sums of allocations do not exceed Total; Max for a process does not exceed Total. These validation constraints keep the teaching scenarios feasible as declared claims.

## Deterministic safety check

Initialize Work = Available and all Finish flags false. Repeatedly choose the lowest input-index unfinished process whose Need vector is componentwise <= Work. Record its selection and Work before/after, set Work = Work + Allocation for that process, and mark Finish true. Restart selection from the beginning of the input order after every selection. If all finish, return safe and that sequence. If no eligible process remains, return unsafe plus unfinished processes and unsatisfied needs.

Different valid sequences may exist. This app uses the above rule to make the displayed sequence deterministic. A safety check simulates potential completion; it does not mutate the actual Allocation or Available state.

## Resource request transaction

For process i and Request vector:
1. If any component is negative/non-integer or exceeds Need, return invalid.
2. If Request exceeds Available, return wait-for-availability; retain original state.
3. Tentatively subtract Request from Available, add it to Allocation[i], and subtract it from Need[i].
4. Run the safety algorithm on a copy.
5. If safe, commit the tentative state and show the sequence. If unsafe, restore the exact original state and return wait-for-safety.

A zero vector is a valid no-op whose safety result is still explainable. No request outcome is called deadlock merely because the safety check failed.

## Reference matrices

Total = [10,5,7]. Allocation rows P0 through P4: [0,1,0], [2,0,0], [3,0,2], [2,1,1], [0,0,2]. Max rows: [7,5,3], [3,2,2], [9,0,2], [2,2,2], [4,3,3]. Available = [3,3,2].

With the deterministic rule above, the safe sequence is P1, P3, P0, P2, P4. Work progresses [3,3,2], [5,3,2], [7,4,3], [7,5,3], [10,5,5], [10,5,7].

Independent requests from the original state: P1 requests [1,0,2] and is granted; P4 requests [3,3,0] and is deferred for safety; P0 requests [0,4,0] and waits for availability; P1 requests [2,0,0] and is invalid because it exceeds Need. Reset to the original matrices before each test.

## Required tests

Cycle and no cycle; correct graph directions; invalid multiple owners; zero-need processes; safe and unsafe matrices; available-vector conservation; no mutation from analysis; safe request commit; unsafe request rollback; insufficient availability; request beyond declared claim; malformed dimensions; consistent replay of Work and Finish.
