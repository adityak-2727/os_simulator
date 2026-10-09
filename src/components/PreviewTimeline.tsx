import type { PreviewResult, PreviewSnapshot } from '../engine/preview';

export function PreviewTimeline({
  result,
  snapshot,
}: {
  result: PreviewResult;
  snapshot: PreviewSnapshot;
}) {
  const width = Math.max(480, result.duration * 28);
  const plot = width - 48;
  const x = (time: number) => 24 + (time / result.duration) * plot;
  const tickStep = Math.max(1, Math.ceil(result.duration / 10));
  const ticks = Array.from(
    { length: Math.floor(result.duration / tickStep) + 1 },
    (_, i) => i * tickStep,
  );
  if (ticks.at(-1) !== result.duration) ticks.push(result.duration);
  return (
    <div
      className="timeline-scroll"
      role="region"
      aria-label="Completed fixture intervals, horizontal scroll"
      tabIndex={0}
    >
      <svg
        width={width}
        height="132"
        role="img"
        aria-labelledby="timeline-title timeline-description"
      >
        <title id="timeline-title">
          Fixture timeline at t = {snapshot.simTime}
        </title>
        <desc id="timeline-description">
          {snapshot.segments.length
            ? snapshot.segments
                .map(
                  (s) =>
                    `${s.processId} from ${s.start} to ${s.end} time units`,
                )
                .join('. ')
            : 'No completed intervals yet.'}{' '}
          The interval table provides the same data.
        </desc>
        <rect x="24" y="20" width={plot} height="44" fill="#EDF1F5" rx="3" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1="66" y2="73" stroke="#526071" />
            <text
              x={x(t)}
              y="94"
              textAnchor="middle"
              fill="#526071"
              fontSize="12"
            >
              {t}
            </text>
          </g>
        ))}
        {snapshot.segments.map((s) => (
          <g key={s.processId}>
            <rect
              x={x(s.start)}
              y="20"
              width={x(s.end) - x(s.start)}
              height="44"
              fill={s.processId === 'P1' ? '#275DAD' : '#8A5B12'}
              stroke="white"
            />
            <text
              x={(x(s.start) + x(s.end)) / 2}
              y="47"
              textAnchor="middle"
              fill="white"
              fontSize="14"
            >
              {s.processId}
            </text>
          </g>
        ))}
        <line
          x1={x(snapshot.simTime)}
          x2={x(snapshot.simTime)}
          y1="12"
          y2="68"
          stroke="#17212F"
          strokeWidth="2"
        />
        <text x="24" y="120" fill="#526071" fontSize="12">
          Simulation time (t), in time units
        </text>
      </svg>
    </div>
  );
}
