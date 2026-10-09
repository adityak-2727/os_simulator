import { lazy, Suspense } from 'react';
import { Button, ScrollTable, Status } from '../../components/Primitives';
import type { ReplayAction } from '../../app/replay';
import { analyzeGraph } from '../../engine/deadlock/graph';
import { runBanker } from '../../engine/deadlock/banker';
import { FrameCursor, ReplayControls } from '../memory/ReplayControls';
import { MemoryEmpty, MemoryInspector } from '../memory/MemoryShared';
import { useDeadlock } from './DeadlockContext';
import { parseBanker, parseGraph } from './deadlockState';
import { GraphEditor } from './GraphEditor';
import { BankerEditor } from './BankerEditor';
import { BankerView } from './BankerView';
import { formatVector } from './format';
const ResourceGraph = lazy(() =>
  import('./ResourceGraph').then((m) => ({ default: m.ResourceGraph })),
);
const labels: Record<string, string> = {
  'graph-visit': 'Follow outgoing arrows',
  'graph-backtrack': 'Backtrack',
  'graph-cycle': 'Directed cycle found',
  'graph-no-cycle': 'No directed cycle',
  'request-tentative': 'Tentative request',
  'banker-select': 'Select eligible process',
  'banker-safe': 'Safe sequence found',
  'banker-unsafe': 'No eligible process',
  'request-decision': 'Request decision',
};
const statuses: Record<string, string> = {
  deadlocked: 'Deadlocked',
  'no-cycle': 'No cycle',
  safe: 'Safe',
  unsafe: 'Unsafe',
  granted: 'Granted',
  'wait-for-availability': 'Wait for availability',
  'wait-for-safety': 'Wait for safety',
  invalid: 'Invalid request',
};
export function DeadlockLab() {
  const { state, dispatch } = useDeadlock(),
    { mode } = state,
    lab = state[mode],
    { result, replay } = lab;
  const parsed =
    mode === 'graph'
      ? parseGraph(state.graph.draft)
      : parseBanker(state.banker.draft);
  const frame = result?.frames[replay.cursor],
    snapshot = frame?.snapshot,
    event = frame?.event;
  const act = (action: ReplayAction) =>
    dispatch({ type: 'replay', mode, action });
  function run() {
    if (replay.playing) {
      act({ type: 'pause' });
      return;
    }
    if (mode === 'graph') {
      const input = parseGraph(state.graph.draft),
        response = state.graph.result
          ? { ok: true as const, result: state.graph.result }
          : input.ok
            ? analyzeGraph(input.result)
            : input;
      if (response.ok) dispatch({ type: 'graph-run', result: response.result });
      else dispatch({ type: 'error', mode: 'graph', error: response.error });
    } else {
      const input = parseBanker(state.banker.draft),
        response = state.banker.result
          ? { ok: true as const, result: state.banker.result }
          : input.ok
            ? runBanker(input.result)
            : input;
      if (response.ok)
        dispatch({ type: 'banker-run', result: response.result });
      else dispatch({ type: 'error', mode: 'banker', error: response.error });
    }
  }
  function evaluate() {
    const input = parseBanker(state.banker.draft, true),
      response = input.ok ? runBanker(input.result) : input;
    if (response.ok) dispatch({ type: 'banker-run', result: response.result });
    else dispatch({ type: 'error', mode: 'banker', error: response.error });
  }
  const status = !parsed.ok
    ? 'Invalid'
    : lab.error
      ? 'Engine error'
      : replay.playing
        ? 'Running'
        : snapshot && snapshot.status !== 'checking'
          ? (statuses[snapshot.status] ?? 'Ready')
          : replay.cursor
            ? 'Paused'
            : 'Ready';
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LABORATORY / RESOURCES</div>
          <h1>Deadlock & resource safety</h1>
          <p>
            Trace ownership cycles and check whether every process can finish.
          </p>
        </div>
      </div>
      <div className="deadlock-mode-bar">
        <div role="group" aria-label="Deadlock model">
          <Button
            primary={mode === 'graph'}
            aria-pressed={mode === 'graph'}
            onClick={() => dispatch({ type: 'mode', mode: 'graph' })}
          >
            Resource graph
          </Button>
          <Button
            primary={mode === 'banker'}
            aria-pressed={mode === 'banker'}
            onClick={() => dispatch({ type: 'mode', mode: 'banker' })}
          >
            Banker’s algorithm
          </Button>
        </div>
        <Status label={status} />
      </div>
      {lab.error && (
        <div className="cpu-error" role="alert">
          {lab.error.message}
        </div>
      )}
      <div className="workbench deadlock-workbench">
        {mode === 'graph' ? (
          <GraphEditor />
        ) : (
          <BankerEditor evaluate={evaluate} />
        )}
        <section
          className="panel canvas-panel"
          aria-label="Deadlock replay workspace"
        >
          <ReplayControls
            replay={replay}
            frameCount={result?.frames.length ?? 0}
            valid={parsed.ok}
            run={run}
            act={act}
          />
          <div className="canvas-body">
            {mode === 'graph' &&
            state.graph.result &&
            state.graph.result.frames[replay.cursor] ? (
              (() => {
                const r = state.graph.result,
                  s = r.frames[replay.cursor]!.snapshot;
                return (
                  <>
                    <div className="section-title">
                      <h2>Single-instance resource graph</h2>
                      <span className="scope-label">Step {s.step}</span>
                    </div>
                    <p className="graph-legend">
                      <span>○ Process</span>
                      <span>□ Resource · 1 instance</span>
                      <span>Dashed: request → resource</span>
                      <span>Solid: allocation → process</span>
                    </p>
                    <Suspense
                      fallback={
                        <p role="status">Loading graph visualization…</p>
                      }
                    >
                      <ResourceGraph result={r} snapshot={s} />
                    </Suspense>
                    <div
                      className={`rule-box ${s.status === 'deadlocked' ? 'deadlock-alert' : ''}`}
                      role={s.status === 'deadlocked' ? 'status' : undefined}
                    >
                      <h3>
                        {s.status === 'deadlocked'
                          ? 'Cycle proves deadlock'
                          : s.status === 'no-cycle'
                            ? 'No cycle found'
                            : 'Directed cycle search'}
                      </h3>
                      <p className="mono" data-testid="graph-path">
                        {(s.cycle.length ? s.cycle : s.path)
                          .map((n) => n.id)
                          .join(' → ') || 'No active search path'}
                      </p>
                      {s.status === 'deadlocked' ? (
                        <p>
                          Blocked cycle processes:{' '}
                          {s.blockedProcessIds.join(', ')}. Every resource has
                          one instance.
                        </p>
                      ) : s.status === 'no-cycle' ? (
                        <p>
                          Pending requests may still wait for an owner to
                          release a resource. No cycle does not mean every
                          request is immediately available.
                        </p>
                      ) : (
                        <p>
                          Visit nodes and outgoing arrows in input order. A
                          return to a node on the active path closes a cycle.
                        </p>
                      )}
                    </div>
                    <ScrollTable label="Graph edges at selected frame">
                      <table>
                        <thead>
                          <tr>
                            <th>Edge</th>
                            <th>From</th>
                            <th>To</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.edges.map((e, i) => (
                            <tr key={i}>
                              <td>{e.kind}</td>
                              <td>
                                {e.source.kind} {e.source.id}
                              </td>
                              <td>
                                {e.target.kind} {e.target.id}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollTable>
                    <ScrollTable label="Resource ownership">
                      <table>
                        <thead>
                          <tr>
                            <th>Resource</th>
                            <th>Owner</th>
                            <th>Pending requests</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.scenario.resourceIds.map((id) => (
                            <tr key={id}>
                              <th>{id}</th>
                              <td>
                                {r.scenario.allocations.find(
                                  (a) => a.resourceId === id,
                                )?.processId ?? 'Available'}
                              </td>
                              <td>
                                {r.scenario.requests
                                  .filter((a) => a.resourceId === id)
                                  .map((a) => a.processId)
                                  .join(', ') || 'None'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollTable>
                  </>
                );
              })()
            ) : mode === 'banker' &&
              state.banker.result &&
              state.banker.result.frames[replay.cursor] ? (
              <BankerView
                result={state.banker.result}
                snapshot={state.banker.result.frames[replay.cursor]!.snapshot}
                select={(cursor) => act({ type: 'seek', cursor })}
                continueGrant={() => {
                  const r = state.banker.result;
                  if (r)
                    dispatch({
                      type: 'banker-edit',
                      draft: {
                        ...state.banker.draft,
                        allocation: r.finalState.allocation.map((row) =>
                          row.map(String),
                        ),
                        amount: r.scenario.resourceIds.map(() => '0'),
                      },
                    });
                }}
              />
            ) : (
              <MemoryEmpty
                valid={parsed.ok}
                changed={lab.changed}
                empty={
                  mode === 'graph'
                    ? !state.graph.draft.processes.trim() ||
                      !state.graph.draft.resources.trim()
                    : !state.banker.draft.processIds.length ||
                      !state.banker.draft.resourceIds.length
                }
              />
            )}
            {result && (
              <FrameCursor
                replay={replay}
                frameCount={result.frames.length}
                act={act}
              />
            )}
          </div>
        </section>
        <MemoryInspector
          title={
            event
              ? event.kind === 'banker-select'
                ? `${'processId' in event ? event.processId : ''} selected`
                : (labels[event.kind] ?? event.kind)
              : result
                ? 'Initial frame'
                : 'No active result'
          }
          reason={
            event?.reason ??
            (result
              ? mode === 'graph'
                ? 'Source ownership and requests are fixed throughout this cycle search. Run or step to inspect the first visited node.'
                : 'Work begins at Available and all Finish flags are false. Run replays safety without a request. Evaluate request starts a tentative transaction.'
              : 'Inputs changed. Run again to update results.')
          }
          events={
            result?.events.map((e) => ({
              title:
                e.kind === 'banker-select' && 'processId' in e
                  ? `${e.processId} selected`
                  : (labels[e.kind] ?? e.kind),
              step: e.seq + 1,
            })) ?? []
          }
          cursor={replay.cursor}
          select={(cursor) => act({ type: 'seek', cursor })}
        >
          {mode === 'banker' && event && 'workBefore' in event && (
            <dl className="detail-list">
              <div>
                <dt>Work before</dt>
                <dd className="mono">{formatVector(event.workBefore)}</dd>
              </div>
              <div>
                <dt>Work after</dt>
                <dd className="mono">{formatVector(event.workAfter)}</dd>
              </div>
              {event.eligible.length > 0 && (
                <div>
                  <dt>Eligible, input order</dt>
                  <dd>{event.eligible.join(', ')}</dd>
                </div>
              )}
            </dl>
          )}
          <div className="rule-box">
            <h3>Model boundary</h3>
            <p>
              {mode === 'graph'
                ? 'Reusable resources; one instance per resource. Request arrows run from process to resource. Allocation arrows run from resource to owner. A directed cycle proves deadlock only in this model.'
                : 'Banker uses multiple instances. Select the lowest input-index unfinished process with Need ≤ Work, add its Allocation to Work, and restart from row 0. Unsafe does not prove current deadlock.'}
            </p>
          </div>
        </MemoryInspector>
      </div>
      <footer className="page-footer">
        <span>
          Browser simulation · deterministic resource engine · steps are not
          time
        </span>
        <span>Engine v0.4.0</span>
      </footer>
    </>
  );
}
