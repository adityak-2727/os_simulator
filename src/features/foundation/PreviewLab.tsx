import { useId } from 'react';
import { useLab } from '../../app/LabContext';
import type { PlaybackSpeed } from '../../app/replay';
import { createPreview, type PreviewEvent } from '../../engine/preview';
import {
  Button,
  Icon,
  Panel,
  ScrollTable,
  Status,
} from '../../components/Primitives';
import { PreviewTimeline } from '../../components/PreviewTimeline';

function describeEvent(event: PreviewEvent | null) {
  if (!event)
    return {
      title: 'Initial frame',
      reason:
        'The trace is loaded. No event has occurred yet; both fixture processes are still new.',
      rule: 'Frame 0 is the state before the first event.',
    };
  switch (event.kind) {
    case 'fixture-queued':
      return {
        title: 'P1 and P2 enter the queue',
        reason:
          'The scripted fixture places P1 at the head and P2 at the tail. Both entries are now ready.',
        rule: 'Fixture order is explicitly P1, then P2. No scheduling algorithm is being evaluated.',
      };
    case 'fixture-started':
      return {
        title: `${event.processId} starts`,
        reason: `${event.processId} moves out of the ready queue and into the running slot at t = ${event.simTime}.`,
        rule: 'This is the next start transition in the scripted trace; playback does not choose a process.',
      };
    case 'fixture-finished':
      return {
        title: `${event.processId} completes`,
        reason: `${event.processId} completes ${event.duration} time units of scripted work at t = ${event.simTime}. Its interval is now visible on the timeline.`,
        rule: `Start ${(event.simTime ?? 0) - event.duration} + duration ${event.duration} = end ${event.simTime}.`,
      };
  }
}

