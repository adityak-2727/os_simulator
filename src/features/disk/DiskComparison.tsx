import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, ScrollTable } from '../../components/Primitives';
import type { DiskResult } from '../../engine/disk/types';
import { DISK_NAMES } from './diskState';
export function DiskComparison({
  results,
  name,
  back,
  inspect,
}: {
  results: readonly DiskResult[];
  name: string;
  back: () => void;
  inspect: (r: DiskResult) => void;
}) {
  const input = results[0]?.scenario;
  return (
    <section
      className="panel comparison-panel disk-comparison"
      aria-label="Disk algorithm comparison"
    >
      <header className="comparison-heading">
        <div>
          <h2>Compare algorithms</h2>
          <p className="subtle small">
            Final results · identical static batch, head, range, and direction
          </p>
        </div>
        <Button onClick={back}>Back to replay</Button>
      </header>
      <div className="panel-body">
        <div className="comparison-assumptions">
          <strong>{name}</strong>
          <p>
            Lower movement means fewer cylinders traversed for this batch; no
            algorithm is universally best. SCAN and C-SCAN reach physical
            endpoints only when opposite-side requests remain. C-SCAN counts its
            entire wrap distance. All algorithms stop at the last service.
          </p>
        </div>
        <div
          className="comparison-chart"
          role="img"
          aria-label="Final total cylinders moved by each algorithm; exact values in the comparison table"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={results.map((r) => ({
                algorithm: DISK_NAMES[r.scenario.algorithm],
                movement: r.summary.totalMovement,
              }))}
              margin={{ top: 16, left: 12, right: 8, bottom: 4 }}
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
                  value: 'Cylinders',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#526071', fontSize: 12 },
                }}
              />
              <Tooltip />
              <Bar
                dataKey="movement"
                name="Total cylinders moved"
                fill="#275DAD"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ScrollTable label="Disk comparison metrics">
          <table>
            <thead>
              <tr>
                <th scope="col">Algorithm</th>
                <th scope="col">Movement (cylinders)</th>
                <th scope="col">Average (cylinders/request)</th>
                <th scope="col">Endpoint travel</th>
                <th scope="col">Wrap travel</th>
                <th scope="col">Inspect</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.scenario.algorithm}>
                  <th scope="row">{DISK_NAMES[r.scenario.algorithm]}</th>
                  <td>{r.summary.totalMovement}</td>
                  <td>{r.summary.averageMovement?.toFixed(2) ?? '—'}</td>
                  <td>{r.summary.endpointMovement}</td>
                  <td>{r.summary.wrapMovement}</td>
                  <td>
                    <Button
                      aria-label={`Inspect ${DISK_NAMES[r.scenario.algorithm]} trace`}
                      onClick={() => inspect(r)}
                    >
                      Trace
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <p className="subtle small">
          Endpoint and wrap columns are cylinders moved, not request counts or
          latency.
        </p>
        <details className="comparison-inputs" open>
          <summary>Shared workload · calculation inputs</summary>
          <p className="subtle small">
            Range 0–{input?.maxCylinder} inclusive · initial head{' '}
            {input?.initialHead} · sweep {input?.direction}
          </p>
          <ScrollTable label="Shared disk inputs">
            <table>
              <thead>
                <tr>
                  <th scope="col">Input row</th>
                  <th scope="col">Request ID</th>
                  <th scope="col">Cylinder</th>
                </tr>
              </thead>
              <tbody>
                {input?.requests.map((r, i) => (
                  <tr key={r.id}>
                    <th scope="row">{i + 1}</th>
                    <td>{r.id}</td>
                    <td>{r.cylinder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </details>
      </div>
    </section>
  );
}
