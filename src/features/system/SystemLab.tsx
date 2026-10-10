import { useState, useMemo } from 'react';
import {
  Button,
  Panel,
  ScrollTable,
  Status,
} from '../../components/Primitives';
import { ReplayControls, FrameCursor } from '../memory/ReplayControls';
import { MemoryInspector } from '../memory/MemoryShared';
import { processColor } from '../cpu/presentation';
import type { SystemResult, SystemSnapshot } from '../../engine/system/types';
import { useSystem } from './SystemContext';
import { parseSystem, systemExample } from './systemState';
export function SystemLab() {
  const { state, dispatch } = useSystem(),
    { draft, result, replay } = state,
    parsed = useMemo(() => parseSystem(draft), [draft]),
    frame = result?.frames[replay.cursor],
    s = frame?.snapshot;
  const traceEvents = useMemo(
    () =>
      result?.events.map((e) => ({
        title: `t=${e.simTime} · ${e.processId ?? ''} ${e.kind}`,
        step: e.seq + 1,
      })) ?? [],
    [result],
  );
  const invalid = (path: string) =>
    !parsed.ok &&
    parsed.error.issues.some(
      (i) => i.path === path || i.path.startsWith(path + '.'),
    );
  const edit = (patch: Partial<typeof draft>) =>
    dispatch({ type: 'edit', draft: { ...draft, ...patch } });
  const act = (action: Parameters<typeof dispatch>[0] & { type: 'replay' }) =>
    dispatch(action);
  const status = !draft.processes.length
    ? 'Empty'
    : !parsed.ok
      ? 'Invalid'
      : state.error
        ? 'Trace limit'
        : replay.playing
          ? 'Running'
          : s?.status !== 'active' && s?.status
            ? s.status === 'model-error'
              ? 'Model error'
              : s.status[0]!.toUpperCase() + s.status.slice(1)
            : s?.processes.some((p) => p.state === 'blocked')
              ? 'Blocked'
              : replay.cursor
                ? 'Paused'
                : 'Ready';
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LABORATORY / INTEGRATED</div>
          <h1>Integrated system</h1>
          <p>
            One clock joins Round Robin, first-fit admission and resource
            blocking.
          </p>
        </div>
        <Status label={status} />
      </div>
      <div className="cpu-workload-heading">
        <span>{draft.name}</span>
        <span className="scope-label">
          RR · First Fit · one instance per resource
        </span>
      </div>
      <div className="workbench system-workbench">
        <Panel title="Configuration" className="input-panel">
          <div className="panel-body system-editor">
            <label>
              Scenario name
              <input
                aria-label="Scenario name"
                aria-invalid={invalid('name')}
                value={draft.name}
                onChange={(e) => edit({ name: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {(['reference', 'cycle', 'idle'] as const).map((kind) => (
                <Button
                  key={kind}
                  onClick={() =>
                    dispatch({
                      type: 'load',
                      scenario: systemExample(kind),
                      name:
                        kind === 'reference'
                          ? 'CPU, memory and resource contention'
                          : kind === 'cycle'
                            ? 'Two-resource cycle'
                            : 'Idle gaps without resources',
                    })
                  }
                >
                  {kind === 'reference'
                    ? 'Load reference example'
                    : kind === 'cycle'
                      ? 'Two-resource cycle'
                      : 'Idle example'}
                </Button>
              ))}
            </div>
            <label>
              Capacity (KiB)
              <input
                aria-label="Capacity (KiB)"
                aria-invalid={invalid('totalKiB')}
                inputMode="numeric"
                value={draft.capacity}
                onChange={(e) => edit({ capacity: e.target.value })}
              />
            </label>
            <label>
              Quantum (t)
              <input
                aria-label="Quantum (t)"
                aria-invalid={invalid('quantum')}
                inputMode="numeric"
                value={draft.quantum}
                onChange={(e) => edit({ quantum: e.target.value })}
              />
            </label>
            <label>
              Resources (IDs)
              <input
                aria-label="Resources (IDs)"
                aria-invalid={invalid('resources')}
                value={draft.resources}
                onChange={(e) => edit({ resources: e.target.value })}
              />
            </label>
            <p className="subtle small">
              1–20 processes · up to 8 resources · 1–100 instructions per
              process. One instruction per line; programs are data.
            </p>
            {draft.processes.map((p, i) => {
              const change = (patch: Partial<typeof p>) =>
                edit({
                  processes: draft.processes.map((p, j) =>
                    j === i ? { ...p, ...patch } : p,
                  ),
                });
              return (
                <fieldset key={i} className="system-process">
                  <legend>Process {i + 1}</legend>
                  <div className="system-fields">
                    {(['id', 'arrival', 'memory'] as const).map((key) => (
                      <label key={key}>
                        {key === 'id'
                          ? 'ID'
                          : key === 'arrival'
                            ? 'Arrival (t)'
                            : 'Memory (KiB)'}
                        <input
                          aria-label={`Process ${i + 1} ${key}`}
                          aria-invalid={invalid(
                            `processes.${i}.${key === 'memory' ? 'memoryKiB' : key}`,
                          )}
                          value={p[key]}
                          onChange={(e) => change({ [key]: e.target.value })}
                        />
                      </label>
                    ))}
                  </div>
                  <label>
                    Program
                    <textarea
                      aria-label={`Process ${i + 1} program`}
                      aria-invalid={invalid(`processes.${i}.program`)}
                      rows={4}
                      value={p.code}
                      onChange={(e) => change({ code: e.target.value })}
                    />
                  </label>
                  <Button
                    onClick={() =>
                      edit({
                        processes: draft.processes.filter((_, j) => j !== i),
                      })
                    }
                    aria-label={`Remove process ${i + 1}`}
                  >
                    Remove
                  </Button>
                </fieldset>
              );
            })}
            <Button
              disabled={draft.processes.length >= 20}
              onClick={() => {
                let id = 1;
                while (draft.processes.some((p) => p.id === `P${id}`)) id++;
                edit({
                  processes: [
                    ...draft.processes,
                    { id: `P${id}`, arrival: '0', memory: '1', code: 'cpu 1' },
                  ],
                });
              }}
            >
              Add process
            </Button>
            {!parsed.ok && (
              <div className="field-error" role="alert">
                {parsed.error.issues.map((x, i) => (
                  <p key={i}>
                    {x.path}: {x.message}
                  </p>
                ))}
              </div>
            )}
            <details>
              <summary>Assumptions & instruction reference</summary>
              <p>
                cpu 4 consumes 4 t; acquire R1 and release R1 consume zero t.
                One CPU, zero switch cost. Each dispatch grants a fresh quantum.
                Instruction completion and its zero-time operations precede
                arrivals, wake-ups, admission and requeue.
              </p>
              <p>
                Strict FIFO memory admission may hold smaller processes behind a
                larger head. Blocked processes keep memory. Termination releases
                owned resources and coalesces holes. Release is owner-only;
                invalid release stops with a model error.
              </p>
            </details>
          </div>
        </Panel>
        <section
          className="panel canvas-panel"
          aria-label="Integrated replay workspace"
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
            act={(action) => act({ type: 'replay', action })}
          />
          <div className="canvas-body">
            {state.error && (
              <p role="alert" className="field-error">
                {state.error.message}
              </p>
            )}
            {result && s ? (
              <>
                <SystemView result={result} snapshot={s} />
                <FrameCursor
                  replay={replay}
                  frameCount={result.frames.length}
                  act={(action) => act({ type: 'replay', action })}
                />
              </>
            ) : (
              <div className="empty-state">
                <h2>
                  {draft.processes.length
                    ? 'Ready for a new run'
                    : 'Add a process'}
                </h2>
                <p>Inputs changed. Run again to update results.</p>
              </div>
            )}
          </div>
        </section>
        <MemoryInspector
          playing={replay.playing}
          title={
            frame?.event
              ? `${frame.event.kind} · t=${frame.event.simTime}`
              : 'Initial state'
          }
          reason={
            frame?.event?.reason ??
            'Load or enter a scenario, then step through its actual decisions.'
          }
          cursor={replay.cursor}
          events={traceEvents}
          select={(cursor) =>
            act({ type: 'replay', action: { type: 'seek', cursor } })
          }
        >
          <details open>
            <summary>What to observe</summary>
            <p>
              Watch resource owners, FIFO waiters and memory admission at the
              selected event. Resource waiting and memory waiting are separate
              from ready-queue waiting. A blocked owner retains its memory.
            </p>
          </details>
          <details>
            <summary>Guided exercise</summary>
            <p>
              Load the reference. Find P2's block at t=2 and wake at t=4.
              Inspect P3's admission at t=6. Predict how raising memory to 128
              KiB changes its memory wait, then rerun and compare the waiting
              columns.
            </p>
          </details>
        </MemoryInspector>
      </div>
    </>
  );
}
export function SystemView({
  result,
  snapshot: s,
}: {
  result: SystemResult;
  snapshot: SystemSnapshot;
}) {
  const [scale, setScale] = useState(32),
    [offset, setOffset] = useState<number | null>(null);
  const start = offset ?? Math.max(0, s.simTime - 20),
    end = Math.max(start + 20, Math.min(start + 100, s.simTime)),
    width = (end - start) * scale + 80;
  const intervals = [
    ...result.intervals.slice(0, s.intervalCount),
    ...(s.activeInterval && s.simTime > s.activeInterval.start
      ? [{ ...s.activeInterval, end: s.simTime }]
      : []),
  ];
  const color = (id: string) =>
    processColor(result.scenario.processes.findIndex((p) => p.id === id));
  return (
    <>
      <div className="section-title">
        <h2>
          State at t = <span data-testid="system-time">{s.simTime}</span>
        </h2>
        <span className="scope-label">Selected frame · {s.status}</span>
      </div>
      <div className="metric-strip">
        <div>
          <span>Busy CPU (t)</span>
          <strong data-testid="system-busy">{s.busyTime}</strong>
        </div>
        <div>
          <span>Utilization so far</span>
          <strong>
            {s.utilizationPercent === null
              ? '—'
              : `${s.utilizationPercent.toFixed(1)}%`}
          </strong>
        </div>
        <div>
          <span>CPU slot</span>
          <strong data-testid="system-running">{s.running ?? 'Idle'}</strong>
        </div>
      </div>
      <div className="section-title">
        <h2>CPU timeline</h2>
        <label>
          Scale
          <select
            aria-label="Timeline scale"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          >
            <option value={32}>32 px / t</option>
            <option value={48}>48 px / t</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={start === 0}
          onClick={() => setOffset(Math.max(0, start - 20))}
        >
          Earlier
        </Button>
        <Button
          disabled={end >= s.simTime}
          onClick={() => setOffset(start + 20)}
        >
          Later
        </Button>
        <Button disabled={offset === null} onClick={() => setOffset(null)}>
          Follow cursor
        </Button>
        <span className="subtle small">
          Window {start}–{end} t
        </span>
      </div>
      <div
        className="system-timeline"
        role="region"
        tabIndex={0}
        aria-label="Integrated CPU timeline"
      >
        <svg
          width={width}
          height={105}
          role="img"
          aria-label={`CPU intervals through t=${s.simTime}. Exact intervals in the table.`}
        >
          {Array.from({ length: Math.floor((end - start) / 2) + 1 }, (_, i) => {
            const t = start + i * 2;
            return (
              <g key={t}>
                <line
                  x1={40 + (t - start) * scale}
                  x2={40 + (t - start) * scale}
                  y1={14}
                  y2={75}
                  stroke="#CDD3DA"
                />
                <text
                  x={40 + (t - start) * scale}
                  y={95}
                  textAnchor="middle"
                  fontSize={12}
                >
                  {t}
                </text>
              </g>
            );
          })}
          {intervals
            .filter((x) => x.end > start && x.start < end)
            .map((x, i) => {
              const a = Math.max(x.start, start),
                b = Math.min(x.end, end),
                w = (b - a) * scale;
              return (
                <g key={i}>
                  <title>
                    {x.id ?? 'Idle'} [{x.start}, {x.end}) t
                  </title>
                  <rect
                    x={40 + (a - start) * scale}
                    y={22}
                    width={w}
                    height={44}
                    fill={x.id ? color(x.id) : '#EDF1F5'}
                    stroke="#fff"
                    strokeDasharray={
                      x.id &&
                      result.scenario.processes.findIndex(
                        (p) => p.id === x.id,
                      ) >= 6
                        ? '3 2'
                        : undefined
                    }
                  />
                  <text
                    x={40 + (a - start) * scale + w / 2}
                    y={49}
                    textAnchor="middle"
                    fill={x.id ? 'white' : '#526071'}
                    fontSize={12}
                  >
                    {x.id && x.id.length > 5
                      ? x.id.slice(0, 4) + '…'
                      : (x.id ?? 'Idle')}
                  </text>
                </g>
              );
            })}
        </svg>
      </div>
      <ScrollTable label="Integrated CPU intervals">
        <table>
          <thead>
            <tr>
              <th>Process</th>
              <th>Start (t)</th>
              <th>End (t)</th>
            </tr>
          </thead>
          <tbody>
            {intervals.slice(-30).map((x, i) => (
              <tr key={i}>
                <th>{x.id ?? 'Idle'}</th>
                <td>{x.start}</td>
                <td>{x.end}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
      {intervals.length > 30 && (
        <p className="subtle small">
          Last 30 intervals at this frame. CSV exports the full result.
        </p>
      )}
      <div className="system-queues">
        <div>
          <h3>Ready queue</h3>
          <p data-testid="system-ready">{s.ready.join(' → ') || 'Empty'}</p>
        </div>
        <div>
          <h3>Memory FIFO</h3>
          <p data-testid="system-memory-wait">
            {s.memoryWait.join(' → ') || 'Empty'}
          </p>
        </div>
        {s.pendingWake.length > 0 && (
          <div>
            <h3>Pending wake-ups</h3>
            <p>{s.pendingWake.join(' → ')}</p>
          </div>
        )}
      </div>
      <h2>Memory address space · KiB</h2>
      <div
        className="system-memory"
        role="region"
        tabIndex={0}
        aria-label="Integrated memory map"
      >
        <svg
          width="100%"
          viewBox="0 0 600 100"
          role="img"
          aria-label={s.segments
            .map((x) => `${x.id ?? 'Free'} [${x.start}, ${x.end}) KiB`)
            .join('; ')}
        >
          {s.segments.map((x) => {
            const a = 20 + (x.start / result.scenario.totalKiB) * 560,
              w = ((x.end - x.start) / result.scenario.totalKiB) * 560;
            return (
              <g key={x.start}>
                <title>
                  {x.id ?? 'Free'} [{x.start}, {x.end}) KiB
                </title>
                <rect
                  x={a}
                  y={25}
                  width={w}
                  height={40}
                  fill={x.id ? color(x.id) : '#EDF1F5'}
                  stroke="#CDD3DA"
                  strokeDasharray={
                    x.id &&
                    result.scenario.processes.findIndex((p) => p.id === x.id) >=
                      6
                      ? '3 2'
                      : undefined
                  }
                />
                {w > 50 && (
                  <text
                    x={a + w / 2}
                    y={50}
                    textAnchor="middle"
                    fontSize={13}
                    fill={x.id ? 'white' : '#526071'}
                  >
                    {x.id ?? 'Free'}
                  </text>
                )}
                <text x={a} y={84} fontSize={13}>
                  {x.start}
                </text>
              </g>
            );
          })}
          <text x={580} y={84} textAnchor="end" fontSize={13}>
            {result.scenario.totalKiB}
          </text>
        </svg>
      </div>
      <ScrollTable label="Integrated memory ledger">
        <table>
          <thead>
            <tr>
              <th>Owner</th>
              <th>Start (KiB)</th>
              <th>End (KiB)</th>
              <th>Size (KiB)</th>
            </tr>
          </thead>
          <tbody>
            {s.segments.map((x) => (
              <tr key={x.start}>
                <th>{x.id ?? 'Free hole'}</th>
                <td>{x.start}</td>
                <td>{x.end}</td>
                <td>{x.end - x.start}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
      <h2>Resources · single instance</h2>
      {s.resources.length ? (
        <ScrollTable label="Integrated resource ownership">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Owner</th>
                <th>FIFO waiters</th>
              </tr>
            </thead>
            <tbody>
              {s.resources.map((r) => (
                <tr key={r.id}>
                  <th>{r.id}</th>
                  <td>{r.owner ?? 'Free'}</td>
                  <td>{r.queue.join(' → ') || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : (
        <p className="subtle">No resources in this workload.</p>
      )}
      <h2>Process ledger · all durations in t</h2>
      <p className="subtle small">
        CT and TAT appear after completion. RT uses first positive CPU service.
        Waiting columns accumulate only in their named state.
      </p>
      <ScrollTable label="Integrated process results">
        <table>
          <thead>
            <tr>
              {[
                'ID',
                'State',
                'PC',
                'CPU',
                'Ready wait',
                'Resource wait',
                'Memory wait',
                'CT',
                'TAT',
                'RT',
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.processes.map((p) => (
              <tr key={p.id}>
                <th>
                  <span style={{ color: color(p.id) }}>{p.id}</span>
                </th>
                <td>{p.state}</td>
                <td>{p.pc}</td>
                {[
                  p.cpuService,
                  p.readyWait,
                  p.resourceWait,
                  p.memoryWait,
                  p.completion,
                  p.turnaround,
                  p.response,
                ].map((x, i) => (
                  <td key={i}>{x ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
      {s.cycle.length > 0 && (
        <p className="field-error">Proven wait cycle: {s.cycle.join(' → ')}</p>
      )}
    </>
  );
}
