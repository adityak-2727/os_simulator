import { Button, Panel, ScrollTable } from '../../components/Primitives';
import { DISK_ALGORITHMS } from '../../engine/disk/validation';
import type { DiskAlgorithm } from '../../engine/disk/types';
import { useDisk } from './DiskContext';
import { DISK_NAMES, parseDisk, type DiskDraft } from './diskState';
export function DiskEditor() {
  const { state, dispatch } = useDisk(),
    d = state.draft,
    parsed = parseDisk(d);
  const issues = parsed.ok ? [] : parsed.error.issues;
  const error = (path: string) =>
    issues
      .filter((i) => i.path === path)
      .map((i) => i.message)
      .join(' ');
  const edit = (draft: DiskDraft) => dispatch({ type: 'edit', draft });
  function reorder(index: number, offset: number) {
    const requests = [...d.requests],
      a = requests[index],
      b = requests[index + offset];
    if (!a || !b) return;
    requests[index] = b;
    requests[index + offset] = a;
    edit({ ...d, requests });
  }
  function add() {
    let n = d.nextKey + 1;
    while (d.requests.some((r) => r.id === `D${n}`)) n++;
    edit({
      ...d,
      nextKey: n,
      requests: [
        ...d.requests,
        { key: n, id: `D${n}`, cylinder: d.initialHead },
      ],
    });
  }
  return (
    <Panel title="Disk configuration" className="disk-editor">
      <div className="panel-body">
        <label className="field-label" htmlFor="disk-name">
          Scenario name
        </label>
        <input
          id="disk-name"
          value={d.name}
          maxLength={80}
          aria-invalid={!!error('name')}
          aria-describedby="disk-name-error"
          onChange={(e) => edit({ ...d, name: e.target.value })}
        />
        <p id="disk-name-error" className="field-error">
          {error('name')}
        </p>
        <label className="field-label" htmlFor="disk-algorithm">
          Algorithm
        </label>
        <select
          id="disk-algorithm"
          value={d.algorithm}
          onChange={(e) => {
            const algorithm = e.target.value as DiskAlgorithm;
            if (DISK_ALGORITHMS.includes(algorithm)) edit({ ...d, algorithm });
          }}
        >
          {DISK_ALGORITHMS.map((a) => (
            <option key={a} value={a}>
              {DISK_NAMES[a]}
            </option>
          ))}
        </select>
        <div className="disk-field-pair">
          <div>
            <label className="field-label" htmlFor="disk-max">
              Maximum cylinder
            </label>
            <input
              id="disk-max"
              inputMode="numeric"
              value={d.maxCylinder}
              aria-invalid={!!error('maxCylinder')}
              aria-describedby="disk-max-error"
              onChange={(e) => edit({ ...d, maxCylinder: e.target.value })}
            />
            <p id="disk-max-error" className="field-error">
              {error('maxCylinder')}
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="disk-head">
              Initial head
            </label>
            <input
              id="disk-head"
              inputMode="numeric"
              value={d.initialHead}
              aria-invalid={!!error('initialHead')}
              aria-describedby="disk-head-error"
              onChange={(e) => edit({ ...d, initialHead: e.target.value })}
            />
            <p id="disk-head-error" className="field-error">
              {error('initialHead')}
            </p>
          </div>
        </div>
        <p className="subtle small">
          Minimum is 0. Maximum 1–100,000; head and requests must lie within the
          inclusive range.
        </p>
        <label className="field-label" htmlFor="disk-direction">
          Initial sweep direction
        </label>
        <select
          id="disk-direction"
          value={d.direction}
          onChange={(e) => {
            if (e.target.value === 'higher' || e.target.value === 'lower')
              edit({ ...d, direction: e.target.value });
          }}
        >
          <option value="higher">Higher cylinders</option>
          <option value="lower">Lower cylinders</option>
        </select>
        <p className="subtle small">
          Direction affects SCAN and C-SCAN. Comparison uses this same direction
          for both.
        </p>
        <div className="section-divider" />
        <h3>Requests in input order</h3>
        <p className="subtle small">
          1–100 requests. Duplicate cylinders are separate requests with unique
          IDs. IDs: 1–24 letters, digits, underscores or hyphens.
        </p>
        <ScrollTable label="Disk request editor">
          <table className="disk-input-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Cylinder</th>
                <th scope="col">Order / remove</th>
              </tr>
            </thead>
            <tbody>
              {d.requests.map((r, i) => {
                const idError = error(`requests.${i}.id`),
                  cylinderError = error(`requests.${i}.cylinder`);
                return (
                  <tr key={r.key}>
                    <td>
                      <input
                        aria-label={`Request ${i + 1} ID`}
                        value={r.id}
                        maxLength={24}
                        aria-invalid={!!idError}
                        aria-describedby={`disk-id-${r.key}-error`}
                        onChange={(e) =>
                          edit({
                            ...d,
                            requests: d.requests.map((x) =>
                              x.key === r.key
                                ? { ...x, id: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                      <p id={`disk-id-${r.key}-error`} className="field-error">
                        {idError}
                      </p>
                    </td>
                    <td>
                      <input
                        aria-label={`Request ${i + 1} cylinder`}
                        inputMode="numeric"
                        value={r.cylinder}
                        aria-invalid={!!cylinderError}
                        aria-describedby={`disk-cylinder-${r.key}-error`}
                        onChange={(e) =>
                          edit({
                            ...d,
                            requests: d.requests.map((x) =>
                              x.key === r.key
                                ? { ...x, cylinder: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                      <p
                        id={`disk-cylinder-${r.key}-error`}
                        className="field-error"
                      >
                        {cylinderError}
                      </p>
                    </td>
                    <td>
                      <div className="disk-row-actions">
                        <Button
                          aria-label={`Move request ${i + 1} earlier`}
                          disabled={i === 0}
                          onClick={() => reorder(i, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          aria-label={`Move request ${i + 1} later`}
                          disabled={i === d.requests.length - 1}
                          onClick={() => reorder(i, 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          aria-label={`Remove request ${i + 1}`}
                          onClick={() =>
                            edit({
                              ...d,
                              requests: d.requests.filter(
                                (x) => x.key !== r.key,
                              ),
                            })
                          }
                        >
                          ×
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollTable>
        <p
          className="field-error"
          role={error('requests') ? 'alert' : undefined}
        >
          {error('requests')}
        </p>
        <Button disabled={d.requests.length >= 100} onClick={add}>
          Add request
        </Button>
        <div className="section-divider" />
        <h3>Examples</h3>
        <div className="disk-example-actions">
          <Button
            onClick={() => dispatch({ type: 'load', example: 'reference' })}
          >
            Load reference example
          </Button>
          <Button
            onClick={() => dispatch({ type: 'load', example: 'boundaries' })}
          >
            Duplicates and endpoints
          </Button>
        </div>
        <details className="comparison-inputs">
          <summary>Model & conventions</summary>
          <p className="small">
            Static batch without arrivals. FCFS preserves input order; SSTF ties
            use smaller cylinder, then input order. Sweeps serve head requests
            first and preserve duplicate order. Reach the physical endpoint
            before reversing or wrapping if opposite-side requests remain. Wrap
            distance counts. Stop at the last service. An already-reached
            endpoint decision costs zero.
          </p>
        </details>
      </div>
    </Panel>
  );
}
