import { Button, Panel } from '../../components/Primitives';
import { useSync } from './SyncContext';
import { parseSync, type SyncDraft } from './edit';
import { PRESETS } from './presets';
export function SyncEditor() {
  const { state, dispatch } = useSync(),
    { draft } = state,
    parsed = parseSync(draft);
  const update = (patch: Partial<SyncDraft>) =>
    dispatch({ type: 'edit', draft: { ...draft, ...patch } });
  return (
    <Panel title="Interleaving configuration" className="input-panel">
      <div className="panel-body sync-editor">
        <label>
          Example
          <select
            aria-label="Synchronization example"
            value={draft.preset}
            onChange={(e) => {
              const preset = PRESETS.find((p) => p.id === e.target.value);
              if (preset) dispatch({ type: 'load', preset: preset.id });
            }}
          >
            {PRESETS.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Process selection
          <select
            aria-label="Process selection mode"
            value={state.mode}
            onChange={(e) => {
              if (e.target.value === 'scripted' || e.target.value === 'manual')
                dispatch({ type: 'mode', mode: e.target.value });
            }}
          >
            <option value="scripted">Scripted schedule</option>
            <option value="manual">Manual choices</option>
          </select>
        </label>
        <div className="sync-input-pair">
          <label>
            Initial shared x
            <input
              aria-label="Initial shared counter"
              value={draft.initialCounter}
              onChange={(e) => update({ initialCounter: e.target.value })}
            />
          </label>
          <label>
            Buffer slots
            <input
              aria-label="Buffer capacity"
              inputMode="numeric"
              value={draft.capacity}
              onChange={(e) => update({ capacity: e.target.value })}
            />
          </label>
        </div>
        <label>
          Mutex IDs
          <input
            aria-label="Mutex IDs"
            value={draft.mutexIds}
            placeholder="m"
            onChange={(e) => update({ mutexIds: e.target.value })}
          />
        </label>
        <label>
          Semaphore ID and initial permits
          <textarea
            aria-label="Semaphore definitions"
            rows={2}
            value={draft.semaphores}
            placeholder={'empty 2\nfull 0'}
            onChange={(e) => update({ semaphores: e.target.value })}
          />
        </label>
        <div className="section-divider" />
        <h3>Source programs</h3>
        <p className="subtle small">
          2–4 processes, 1–100 instructions each. One instruction per line.
          These are model instructions, never executed JavaScript.
        </p>
        {draft.processes.map((p, i) => (
          <div className="sync-program-input" key={i}>
            <div className="sync-process-tools">
              <label>
                Process {i + 1}
                <input
                  aria-label={`Process ${i + 1} ID`}
                  value={p.id}
                  onChange={(e) =>
                    update({
                      processes: draft.processes.map((x, j) =>
                        i === j ? { ...x, id: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <Button
                disabled={draft.processes.length <= 2}
                aria-label={`Remove process ${p.id}`}
                onClick={() =>
                  update({
                    processes: draft.processes.filter((_, j) => i !== j),
                  })
                }
              >
                ×
              </Button>
            </div>
            <textarea
              aria-label={`${p.id} program`}
              rows={Math.min(6, Math.max(3, p.code.split('\n').length))}
              value={p.code}
              onChange={(e) =>
                update({
                  processes: draft.processes.map((x, j) =>
                    i === j ? { ...x, code: e.target.value } : x,
                  ),
                })
              }
            />
          </div>
        ))}
        <Button
          disabled={draft.processes.length >= 4}
          onClick={() => {
            let index = draft.processes.length + 1;
            while (draft.processes.some((p) => p.id === `P${index}`)) index++;
            update({
              processes: [
                ...draft.processes,
                {
                  id: `P${index}`,
                  code: 'read-counter r\nadd-local r 1\nwrite-counter r',
                },
              ],
            });
          }}
        >
          Add process
        </Button>
        <div className="section-divider" />
        <label>
          Scheduled process choices
          <textarea
            aria-label="Scheduled process choices"
            rows={3}
            value={draft.schedule}
            placeholder="Empty schedule awaits manual choices"
            onChange={(e) => update({ schedule: e.target.value })}
          />
        </label>
        <p className="subtle small">
          Comma or space separated; up to 1,000 choices. A blocked/completed
          choice is rejected without executing. An empty or exhausted schedule
          awaits a choice.
        </p>
        <Button onClick={() => dispatch({ type: 'empty-schedule' })}>
          Start empty manual schedule
        </Button>
        {!parsed.ok && (
          <div role="alert" className="field-error">
            {parsed.error.issues.map((issue, i) => (
              <p key={i}>{issue.message}</p>
            ))}
          </div>
        )}
        <details>
          <summary>Instruction reference & limits</summary>
          <p className="subtle small">
            read-counter r · add-local r 1 · write-counter r · lock m · unlock m
            · wait empty · signal full · enqueue A · dequeue item
          </p>
          <p className="subtle small">
            IDs and registers: 1–24 letters, digits, underscores, hyphens. Safe
            integer counters/addends. Buffer capacity 1–10. Up to 8 mutexes and
            8 semaphores, initial permits 0–1000. Buffer operations require
            ownership of mutex m.
          </p>
        </details>
      </div>
    </Panel>
  );
}
