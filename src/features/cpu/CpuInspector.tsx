import { Panel } from '../../components/Primitives';
import { useCpu } from './CpuContext';
import { describeCpuEvent } from './presentation';

export function CpuInspector() {
  const { state, dispatch } = useCpu();
  const result = state.result,
    frame = result?.frames[state.replay.cursor];
  if (!frame || !result)
    return (
      <Panel title="Event inspector" className="inspector-panel">
        <div className="panel-body inspector-empty">
          <h3>No active result</h3>
          <p className="subtle">
            Run a valid workload to inspect its decision, queue transition, and
            calculations.
          </p>
        </div>
      </Panel>
    );
  const description = describeCpuEvent(
    frame.event,
    frame.snapshot,
    result.scenario.quantum,
  );
  const before = result.frames[Math.max(0, frame.index - 1)]?.snapshot;
  const selectedEvent = frame.event;
  const process =
    selectedEvent && 'processId' in selectedEvent
      ? frame.snapshot.processes.find((p) => p.id === selectedEvent.processId)
      : undefined;
  const eventStart = Math.max(
    0,
    Math.min(result.events.length - 7, state.replay.cursor - 4),
  );
  const recent = result.events.slice(eventStart, eventStart + 7);
  return (
    <Panel
      title="Event inspector"
      className="inspector-panel"
      aside={<span className="inspector-marker" aria-hidden="true" />}
    >
      <div className="panel-body">
        <div className="eyebrow mono">
          {frame.event ? `EVENT ${frame.event.seq + 1}` : 'INITIAL FRAME'} · t ={' '}
          {frame.snapshot.simTime}
        </div>
        <h3 className="event-title">{description.title}</h3>
        <p className="event-reason">{description.reason}</p>
        <div className="section-divider" />
        <h3>Queue transition</h3>
        <dl className="detail-list">
          <div>
            <dt>Before</dt>
            <dd className="mono">{before?.ready.join(' → ') || 'Empty'}</dd>
          </div>
          <div>
            <dt>After</dt>
            <dd className="mono">
              {frame.snapshot.ready.join(' → ') || 'Empty'}
            </dd>
          </div>
          <div>
            <dt>CPU</dt>
            <dd className="mono">{frame.snapshot.running ?? 'Idle'}</dd>
          </div>
          {process && (
            <>
              <div>
                <dt>Arrival</dt>
                <dd className="mono">{process.arrival} t</dd>
              </div>
              <div>
                <dt>Service so far</dt>
                <dd className="mono">
                  {process.serviced} / {process.burst} t
                </dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd className="mono">{process.remaining} t</dd>
              </div>
            </>
          )}
        </dl>
        <div className="rule-box">
          <h3>Rule used</h3>
          <p>{description.rule}</p>
        </div>
        <h3 className="trace-heading">Trace events</h3>
        <p className="subtle small">
          Showing events {eventStart + 1}–{eventStart + recent.length} of{' '}
          {result.events.length}. Use the frame slider to reach any event.
        </p>
        <ol className="event-list">
          {recent.map((event) => (
            <li key={event.seq}>
              <button
                type="button"
                aria-label={`Event ${event.seq + 1}: ${describeCpuEvent(event, result.frames[event.seq + 1]?.snapshot ?? frame.snapshot, result.scenario.quantum).title}`}
                aria-current={
                  event.seq + 1 === frame.index ? 'step' : undefined
                }
                onClick={() =>
                  dispatch({
                    type: 'replay',
                    action: { type: 'seek', cursor: event.seq + 1 },
                  })
                }
              >
                <span className="mono">{event.simTime}</span>
                <span>
                  {
                    describeCpuEvent(
                      event,
                      result.frames[event.seq + 1]?.snapshot ?? frame.snapshot,
                      result.scenario.quantum,
                    ).title
                  }
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}
