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
import type { AllocationResult, PagingResult } from '../../engine/memory/types';
import { PAGE_NAMES, STRATEGY_NAMES } from './memoryState';
type Props = { name: string; back: () => void } & (
  | {
      kind: 'allocation';
      results: readonly AllocationResult[];
      inspect: (result: AllocationResult) => void;
    }
  | {
      kind: 'paging';
      results: readonly PagingResult[];
      inspect: (result: PagingResult) => void;
    }
);
const percent = (ratio: number | null) =>
  ratio === null ? '—' : `${(ratio * 100).toFixed(1)}%`;
export function MemoryComparison(props: Props) {
  const allocation = props.kind === 'allocation';
  const data =
    props.kind === 'allocation'
      ? props.results.map((r) => ({
          algorithm: STRATEGY_NAMES[r.scenario.strategy],
          primary: r.summary.totalFreeKiB,
          secondary: r.summary.largestHoleKiB,
        }))
      : props.results.map((r) => ({
          algorithm: PAGE_NAMES[r.scenario.algorithm],
          primary: r.summary.faults,
          secondary: r.summary.hits,
        }));
  return (
    <section
      className="panel comparison-panel memory-comparison"
      aria-label={`${props.kind} algorithm comparison`}
    >
      <header className="comparison-heading">
        <div>
          <h2>Compare algorithms</h2>
          <p className="subtle small">
            Final results · identical{' '}
            {allocation
              ? 'capacity and ordered operations'
              : 'reference sequence and frame count'}
          </p>
        </div>
        <Button onClick={props.back}>Back to replay</Button>
      </header>
      <div className="panel-body">
        <div className="comparison-assumptions">
          <strong>{props.name}</strong>
          <p>
            {allocation
              ? 'Each strategy starts from empty memory. Successful allocations and the shape of remaining free space depend on the operation sequence; no strategy is universally best.'
              : 'Lower faults mean fewer missing-page references for this workload. Optimal is a benchmark that knows the full future reference sequence.'}
          </p>
        </div>
        <div
          className="comparison-chart"
          role="img"
          aria-label={
            allocation
              ? 'Final free memory and largest hole in KiB, exact values in the table'
              : 'Final faults and hits, exact values in the table'
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data}
              margin={{ top: 16, right: 8, left: 0, bottom: 4 }}
              accessibilityLayer
            >
              <CartesianGrid
                vertical={false}
                stroke="#CDD3DA"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="algorithm"
                tick={{ fill: '#526071', fontSize: 12 }}
              />
              <YAxis
                tick={{ fill: '#526071', fontSize: 12 }}
                label={{
                  value: allocation ? 'KiB' : 'References',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#526071', fontSize: 12 },
                }}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="primary"
                name={allocation ? 'Free KiB' : 'Faults'}
                fill="#275DAD"
                isAnimationActive={false}
              />
              <Bar
                dataKey="secondary"
                name={allocation ? 'Largest hole KiB' : 'Hits'}
                fill="#2E7656"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ScrollTable label={`${props.kind} comparison metrics`}>
          <table>
            <caption className="sr-only">
              Final results calculated from the same inputs
            </caption>
            <thead>
              <tr>
                <th scope="col">Algorithm</th>
                {allocation ? (
                  <>
                    <th scope="col">Allocations</th>
                    <th scope="col">Failed ops</th>
                    <th scope="col">Free (KiB)</th>
                    <th scope="col">Largest (KiB)</th>
                  </>
                ) : (
                  <>
                    <th scope="col">Faults</th>
                    <th scope="col">Hits</th>
                    <th scope="col">Fault ratio</th>
                    <th scope="col">Hit ratio</th>
                  </>
                )}
                <th scope="col">Inspect</th>
              </tr>
            </thead>
            <tbody>
              {props.kind === 'allocation'
                ? props.results.map((r) => (
                    <tr key={r.scenario.strategy}>
                      <th scope="row">{STRATEGY_NAMES[r.scenario.strategy]}</th>
                      <td>{r.summary.successfulAllocations}</td>
                      <td>{r.summary.failedOperations}</td>
                      <td>{r.summary.totalFreeKiB}</td>
                      <td>{r.summary.largestHoleKiB}</td>
                      <td>
                        <Button
                          aria-label={`Inspect ${STRATEGY_NAMES[r.scenario.strategy]} trace`}
                          onClick={() => props.inspect(r)}
                        >
                          Trace
                        </Button>
                      </td>
                    </tr>
                  ))
                : props.results.map((r) => (
                    <tr key={r.scenario.algorithm}>
                      <th scope="row">{PAGE_NAMES[r.scenario.algorithm]}</th>
                      <td>{r.summary.faults}</td>
                      <td>{r.summary.hits}</td>
                      <td>{percent(r.summary.faultRatio)}</td>
                      <td>{percent(r.summary.hitRatio)}</td>
                      <td>
                        <Button
                          aria-label={`Inspect ${PAGE_NAMES[r.scenario.algorithm]} trace`}
                          onClick={() => props.inspect(r)}
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
          {props.kind === 'allocation' ? (
            <>
              <p className="subtle small">
                Capacity {props.results[0]?.scenario.totalKiB} KiB · initial
                memory entirely free
              </p>
              <ScrollTable label="Shared allocation inputs">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Step</th>
                      <th scope="col">Action</th>
                      <th scope="col">ID</th>
                      <th scope="col">Size (KiB)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.results[0]?.scenario.operations.map((op, i) => (
                      <tr key={i}>
                        <th scope="row">{i + 1}</th>
                        <td>{op.kind}</td>
                        <td>{op.id}</td>
                        <td>{op.kind === 'allocate' ? op.sizeKiB : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            </>
          ) : (
            <>
              <p className="subtle small">
                {props.results[0]?.scenario.frames} frames · initially empty
              </p>
              <p className="mono memory-reference-text">
                {props.results[0]?.scenario.references.join(', ')}
              </p>
            </>
          )}
        </details>
      </div>
    </section>
  );
}
