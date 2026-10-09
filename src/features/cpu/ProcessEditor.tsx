import { Button, Panel } from '../../components/Primitives';
import { useCpu } from './CpuContext';
import { ALGORITHM_NAMES, processStyle } from './presentation';
import { parseCpuDraft, type ExampleName } from './cpuState';
import { CPU_ALGORITHMS, isCpuAlgorithm } from '../../engine/cpu/validation';

export function ProcessEditor() {
  const { state, dispatch } = useCpu();
  const validation = parseCpuDraft(state.draft);
  const issues = validation.ok ? [] : validation.error.issues;
  const issue = (path: string) => issues.find((i) => i.path === path);
  return (
    <Panel
      title="Workload"
      aside={
        <span className="subtle">{state.draft.processes.length} processes</span>
      }
      className="input-panel cpu-editor"
    >
      <div className="panel-body">
        <label className="field-label" htmlFor="cpu-name">
          Workload name
        </label>
        <input
          id="cpu-name"
          value={state.draft.name}
          onChange={(e) =>
            dispatch({ type: 'edit-name', value: e.target.value })
          }
          maxLength={80}
          aria-invalid={!!issue('name')}
          aria-describedby={issue('name') ? 'cpu-name-error' : undefined}
        />
        {issue('name') && (
          <p id="cpu-name-error" className="field-error">
            {issue('name')?.message}
          </p>
        )}
        <div
          className="table-scroll cpu-input-scroll"
          role="region"
          aria-label="Process input table"
          tabIndex={0}
        >
          <table className="process-editor-table">
            <caption className="sr-only">
              CPU workload, times in time units. Priority is used only by
              Priority scheduling.
            </caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Arrival</th>
                <th scope="col">Burst</th>
                <th scope="col">Priority</th>
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {state.draft.processes.map((p, index) => (
                <tr key={p.key} data-testid={`process-input-${p.key}`}>
                  <td colSpan={5}>
                    <div className="process-input-row">
                      {(['id', 'arrival', 'burst', 'priority'] as const).map(
                        (field) => {
                          const error = issue(`processes.${index}.${field}`);
                          const label =
                            field === 'id'
                              ? `Process ${index + 1} ID`
                              : `${p.id || `Row ${index + 1}`} ${field === 'arrival' ? 'arrival time' : field === 'burst' ? 'burst time' : 'priority'}`;
                          const errorId = `cpu-${p.key}-${field}-error`;
                          return (
                            <input
                              key={field}
                              aria-label={label}
                              aria-invalid={!!error}
                              aria-describedby={
                                error ? errorId : 'cpu-input-limits'
                              }
                              value={p[field]}
                              type={field === 'id' ? 'text' : 'number'}
                              min={field === 'burst' ? 1 : 0}
                              max={
                                field === 'arrival'
                                  ? 10_000
                                  : field === 'burst'
                                    ? 1000
                                    : field === 'priority'
                                      ? 999
                                      : undefined
                              }
                              step={field === 'id' ? undefined : 1}
                              maxLength={field === 'id' ? 24 : undefined}
                              style={
                                field === 'id' ? processStyle(index) : undefined
                              }
                              onChange={(e) =>
                                dispatch({
                                  type: 'edit-process',
                                  key: p.key,
                                  field,
                                  value: e.target.value,
                                })
                              }
                            />
                          );
                        },
                      )}
                      <button
                        type="button"
                        className="remove-process"
                        aria-label={`Remove process ${p.id || `row ${index + 1}`}`}
                        onClick={() => dispatch({ type: 'remove', key: p.key })}
                      >
                        ×
                      </button>
                    </div>
                    {(['id', 'arrival', 'burst', 'priority'] as const).map(
                      (field) => {
                        const error = issue(`processes.${index}.${field}`);
                        return error ? (
                          <p
                            key={field}
                            id={`cpu-${p.key}-${field}-error`}
                            className="field-error"
                          >
                            {error.message}
                          </p>
                        ) : null;
                      },
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {issue('processes') && (
          <p className="field-error" role="alert">
            {state.draft.processes.length === 0
              ? 'Add at least one process or load an example.'
              : issue('processes')?.message}
          </p>
        )}
        <Button
          className="w-full"
          onClick={() => dispatch({ type: 'add' })}
          disabled={state.draft.processes.length >= 50}
        >
          Add process
        </Button>
        <p id="cpu-input-limits" className="subtle small">
          Up to 50 processes. Arrival 0–10,000 t; burst 1–1,000 t. Priority
          0–999, relevant only to Priority.
        </p>
        <label className="field-label" htmlFor="cpu-algorithm">
          Algorithm
        </label>
        <select
          id="cpu-algorithm"
          value={state.draft.algorithm}
          onChange={(e) => {
            if (isCpuAlgorithm(e.target.value))
              dispatch({ type: 'algorithm', algorithm: e.target.value });
          }}
        >
          {CPU_ALGORITHMS.map((a) => (
            <option value={a} key={a}>
              {ALGORITHM_NAMES[a]}
              {a === 'sjf' || a === 'priority' ? ' (non-preemptive)' : ''}
            </option>
          ))}
        </select>
        {state.draft.algorithm === 'rr' && (
          <div className="quantum-field">
            <label className="field-label" htmlFor="cpu-quantum">
              Time quantum
            </label>
            <div className="flex items-center gap-2">
              <input
                id="cpu-quantum"
                type="number"
                min={1}
                max={1000}
                step={1}
                value={state.draft.quantum}
                aria-invalid={!!issue('quantum')}
                aria-describedby={
                  issue('quantum') ? 'cpu-quantum-error' : 'cpu-quantum-unit'
                }
                onChange={(e) =>
                  dispatch({ type: 'edit-quantum', value: e.target.value })
                }
              />
              <span id="cpu-quantum-unit" className="subtle small">
                time units
              </span>
            </div>
            {issue('quantum') && (
              <p id="cpu-quantum-error" className="field-error">
                {issue('quantum')?.message}
              </p>
            )}
          </div>
        )}
        <div className="section-divider" />
        <label className="field-label" htmlFor="cpu-example">
          Load example
        </label>
        <select
          id="cpu-example"
          value=""
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'reference' || value === 'idle' || value === 'ties')
              dispatch({ type: 'example', example: value as ExampleName });
          }}
        >
          <option value="" disabled>
            Choose an example…
          </option>
          <option value="reference">Reference workload · RR</option>
          <option value="idle">Initial idle · FCFS</option>
          <option value="ties">Equal arrival ties · RR</option>
        </select>
        <details className="assumptions" open>
          <summary>Model assumptions</summary>
          <ul>
            <li>One CPU · integer time units</li>
            <li>Zero context-switch cost</li>
            <li>One positive burst · no I/O</li>
            <li>
              {state.draft.algorithm === 'rr'
                ? 'Preemptive · FIFO ready queue'
                : 'Non-preemptive · run to completion'}
            </li>
            <li>Smaller priority = higher priority</li>
            <li>Ties preserve arrival/input order</li>
            <li>RR arrivals before requeue</li>
            <li>Clock begins at t = 0</li>
          </ul>
        </details>
      </div>
    </Panel>
  );
}
