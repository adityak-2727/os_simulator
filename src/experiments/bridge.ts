import { useCpu } from '../features/cpu/CpuContext';
import { parseCpuDraft } from '../features/cpu/cpuState';
import { useMemory } from '../features/memory/MemoryContext';
import { parseAllocation, parsePaging } from '../features/memory/memoryState';
import { useDeadlock } from '../features/deadlock/DeadlockContext';
import { parseGraph, parseBanker } from '../features/deadlock/deadlockState';
import { useSync } from '../features/synchronization/SyncContext';
import { parseSync, draftFrom } from '../features/synchronization/edit';
import { useDisk } from '../features/disk/DiskContext';
import { parseDisk } from '../features/disk/diskState';
import { useSystem } from '../features/system/SystemContext';
import { parseSystem } from '../features/system/systemState';
import type { Scenario } from '../engine/scenarios';
import type { EngineResponse } from '../engine/contracts';
import { useMemo } from 'react';
import { scheduleCpu } from '../engine/cpu/schedule';
import { allocateMemory } from '../engine/memory/allocation';
import { replacePages } from '../engine/memory/paging';
import { analyzeGraph } from '../engine/deadlock/graph';
import { runBanker } from '../engine/deadlock/banker';
import { validateScenario } from './format';
import { useExperiments } from './ExperimentContext';
export function useScenarioBridge(route: string) {
  const cpu = useCpu(),
    memory = useMemory(),
    deadlock = useDeadlock(),
    sync = useSync(),
    disk = useDisk(),
    system = useSystem();
  const { notice } = useExperiments();
  const selected = useMemo(() => {
    let parsed: EngineResponse<Scenario> | null = null,
      name = 'Experiment',
      rows: (string | number | null)[][] | null = null;
    switch (route) {
      case 'cpu': {
        parsed = parseCpuDraft(cpu.state.draft);
        name = cpu.state.draft.name;
        const r = cpu.state.result;
        if (r)
          rows = [
            ['Final CPU results · time units t'],
            ['ID', 'CT', 'TAT', 'WT', 'RT'],
            ...r.metrics.map((p) => [
              p.id,
              p.completion,
              p.turnaround,
              p.waiting,
              p.response,
            ]),
          ];
        break;
      }
      case 'allocation': {
        parsed = parseAllocation(memory.state.allocation.draft);
        name = memory.state.allocation.draft.name;
        const r = memory.state.allocation.result;
        if (r)
          rows = [
            ['Final allocation results · KiB'],
            ['Step', 'ID', 'Operation', 'Decision', 'Reason'],
            ...r.events.map((e) => [
              e.seq + 1,
              e.operation.id,
              e.operation.kind,
              e.decision,
              e.reason,
            ]),
          ];
        break;
      }
      case 'paging': {
        parsed = parsePaging(memory.state.paging.draft);
        name = memory.state.paging.draft.name;
        const r = memory.state.paging.result;
        if (r)
          rows = [
            ['Final paging results'],
            ['Step', 'Page', 'Hit', 'Frame', 'Evicted', 'Reason'],
            ...r.events.map((e) => [
              e.seq + 1,
              e.page,
              e.hit ? 'hit' : 'fault',
              e.frameIndex,
              e.evicted,
              e.reason,
            ]),
          ];
        break;
      }
      case 'deadlock': {
        const mode = deadlock.state.mode;
        parsed =
          mode === 'graph'
            ? parseGraph(deadlock.state.graph.draft)
            : parseBanker(deadlock.state.banker.draft, true);
        name =
          mode === 'graph'
            ? 'Single-instance resource graph'
            : 'Banker safety and request';
        const r =
          mode === 'graph'
            ? deadlock.state.graph.result
            : deadlock.state.banker.result;
        if (r)
          rows = [
            ['Final resource results', r.outcome],
            ['Step', 'Event', 'Reason'],
            ...r.events.map((e) => [e.seq + 1, e.kind, e.reason]),
          ];
        break;
      }
      case 'synchronization': {
        parsed = parseSync(sync.state.draft);
        name = sync.state.draft.preset;
        const r = sync.state.result;
        if (r)
          rows = [
            ['Final synchronization results', r.outcome],
            ['Final counter', r.summary.counter],
            ['Maximum buffer occupancy (items)', r.summary.maxBufferOccupancy],
            [
              'Step',
              'Process',
              'PC before',
              'PC after',
              'Counter before',
              'Counter after',
              'Event',
              'Reason',
            ],
            ...r.events.map((e) => [
              e.seq + 1,
              e.processId,
              e.pcBefore,
              e.pcAfter,
              e.counterBefore,
              e.counterAfter,
              e.kind,
              e.reason,
            ]),
          ];
        break;
      }
      case 'disk': {
        parsed = parseDisk(disk.state.draft);
        name = disk.state.draft.name;
        const r = disk.state.result;
        if (r)
          rows = [
            ['Final disk results · cylinders'],
            ['Total movement (cylinders)', r.summary.totalMovement],
            ['Average movement (cylinders/request)', r.summary.averageMovement],
            [
              'Step',
              'Event',
              'Request',
              'From (cylinder)',
              'To (cylinder)',
              'Distance (cylinders)',
              'Reason',
            ],
            ...r.events.map((e) => [
              e.seq + 1,
              e.kind,
              e.requestId,
              e.from,
              e.to,
              e.distance,
              e.reason,
            ]),
          ];
        break;
      }
      case 'system': {
        parsed = parseSystem(system.state.draft);
        name = system.state.draft.name;
        const r = system.state.result;
        if (r)
          rows = [
            ['Final integrated results · time units t', r.outcome],
            [
              'ID',
              'CT',
              'TAT',
              'CPU',
              'Ready wait',
              'Resource wait',
              'Memory wait',
              'RT',
            ],
            ...r.metrics.map((p) => [
              p.id,
              p.completion,
              p.turnaround,
              p.cpuService,
              p.readyWait,
              p.resourceWait,
              p.memoryWait,
              p.response,
            ]),
            [],
            ['CPU process', 'Start (t)', 'End (t)'],
            ...r.intervals.map((x) => [x.id ?? 'Idle', x.start, x.end]),
            [],
            ['Event', 'Time (t)', 'Kind', 'Process', 'Resource', 'Reason'],
            ...r.events.map((e) => [
              e.seq,
              e.simTime,
              e.kind,
              e.processId,
              e.resourceId,
              e.reason,
            ]),
          ];
        break;
      }
    }
    if (parsed?.ok) parsed = validateScenario(parsed.result);
    return { parsed, name, rows };
  }, [
    route,
    cpu.state.draft,
    cpu.state.result,
    memory.state.allocation.draft,
    memory.state.allocation.result,
    memory.state.paging.draft,
    memory.state.paging.result,
    deadlock.state.mode,
    deadlock.state.graph.draft,
    deadlock.state.graph.result,
    deadlock.state.banker.draft,
    deadlock.state.banker.result,
    sync.state.draft,
    sync.state.result,
    disk.state.draft,
    disk.state.result,
    system.state.draft,
    system.state.result,
  ]);
  function open(s: Scenario, name: string) {
    const validated = validateScenario(s);
    if (!validated.ok) {
      notice(validated.error.message);
      return false;
    }
    s = validated.result;
    switch (s.kind) {
      case 'cpu':
        cpu.dispatch({ type: 'load-scenario', scenario: s, name });
        {
          const r = scheduleCpu(s);
          cpu.dispatch(
            r.ok
              ? { type: 'run', result: r.result }
              : { type: 'error', error: r.error },
          );
          cpu.dispatch({ type: 'replay', action: { type: 'pause' } });
        }
        break;
      case 'allocation':
        memory.dispatch({
          type: 'allocation-draft',
          draft: {
            name,
            capacity: String(s.totalKiB),
            strategy: s.strategy,
            nextKey: s.operations.length,
            operations: s.operations.map((o, key) => ({
              key,
              kind: o.kind,
              id: o.id,
              size: o.kind === 'allocate' ? String(o.sizeKiB) : '',
            })),
          },
        });
        {
          const r = allocateMemory(s);
          memory.dispatch(
            r.ok
              ? { type: 'allocation-run', result: r.result }
              : { type: 'error', lab: 'allocation', error: r.error },
          );
          memory.dispatch({
            type: 'replay',
            lab: 'allocation',
            action: { type: 'pause' },
          });
        }
        break;
      case 'paging':
        memory.dispatch({
          type: 'paging-draft',
          draft: {
            name,
            frames: String(s.frames),
            algorithm: s.algorithm,
            references: s.references.join(', '),
          },
        });
        {
          const r = replacePages(s);
          memory.dispatch(
            r.ok
              ? { type: 'paging-run', result: r.result }
              : { type: 'error', lab: 'paging', error: r.error },
          );
          memory.dispatch({
            type: 'replay',
            lab: 'paging',
            action: { type: 'pause' },
          });
        }
        break;
      case 'deadlock':
        deadlock.dispatch({ type: 'mode', mode: s.mode });
        if (s.mode === 'graph')
          deadlock.dispatch({
            type: 'graph-edit',
            draft: {
              processes: s.processIds.join(', '),
              resources: s.resourceIds.join(', '),
              allocations: s.allocations,
              requests: s.requests,
            },
          });
        else
          deadlock.dispatch({
            type: 'banker-edit',
            draft: {
              processIds: s.processIds,
              resourceIds: s.resourceIds,
              total: s.total.map(String),
              allocation: s.allocation.map((r) => r.map(String)),
              max: s.max.map((r) => r.map(String)),
              requestProcess: s.request?.processId ?? s.processIds[0] ?? '',
              amount: (s.request?.amount ?? s.resourceIds.map(() => 0)).map(
                String,
              ),
            },
          });
        if (s.mode === 'graph') {
          const r = analyzeGraph(s);
          deadlock.dispatch(
            r.ok
              ? { type: 'graph-run', result: r.result }
              : { type: 'error', mode: 'graph', error: r.error },
          );
        } else {
          const r = runBanker(s);
          deadlock.dispatch(
            r.ok
              ? { type: 'banker-run', result: r.result }
              : { type: 'error', mode: 'banker', error: r.error },
          );
        }
        deadlock.dispatch({
          type: 'replay',
          mode: s.mode,
          action: { type: 'pause' },
        });
        break;
      case 'synchronization':
        sync.dispatch({ type: 'edit', draft: draftFrom(s) });
        sync.dispatch({ type: 'run' });
        sync.dispatch({ type: 'replay', action: { type: 'pause' } });
        break;
      case 'disk':
        disk.dispatch({
          type: 'edit',
          draft: {
            name,
            maxCylinder: String(s.maxCylinder),
            initialHead: String(s.initialHead),
            direction: s.direction,
            algorithm: s.algorithm,
            requests: s.requests.map((r, key) => ({
              key,
              id: r.id,
              cylinder: String(r.cylinder),
            })),
            nextKey: s.requests.length,
          },
        });
        disk.dispatch({ type: 'run' });
        disk.dispatch({ type: 'replay', action: { type: 'pause' } });
        break;
      case 'system':
        system.dispatch({ type: 'load', scenario: s, name });
        system.dispatch({ type: 'run' });
        system.dispatch({ type: 'replay', action: { type: 'pause' } });
        break;
    }
    window.location.hash = `/${s.kind}`;
    return true;
  }
  return { ...selected, open };
}
