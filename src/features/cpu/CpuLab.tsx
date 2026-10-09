import { lazy, Suspense } from 'react';
import { Button, Icon, Status } from '../../components/Primitives';
import { useCpu } from './CpuContext';
import { ProcessEditor } from './ProcessEditor';
import { CpuInspector } from './CpuInspector';
import { CpuTimeline } from './CpuTimeline';
import { CpuResultsTable, CpuMetrics } from './CpuResults';
import { parseCpuDraft } from './cpuState';
import { compareCpu } from '../../engine/cpu/compare';
import { scheduleCpu } from '../../engine/cpu/schedule';
import {
  ALGORITHM_NAMES,
  describeCpuEvent,
  processStyle,
} from './presentation';
import type { PlaybackSpeed } from '../../app/replay';

const CpuComparison = lazy(() =>
  import('./CpuComparison').then((module) => ({
    default: module.CpuComparison,
  })),
);

export function CpuLab() {
  const { state, dispatch } = useCpu();
  const { result, replay, draft } = state;
  const validation = parseCpuDraft(draft);
  const comparisonValidation = parseCpuDraft(draft, true);
  const frame = result?.frames[replay.cursor];
  const snapshot = frame?.snapshot;
  const last = (result?.frames.length ?? 1) - 1;
  const final = !!result && replay.cursor === last;
  const status = !validation.ok
    ? 'Invalid'
    : state.error?.code === 'limit-exceeded'
      ? 'Trace limit'
      : replay.playing
        ? 'Running'
        : final
          ? 'Completed'
          : replay.cursor
            ? 'Paused'
            : 'Ready';
  const act = (type: 'previous' | 'next' | 'reset' | 'pause') =>
    dispatch({ type: 'replay', action: { type } });
  function run() {
    if (replay.playing) {
      act('pause');
      return;
    }
    if (!validation.ok) {
      dispatch({ type: 'error', error: validation.error });
      return;
    }
    const response = result
      ? { ok: true as const, result }
      : scheduleCpu(validation.result);
    if (response.ok) dispatch({ type: 'run', result: response.result });
    else dispatch({ type: 'error', error: response.error });
  }
  function compare() {
    if (!comparisonValidation.ok) {
      dispatch({ type: 'error', error: comparisonValidation.error });
      return;
    }
    const response = compareCpu(comparisonValidation.result);
    if (response.ok) dispatch({ type: 'compare', results: response.result });
    else dispatch({ type: 'error', error: response.error });
  }
  const description = snapshot
    ? describeCpuEvent(
        frame?.event ?? null,
        snapshot,
        result?.scenario.quantum ?? 2,
      )
    : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LABORATORY / CPU</div>
          <h1>CPU scheduling</h1>
          <p>
            Inspect a schedule, follow every decision, and compare the same
            workload.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled title="Saved experiments are not implemented yet">
            Save
          </Button>
          <Button
            disabled
            title="Scenario and CSV export arrive with saved experiments"
          >
            Export
          </Button>
        </div>
      </div>
      <div className="cpu-workload-heading">
        <span className="subtle">
          {draft.name || 'Unnamed workload'} <span aria-hidden="true">·</span>{' '}
          {ALGORITHM_NAMES[draft.algorithm]}
        </span>
        <Status label={status} />
      </div>
      {state.error && (
        <div role="alert" className="cpu-error">
          <strong>{state.error.message}</strong>
          {state.error.issues.map((issue, index) => (
            <p key={index}>{issue.message}</p>
          ))}
        </div>
      )}
      <div className="workbench cpu-workbench">
        <ProcessEditor />
        {state.view === 'compare' && state.comparison ? (
          <Suspense
            fallback={
              <section className="panel canvas-panel" role="status">
                <div className="canvas-body">Loading comparison charts…</div>
              </section>
            }
          >
            <CpuComparison />
          </Suspense>
        ) : (
          <>
            <section
              className="panel canvas-panel"
              aria-label="CPU replay workspace"
            >
              <div className="playback-toolbar">
                <div className="flex flex-wrap items-center gap-2">
                  <Button primary disabled={!validation.ok} onClick={run}>
                    <Icon name={replay.playing ? 'pause' : 'play'} />
                    {replay.playing ? 'Pause' : final ? 'Replay' : 'Run'}
                  </Button>
                  <Button
                    disabled={!result || replay.cursor === 0}
                    aria-label="Previous event"
                    onClick={() => act('previous')}
                    title="Move back one event"
                  >
                    <Icon name="previous" />
                    Prev
                  </Button>
                  <Button
                    disabled={!result || final}
                    aria-label="Next event"
                    onClick={() => act('next')}
                    title="Move forward one event"
                  >
                    <Icon name="next" />
                    Next
                  </Button>
                  <Button disabled={!result} onClick={() => act('reset')}>
                    <Icon name="reset" />
                    Reset
                  </Button>
                </div>
                <label className="speed-control">
                  Speed
                  <select
                    aria-label="Speed"
                    value={replay.speed}
                    onChange={(e) => {
                      const speed = Number(e.target.value);
                      if (
                        speed === 0.5 ||
                        speed === 1 ||
                        speed === 2 ||
                        speed === 4
                      )
                        dispatch({
                          type: 'replay',
                          action: {
                            type: 'speed',
                            speed: speed as PlaybackSpeed,
                          },
                        });
                    }}
                  >
                    {[0.5, 1, 2, 4].map((speed) => (
                      <option key={speed} value={speed}>
                        {speed}×
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="canvas-body">
                {snapshot && result ? (
                  <>
                    <div className="section-title">
                      <h2>Execution timeline</h2>
                      <span className="mono">t = {snapshot.simTime}</span>
                    </div>
                    <p className="subtle small">
                      {replay.cursor
                        ? 'Elapsed intervals through the selected event'
                        : 'No elapsed service at the initial frame'}
                    </p>
                    <CpuTimeline
                      key={
                        result.scenario.algorithm +
                        result.scenario.processes
                          .map((p) => `${p.id}-${p.arrival}-${p.burst}`)
                          .join('|')
                      }
                      result={result}
                      snapshot={snapshot}
                      onSelect={(cursor) =>
                        dispatch({
                          type: 'replay',
                          action: { type: 'seek', cursor },
                        })
                      }
                    />
                    <CpuMetrics snapshot={snapshot} final={final} />
                    <div className="state-grid">
                      <section>
                        <h3>CPU state</h3>
                        <div className="state-box">
                          {snapshot.running ? (
                            <span
                              className="process-chip"
                              style={processStyle(
                                snapshot.processes.findIndex(
                                  (p) => p.id === snapshot.running,
                                ),
                              )}
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
                                  className="process-chip"
                                  style={processStyle(
                                    snapshot.processes.findIndex(
                                      (p) => p.id === id,
                                    ),
                                  )}
                                  key={id}
                                >
                                  {id}
                                </span>
                              ))}
                              <span className="subtle small">Tail</span>
                            </>
                          ) : (
                            <span className="subtle">
                              {final
                                ? 'Empty · all processes finished'
                                : `No process ready at t = ${snapshot.simTime}`}
                            </span>
                          )}
                        </div>
                      </section>
                    </div>
                    <div className="section-title">
                      <h2>Process results</h2>
                      <span className="subtle small">
                        {final ? 'Final results' : 'Selected frame · so far'}
                      </span>
                    </div>
                    <CpuResultsTable processes={snapshot.processes} />
                    <p className="subtle small results-definition">
                      CT completion · TAT turnaround · WT waiting · RT response.
                      “—” means not yet available; CT/TAT/WT appear only after
                      completion.
                    </p>
                    <div className="cursor-control">
                      <label htmlFor="cpu-frame">
                        Replay frame{' '}
                        <span className="mono">
                          {replay.cursor} / {last}
                        </span>
                      </label>
                      <input
                        id="cpu-frame"
                        type="range"
                        min={0}
                        max={last}
                        step={1}
                        value={replay.cursor}
                        onChange={(e) =>
                          dispatch({
                            type: 'replay',
                            action: {
                              type: 'seek',
                              cursor: Number(e.target.value),
                            },
                          })
                        }
                        aria-valuetext={`Frame ${replay.cursor}, t = ${snapshot.simTime}. ${description?.title}`}
                      />
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <Icon name="cpu" />
                    <h2>
                      {draft.processes.length === 0
                        ? 'Add a CPU workload'
                        : validation.ok
                          ? 'Ready for a new schedule'
                          : 'Check the workload inputs'}
                    </h2>
                    <p>
                      {state.changed
                        ? 'Inputs changed. Run again to update results.'
                        : 'Load an example or enter at least one process.'}
                    </p>
                    <p className="subtle">
                      Your edited values are preserved. Valid inputs enable Run.
                    </p>
                  </div>
                )}
                <div className="compare-action">
                  <Button disabled={!comparisonValidation.ok} onClick={compare}>
                    Compare algorithms
                  </Button>
                  {!comparisonValidation.ok && validation.ok && (
                    <p className="subtle small">
                      Comparison also needs a valid RR quantum. Select Round
                      Robin to edit it.
                    </p>
                  )}
                </div>
              </div>
              <div
                className="sr-only"
                role="status"
                aria-live={replay.playing ? 'off' : 'polite'}
              >
                {result
                  ? `Frame ${replay.cursor}. ${description?.title}. ${status}.`
                  : status}
              </div>
            </section>
            <CpuInspector />
          </>
        )}
      </div>
      <section className="learning-panel">
        <div>
          <h2>What to observe</h2>
          <p>
            {draft.algorithm === 'rr'
              ? 'At a quantum boundary, new arrivals join before the unfinished process is requeued. Inspect the queue between same-time events.'
              : draft.algorithm === 'sjf'
                ? 'SJF chooses the shortest original burst among ready processes. A shorter arrival does not preempt a running process.'
                : draft.algorithm === 'priority'
                  ? 'Smaller priority numbers win among ready processes. A higher-priority arrival waits until the current process completes.'
                  : 'FCFS follows arrival order. An initial idle gap still counts in the utilization observation interval.'}
          </p>
        </div>
        <details>
          <summary>Try it yourself</summary>
          <p>
            Load the reference workload and compare algorithms. Why does Round
            Robin reduce average response time while SJF reduces average waiting
            time? Rewind a dispatch to see its actual ready candidates.
          </p>
        </details>
      </section>
      <footer className="page-footer">
        <span>Browser simulation · deterministic CPU engine</span>
        <span>Engine v0.2.0</span>
      </footer>
    </>
  );
}
