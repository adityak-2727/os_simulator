import { lazy, Suspense } from 'react';
import { Button, ScrollTable } from '../../components/Primitives';
import { replacePages, comparePaging } from '../../engine/memory/paging';
import type { PagingEvent } from '../../engine/memory/types';
import type { ReplayAction } from '../../app/replay';
import { useMemory } from './MemoryContext';
import { parsePaging, PAGE_NAMES } from './memoryState';
import { PagingEditor } from './MemoryEditors';
import {
  MemoryEmpty,
  MemoryFooter,
  MemoryHeader,
  MemoryInspector,
} from './MemoryShared';
import { FrameCursor, ReplayControls } from './ReplayControls';
const MemoryComparison = lazy(() =>
  import('./MemoryComparison').then((m) => ({ default: m.MemoryComparison })),
);
const title = (event: PagingEvent) =>
  `Page ${event.page} · ${event.hit ? 'hit' : 'fault'}`;
const ratio = (value: number | null) =>
  value === null ? '—' : `${(value * 100).toFixed(1)}%`;
export function PagingLab() {
  const { state: memory, dispatch } = useMemory(),
    state = memory.paging;
  const { draft, result, replay } = state,
    parsed = parsePaging(draft),
    frame = result?.frames[replay.cursor],
    snapshot = frame?.snapshot,
    event = frame?.event;
  const act = (action: ReplayAction) =>
    dispatch({ type: 'replay', lab: 'paging', action });
  function run() {
    if (replay.playing) {
      act({ type: 'pause' });
      return;
    }
    const response = result
      ? { ok: true as const, result }
      : parsed.ok
        ? replacePages(parsed.result)
        : parsed;
    if (response.ok) dispatch({ type: 'paging-run', result: response.result });
    else dispatch({ type: 'error', lab: 'paging', error: response.error });
  }
  function compare() {
    const response = parsed.ok ? comparePaging(parsed.result) : parsed;
    if (response.ok)
      dispatch({ type: 'paging-compare', results: response.result });
    else dispatch({ type: 'error', lab: 'paging', error: response.error });
  }
  const previous = result?.frames[Math.max(0, replay.cursor - 1)]?.snapshot;
  return (
    <>
      <MemoryHeader
        title="Page replacement"
        name={draft.name}
        algorithm={PAGE_NAMES[draft.algorithm]}
        valid={parsed.ok}
        replay={replay}
        frameCount={result?.frames.length ?? 0}
        error={state.error}
      />
      <div className="workbench memory-workbench">
        <PagingEditor />
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
              kind="paging"
              name={draft.name}
              results={state.comparison}
              inspect={(result) => dispatch({ type: 'paging-inspect', result })}
              back={() => dispatch({ type: 'back', lab: 'paging' })}
            />
          </Suspense>
        ) : (
          <>
            <section
              className="panel canvas-panel"
              aria-label="Paging replay workspace"
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
                      <h2>Reference cursor</h2>
                      <span className="mono">
                        {snapshot.processed} /{' '}
                        {result.scenario.references.length}
                      </span>
                    </div>
                    <p className="subtle small">
                      Reference numbers start at 1; frame indices start at 0.
                      Select a reference to inspect its result.
                    </p>
                    <div
                      className="page-reference-strip"
                      role="group"
                      aria-label="Reference sequence cursor"
                    >
                      {result.scenario.references.map((page, i) => (
                        <button
                          type="button"
                          key={i}
                          className={
                            replay.cursor === i + 1
                              ? 'selected'
                              : i < replay.cursor
                                ? 'processed'
                                : ''
                          }
                          aria-current={
                            replay.cursor === i + 1 ? 'step' : undefined
                          }
                          aria-label={`Inspect reference ${i + 1}, page ${page}`}
                          onClick={() => act({ type: 'seek', cursor: i + 1 })}
                        >
                          <small>#{i + 1}</small>
                          <span>{page}</span>
                        </button>
                      ))}
                    </div>
                    <div
                      className="metric-strip cpu-metric-strip memory-metric-strip"
                      role="region"
                      aria-label="Paging frame metrics"
                    >
                      <div>
                        <strong>{snapshot.faults}</strong>
                        <span>Faults (references)</span>
                      </div>
                      <div>
                        <strong>{snapshot.hits}</strong>
                        <span>Hits (references)</span>
                      </div>
                      <div>
                        <strong>{ratio(snapshot.faultRatio)}</strong>
                        <span>Fault ratio · faults / processed</span>
                      </div>
                      <div>
                        <strong>{ratio(snapshot.hitRatio)}</strong>
                        <span>Hit ratio · hits / processed</span>
                      </div>
                    </div>
                    <p className="subtle small">
                      {replay.cursor === result.events.length
                        ? 'Final metrics'
                        : 'Selected frame · so far'}{' '}
                      · {snapshot.processed} references processed. No
                      elapsed-time estimate is modeled.
                    </p>
                    <div className="section-title">
                      <h2>Resident pages</h2>
                      <span className="subtle small">Selected frame</span>
                    </div>
                    <ScrollTable label="Current page frames">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Frame index</th>
                            <th scope="col">Page</th>
                            <th scope="col">Inserted at ref</th>
                            <th scope="col">Last access ref</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snapshot.pages.map((page, i) => (
                            <tr
                              key={i}
                              className={
                                event?.frameIndex === i
                                  ? 'memory-chosen-row'
                                  : ''
                              }
                            >
                              <th scope="row">{i}</th>
                              <td>{page ?? 'Empty'}</td>
                              <td>
                                {snapshot.insertedAt[i] === null
                                  ? '—'
                                  : (snapshot.insertedAt[i] ?? 0) + 1}
                              </td>
                              <td>
                                {snapshot.lastAccess[i] === null
                                  ? '—'
                                  : (snapshot.lastAccess[i] ?? 0) + 1}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollTable>
                    <div className="section-title">
                      <h2>Frame history</h2>
                      <span className="subtle small">
                        Through this reference
                      </span>
                    </div>
                    <ScrollTable label="Page frame history">
                      <table className="page-history-table">
                        <caption className="sr-only">
                          Each column is a processed reference; H means hit and
                          F means fault
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Reference</th>
                            {result.events.slice(0, replay.cursor).map((e) => (
                              <th scope="col" key={e.seq}>
                                <button
                                  type="button"
                                  className="memory-step-link"
                                  aria-label={`History reference ${e.seq + 1}`}
                                  onClick={() =>
                                    act({ type: 'seek', cursor: e.seq + 1 })
                                  }
                                >
                                  #{e.seq + 1}
                                  <br />
                                  {e.page}
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {snapshot.pages.map((_, i) => (
                            <tr key={i}>
                              <th scope="row">Frame {i}</th>
                              {result.events
                                .slice(0, replay.cursor)
                                .map((e) => (
                                  <td
                                    key={e.seq}
                                    className={
                                      e.frameIndex === i
                                        ? e.hit
                                          ? 'page-hit-cell'
                                          : 'page-fault-cell'
                                        : ''
                                    }
                                  >
                                    {e.frames[i] ?? '—'}
                                  </td>
                                ))}
                            </tr>
                          ))}
                          <tr>
                            <th scope="row">Result</th>
                            {result.events.slice(0, replay.cursor).map((e) => (
                              <td key={e.seq}>{e.hit ? 'H' : 'F'}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </ScrollTable>
                    <p className="subtle small">
                      H = hit · F = fault. Highlight identifies the accessed
                      frame.{' '}
                      {snapshot.processed === 0 &&
                        'No references processed yet.'}
                    </p>
                    <details className="comparison-inputs">
                      <summary>
                        Reference outcomes · equivalent numeric table
                      </summary>
                      <ScrollTable label="Paging reference outcomes">
                        <table>
                          <thead>
                            <tr>
                              <th scope="col">Ref</th>
                              <th scope="col">Page</th>
                              <th scope="col">Result</th>
                              <th scope="col">Frame</th>
                              <th scope="col">Evicted page</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.events.slice(0, replay.cursor).map((e) => (
                              <tr key={e.seq}>
                                <th scope="row">{e.seq + 1}</th>
                                <td>{e.page}</td>
                                <td>{e.hit ? 'Hit' : 'Fault'}</td>
                                <td>{e.frameIndex}</td>
                                <td>{e.evicted ?? 'None'}</td>
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
                    empty={!draft.references.trim()}
                  />
                )}
                <div className="compare-action">
                  <Button disabled={!parsed.ok} onClick={compare}>
                    Compare algorithms
                  </Button>
                </div>
                <div
                  className="sr-only"
                  role="status"
                  aria-live={replay.playing ? 'off' : 'polite'}
                >
                  Step {replay.cursor}.{' '}
                  {event
                    ? title(event)
                    : result
                      ? 'All frames are empty.'
                      : 'No active result.'}
                </div>
              </div>
            </section>
            <MemoryInspector
              title={
                event
                  ? title(event)
                  : result
                    ? 'Initial frames'
                    : 'No active result'
              }
              reason={
                event?.reason ??
                (result
                  ? 'All frames begin empty. Step forward to process the first page reference.'
                  : 'Run a valid sequence to inspect hits, faults, and eviction decisions.')
              }
              events={
                result?.events.map((e) => ({
                  title: title(e),
                  step: e.seq + 1,
                })) ?? []
              }
              cursor={replay.cursor}
              select={(cursor) => act({ type: 'seek', cursor })}
            >
              {event && (
                <>
                  <dl className="detail-list">
                    <div>
                      <dt>Reference</dt>
                      <dd>#{event.referenceIndex + 1}</dd>
                    </div>
                    <div>
                      <dt>Chosen frame</dt>
                      <dd>{event.frameIndex}</dd>
                    </div>
                    <div>
                      <dt>Evicted page</dt>
                      <dd>{event.evicted ?? 'None'}</dd>
                    </div>
                    <div>
                      <dt>Before</dt>
                      <dd>
                        [{previous?.pages.map((p) => p ?? '—').join(', ')}]
                      </dd>
                    </div>
                    <div>
                      <dt>After</dt>
                      <dd>[{event.frames.map((p) => p ?? '—').join(', ')}]</dd>
                    </div>
                  </dl>
                  {event.candidates.length > 0 && (
                    <>
                      <h3>Eviction candidates</h3>
                      <ScrollTable label="Page eviction candidates">
                        <table>
                          <thead>
                            <tr>
                              <th scope="col">Frame</th>
                              <th scope="col">Page</th>
                              <th scope="col">
                                {draft.algorithm === 'fifo'
                                  ? 'Inserted ref'
                                  : draft.algorithm === 'lru'
                                    ? 'Last ref'
                                    : 'Next ref'}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {event.candidates.map((c) => (
                              <tr key={c.frameIndex}>
                                <th scope="row">{c.frameIndex}</th>
                                <td>{c.page}</td>
                                <td>
                                  {draft.algorithm === 'fifo'
                                    ? c.insertedAt + 1
                                    : draft.algorithm === 'lru'
                                      ? c.lastAccess + 1
                                      : c.nextUse === null
                                        ? 'Never again (∞)'
                                        : c.nextUse + 1}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollTable>
                    </>
                  )}
                  <div className="rule-box">
                    <h3>Rule used</h3>
                    <p>
                      {draft.algorithm === 'fifo'
                        ? 'Evict oldest insertion. A hit does not alter FIFO order.'
                        : draft.algorithm === 'lru'
                          ? 'Evict oldest last access. Every hit updates recency.'
                          : 'Evict farthest future use; never again counts as infinity. Lowest frame index resolves ties. Optimal knows the future.'}
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
            A hit preserves frame contents, but changes LRU recency. Compare the
            candidate values at each actual eviction.
          </p>
        </div>
        <details>
          <summary>Try it yourself</summary>
          <p>
            Use two frames and references 1, 2, 1, 3. Why does FIFO evict page 1
            while LRU evicts page 2? Then compare the reference example with
            Optimal, which knows future accesses.
          </p>
        </details>
      </section>
      <MemoryFooter />
    </>
  );
}
