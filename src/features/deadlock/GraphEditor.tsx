import { useState } from 'react';
import { Button, Panel, ScrollTable } from '../../components/Primitives';
import { editGraph } from '../../engine/deadlock/graph';
import type { GraphCommand } from '../../engine/deadlock/types';
import { useDeadlock } from './DeadlockContext';
import { graphExample, parseGraph, splitIds } from './deadlockState';
export function GraphEditor() {
  const { state, dispatch } = useDeadlock(),
    draft = state.graph.draft,
    parsed = parseGraph(draft);
  const [process, setProcess] = useState('P1'),
    [resource, setResource] = useState('R1'),
    [message, setMessage] = useState('');
  const update = (patch: Partial<typeof draft>) => {
    setMessage('');
    dispatch({ type: 'graph-edit', draft: { ...draft, ...patch } });
  };
  function command(type: GraphCommand['type']) {
    if (!parsed.ok) return;
    const result = editGraph(parsed.result, {
      type,
      processId: process,
      resourceId: resource,
    });
    if (result.ok)
      update({
        allocations: result.result.allocations,
        requests: result.result.requests,
      });
    else setMessage(result.error.message);
  }
  return (
    <Panel title="Graph configuration" className="input-panel">
      <div className="panel-body deadlock-editor">
        <label>
          Example
          <select
            aria-label="Graph example"
            defaultValue="cycle"
            onChange={(e) => {
              setMessage('');
              dispatch({
                type: 'graph-edit',
                draft: graphExample(e.target.value === 'cycle'),
              });
            }}
          >
            <option value="cycle">Two-process cycle</option>
            <option value="no-cycle">Pending request, no cycle</option>
          </select>
        </label>
        <label>
          Process IDs
          <input
            aria-label="Graph process IDs"
            value={draft.processes}
            onChange={(e) => update({ processes: e.target.value })}
          />
        </label>
        <label>
          Resource IDs
          <input
            aria-label="Graph resource IDs"
            value={draft.resources}
            onChange={(e) => update({ resources: e.target.value })}
          />
        </label>
        <p className="subtle small">
          Comma-separated IDs. Up to 12 of each; resources have exactly one
          instance.
        </p>
        <div className="section-divider" />
        <h3>Resource operations</h3>
        <label>
          Process
          <select
            aria-label="Graph operation process"
            value={process}
            onChange={(e) => setProcess(e.target.value)}
          >
            <option value="">Choose process</option>
            {splitIds(draft.processes).map((id, i) => (
              <option key={i} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Resource
          <select
            aria-label="Graph operation resource"
            value={resource}
            onChange={(e) => setResource(e.target.value)}
          >
            <option value="">Choose resource</option>
            {splitIds(draft.resources).map((id, i) => (
              <option key={i} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          {(['request', 'cancel-request', 'grant', 'release'] as const).map(
            (type) => (
              <Button
                key={type}
                disabled={!parsed.ok}
                onClick={() => command(type)}
              >
                {type === 'cancel-request'
                  ? 'Cancel request'
                  : type[0]?.toUpperCase() + type.slice(1)}
              </Button>
            ),
          )}
        </div>
        {message && (
          <p role="alert" className="field-error">
            {message}
          </p>
        )}
        <div className="section-divider" />
        <h3>Source edges</h3>
        <ScrollTable label="Editable graph edges">
          <table>
            <thead>
              <tr>
                <th>Kind</th>
                <th>Direction</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {(['requests', 'allocations'] as const).flatMap((key) =>
                draft[key].map((edge, i) => (
                  <tr key={`${key}-${i}`}>
                    <td>{key === 'requests' ? 'Request' : 'Allocation'}</td>
                    <td className="mono">
                      {key === 'requests'
                        ? `${edge.processId} → ${edge.resourceId}`
                        : `${edge.resourceId} → ${edge.processId}`}
                    </td>
                    <td>
                      <Button
                        aria-label={`Remove ${key} ${edge.processId} ${edge.resourceId}`}
                        onClick={() =>
                          update({
                            [key]: draft[key].filter((_, j) => i !== j),
                          })
                        }
                      >
                        ×
                      </Button>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </ScrollTable>
        {!draft.allocations.length && !draft.requests.length && (
          <p className="subtle small">
            No edges. Add a request or grant above.
          </p>
        )}
        <p className="subtle small">
          Operations edit the source graph and invalidate its trace. Grant
          removes the matching pending request. Release requires the selected
          owner.
        </p>
        {!parsed.ok && (
          <div role="alert" className="field-error">
            {parsed.error.issues.map((issue, i) => (
              <p key={i}>{issue.message}</p>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
