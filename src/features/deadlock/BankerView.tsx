import { Button, ScrollTable } from '../../components/Primitives';
import type { BankerResult, BankerSnapshot } from '../../engine/deadlock/types';
import { formatVector } from './format';
import { processColor } from '../cpu/presentation';
export function Matrix({
  title,
  processIds,
  resourceIds,
  values,
}: {
  title: string;
  processIds: readonly string[];
  resourceIds: readonly string[];
  values: readonly (readonly number[])[];
}) {
  return (
    <div className="banker-matrix">
      <h3>{title}</h3>
      <ScrollTable label={title}>
        <table>
          <thead>
            <tr>
              <th>Process</th>
              {resourceIds.map((id) => (
                <th key={id}>{id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processIds.map((id, i) => (
              <tr key={id}>
                <th style={{ color: processColor(i) }}>{id}</th>
                {resourceIds.map((r, j) => (
                  <td key={r} className="mono">
                    {values[i]?.[j]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
export function BankerView({
  result,
  snapshot,
  continueGrant,
  select,
}: {
  result: BankerResult;
  snapshot: BankerSnapshot;
  continueGrant: () => void;
  select: (cursor: number) => void;
}) {
  const { actual, analyzed, work, finish, sequence } = snapshot,
    { processIds, resourceIds } = result.scenario;
  const visible = result.frames
    .slice(1, snapshot.step + 1)
    .filter((f) => f.event?.kind === 'banker-select');
  return (
    <>
      <div className="section-title">
        <h2>Actual resource state</h2>
        <span className="scope-label">Step {snapshot.step} · instances</span>
      </div>
      <ScrollTable label="Actual resource vectors">
        <table>
          <thead>
            <tr>
              <th>Vector</th>
              {resourceIds.map((id) => (
                <th key={id}>{id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Total</th>
              {actual.total.map((v, j) => (
                <td key={j} className="mono">
                  {v}
                </td>
              ))}
            </tr>
            <tr>
              <th>Available</th>
              {actual.available.map((v, j) => (
                <td key={j} className="mono">
                  {v}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </ScrollTable>
      <p className="subtle small">
        Available = Total − allocated column sum. Need = Max − Allocation. These
        values change only when a request is committed.
      </p>
      <div className="banker-matrices">
        <Matrix
          title="Actual Allocation"
          processIds={processIds}
          resourceIds={resourceIds}
          values={actual.allocation}
        />
        <Matrix
          title="Actual Need"
          processIds={processIds}
          resourceIds={resourceIds}
          values={actual.need}
        />
      </div>
      {result.scenario.request && analyzed !== result.initialState && (
        <div className="tentative-state">
          <h3>
            {snapshot.status === 'granted'
              ? 'Committed request state'
              : 'Tentative analysis · not actual allocation'}
          </h3>
          <p className="small">
            Analysis Available {formatVector(analyzed.available)}. Request:{' '}
            {result.scenario.request.processId}{' '}
            {formatVector(result.scenario.request.amount)}.
          </p>
          <div className="banker-matrices">
            <Matrix
              title="Analysis Allocation"
              processIds={processIds}
              resourceIds={resourceIds}
              values={analyzed.allocation}
            />
            <Matrix
              title="Analysis Need"
              processIds={processIds}
              resourceIds={resourceIds}
              values={analyzed.need}
            />
          </div>
        </div>
      )}
      <div className="section-divider" />
      <div className="section-title">
        <h2>Safety calculation</h2>
        <span className="scope-label">Simulated completion</span>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Work (instances)</dt>
          <dd className="mono" data-testid="banker-work">
            {formatVector(work)}
          </dd>
        </div>
        <div>
          <dt>Sequence so far</dt>
          <dd className="mono" data-testid="banker-sequence">
            {sequence.length ? sequence.join(' → ') : 'No selections yet'}
          </dd>
        </div>
      </dl>
      <ScrollTable label="Finish flags">
        <table>
          <thead>
            <tr>
              <th>Process</th>
              <th>Finish</th>
              <th>Need for this analysis</th>
            </tr>
          </thead>
          <tbody>
            {processIds.map((id, i) => (
              <tr key={id}>
                <th>{id}</th>
                <td>
                  {finish[i] ? 'True · can finish' : 'False · unfinished'}
                </td>
                <td className="mono">{formatVector(analyzed.need[i] ?? [])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
      <p className="subtle small">
        Work is a simulated availability vector. Finishing releases resources
        into Work only; it does not release actual allocations.
      </p>
      {visible.length > 0 && (
        <ScrollTable label="Safety trace">
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>Selected</th>
                <th>Work before</th>
                <th>Work after</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.index}>
                  <td>
                    <Button
                      aria-label={`Inspect safety step ${f.index}`}
                      onClick={() => select(f.index)}
                    >
                      {f.index}
                    </Button>
                  </td>
                  <th>{f.event?.processId}</th>
                  <td className="mono">
                    {formatVector(f.event?.workBefore ?? [])}
                  </td>
                  <td className="mono">
                    {formatVector(f.event?.workAfter ?? [])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}
      {snapshot.unsatisfied.length > 0 && (
        <div className="rule-box">
          <h3>Why processes cannot finish</h3>
          {snapshot.unsatisfied.map((p) => (
            <p key={p.processId}>
              <strong>{p.processId}</strong>:{' '}
              {p.shortfalls
                .map((s) => `${s.resourceId} Need ${s.need} > Work ${s.work}`)
                .join('; ')}
            </p>
          ))}
          <p>
            Unsafe means no safe sequence was found; it does not prove current
            deadlock.
          </p>
        </div>
      )}
      {snapshot.status === 'granted' && (
        <div className="rule-box">
          <p>
            The request is committed in actual state. The source inputs stay
            fixed for this replay. To chain another request, use the committed
            allocation as your next source.
          </p>
          <Button onClick={continueGrant}>Continue from granted state</Button>
        </div>
      )}
    </>
  );
}
