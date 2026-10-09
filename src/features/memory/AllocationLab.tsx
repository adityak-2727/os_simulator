import { lazy, Suspense } from 'react';
import { Button, ScrollTable } from '../../components/Primitives';
import {
  allocateMemory,
  compareAllocation,
} from '../../engine/memory/allocation';
import type { AllocationEvent } from '../../engine/memory/types';
import type { ReplayAction } from '../../app/replay';
import { useMemory } from './MemoryContext';
import { parseAllocation, STRATEGY_NAMES } from './memoryState';
import { AllocationEditor } from './MemoryEditors';
import {
  MemoryEmpty,
  MemoryFooter,
  MemoryHeader,
  MemoryInspector,
} from './MemoryShared';
import { FrameCursor, ReplayControls } from './ReplayControls';
import { MemoryMap } from './MemoryMap';
const MemoryComparison = lazy(() =>
  import('./MemoryComparison').then((m) => ({ default: m.MemoryComparison })),
);
function allocationTitle(event: AllocationEvent) {
  return event.decision === 'allocated'
    ? `${event.operation.id} allocated`
    : event.decision === 'freed'
      ? `${event.operation.id} freed`
      : `${event.operation.id} request rejected`;
}
export function AllocationLab() {
  const { state: memory, dispatch } = useMemory(),
    state = memory.allocation;
  const { draft, result, replay } = state,
    parsed = parseAllocation(draft),
    frame = result?.frames[replay.cursor],
    snapshot = frame?.snapshot,
    event = frame?.event;
  const act = (action: ReplayAction) =>
    dispatch({ type: 'replay', lab: 'allocation', action });
  function run() {
    if (replay.playing) {
      act({ type: 'pause' });
      return;
    }
    const response = result
      ? { ok: true as const, result }
      : parsed.ok
        ? allocateMemory(parsed.result)
        : parsed;
    if (response.ok)
      dispatch({ type: 'allocation-run', result: response.result });
    else dispatch({ type: 'error', lab: 'allocation', error: response.error });
  }
  function compare() {
    const response = parsed.ok ? compareAllocation(parsed.result) : parsed;
    if (response.ok)
      dispatch({ type: 'allocation-compare', results: response.result });
    else dispatch({ type: 'error', lab: 'allocation', error: response.error });
  }
  const final = !!result && replay.cursor === result.events.length;
  return (
    <>
      <MemoryHeader
        title="Memory allocation"
        name={draft.name}
        algorithm={STRATEGY_NAMES[draft.strategy]}
        valid={parsed.ok}
        replay={replay}
        frameCount={result?.frames.length ?? 0}
        error={state.error}
      />
      <div className="workbench memory-workbench">
        <AllocationEditor />
        {state.view === 'compare' && state.comparison ? (
          <Suspense
            fallback={
              <section className="panel comparison-panel">
                <p className="panel-body" role="status">
                  Loading comparison…
                </p>
              </section>
            }
          >
            <MemoryComparison
              kind="allocation"
              name={draft.name}
              results={state.comparison}
              inspect={(result) =>
                dispatch({ type: 'allocation-inspect', result })
              }
              back={() => dispatch({ type: 'back', lab: 'allocation' })}
            />
          </Suspense>
        ) : (
          <>
            <section
              className="panel canvas-panel"
              aria-label="Allocation replay workspace"
            >
              <ReplayControls
                replay={replay}
                frameCount={result?.frames.length ?? 0}
                valid={parsed.ok}
                run={run}
                act={act}
              />
              <div className="canvas-body">
                {snapshot && result ? (
                  <>
                    <div className="section-title">
                      <h2>Memory state</h2>
                      <span className="mono">
                        Step {snapshot.step} / {result.events.length}
                      </span>
                    </div>
                    {event &&
                      event.decision !== 'allocated' &&
                      event.decision !== 'freed' && (
                        <div className="memory-step-warning" role="status">
                          <strong>Operation rejected · memory unchanged</strong>
                          <p>{event.reason}</p>
                        </div>
                      )}
                    <div
                      className="metric-strip cpu-metric-strip memory-metric-strip"
                      role="region"
                      aria-label="Allocation frame metrics"
                    >
                      <div>
                        <strong>{snapshot.allocatedKiB}</strong>
                        <span>Allocated (KiB)</span>
                      </div>
                      <div>
                        <strong>{snapshot.totalFreeKiB}</strong>
                        <span>Total free (KiB)</span>
                      </div>
                      <div>
                        <strong>{snapshot.largestHoleKiB}</strong>
                        <span>Largest hole (KiB)</span>
                      </div>
                      <div>
                        <strong>{snapshot.freeOutsideLargestKiB}</strong>
                        <span>Free space outside largest hole (KiB)</span>
                      </div>
                    </div>
                    <p className="subtle small">
                      {final ? 'Final state' : 'Selected frame'} ·{' '}
                      {snapshot.successfulAllocations} successful allocations ·{' '}
                      {snapshot.failedOperations} failed operations ·{' '}
                      {snapshot.liveCount} live IDs
                    </p>
                    <MemoryMap scenario={result.scenario} snapshot={snapshot} />
                    <details className="comparison-inputs">
                      <summary>Operation outcomes through this frame</summary>
                      <ScrollTable label="Allocation operation outcomes">
                        <table>
                          <thead>
                            <tr>
                              <th scope="col">Step</th>
                              <th scope="col">ID</th>
                              <th scope="col">Action</th>
                              <th scope="col">Outcome</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.events.slice(0, replay.cursor).map((e) => (
                              <tr key={e.seq}>
                                <th scope="row">
                                  <button
                                    className="memory-step-link"
                                    type="button"
                                    onClick={() =>
                                      act({ type: 'seek', cursor: e.seq + 1 })
                                    }
                                  >
                                    {e.seq + 1}
                                  </button>
                                </th>
                                <td>{e.operation.id}</td>
                                <td>{e.operation.kind}</td>
                                <td>{e.decision}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollTable>
                    </details>
                    <FrameCursor
                      replay={replay}
                      frameCount={result.frames.length}
                      act={act}
                    />
                  </>
                ) : (
                  <MemoryEmpty
                    valid={parsed.ok}
                    changed={state.changed}
                    empty={!draft.operations.length}
                  />
                )}
                <div className="compare-action">
                  <Button disabled={!parsed.ok} onClick={compare}>
                    Compare algorithms
                  </Button>
                </div>
                <div
                  role="status"
                  aria-live={replay.playing ? 'off' : 'polite'}
                  className="sr-only"
                >
                  Step {replay.cursor}.{' '}
                  {event
                    ? allocationTitle(event)
                    : result
                      ? 'Initial memory is entirely free.'
                      : 'No active result.'}
                </div>
              </div>
            </section>
            <MemoryInspector
              title={
                event
                  ? allocationTitle(event)
                  : result
                    ? 'Initial memory'
                    : 'No active result'
              }
              reason={
                event?.reason ??
                (result
                  ? `All ${result.scenario.totalKiB} KiB are free. Step forward to execute the first operation.`
                  : 'Run a valid workload to inspect its hole selection and memory transitions.')
              }
              events={
                result?.events.map((e) => ({
                  title: allocationTitle(e),
                  step: e.seq + 1,
                })) ?? []
              }
              cursor={replay.cursor}
              select={(cursor) => act({ type: 'seek', cursor })}
            >
              {event && (
                <>
                  <div className="section-divider" />
                  <h3>Holes before operation</h3>
                  {event.holesBefore.length ? (
                    <ScrollTable label="Candidate allocation holes">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Range (KiB)</th>
                            <th scope="col">Size</th>
                            <th scope="col">Selected</th>
                          </tr>
                        </thead>
                        <tbody>
                          {event.holesBefore.map((h) => (
                            <tr key={h.start}>
                              <th scope="row">
                                [{h.start}, {h.end})
                              </th>
                              <td>{h.end - h.start}</td>
                              <td>
                                {event.selectedHole?.start === h.start
                                  ? 'Yes'
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollTable>
                  ) : (
                    <p className="subtle small">No free holes.</p>
                  )}
                  <div className="rule-box">
                    <h3>Rule used</h3>
                    <p>
                      {
                        STRATEGY_NAMES[
                          result?.scenario.strategy ?? draft.strategy
                        ]
                      }{' '}
                      · ties use the lower address. Free coalesces adjacent
                      holes on both sides. Failed operations are visible steps
                      and do not mutate segments.
                    </p>
                  </div>
                </>
              )}
            </MemoryInspector>
          </>
        )}
      </div>
      <section className="learning-panel">
        <div>
          <h2>What to observe</h2>
          <p>
            Total free space alone does not guarantee a contiguous fit. Compare
            the hole selected by each strategy before the last allocation.
          </p>
        </div>
        <details>
          <summary>Try it yourself</summary>
          <p>
            Load Fragmentation failure: why does 400 KiB fail when 524 KiB is
            free? Then load Free and coalesce and inspect how freeing C and D
            creates [100, 1024).
          </p>
        </details>
      </section>
      <MemoryFooter />
    </>
  );
}
