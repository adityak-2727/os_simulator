import { useState } from 'react';
import { Button } from '../../components/Primitives';
import type { DiskResult } from '../../engine/disk/types';
const WINDOW = 12;
export function DiskPath({
  result,
  cursor,
  select,
}: {
  result: DiskResult;
  cursor: number;
  select: (cursor: number) => void;
}) {
  const [manualStart, setManualStart] = useState<number | null>(null);
  const maxStart = Math.max(0, cursor - WINDOW),
    start = Math.min(manualStart ?? maxStart, maxStart),
    end = Math.min(cursor, start + WINDOW);
  const width = 480,
    left = 52,
    right = 42,
    top = 56,
    row = 36,
    height = top + (end - start + 1) * row + 24;
  const x = (cylinder: number) =>
    left + (cylinder / result.scenario.maxCylinder) * (width - left - right);
  const ticks = [
    ...new Set(
      [0, 0.25, 0.5, 0.75, 1].map((t) =>
        Math.round(t * result.scenario.maxCylinder),
      ),
    ),
  ];
  const points = result.frames.slice(start, end + 1);
  return (
    <>
      <div className="section-title">
        <h2>Head movement path</h2>
        <span className="subtle small">
          Processed steps {start}–{end}
        </span>
      </div>
      <div className="disk-path-controls">
        <Button
          disabled={start === 0}
          onClick={() => setManualStart(Math.max(0, start - WINDOW))}
        >
          Earlier
        </Button>
        <Button
          disabled={start === maxStart}
          onClick={() => setManualStart(Math.min(maxStart, start + WINDOW))}
        >
          Later
        </Button>
        <Button
          disabled={manualStart === null}
          onClick={() => setManualStart(null)}
        >
          Follow cursor
        </Button>
      </div>
      <div
        className="disk-path-scroll"
        role="region"
        aria-label="Scaled disk head path"
        tabIndex={0}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={`Cylinder scale 0 to ${result.scenario.maxCylinder}; step ${start} to ${end}; selected head ${result.frames[cursor]?.snapshot.head}. Exact moves in the movement ledger.`}
        >
          <text
            x={width / 2}
            y={16}
            textAnchor="middle"
            className="disk-axis-title"
          >
            Cylinder
          </text>
          <text x={4} y={top - 12} className="disk-axis-title">
            Step
          </text>
          {ticks.map((t) => (
            <g key={t}>
              <text
                x={x(t)}
                y={36}
                textAnchor="middle"
                className="disk-axis-tick"
              >
                {t.toLocaleString('en-US')}
              </text>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={42}
                y2={height - 20}
                className="disk-grid-line"
              />
            </g>
          ))}
          {points.map((frame, i) => {
            const y = top + i * row,
              previous = points[i - 1],
              move = frame.event,
              cylinder = frame.snapshot.head,
              px = x(cylinder),
              current = frame.index === cursor;
            return (
              <g key={frame.index}>
                <text
                  x={30}
                  y={y + 4}
                  textAnchor="end"
                  className="disk-axis-tick"
                >
                  {frame.index}
                </text>
                {previous && move && (
                  <line
                    x1={x(previous.snapshot.head)}
                    y1={y - row}
                    x2={px}
                    y2={y}
                    className={`disk-move disk-move-${move.kind}`}
                  >
                    <title>
                      {move.kind}: {move.from} → {move.to}, {move.distance}{' '}
                      cylinders
                    </title>
                  </line>
                )}
                <circle
                  cx={px}
                  cy={y}
                  r={current ? 6 : 4}
                  className={`disk-point disk-point-${move?.kind ?? 'initial'}`}
                />
                <text
                  x={px + (px > width * 0.6 ? -10 : 10)}
                  y={y + 4}
                  textAnchor={px > width * 0.6 ? 'end' : 'start'}
                  className="disk-point-label"
                >
                  {move
                    ? `${move.kind === 'service' ? (move.requestId.length > 10 ? `${move.requestId.slice(0, 8)}…` : move.requestId) : move.kind} · ${cylinder}`
                    : `Start · ${cylinder}`}
                  <title>
                    {move?.requestId ?? move?.kind ?? 'Initial head'} at
                    cylinder {cylinder}
                  </title>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="disk-path-legend small">
        <span>Solid blue: service</span>
        <span>Ochre: endpoint</span>
        <span>Dashed violet: wrap</span>
      </p>
      <p className="subtle small">
        Only processed moves are shown. Horizontal distance uses the inclusive
        cylinder scale; vertical position is a step, not time. Use the ledger or
        frame slider to select a move.
      </p>
      {start > 0 && (
        <Button onClick={() => select(start)}>Inspect start of window</Button>
      )}
    </>
  );
}