export function PreviewLab() {
  const { state, dispatch } = useLab();
  const { result, replay, draft } = state;
  const response = createPreview({
    firstDuration: Number(draft.firstDuration),
    secondDuration: Number(draft.secondDuration),
  });
  const issues = response.ok ? [] : response.error.issues;
  const frame = result?.frames[replay.cursor];
  const snapshot = frame?.snapshot;
  const last = result ? result.frames.length - 1 : 0;
  const status = issues.length
    ? 'Invalid'
    : !result
      ? 'Ready to run'
      : replay.playing
        ? 'Running'
        : replay.cursor === last
          ? 'Completed'
          : replay.cursor === 0
            ? 'Ready'
            : 'Paused';
  const description = describeEvent(frame?.event ?? null);
  const fieldPrefix = useId();
  const act = (type: 'pause' | 'previous' | 'next' | 'reset') =>
    dispatch({ type: 'replay', action: { type } });

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FOUNDATION / PHASE 01</div>
          <h1>CPU scheduling</h1>
          <p>
            Inspect a trace. Follow each transition. Keep every view in sync.
          </p>
        </div>
        <span className="scope-label">Fixture preview</span>
      </div>
      <div className="scope-note">
        <strong>Replay infrastructure preview.</strong> This is a scripted
        two-process trace, not a CPU algorithm. FCFS, SJF, Priority, and Round
        Robin arrive in Phase 2.
      </div>
      <div className="workbench">
        <Panel
          title="Fixture inputs"
          aside={<span className="subtle">2 processes</span>}
          className="input-panel"
        >
          <div className="panel-body">
            <p className="subtle intro">Example · P1, then P2</p>
            <div className="input-grid input-grid-head">
              <span>Process</span>
              <span>Duration (t)</span>
            </div>
            {(['firstDuration', 'secondDuration'] as const).map((field, i) => {
              const error = issues.find((issue) => issue.path === field);
              const id = `${fieldPrefix}-${field}`;
              return (
                <div key={field}>
                  <div className="input-grid">
                    <label htmlFor={id} className="process-label">
                      <span className={`process-dot p${i + 1}`} />
                      <span className="mono">P{i + 1}</span>
                      <span className="sr-only"> duration in time units</span>
                    </label>
                    <input
                      id={id}
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      value={draft[field]}
                      aria-invalid={!!error}
                      aria-describedby={
                        error ? `${id}-error` : `${fieldPrefix}-limits`
                      }
                      onChange={(e) =>
                        dispatch({ type: 'edit', field, value: e.target.value })
                      }
                    />
                  </div>
                  {error && (
                    <p id={`${id}-error`} className="field-error">
                      {error.message}
                    </p>
                  )}
                </div>
              );
            })}
            <p id={`${fieldPrefix}-limits`} className="subtle small">
              Whole numbers, 1–20 time units each.
            </p>
            <Button
              className="w-full"
              onClick={() => dispatch({ type: 'example' })}
            >
              Load example
            </Button>
            <div className="section-divider" />
            <label className="field-label" htmlFor={`${fieldPrefix}-algorithm`}>
              Scheduling algorithm
            </label>
            <select
              id={`${fieldPrefix}-algorithm`}
              disabled
              aria-describedby={`${fieldPrefix}-algorithm-note`}
            >
              <option>Available in Phase 2</option>
            </select>
            <p id={`${fieldPrefix}-algorithm-note`} className="subtle small">
              This fixture demonstrates playback only.
            </p>
            <details open className="assumptions">
              <summary>Model assumptions</summary>
              <ul>
                <li>Scripted order: P1 → P2</li>
                <li>One running slot</li>
                <li>No context-switch time</li>
                <li>Clock begins at t = 0</li>
                <li>Same-time events remain distinct</li>
              </ul>
            </details>
          </div>
        </Panel>
        <section className="panel canvas-panel" aria-label="Replay workspace">
          <div className="playback-toolbar">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                primary
                disabled={!response.ok}
                onClick={() => {
                  if (replay.playing) act('pause');
                  else if (response.ok)
                    dispatch({ type: 'run', result: response.result });
                }}
              >
                <Icon name={replay.playing ? 'pause' : 'play'} />
                {replay.playing
                  ? 'Pause'
                  : result && replay.cursor === last
                    ? 'Replay'
                    : 'Run'}
              </Button>
              <Button
                disabled={!result || replay.cursor === 0}
                onClick={() => act('previous')}
                aria-label="Previous event"
                title="Move back one event"
              >
                <Icon name="previous" />
                <span>Prev</span>
              </Button>
              <Button
                disabled={!result || replay.cursor === last}
                onClick={() => act('next')}
                aria-label="Next event"
                title="Move forward one event"
              >
                <Icon name="next" />
                <span>Next</span>
              </Button>
              <Button disabled={!result} onClick={() => act('reset')}>
                <Icon name="reset" />
                Reset
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <label className="speed-control">
                Speed
                <select
                  value={replay.speed}
                  onChange={(e) =>
                    dispatch({
                      type: 'replay',
                      action: {
                        type: 'speed',
                        speed: Number(e.target.value) as PlaybackSpeed,
                      },
                    })
                  }
                >
                  {[0.5, 1, 2, 4].map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}×
                    </option>
                  ))}
                </select>
              </label>
              <Status label={status} />
            </div>
          </div>
          <div className="canvas-body">
            {!snapshot || !result ? (
              <div className="empty-state">
                <Icon name="cpu" />
                <h2>
                  {issues.length
                    ? 'Check the fixture inputs'
                    : 'Ready for a new trace'}
                </h2>
                <p>
                  {state.changed
                    ? 'Inputs changed. Run again to update results.'
                    : 'Load an example to inspect the replay.'}
                </p>
                <p className="subtle">
                  Your edited values are preserved. A valid input enables Run.
                </p>
              </div>
            ) : (
              <>
                <div className="section-title">
                  <h2>Execution timeline</h2>
                  <span className="mono">t = {snapshot.simTime}</span>
                </div>
                <p className="subtle small">
                  Completed intervals · one uniform time scale
                </p>
                <PreviewTimeline result={result} snapshot={snapshot} />
                <div className="metric-strip">
                  <div>
                    <strong>
                      {snapshot.simTime}
                      <small> t</small>
                    </strong>
                    <span>Elapsed simulation time</span>
                  </div>
                  <div>
                    <strong>
                      {snapshot.completed.length}
                      <small> / 2</small>
                    </strong>
                    <span>Processes completed so far</span>
                  </div>
                  <div>
                    <strong>
                      {replay.cursor}
                      <small> / {result.events.length}</small>
                    </strong>
                    <span>Events observed</span>
                  </div>
                </div>
                <div className="state-grid">
                  <section>
                    <h3>Running slot</h3>
                    <div className="state-box">
                      {snapshot.running ? (
                        <span
                          className={`process-chip ${snapshot.running.toLowerCase()}`}
                        >
                          {snapshot.running} · Running
                        </span>
                      ) : (
                        <span className="subtle">
                          Idle · no process running
                        </span>
                      )}
                    </div>
                  </section>
                  <section>
                    <h3>Ready queue</h3>
                    <div className="state-box queue">
                      {snapshot.ready.length ? (
                        <>
                          <span className="subtle small">Head</span>
                          {snapshot.ready.map((id) => (
                            <span
                              className={`process-chip ${id.toLowerCase()}`}
                              key={id}
                            >
                              {id}
                            </span>
                          ))}
                          <span className="subtle small">Tail</span>
                        </>
                      ) : (
                        <span className="subtle">Empty · no process ready</span>
                      )}
                    </div>
                  </section>
                </div>
                <div className="section-title">
                  <h2>Interval ledger</h2>
                  <span className="subtle small">Selected frame only</span>
                </div>
                <ScrollTable label="Completed fixture intervals">
                  <table>
                    <caption className="sr-only">
                      Completed intervals in time units at the selected frame
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Process</th>
                        <th scope="col">Start (t)</th>
                        <th scope="col">End (t)</th>
                        <th scope="col">Duration (t)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.segments.length ? (
                        snapshot.segments.map((s) => (
                          <tr key={s.processId}>
                            <th scope="row">
                              <span
                                className={`process-dot ${s.processId.toLowerCase()}`}
                              />
                              {s.processId}
                            </th>
                            <td>{s.start}</td>
                            <td>{s.end}</td>
                            <td>{s.end - s.start}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="table-empty">
                            No completed intervals at this frame.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollTable>
                <p className="frame-counter mono">
                  Frame {replay.cursor} / {last}{' '}
                  <span className="subtle">
                    · initial frame + {result.events.length} events
                  </span>
                </p>
              </>
            )}
          </div>
          <div
            className="sr-only"
            role="status"
            aria-live={replay.playing ? 'off' : 'polite'}
          >
            {result
              ? `Frame ${replay.cursor}. ${description.title}. ${status}.`
              : status}
          </div>
        </section>
        <Panel
          title="Event inspector"
          className="inspector-panel"
          aside={<span className="inspector-marker" aria-hidden="true" />}
        >
          <div className="panel-body">
            {snapshot && result ? (
              <>
                <div className="eyebrow mono">
                  {frame?.event
                    ? `EVENT ${frame.event.seq + 1} · t = ${snapshot.simTime}`
                    : 'FRAME 0 · t = 0'}
                </div>
                <h3 className="event-title">{description.title}</h3>
                <p className="event-reason">{description.reason}</p>
                <div className="section-divider" />
                <h3>Transition</h3>
                <dl className="detail-list">
                  <div>
                    <dt>Before</dt>
                    <dd className="mono">
                      t ={' '}
                      {result.frames[Math.max(0, replay.cursor - 1)]?.snapshot
                        .simTime ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt>After</dt>
                    <dd className="mono">t = {snapshot.simTime}</dd>
                  </div>
                  <div>
                    <dt>Running</dt>
                    <dd className="mono">{snapshot.running ?? 'None'}</dd>
                  </div>
                  <div>
                    <dt>Completed</dt>
                    <dd className="mono">
                      {snapshot.completed.join(', ') || 'None'}
                    </dd>
                  </div>
                </dl>
                <div className="rule-box">
                  <h3>Rule used</h3>
                  <p>{description.rule}</p>
                </div>
                <h3 className="trace-heading">Trace events</h3>
                <p className="subtle small">
                  Select an event to inspect its frame.
                </p>
                <ol className="event-list">
                  {result.events.map((event) => (
                    <li key={event.seq}>
                      <button
                        type="button"
                        aria-current={
                          event.seq + 1 === replay.cursor ? 'step' : undefined
                        }
                        onClick={() =>
                          dispatch({
                            type: 'replay',
                            action: { type: 'seek', cursor: event.seq + 1 },
                          })
                        }
                      >
                        <span className="mono">{event.simTime}</span>
                        <span>{describeEvent(event).title}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <div className="inspector-empty">
                <h3>No active result</h3>
                <p className="subtle">
                  Run a valid fixture to inspect the event, transition, and rule
                  together.
                </p>
              </div>
            )}
          </div>
        </Panel>
      </div>
      <section className="learning-panel">
        <div>
          <h2>What to observe</h2>
          <p>
            P1 completes and P2 starts at the same simulation time. Step through
            both events: the queue changes while the clock stays still.
          </p>
        </div>
        <details>
          <summary>Try it yourself</summary>
          <p>
            Run to completion, move back two events, then change playback speed.
            Does the selected frame or the computed trace change? Reset returns
            to frame 0 and preserves the trace.
          </p>
        </details>
      </section>
      <footer className="page-footer">
        <span>Browser simulation · deterministic fixture</span>
        <span>Engine v0.1.0-preview</span>
      </footer>
    </>
  );
}
