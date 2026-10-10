import { Icon, Panel, Status } from '../../components/Primitives';
import type { ReplayState } from '../../app/replay';
import type { EngineError } from '../../engine/contracts';
import type { ReactNode } from 'react';

export function MemoryHeader({
  title,
  name,
  algorithm,
  valid,
  replay,
  frameCount,
  error,
}: {
  title: string;
  name: string;
  algorithm: string;
  valid: boolean;
  replay: ReplayState;
  frameCount: number;
  error: EngineError | null;
}) {
  const status = !valid
    ? 'Invalid'
    : error
      ? 'Trace limit'
      : replay.playing
        ? 'Running'
        : frameCount > 1 && replay.cursor === frameCount - 1
          ? 'Completed'
          : replay.cursor
            ? 'Paused'
            : 'Ready';
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LABORATORY / MEMORY</div>
          <h1>{title}</h1>
          <p>
            {title === 'Memory allocation'
              ? 'Follow each operation, inspect the holes, and account for every KiB.'
              : 'Follow each reference, inspect eviction decisions, and compare replacement rules.'}
          </p>
        </div>
      </div>
      <div className="cpu-workload-heading memory-workload-heading">
        <span className="subtle">
          {name || 'Unnamed workload'} · {algorithm}
        </span>
        <Status label={status} />
      </div>
      {error && (
        <div className="cpu-error" role="alert">
          <strong>{error.message}</strong>
          {error.issues.map((i) => (
            <p key={i.path}>{i.message}</p>
          ))}
        </div>
      )}
    </>
  );
}
export function MemoryEmpty({
  valid,
  changed,
  empty,
}: {
  valid: boolean;
  changed: boolean;
  empty: boolean;
}) {
  return (
    <div className="empty-state">
      <Icon name="memory" />
      <h2>
        {empty
          ? 'Add a workload'
          : valid
            ? 'Ready for a new run'
            : 'Check the workload inputs'}
      </h2>
      <p>
        {changed
          ? 'Inputs changed. Run again to update results.'
          : 'Load an example or enter the required input.'}
      </p>
      <p className="subtle">
        Edited values are preserved. Valid inputs enable Run.
      </p>
    </div>
  );
}
export function MemoryInspector({
  title,
  reason,
  children,
  events,
  cursor,
  select,
}: {
  title: string;
  reason: string;
  children?: ReactNode;
  events: readonly { title: string; step: number }[];
  cursor: number;
  select: (cursor: number) => void;
}) {
  const start = Math.max(0, cursor - 4),
    visible = events.slice(start, start + 7);
  return (
    <Panel title="Event inspector" className="inspector-panel">
      <div className="panel-body">
        <div className="eyebrow">STEP {cursor}</div>
        <h2 className="event-title">{title}</h2>
        <p className="event-copy">{reason}</p>
        {children}
        {events.length > 0 && (
          <>
            <div className="section-divider" />
            <h3>Trace events</h3>
            <p className="subtle small">
              Showing steps {start + 1}–{start + visible.length}. Use the frame
              slider to reach any step.
            </p>
            <div className="event-list">
              {visible.map((e) => (
                <button
                  type="button"
                  key={e.step}
                  className={cursor === e.step ? 'selected' : ''}
                  aria-current={cursor === e.step ? 'step' : undefined}
                  onClick={() => select(e.step)}
                >
                  <span className="mono">{e.step}</span>
                  <span>{e.title}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
export function MemoryFooter() {
  return (
    <footer className="page-footer">
      <span>Browser simulation · deterministic memory engine</span>
      <span>Engine v0.3.0</span>
    </footer>
  );
}
