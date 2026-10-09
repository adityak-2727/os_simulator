import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, ScrollTable } from '../../components/Primitives';
import { useCpu } from './CpuContext';
import { ALGORITHM_LABELS, formatMetric } from './presentation';
import { CpuResultsTable } from './CpuResults';

export function CpuComparison() {
  const { state, dispatch } = useCpu();
  const results = state.comparison;
  if (!results) return null;
  const data = results.map((r) => ({
    algorithm: ALGORITHM_LABELS[r.scenario.algorithm],
    Waiting: r.summary.averageWaiting,
    Turnaround: r.summary.averageTurnaround,
    Response: r.summary.averageResponse,
  }));
  return (
    <section
      className="panel comparison-panel"
      aria-label="CPU algorithm comparison"
    >
      <header className="comparison-heading">
        <div>
          <h2>Compare algorithms</h2>
          <p className="subtle small">
            Final results · same {state.draft.processes.length} processes in the
            same input order
          </p>
        </div>
        <Button onClick={() => dispatch({ type: 'back' })}>
          Back to replay
        </Button>
      </header>
      <div className="panel-body">
        <div className="comparison-assumptions">
          <strong>{state.draft.name}</strong>
          <p>
            One CPU · zero context-switch cost · RR quantum{' '}
            {state.draft.quantum} t. Lower waiting, turnaround, and response
            times are preferable; workload goals determine the choice.
          </p>
        </div>
        <div
          className="comparison-chart"
          role="img"
          aria-label="Average waiting, turnaround, and response in time units for all four algorithms; exact values in the following comparison table"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data}
              margin={{ top: 16, right: 12, bottom: 4, left: 0 }}
              accessibilityLayer
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#CDD3DA"
              />
              <XAxis
                dataKey="algorithm"
                tick={{ fill: '#526071', fontSize: 12 }}
              />
              <YAxis
                tick={{ fill: '#526071', fontSize: 12 }}
                label={{
                  value: 'Time units (t)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#526071', fontSize: 12 },
                }}
              />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)} t`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Waiting" fill="#275DAD" isAnimationActive={false} />
              <Bar
                dataKey="Turnaround"
                fill="#8A5B12"
                isAnimationActive={false}
              />
              <Bar
                dataKey="Response"
                fill="#2E7656"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ScrollTable label="Algorithm comparison results">
          <table>
            <caption className="sr-only">
              Final CPU comparison metrics for identical inputs
            </caption>
            <thead>
              <tr>
                <th scope="col">Algorithm</th>
                <th scope="col">Avg WT (t)</th>
                <th scope="col">Avg TAT (t)</th>
                <th scope="col">Avg RT (t)</th>
                <th scope="col">Utilization (%)</th>
                <th scope="col">Throughput (processes/t)</th>
                <th scope="col">Inspect</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.scenario.algorithm}>
                  <th scope="row">{ALGORITHM_LABELS[r.scenario.algorithm]}</th>
                  <td>{formatMetric(r.summary.averageWaiting)}</td>
                  <td>{formatMetric(r.summary.averageTurnaround)}</td>
                  <td>{formatMetric(r.summary.averageResponse)}</td>
                  <td>{formatMetric(r.summary.utilizationPercent)}</td>
                  <td>{formatMetric(r.summary.throughput, 3)}</td>
                  <td>
                    <Button
                      aria-label={`Inspect ${ALGORITHM_LABELS[r.scenario.algorithm]} trace`}
                      onClick={() =>
                        dispatch({ type: 'inspect-comparison', result: r })
                      }
                    >
                      Trace
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <details className="comparison-inputs" open>
          <summary>Shared workload · calculation inputs</summary>
          <ScrollTable label="Shared comparison inputs">
            <table>
              <caption className="sr-only">
                The immutable input used by every compared algorithm
              </caption>
              <thead>
                <tr>
                  <th scope="col">Process</th>
                  <th scope="col">Arrival (t)</th>
                  <th scope="col">Burst (t)</th>
                  <th scope="col">Priority</th>
                </tr>
              </thead>
              <tbody>
                {results[0]?.scenario.processes.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">{p.id}</th>
                    <td>{p.arrival}</td>
                    <td>{p.burst}</td>
                    <td>{p.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </details>
        <details className="comparison-inputs">
          <summary>Per-process final results for every algorithm</summary>
          {results.map((r) => (
            <section
              key={r.scenario.algorithm}
              className="comparison-process-results"
            >
              <h3>{ALGORITHM_LABELS[r.scenario.algorithm]}</h3>
              <CpuResultsTable
                processes={r.metrics}
                label={`${ALGORITHM_LABELS[r.scenario.algorithm]} final process results`}
              />
            </section>
          ))}
        </details>
      </div>
    </section>
  );
}
