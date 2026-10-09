import { Button, Panel, ScrollTable } from '../../components/Primitives';
import { useDeadlock } from './DeadlockContext';
import { bankerExample, parseBanker, type BankerDraft } from './deadlockState';
export function BankerEditor({ evaluate }: { evaluate: () => void }) {
  const { state, dispatch } = useDeadlock(),
    draft = state.banker.draft,
    parsed = parseBanker(draft);
  const update = (patch: Partial<BankerDraft>) =>
    dispatch({ type: 'banker-edit', draft: { ...draft, ...patch } });
  const rowCount = draft.processIds.length,
    colCount = draft.resourceIds.length;
  function nextId(prefix: string, existing: readonly string[]) {
    let i = existing.length;
    while (existing.includes(`${prefix}${i}`)) i++;
    return `${prefix}${i}`;
  }
  function resource(add: boolean, index = 0) {
    if (add) {
      update({
        resourceIds: [...draft.resourceIds, nextId('R', draft.resourceIds)],
        total: [...draft.total, '0'],
        amount: [...draft.amount, '0'],
        allocation: draft.allocation.map((r) => [...r, '0']),
        max: draft.max.map((r) => [...r, '0']),
      });
    } else {
      update({
        resourceIds: draft.resourceIds.filter((_, j) => j !== index),
        total: draft.total.filter((_, j) => j !== index),
        amount: draft.amount.filter((_, j) => j !== index),
        allocation: draft.allocation.map((r) =>
          r.filter((_, j) => j !== index),
        ),
        max: draft.max.map((r) => r.filter((_, j) => j !== index)),
      });
    }
  }
  function process(add: boolean, index = 0) {
    if (add) {
      update({
        processIds: [...draft.processIds, nextId('P', draft.processIds)],
        allocation: [
          ...draft.allocation,
          Array.from({ length: colCount }, () => '0'),
        ],
        max: [...draft.max, Array.from({ length: colCount }, () => '0')],
      });
    } else {
      const ids = draft.processIds.filter((_, i) => i !== index);
      update({
        processIds: ids,
        allocation: draft.allocation.filter((_, i) => i !== index),
        max: draft.max.filter((_, i) => i !== index),
        requestProcess: ids.includes(draft.requestProcess)
          ? draft.requestProcess
          : (ids[0] ?? ''),
      });
    }
  }
  function cell(
    key: 'allocation' | 'max',
    i: number,
    j: number,
    value: string,
  ) {
    update({
      [key]: draft[key].map((r, ri) =>
        ri === i ? r.map((v, cj) => (cj === j ? value : v)) : r,
      ),
    });
  }
  return (
    <Panel title="Banker configuration" className="input-panel">
      <div className="panel-body deadlock-editor">
        <label>
          Example
          <select
            aria-label="Banker example"
            defaultValue="safe"
            onChange={(e) =>
              dispatch({
                type: 'banker-edit',
                draft: bankerExample(e.target.value),
              })
            }
          >
            <option value="safe">Safety reference</option>
            <option value="unsafe">Unsafe state</option>
            <optgroup label="Independent requests; reset matrices">
              <option value="grant">P1 requests [1, 0, 2]</option>
              <option value="wait-safety">P4 requests [3, 3, 0]</option>
              <option value="wait-availability">P0 requests [0, 4, 0]</option>
              <option value="invalid">P1 requests [2, 0, 0]</option>
            </optgroup>
          </select>
        </label>
        <p className="subtle small">
          Each example replaces the source matrices. Counts are instances,
          integers 0–1000. Up to 10 processes and 8 resources.
        </p>
        <h3>Resources & Total</h3>
        <ScrollTable label="Resource inputs">
          <table className="banker-input-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Total</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {draft.resourceIds.map((id, j) => (
                <tr key={j}>
                  <td>
                    <input
                      aria-label={`Resource ${j + 1} ID`}
                      value={id}
                      onChange={(e) =>
                        update({
                          resourceIds: draft.resourceIds.map((v, c) =>
                            j === c ? e.target.value : v,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Total ${id}`}
                      inputMode="numeric"
                      value={draft.total[j] ?? ''}
                      onChange={(e) =>
                        update({
                          total: draft.total.map((v, c) =>
                            j === c ? e.target.value : v,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <Button
                      aria-label={`Remove resource ${id}`}
                      onClick={() => resource(false, j)}
                    >
                      ×
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <Button disabled={colCount >= 8} onClick={() => resource(true)}>
          Add resource
        </Button>
        {(['allocation', 'max'] as const).map((key) => (
          <div key={key}>
            <div className="section-divider" />
            <h3>{key === 'allocation' ? 'Allocation' : 'Max claims'}</h3>
            <ScrollTable label={`Editable ${key}`}>
              <table className="banker-input-table">
                <thead>
                  <tr>
                    <th>Process</th>
                    {draft.resourceIds.map((id, j) => (
                      <th key={j}>{id}</th>
                    ))}
                    {key === 'allocation' && <th>Remove</th>}
                  </tr>
                </thead>
                <tbody>
                  {draft.processIds.map((id, i) => (
                    <tr key={i}>
                      <td>
                        {key === 'allocation' ? (
                          <input
                            aria-label={`Process ${i + 1} ID`}
                            value={id}
                            onChange={(e) => {
                              const newId = e.target.value;
                              update({
                                processIds: draft.processIds.map((v, r) =>
                                  r === i ? newId : v,
                                ),
                                ...(draft.requestProcess === id
                                  ? { requestProcess: newId }
                                  : {}),
                              });
                            }}
                          />
                        ) : (
                          id
                        )}
                      </td>
                      {draft.resourceIds.map((resource, j) => (
                        <td key={j}>
                          <input
                            aria-label={`${key === 'allocation' ? 'Allocation' : 'Max'} ${id} ${resource}`}
                            inputMode="numeric"
                            value={draft[key][i]?.[j] ?? ''}
                            onChange={(e) => cell(key, i, j, e.target.value)}
                          />
                        </td>
                      ))}
                      {key === 'allocation' && (
                        <td>
                          <Button
                            aria-label={`Remove process ${id}`}
                            onClick={() => process(false, i)}
                          >
                            ×
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          </div>
        ))}
        <Button disabled={rowCount >= 10} onClick={() => process(true)}>
          Add process
        </Button>
        {!parsed.ok && (
          <div role="alert" className="field-error">
            {parsed.error.issues.map((issue, i) => (
              <p key={i}>{issue.message}</p>
            ))}
          </div>
        )}
        <div className="section-divider" />
        <h3>Resource request</h3>
        <label>
          Requesting process
          <select
            aria-label="Request process"
            value={draft.requestProcess}
            onChange={(e) => update({ requestProcess: e.target.value })}
          >
            <option value="">Choose process</option>
            {draft.processIds.map((id, i) => (
              <option value={id} key={i}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <div className="request-vector">
          {draft.resourceIds.map((id, j) => (
            <label key={j}>
              {id}
              <input
                aria-label={`Request ${id}`}
                inputMode="numeric"
                value={draft.amount[j] ?? ''}
                onChange={(e) =>
                  update({
                    amount: draft.amount.map((v, c) =>
                      c === j ? e.target.value : v,
                    ),
                  })
                }
              />
            </label>
          ))}
        </div>
        <Button primary disabled={!parsed.ok} onClick={evaluate}>
          Evaluate request
        </Button>
        <p className="subtle small">
          Evaluate checks this request as a transaction. Run starts a safety
          check when no trace exists, or replays the current trace. A grant
          commits at its decision event; input edits start a new analysis.
        </p>
      </div>
    </Panel>
  );
}
