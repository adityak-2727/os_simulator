import { lazy, Suspense } from 'react';
import { Button, Icon, ScrollTable, Status } from '../../components/Primitives';
import type { ReplayAction } from '../../app/replay';
import { ReplayControls, FrameCursor } from '../memory/ReplayControls';
import { MemoryInspector } from '../memory/MemoryShared';
import { useDisk } from './DiskContext';
import { DISK_NAMES, parseDisk } from './diskState';
import { DiskEditor } from './DiskEditor';
import { DiskPath } from './DiskPath';
const Comparison = lazy(() =>
  import('./DiskComparison').then((m) => ({ default: m.DiskComparison })),
);
export function DiskLab() {
  const { state, dispatch } = useDisk(),
    { result, replay } = state,
    parsed = parseDisk(state.draft),
    frame = result?.frames[replay.cursor],
    s = frame?.snapshot,
    event = frame?.event;
  const act = (action: ReplayAction) => dispatch({ type: 'replay', action });
  const status = !parsed.ok
    ? 'Invalid'
    : state.error
      ? 'Trace limit'
      : replay.playing
        ? 'Running'
        : s?.status === 'completed'
          ? 'Completed'
          : replay.cursor
            ? 'Paused'
            : 'Ready';
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LABORATORY / DISK</div>
          <h1>Disk scheduling</h1>
          <p>
            Follow each request, account for endpoint and wrap travel, and
            compare static-batch rules.
          </p>
        </div>
        <Status label={status} />
      </div>
      <div className="cpu-workload-heading">
        <span className="subtle">
          {state.draft.name || 'Unnamed workload'} ·{' '}
          {DISK_NAMES[state.draft.algorithm]}
        </span>
        <span className="scope-label">
          Movement in cylinders · steps, not time
        </span>
      </div>
      {state.error && (
        <div className="cpu-error" role="alert">
          {state.error.message}
          {state.error.issues.map((i) => (
            <p key={i.path}>{i.message}</p>
          ))}
        </div>
      )}
      {state.view === 'compare' && state.comparison ? (
        <Suspense
          fallback={
            <div className="panel panel-body" role="status">
              Loading comparison chart…
            </div>
          }
        >
          <Comparison
            name={state.draft.name}
            results={state.comparison}
            back={() => dispatch({ type: 'back' })}
            inspect={(result) => dispatch({ type: 'inspect', result })}
          />
        </Suspense>
      ) : (
        <div className="workbench disk-workbench">
          <DiskEditor />
          <section
            className="panel canvas-panel"
            aria-label="Disk replay workspace"
          >
            <ReplayControls
              replay={replay}
              frameCount={result?.frames.length ?? 0}
              valid={parsed.ok}
              run={() =>
                dispatch(
                  replay.playing
                    ? { type: 'replay', action: { type: 'pause' } }
                    : { type: 'run' },
                )
              }
              act={act}
            />
            <div className="canvas-body">
              {result && s ? (
                <>
                  <div className="section-title">
                    <h2>Movement so far</h2>
                    <span className="scope-label">Step {s.step}</span>
                  </div>
                  <div className="metric-strip disk-metrics">
                    <div>
                      <span>Head position</span>
                      <strong data-testid="disk-head">{s.head}</strong>
                      <span>cylinder</span>
                    </div>
                    <div>
                      <span>Cylinders moved</span>
                      <strong data-testid="disk-movement">
                        {s.totalMovement}
                      </strong>
                      <span>includes endpoint & wrap</span>
                    </div>
                    <div>
                      <span>Requests served</span>
                      <strong data-testid="disk-served">
                        {s.serviceOrder.length} /{' '}
                        {result.scenario.requests.length}
                      </strong>
                      <span>separate request IDs</span>
                    </div>
                  </div>
                  <p className="subtle small">
                    Average so far:{' '}
                    <span className="mono" data-testid="disk-average">
                      {s.averageMovement?.toFixed(2) ?? '—'}
                    </span>{' '}
                    cylinders / served request · includes all movement so far.
                    Active sweep:{' '}
                    {result.scenario.algorithm === 'scan' ||
                    result.scenario.algorithm === 'cscan'
                      ? s.direction
                      : 'not used'}
                    .
                  </p>
                  <DiskPath
                    result={result}
                    cursor={replay.cursor}
                    select={(cursor) => act({ type: 'seek', cursor })}
                  />
                  <div className="section-divider" />
                  <h2>Service order so far</h2>
                  <p className="mono disk-order" data-testid="disk-order">
                    {s.serviceOrder.join(' → ') || 'No requests served yet'}
                  </p>
                  <details className="comparison-inputs">
                    <summary>Requests · selected-frame state</summary>
                    <ScrollTable label="Disk request states">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">ID</th>
                            <th scope="col">Cylinder</th>
                            <th scope="col">State</th>
                            <th scope="col">Service #</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.scenario.requests.map((r) => (
                            <tr key={r.id}>
                              <th scope="row">{r.id}</th>
                              <td>{r.cylinder}</td>
                              <td>
                                {s.pendingIds.includes(r.id)
                                  ? 'Pending'
                                  : 'Served'}
                              </td>
                              <td>
                                {s.pendingIds.includes(r.id)
                                  ? '—'
                                  : s.serviceOrder.indexOf(r.id) + 1}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollTable>
                  </details>
                  <div className="section-title">
                    <h2>Movement ledger</h2>
                    <span className="subtle small">Processed moves only</span>
                  </div>
                  <ScrollTable label="Disk movement ledger">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Step</th>
                          <th scope="col">Kind / request</th>
                          <th scope="col">From</th>
                          <th scope="col">To</th>
                          <th scope="col">Distance (cylinders)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.events.slice(0, replay.cursor).map((e) => (
                          <tr
                            key={e.seq}
                            aria-current={
                              e.seq + 1 === replay.cursor ? 'step' : undefined
                            }
                            className={`disk-ledger-${e.kind}`}
                          >
                            <th scope="row">
                              <button
                                className="memory-step-link"
                                type="button"
                                aria-label={`Inspect move ${e.seq + 1}`}
                                onClick={() =>
                                  act({ type: 'seek', cursor: e.seq + 1 })
                                }
                              >
                                {e.seq + 1}
                              </button>
                            </th>
                            <td>
                              {e.kind}
                              {e.requestId ? ` · ${e.requestId}` : ''}
                            </td>
                            <td>{e.from}</td>
                            <td>{e.to}</td>
                            <td>{e.distance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollTable>
                  {s.step === 0 && (
                    <p className="subtle small">
                      The head has not moved. Next inspects the first calculated
                      move.
                    </p>
                  )}
                  <p className="subtle small">
                    Endpoint travel so far: {s.endpointMovement} cylinders ·
                    wrap travel so far: {s.wrapMovement} cylinders.
                  </p>
                  <FrameCursor
                    replay={replay}
                    frameCount={result.frames.length}
                    act={act}
                  />
                </>
              ) : (
                <div className="empty-state">
                  <Icon name="disk" />
                  <h2>
                    {state.draft.requests.length === 0
                      ? 'Add a disk request'
                      : parsed.ok
                        ? 'Ready for a new run'
                        : 'Check the disk inputs'}
                  </h2>
                  <p>
                    {state.changed
                      ? 'Inputs changed. Run again to update results.'
                      : 'Load an example or enter a static request batch.'}
                  </p>
                  <p className="subtle">
                    Edited values are preserved. At least one valid request is
                    required.
                  </p>
                  <Button
                    onClick={() =>
                      dispatch({ type: 'load', example: 'reference' })
                    }
                  >
                    Load example
                  </Button>
                </div>
              )}
              <div className="compare-action">
                <Button
                  disabled={!parsed.ok}
                  onClick={() => dispatch({ type: 'compare' })}
                >
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
                  ? `${event.kind} from ${event.from} to ${event.to}, ${event.distance} cylinders.`
                  : 'No move selected.'}
              </div>
            </div>
          </section>
          <MemoryInspector
            title={
              event
                ? event.kind === 'service'
                  ? `Serve ${event.requestId} at ${event.to}`
                  : `${event.kind === 'wrap' ? 'Circular wrap' : 'Physical endpoint'} · ${event.to}`
                : result
                  ? 'Initial head'
                  : 'No active result'
            }
            reason={
              event?.reason ??
              (result
                ? `Head starts at ${result.scenario.initialHead}, with ${result.scenario.requests.length} pending requests. Step forward to inspect the first decision.`
                : 'Run valid inputs to calculate the movement path.')
            }
            events={
              result?.events.map((e) => ({
                title: `${e.kind === 'service' ? e.requestId : e.kind} · ${e.to}`,
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
                    <dt>Move kind</dt>
                    <dd>{event.kind}</dd>
                  </div>
                  <div>
                    <dt>Request ID</dt>
                    <dd>{event.requestId ?? 'No service'}</dd>
                  </div>
                  <div>
                    <dt>Head</dt>
                    <dd className="mono">
                      {event.from} → {event.to}
                    </dd>
                  </div>
                  <div>
                    <dt>Distance</dt>
                    <dd>{event.distance} cylinders</dd>
                  </div>
                  <div>
                    <dt>Calculation</dt>
                    <dd className="mono">
                      |{event.to} − {event.from}|
                    </dd>
                  </div>
                  <div>
                    <dt>Movement so far</dt>
                    <dd>{s?.totalMovement} cylinders</dd>
                  </div>
                </dl>
                {event.candidates.length > 0 && (
                  <details className="comparison-inputs" open>
                    <summary>SSTF candidates · ranked at this decision</summary>
                    <ScrollTable label="SSTF request candidates">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">ID</th>
                            <th scope="col">Cylinder</th>
                            <th scope="col">Distance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {event.candidates.map((r) => (
                            <tr key={r.id}>
                              <th scope="row">{r.id}</th>
                              <td>{r.cylinder}</td>
                              <td>{r.distance}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollTable>
                  </details>
                )}
              </>
            )}
            <div className="rule-box">
              <h3>What to observe</h3>
              <p>
                Service steps consume exactly one request ID, including
                zero-distance duplicates. Endpoint and wrap steps consume none.
                The total is the sum of every movement ledger distance.
              </p>
            </div>
            <details className="comparison-inputs">
              <summary>Guided exercise</summary>
              <p>
                Load Duplicates and endpoints. Compare FCFS with SSTF, then
                change SCAN to the lower direction. Inspect both zero-distance
                services at the initial head and the endpoint decision before
                crossing sides.
              </p>
            </details>
            <div className="rule-box">
              <h3>Model boundaries</h3>
              <p>
                Static batch; no arrival times. SCAN and C-SCAN use physical
                endpoints, include necessary endpoint travel, and stop at the
                last request. C-SCAN counts wrap distance and serves no requests
                during the wrap. Movement is not I/O latency; rotation, transfer
                time, caching, and SSD behavior are outside this model.
              </p>
            </div>
          </MemoryInspector>
        </div>
      )}
      <footer className="page-footer">
        <span>Browser simulation · deterministic disk engine</span>
        <span>Engine v0.6.0</span>
      </footer>
    </>
  );
}
