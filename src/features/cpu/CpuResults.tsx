import type { CpuProcessFrame, CpuSnapshot } from '../../engine/cpu/types';
import { ScrollTable } from '../../components/Primitives';
import { formatMetric, processStyle } from './presentation';

export function CpuResultsTable({
  processes,
  label = 'Process results',
}: {
  processes: readonly CpuProcessFrame[];
  label?: string;
}) {
  return (
    <ScrollTable label={label}>
      <table className="cpu-results-table">
        <caption className="sr-only">
          {label}: CT completion, TAT turnaround, WT waiting, RT response. All
          values in time units.
        </caption>
        <thead>
          <tr>
            <th scope="col">Process</th>
            <th scope="col">
              <abbr title="Completion time">CT (t)</abbr>
            </th>
            <th scope="col">
              <abbr title="Turnaround time">TAT (t)</abbr>
            </th>
            <th scope="col">
              <abbr title="Waiting time">WT (t)</abbr>
            </th>
            <th scope="col">
              <abbr title="Response time">RT (t)</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {processes.map((p, index) => (
            <tr key={p.id}>
              <th scope="row">
                <span className="process-dot" style={processStyle(index)} />
                {p.id}
              </th>
              <td>{p.completion ?? '—'}</td>
              <td>{p.turnaround ?? '—'}</td>
              <td>{p.waiting ?? '—'}</td>
              <td>{p.response ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}
export function CpuMetrics({
  snapshot,
  final,
}: {
  snapshot: CpuSnapshot;
  final: boolean;
}) {
  const s = snapshot.summary;
  return (
    <>
      <p className="subtle small metric-scope">
        {final
          ? 'Final run metrics'
          : `Metrics so far · averages over ${s.completedCount} completed processes`}
      </p>
      <div className="metric-strip cpu-metric-strip">
        <div>
          <strong>{formatMetric(s.averageWaiting)}</strong>
          <span>Avg waiting (t)</span>
        </div>
        <div>
          <strong>{formatMetric(s.averageTurnaround)}</strong>
          <span>Avg turnaround (t)</span>
        </div>
        <div>
          <strong>{formatMetric(s.averageResponse)}</strong>
          <span>Avg response (t)</span>
        </div>
        <div>
          <strong>
            {formatMetric(s.utilizationPercent, 1)}
            {s.utilizationPercent !== null ? '%' : ''}
          </strong>
          <span>CPU utilization</span>
        </div>
      </div>
      <div className="cpu-throughput subtle small">
        <span>
          Busy {s.busyTime} / observed {s.finishTime} time units
        </span>
        <span>Throughput {formatMetric(s.throughput, 3)} processes / t</span>
      </div>
    </>
  );
}
