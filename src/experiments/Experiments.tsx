import { useState } from 'react';
import { Button, ScrollTable } from '../components/Primitives';
import { useExperiments } from './ExperimentContext';
import { useScenarioBridge } from './bridge';
import {
  csv,
  parseExperiment,
  MAX_JSON_BYTES,
  ENGINE_VERSIONS,
  type ExperimentV1,
} from './format';
function create(
  name: string,
  scenario: ExperimentV1['scenario'],
): ExperimentV1 {
  const now = new Date().toISOString();
  return {
    format: 'os-lab-simulator',
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    engineVersion: ENGINE_VERSIONS[scenario.kind],
    scenario,
  };
}
function download(content: string, type: string, name: string) {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ExperimentToolbar({ route }: { route: string }) {
  const bridge = useScenarioBridge(route),
    service = useExperiments(),
    [name, setName] = useState(''),
    [naming, setNaming] = useState(false);
  if (!bridge.parsed) return null;
  const experiment = () =>
    bridge.parsed?.ok
      ? create(name || bridge.name, bridge.parsed.result)
      : null;
  return (
    <section className="experiment-toolbar" aria-label="Experiment actions">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!bridge.parsed.ok}
          onClick={() => {
            setName(bridge.name);
            setNaming(true);
          }}
        >
          Save experiment
        </Button>
        <Button
          disabled={!bridge.parsed.ok}
          onClick={() => {
            const e = bridge.parsed?.ok
              ? create(bridge.name, bridge.parsed.result)
              : null;
            if (e)
              download(
                JSON.stringify(e, null, 2),
                'application/json',
                'os-lab-experiment.json',
              );
          }}
        >
          Export JSON
        </Button>
        <Button
          disabled={!bridge.rows}
          onClick={() => {
            if (bridge.rows)
              download(
                csv([['Scenario', bridge.name], ...bridge.rows]),
                'text/csv;charset=utf-8',
                'os-lab-results.csv',
              );
          }}
        >
          Export results CSV
        </Button>
        <a href="#/experiments" className="button">
          Open experiments
        </a>
      </div>
      {naming && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const item = experiment();
            if (item && service.commit([...service.items, item]))
              setNaming(false);
          }}
        >
          <label>
            Experiment name
            <input
              aria-label="Experiment name"
              maxLength={80}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={!name.trim()}>
            Save locally
          </Button>
          <Button onClick={() => setNaming(false)}>Cancel save</Button>
        </form>
      )}
      {service.message && <p role="status">{service.message}</p>}
    </section>
  );
}
export function Experiments() {
  const service = useExperiments(),
    bridge = useScenarioBridge('experiments'),
    [pending, setPending] = useState<ExperimentV1 | null>(null),
    [target, setTarget] = useState<ExperimentV1 | null>(null),
    [operation, setOperation] = useState<'rename' | 'delete' | 'open' | null>(
      null,
    ),
    [rename, setRename] = useState(''),
    [error, setError] = useState('');
  async function importFile(file: File | undefined) {
    setPending(null);
    setError('');
    if (!file) return;
    if (file.size > MAX_JSON_BYTES) {
      setError('JSON exceeds the 1 MiB import limit.');
      return;
    }
    try {
      const r = parseExperiment(await file.text());
      if (!r.ok) {
        setError(
          [
            r.error.message,
            ...r.error.issues.map((i) => `${i.path}: ${i.message}`),
          ].join(' '),
        );
        return;
      }
      setPending(r.result);
    } catch {
      setError('Could not read the selected file. Current work was preserved.');
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LOCAL WORKSPACE</div>
          <h1>Experiments</h1>
          <p>
            Save source scenarios. Opening revalidates inputs and recomputes the
            result.
          </p>
        </div>
        <span className="scope-label">
          {service.items.length} / 30 saved locally
        </span>
      </div>
      <section className="panel panel-body experiments-panel">
        <div className="flex flex-wrap gap-3">
          <label>
            Module filter
            <select
              aria-label="Module filter"
              value={service.filter}
              onChange={(e) => service.setFilter(e.target.value)}
            >
              {[
                'all',
                'cpu',
                'allocation',
                'paging',
                'deadlock',
                'synchronization',
                'disk',
                'system',
              ].map((x) => (
                <option value={x} key={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label>
            Import experiment JSON
            <input
              type="file"
              aria-label="Import experiment JSON"
              accept=".json,application/json"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="subtle small">
          Schema v1 · JSON limit 1 MiB · module engine version is recorded.
          Results are recalculated, never trusted from a file.
        </p>
        {service.message && <p role="status">{service.message}</p>}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        {pending && (
          <section className="import-review" aria-label="Import review">
            <h2>Validated import</h2>
            <p>
              <strong>{pending.name}</strong> · {pending.scenario.kind} · engine{' '}
              {pending.engineVersion}
            </p>
            {pending.engineVersion !==
              ENGINE_VERSIONS[pending.scenario.kind] && (
              <p>
                Source engine version differs. This app recomputes with module
                engine v{ENGINE_VERSIONS[pending.scenario.kind]}.
              </p>
            )}
            <p>
              Opening replaces the target lab's current inputs and clears its
              replay. Other labs remain available.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                primary
                onClick={() => {
                  bridge.open(pending.scenario, pending.name);
                  setPending(null);
                }}
              >
                Open imported scenario
              </Button>
              <Button
                onClick={() => {
                  const item = create(pending.name, pending.scenario);
                  if (service.commit([...service.items, item]))
                    setPending(null);
                }}
              >
                Save imported copy
              </Button>
              <Button onClick={() => setPending(null)}>Cancel import</Button>
            </div>
          </section>
        )}
        {target && operation && (
          <section
            className="import-review"
            aria-label="Experiment confirmation"
          >
            <h2>
              {operation === 'rename'
                ? 'Rename'
                : operation === 'delete'
                  ? 'Delete'
                  : 'Open'}{' '}
              {target.name}
            </h2>
            {operation === 'rename' ? (
              <label>
                New experiment name
                <input
                  aria-label="New experiment name"
                  maxLength={80}
                  value={rename}
                  onChange={(e) => setRename(e.target.value)}
                />
              </label>
            ) : (
              <p>
                {operation === 'delete'
                  ? 'Remove this saved experiment from this browser?'
                  : 'Replace current inputs in the target lab and clear its replay? The saved source remains available.'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                primary
                disabled={operation === 'rename' && !rename.trim()}
                onClick={() => {
                  if (operation === 'open') {
                    bridge.open(target.scenario, target.name);
                    setTarget(null);
                  } else if (
                    service.commit(
                      operation === 'delete'
                        ? service.items.filter((e) => e.id !== target.id)
                        : service.items.map((e) =>
                            e.id === target.id
                              ? {
                                  ...e,
                                  name: rename.trim(),
                                  updatedAt: new Date().toISOString(),
                                }
                              : e,
                          ),
                    )
                  )
                    setTarget(null);
                }}
              >
                Confirm {operation}
              </Button>
              <Button onClick={() => setTarget(null)}>Cancel</Button>
            </div>
          </section>
        )}
        {service.items.length === 0 ? (
          <div className="empty-state">
            <h2>No saved experiments</h2>
            <p>
              Save a valid scenario from any lab or import an experiment JSON.
            </p>
            <a className="button" href="#/system">
              Open integrated system
            </a>
          </div>
        ) : (
          <ScrollTable label="Saved experiments">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Module</th>
                  <th>Updated (UTC)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {service.items
                  .filter(
                    (e) =>
                      service.filter === 'all' ||
                      e.scenario.kind === service.filter,
                  )
                  .map((e) => (
                    <tr key={e.id}>
                      <th>{e.name}</th>
                      <td>{e.scenario.kind}</td>
                      <td>{e.updatedAt.replace('T', ' ').replace('Z', '')}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => {
                              setTarget(e);
                              setOperation('open');
                            }}
                          >
                            Open {e.name}
                          </Button>
                          <Button
                            onClick={() => {
                              setTarget(e);
                              setOperation('rename');
                              setRename(e.name);
                            }}
                          >
                            Rename {e.name}
                          </Button>
                          <Button
                            onClick={() => {
                              const item = create(
                                `${e.name.slice(0, 73)} (copy)`,
                                e.scenario,
                              );
                              service.commit([...service.items, item]);
                            }}
                          >
                            Duplicate {e.name}
                          </Button>
                          <Button
                            onClick={() =>
                              download(
                                JSON.stringify(e, null, 2),
                                'application/json',
                                'os-lab-experiment.json',
                              )
                            }
                          >
                            Export {e.name}
                          </Button>
                          <Button
                            onClick={() => {
                              setTarget(e);
                              setOperation('delete');
                            }}
                          >
                            Delete {e.name}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
        {service.items.length > 0 &&
          !service.items.some(
            (e) =>
              service.filter === 'all' || e.scenario.kind === service.filter,
          ) && <p>No saved experiments match this module.</p>}
      </section>
    </>
  );
}
