import { useState } from 'react';
import type { CpuResult, CpuSnapshot } from '../../engine/cpu/types';
import { intervalsAtFrame } from '../../engine/cpu/schedule';
import { Button, ScrollTable } from '../../components/Primitives';
import { processColor } from './presentation';

export function CpuTimeline({
  result,
  snapshot,
  onSelect,
}: {
  result: CpuResult;
  snapshot: CpuSnapshot;
  onSelect: (cursor: number) => void;
}) {
  const [scale, setScale] = useState(48);
  const [manualStart, setManualStart] = useState<number | null>(null);
  const windowSpan = Math.floor(1440 / scale);
  const automaticStart =
    Math.floor(Math.max(0, snapshot.simTime - 1) / windowSpan) * windowSpan;
  const start = Math.min(manualStart ?? automaticStart, automaticStart);
  const end = Math.min(result.summary.finishTime, start + windowSpan);
  const width = Math.max(480, (end - start) * scale + 48);
  const plot = (end - start) * scale;
  const x = (time: number) => 24 + (time - start) * scale;
  const intervals = intervalsAtFrame(result, snapshot).filter(
    (i) => i.end > start && i.start < end,
  );
  const tickStep = Math.max(1, Math.ceil((end - start) / 12));
  const ticks = Array.from(
    { length: Math.floor((end - start) / tickStep) + 1 },
    (_, i) => start + i * tickStep,
  );
  if (ticks.at(-1) !== end) ticks.push(end);
  function select(
    id: string | null,
    intervalStart: number,
    intervalEnd: number,
  ) {
    const event = result.events.find(
      (e) =>
        e.simTime === intervalEnd &&
        (id === null
          ? e.kind === 'idle-ended'
          : (e.kind === 'process-completed' || e.kind === 'quantum-expired') &&
            e.processId === id),
    );
    if (event) onSelect(event.seq + 1);
    else {
      const dispatch = result.events.find(
        (e) =>
          e.kind === 'dispatch' &&
          e.processId === id &&
          e.simTime === intervalStart,
      );
      if (dispatch) onSelect(dispatch.seq + 1);
    }
  }
  return (
    <>
      <div className="timeline-options">
        <label>
          Timeline scale
          <select
            aria-label="Timeline scale"
            value={scale}
            onChange={(e) => {
              setScale(Number(e.target.value));
              setManualStart(null);
            }}
          >
            <option value={48}>48 px / time unit</option>
            <option value={24}>24 px / time unit</option>
          </select>
        </label>
        {result.summary.finishTime > windowSpan && (
          <div className="timeline-window">
            <Button
              disabled={start === 0}
              onClick={() => setManualStart(Math.max(0, start - windowSpan))}
            >
              Earlier
            </Button>
            <span className="mono">
              {start}–{end} t
            </span>
            <Button
              disabled={start + windowSpan >= snapshot.simTime}
              onClick={() => setManualStart(start + windowSpan)}
            >
              Later
            </Button>
            <Button onClick={() => setManualStart(null)}>Follow cursor</Button>
          </div>
        )}
      </div>
      <div
        className="timeline-scroll"
        role="region"
        aria-label="CPU Gantt timeline, horizontal scroll"
        tabIndex={0}
      >
        <svg
          width={width}
          height={130}
          role="group"
          aria-labelledby="cpu-timeline-title cpu-timeline-description"
        >
          <title id="cpu-timeline-title">
            CPU intervals through t = {snapshot.simTime}
          </title>
          <desc id="cpu-timeline-description">
            Uniform simulation-time scale.{' '}
            {intervals.length
              ? intervals
                  .map((i) => `${i.id ?? 'Idle'} from ${i.start} to ${i.end}`)
                  .join('. ')
              : 'No CPU service or idle interval has elapsed yet.'}{' '}
            Open the interval table for equivalent data.
          </desc>
          <defs>
            <pattern
              id="idle-pattern"
              width={8}
              height={8}
              patternUnits="userSpaceOnUse"
            >
              <rect width={8} height={8} fill="#EDF1F5" />
              <path d="M0 8 8 0" stroke="#CDD3DA" strokeWidth={1} />
            </pattern>
          </defs>
          <rect x={24} y={20} width={plot} height={44} fill="#EDF1F5" rx={3} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={66} y2={73} stroke="#526071" />
              <text
                x={x(t)}
                y={94}
                textAnchor="middle"
                fill="#526071"
                fontSize={12}
              >
                {t}
              </text>
            </g>
          ))}
          {intervals.map((interval, index) => {
            const order = result.scenario.processes.findIndex(
              (p) => p.id === interval.id,
            );
            const left = x(Math.max(interval.start, start)),
              right = x(Math.min(interval.end, end));
            const label = interval.id ?? 'Idle';
            const maxChars = Math.max(2, Math.floor((right - left - 8) / 7));
            const visibleLabel =
              label.length > maxChars
                ? `${label.slice(0, maxChars - 1)}…`
                : label;
            return (
              <g
                key={`${interval.start}-${index}`}
                role="button"
                tabIndex={0}
                aria-label={`${label} interval ${interval.start} to ${interval.end} time units`}
                onClick={() =>
                  select(interval.id, interval.start, interval.end)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select(interval.id, interval.start, interval.end);
                  }
                }}
              >
                <title>
                  {label}: [{interval.start}, {interval.end}) time units
                </title>
                <rect
                  x={left}
                  y={20}
                  width={right - left}
                  height={44}
                  fill={
                    interval.id === null
                      ? 'url(#idle-pattern)'
                      : processColor(order)
                  }
                  stroke={order >= 6 ? '#17212F' : 'white'}
                  strokeDasharray={order >= 6 ? '4 2' : undefined}
                />
                <text
                  x={(left + right) / 2}
                  y={47}
                  textAnchor="middle"
                  fontSize={13}
                  fill={interval.id === null ? '#526071' : 'white'}
                >
                  {visibleLabel}
                </text>
              </g>
            );
          })}
          {snapshot.simTime >= start && snapshot.simTime <= end && (
            <line
              x1={x(snapshot.simTime)}
              x2={x(snapshot.simTime)}
              y1={12}
              y2={68}
              stroke="#17212F"
              strokeWidth={2}
            />
          )}
          <text x={24} y={120} fill="#526071" fontSize={12}>
            Simulation time (t) · time units
          </text>
        </svg>
      </div>
      <details className="interval-disclosure">
        <summary>Interval table · equivalent timeline data</summary>
        <ScrollTable label="CPU interval table">
          <table>
            <caption className="sr-only">
              Intervals in the current timeline window through the selected
              frame
            </caption>
            <thead>
              <tr>
                <th scope="col">Process</th>
                <th scope="col">Start (t)</th>
                <th scope="col">End (t)</th>
                <th scope="col">Service (t)</th>
              </tr>
            </thead>
            <tbody>
              {intervals.length ? (
                intervals.map((i, index) => (
                  <tr key={index}>
                    <th scope="row">{i.id ?? 'Idle'}</th>
                    <td>{i.start}</td>
                    <td>{i.end}</td>
                    <td>{i.end - i.start}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No elapsed intervals at this frame.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollTable>
      </details>
    </>
  );
}
