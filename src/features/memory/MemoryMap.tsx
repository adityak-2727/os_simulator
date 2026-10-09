import { useState } from 'react';
import { ScrollTable } from '../../components/Primitives';
import type {
  AllocationScenario,
  AllocationSnapshot,
} from '../../engine/memory/types';
import { processColor } from '../cpu/presentation';
function allocationColor(scenario: AllocationScenario, id: string) {
  const ids = [
    ...new Set(
      scenario.operations
        .filter((op) => op.kind === 'allocate')
        .map((op) => op.id),
    ),
  ];
  return processColor(ids.indexOf(id));
}
export function MemoryMap({
  scenario,
  snapshot,
}: {
  scenario: AllocationScenario;
  snapshot: AllocationSnapshot;
}) {
  const [zoom, setZoom] = useState(1);
  const height = 360 * zoom,
    y = (address: number) => 22 + (address / scenario.totalKiB) * height;
  const ticks = [
    ...new Set([
      0,
      Math.round(scenario.totalKiB / 4),
      Math.round(scenario.totalKiB / 2),
      Math.round((scenario.totalKiB * 3) / 4),
      scenario.totalKiB,
    ]),
  ];
  return (
    <>
      <div className="section-title">
        <h2>Address space</h2>
        <span className="mono">0–{scenario.totalKiB} KiB</span>
      </div>
      <p className="subtle small">
        Proportional address scale · ranges include start and exclude end.
      </p>
      <label className="memory-map-zoom">
        Map height
        <select
          aria-label="Memory map zoom"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        >
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </label>
      <div
        className="memory-map-scroll"
        role="region"
        tabIndex={0}
        aria-label="Address-labeled memory map, scrollable"
      >
        <svg
          width="100%"
          viewBox={`0 0 430 ${height + 50}`}
          role="img"
          aria-labelledby="memory-map-title memory-map-description"
        >
          <title id="memory-map-title">
            Memory at operation step {snapshot.step}
          </title>
          <desc id="memory-map-description">
            {snapshot.segments
              .map((s) => `${s.id ?? 'Free'} [${s.start}, ${s.end}) KiB`)
              .join('. ')}
            . Exact ranges also appear in the ledger below.
          </desc>
          <defs>
            <pattern
              id="free-memory-pattern"
              width={8}
              height={8}
              patternUnits="userSpaceOnUse"
            >
              <rect width={8} height={8} fill="#EDF1F5" />
              <path d="M0 8 8 0" stroke="#CDD3DA" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <text
                x={65}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={12}
                fill="#526071"
              >
                {t}
              </text>
              <line x1={73} x2={89} y1={y(t)} y2={y(t)} stroke="#526071" />
            </g>
          ))}
          {snapshot.segments.map((s) => {
            const size = y(s.end) - y(s.start);
            return (
              <g key={s.start}>
                <title>
                  {s.id ?? 'Free'}: [{s.start}, {s.end}) · {s.end - s.start} KiB
                </title>
                <rect
                  x={90}
                  y={y(s.start)}
                  width={326}
                  height={size}
                  fill={
                    s.id === null
                      ? 'url(#free-memory-pattern)'
                      : allocationColor(scenario, s.id)
                  }
                  stroke={s.id === null ? '#CDD3DA' : '#17212F'}
                  strokeDasharray={s.id === null ? undefined : '3 1'}
                />
                {size >= 25 && (
                  <text
                    x={102}
                    y={y(s.start) + Math.min(size / 2 + 4, 28)}
                    fill={s.id === null ? '#526071' : 'white'}
                    fontSize={12}
                  >
                    {s.id && s.id.length > 10
                      ? `${s.id.slice(0, 9)}…`
                      : (s.id ?? 'Free')}{' '}
                    · [{s.start}, {s.end}) · {s.end - s.start} KiB
                  </text>
                )}
              </g>
            );
          })}
          <text x={90} y={height + 45} fontSize={12} fill="#526071">
            Addresses and sizes in KiB
          </text>
        </svg>
      </div>
      <div className="section-title">
        <h2>Allocation ledger</h2>
        <span className="subtle small">Selected frame</span>
      </div>
      <ScrollTable label="Memory allocation ledger">
        <table>
          <caption className="sr-only">
            Exact half-open memory ranges after the selected operation
          </caption>
          <thead>
            <tr>
              <th scope="col">ID / state</th>
              <th scope="col">Start (KiB)</th>
              <th scope="col">End (KiB)</th>
              <th scope="col">Size (KiB)</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.segments.map((s) => (
              <tr key={s.start}>
                <th scope="row">
                  <span
                    style={
                      s.id === null
                        ? undefined
                        : { color: allocationColor(scenario, s.id) }
                    }
                  >
                    {s.id ?? 'Free hole'}
                  </span>
                </th>
                <td>{s.start}</td>
                <td>{s.end}</td>
                <td>{s.end - s.start}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </>
  );
}
