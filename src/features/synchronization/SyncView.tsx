import { ScrollTable } from '../../components/Primitives';
import type {
  SyncResult,
  SyncSnapshot,
} from '../../engine/synchronization/types';
import { processColor } from '../cpu/presentation';
import { instructionText } from './presets';
export function SyncView({
  result,
  snapshot,
}: {
  result: SyncResult;
  snapshot: SyncSnapshot;
}) {
  const s = snapshot;
  return (
    <>
      <div className="section-title">
        <h2>Shared state</h2>
        <span className="scope-label">Step {s.step} · atomic instructions</span>
      </div>
      <div className="metric-strip cpu-metric-strip sync-metrics">
        <div>
          <span>Shared counter x</span>
          <strong data-testid="shared-counter">{s.counter}</strong>
          <span>integer value</span>
        </div>
        <div>
          <span>Buffer occupancy</span>
          <strong>
            {s.buffer.length} / {result.scenario.capacity}
          </strong>
          <span>occupied slots / capacity</span>
        </div>
        <div>
          <span>Consumed so far</span>
          <strong>{s.consumed.length}</strong>
          <span>FIFO items</span>
        </div>
      </div>
      <div className="section-title">
        <h2>Process programs</h2>
        <span className="subtle small">
          PC is a zero-based instruction index
        </span>
      </div>
      <div className="sync-programs">
        {s.processes.map((p, i) => (
          <section
            className="sync-code"
            key={p.id}
            aria-label={`${p.id} execution state`}
            style={{ borderTopColor: processColor(i) }}
          >
            <header>
              <strong style={{ color: processColor(i) }}>{p.id}</strong>
              <span className="scope-label">{p.state}</span>
            </header>
            <p className="mono small">
              PC {p.pc} / {result.scenario.processes[i]?.instructions.length}
              {p.waiting ? ` · pending ${p.waiting.kind} ${p.waiting.id}` : ''}
            </p>
            <p className="subtle small">
              {result.scenario.processes[i]?.instructions[p.pc]
                ? `Next: ${instructionText(result.scenario.processes[i]!.instructions[p.pc]!)}`
                : 'Program finished'}
            </p>
            <ol className="sync-code-lines">
              {result.scenario.processes[i]?.instructions.map(
                (instruction, j) => (
                  <li
                    key={j}
                    className={
                      j === p.pc
                        ? p.waiting
                          ? 'pending'
                          : 'current'
                        : j < p.pc
                          ? 'executed'
                          : ''
                    }
                    aria-current={j === p.pc ? 'step' : undefined}
                  >
                    <span className="mono">{j}</span>
                    <code>{instructionText(instruction)}</code>
                    {j === p.pc && (
                      <span className="sync-pc-marker">
                        {p.waiting ? 'WAIT' : 'PC'}
                      </span>
                    )}
                  </li>
                ),
              )}
            </ol>
            <h3>Local registers</h3>
            {Object.entries(p.locals).length ? (
              <dl className="sync-locals">
                {Object.entries(p.locals).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd className="mono">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="subtle small">No initialized registers</p>
            )}
          </section>
        ))}
      </div>
      <div className="section-divider" />
      <h2>Locks & permits</h2>
      {s.mutexes.length ? (
        <ScrollTable label="Mutex state">
          <table>
            <thead>
              <tr>
                <th>Mutex</th>
                <th>Owner</th>
                <th>FIFO wait queue · head first</th>
              </tr>
            </thead>
            <tbody>
              {s.mutexes.map((m) => (
                <tr key={m.id}>
                  <th>{m.id}</th>
                  <td>{m.owner ?? 'Free'}</td>
                  <td>{m.queue.join(' → ') || 'Empty'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : (
        <p className="subtle small">
          No mutex configured. Reads and writes are separate, unprotected
          instructions.
        </p>
      )}
      {s.semaphores.length ? (
        <ScrollTable label="Semaphore state">
          <table>
            <thead>
              <tr>
                <th>Semaphore</th>
                <th>Available permits</th>
                <th>FIFO wait queue · head first</th>
              </tr>
            </thead>
            <tbody>
              {s.semaphores.map((a) => (
                <tr key={a.id}>
                  <th>{a.id}</th>
                  <td className="mono">{a.count}</td>
                  <td>{a.queue.join(' → ') || 'Empty'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : (
        <p className="subtle small">No counting semaphores configured.</p>
      )}
      {(result.scenario.preset === 'producer-consumer' ||
        s.produced.length > 0 ||
        s.semaphores.some((a) => a.id === 'empty' || a.id === 'full')) && (
        <>
          <div className="section-divider" />
          <div className="section-title">
            <h2>Bounded FIFO buffer</h2>
            <span className="scope-label">Head → tail</span>
          </div>
          <div
            className="sync-buffer"
            role="region"
            aria-label="Buffer slots"
            tabIndex={0}
          >
            {Array.from({ length: result.scenario.capacity }, (_, i) => (
              <div key={i} className={s.buffer[i] ? 'occupied' : ''}>
                <span>Slot {i}</span>
                <strong>{s.buffer[i]?.value ?? 'Empty'}</strong>
                {s.buffer[i] && <small>by {s.buffer[i]?.producer}</small>}
              </div>
            ))}
          </div>
          <p className="subtle small">
            Maximum occupancy so far: {s.maxBufferOccupancy} slots.
            Enqueue/dequeue require mutex m ownership.
          </p>
          <ScrollTable label="In-flight buffer reservations">
            <table>
              <thead>
                <tr>
                  <th>Process</th>
                  <th>Permit reserved</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {s.processes.flatMap((p) =>
                  p.reservations.map((r, i) => (
                    <tr key={`${p.id}-${i}`}>
                      <th>{p.id}</th>
                      <td>{r.semaphore}</td>
                      <td>
                        {r.phase === 'before-buffer'
                          ? 'Before buffer operation'
                          : 'Buffer changed; signal pending'}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </ScrollTable>
          {!s.processes.some((p) => p.reservations.length) && (
            <p className="subtle small">No in-flight buffer permits.</p>
          )}
          <p className="rule-box">
            Permit counts describe available permits, not immediate occupancy.
            Between wait and the complementary signal, empty + full can differ
            from capacity. Reservations show where permits are in flight.
          </p>
          <h3>Consumed sequence so far</h3>
          <p className="mono" data-testid="consumed-sequence">
            {s.consumed.map((item) => item.value).join(' → ') ||
              'No items consumed'}
          </p>
        </>
      )}
      {s.status === 'stalled' && (
        <div className="sync-warning" role="status">
          <h3>Stalled: no process can run</h3>
          <p>
            All unfinished processes are blocked and no external signal is
            modeled. Inspect their wait queues. This interpreter does not
            establish a wait cycle, so this result is not labeled deadlock.
          </p>
        </div>
      )}
      {s.error && (
        <div role="alert" className="cpu-error">
          <strong>Model error · {s.error.processId}</strong>
          <p>{s.error.message}</p>
          <p>
            Repair the source program. The failed instruction changed no domain
            state.
          </p>
        </div>
      )}
    </>
  );
}
