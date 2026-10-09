import { Button, Panel } from '../../components/Primitives';
import {
  ALLOCATION_STRATEGIES,
  PAGING_ALGORITHMS,
} from '../../engine/memory/validation';
import { useMemory } from './MemoryContext';
import {
  allocationExample,
  pagingExample,
  parseAllocation,
  parsePaging,
  PAGE_NAMES,
  STRATEGY_NAMES,
  type AllocationDraft,
  type OperationDraft,
  type PagingDraft,
} from './memoryState';

export function AllocationEditor() {
  const { state, dispatch } = useMemory(),
    draft = state.allocation.draft;
  const parsed = parseAllocation(draft),
    issues = parsed.ok ? [] : parsed.error.issues;
  const update = (patch: Partial<AllocationDraft>) =>
    dispatch({ type: 'allocation-draft', draft: { ...draft, ...patch } });
  const edit = (key: number, patch: Partial<OperationDraft>) =>
    update({
      operations: draft.operations.map((op) =>
        op.key === key ? { ...op, ...patch } : op,
      ),
    });
  const error = (path: string) => issues.find((i) => i.path === path)?.message;
  function move(index: number, direction: -1 | 1) {
    const operations = [...draft.operations],
      other = operations[index + direction],
      current = operations[index];
    if (!other || !current) return;
    operations[index] = other;
    operations[index + direction] = current;
    update({ operations });
  }
  return (
    <Panel
      title="Operations"
      aside={<span className="subtle">{draft.operations.length} steps</span>}
      className="input-panel memory-editor"
    >
      <div className="panel-body">
        <label className="field-label" htmlFor="allocation-name">
          Workload name
        </label>
        <input
          id="allocation-name"
          value={draft.name}
          maxLength={80}
          onChange={(e) => update({ name: e.target.value })}
          aria-invalid={!!error('name')}
          aria-describedby="allocation-name-error"
        />
        <p id="allocation-name-error" className="field-error">
          {error('name')}
        </p>
        <label className="field-label" htmlFor="allocation-capacity">
          Capacity (KiB)
        </label>
        <input
          id="allocation-capacity"
          type="number"
          min={1}
          max={65_536}
          step={1}
          value={draft.capacity}
          onChange={(e) => update({ capacity: e.target.value })}
          aria-invalid={!!error('totalKiB')}
          aria-describedby="allocation-capacity-error"
        />
        <p id="allocation-capacity-error" className="field-error">
          {error('totalKiB')}
        </p>
        <label className="field-label" htmlFor="allocation-strategy">
          Strategy
        </label>
        <select
          id="allocation-strategy"
          value={draft.strategy}
          onChange={(e) => {
            const strategy = ALLOCATION_STRATEGIES.find(
              (s) => s === e.target.value,
            );
            if (strategy) update({ strategy });
          }}
        >
          {ALLOCATION_STRATEGIES.map((s) => (
            <option key={s} value={s}>
              {STRATEGY_NAMES[s]}
            </option>
          ))}
        </select>
        <div className="section-title memory-operation-heading">
          <h3>Ordered operations</h3>
        </div>
        <div
          className="memory-operation-list"
          role="group"
          aria-label="Ordered allocation operations"
        >
          {draft.operations.map((op, index) => (
            <div key={op.key} className="memory-operation-row">
              <div className="memory-operation-tools">
                <span className="mono">#{index + 1}</span>
                <div>
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={`Move operation ${index + 1} up`}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === draft.operations.length - 1}
                    aria-label={`Move operation ${index + 1} down`}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove operation ${index + 1}`}
                    onClick={() =>
                      update({
                        operations: draft.operations.filter(
                          (row) => row.key !== op.key,
                        ),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="memory-operation-fields">
                <label>
                  Action
                  <select
                    aria-label={`Operation ${index + 1} action`}
                    value={op.kind}
                    onChange={(e) => {
                      if (
                        e.target.value === 'allocate' ||
                        e.target.value === 'free'
                      )
                        edit(op.key, { kind: e.target.value });
                    }}
                  >
                    <option value="allocate">Allocate</option>
                    <option value="free">Free</option>
                  </select>
                </label>
                <label>
                  ID
                  <input
                    aria-label={`Operation ${index + 1} ID`}
                    value={op.id}
                    maxLength={24}
                    aria-invalid={!!error(`operations.${index}.id`)}
                    aria-describedby={`operation-${op.key}-error`}
                    onChange={(e) => edit(op.key, { id: e.target.value })}
                  />
                </label>
                <label>
                  KiB
                  {op.kind === 'allocate' ? (
                    <input
                      aria-label={`Operation ${index + 1} size in KiB`}
                      type="number"
                      min={1}
                      max={65_536}
                      step={1}
                      value={op.size}
                      aria-invalid={!!error(`operations.${index}.sizeKiB`)}
                      aria-describedby={`operation-${op.key}-error`}
                      onChange={(e) => edit(op.key, { size: e.target.value })}
                    />
                  ) : (
                    <span className="memory-unused">—</span>
                  )}
                </label>
              </div>
              <p id={`operation-${op.key}-error`} className="field-error">
                {error(`operations.${index}.id`) ??
                  error(`operations.${index}.sizeKiB`)}
              </p>
            </div>
          ))}
        </div>
        {error('operations') && (
          <p className="field-error" role="alert">
            {draft.operations.length
              ? error('operations')
              : 'Add an operation or load an example.'}
          </p>
        )}
        <Button
          className="w-full"
          disabled={draft.operations.length >= 200}
          onClick={() =>
            update({
              operations: [
                ...draft.operations,
                {
                  key: draft.nextKey,
                  kind: 'allocate',
                  id: `A${draft.nextKey + 1}`,
                  size: '100',
                },
              ],
              nextKey: draft.nextKey + 1,
            })
          }
        >
          Add operation
        </Button>
        <p className="subtle small">
          Capacity 1–65,536 KiB · up to 200 operations. Size must be a positive
          integer no greater than capacity.
        </p>
        <label className="field-label" htmlFor="allocation-example">
          Load example
        </label>
        <select
          id="allocation-example"
          value=""
          onChange={(e) => {
            const example = e.target.value;
            if (
              example === 'reference' ||
              example === 'fragmentation' ||
              example === 'coalescing'
            )
              dispatch({
                type: 'allocation-draft',
                draft: allocationExample(example),
              });
          }}
        >
          <option value="" disabled>
            Choose an example…
          </option>
          <option value="reference">Hole selection · 1,024 KiB</option>
          <option value="fragmentation">Fragmentation failure</option>
          <option value="coalescing">Free and coalesce</option>
        </select>
        <details className="assumptions">
          <summary>Model assumptions</summary>
          <ul>
            <li>Half-open address ranges [start, end)</li>
            <li>Allocate from the low end of a hole</li>
            <li>Free merges both adjacent free holes</li>
            <li>Exact partitions · no alignment overhead</li>
            <li>Rejected operations preserve memory</li>
            <li>A freed ID may be reused</li>
          </ul>
        </details>
      </div>
    </Panel>
  );
}
export function PagingEditor() {
  const { state, dispatch } = useMemory(),
    draft = state.paging.draft;
  const parsed = parsePaging(draft),
    issues = parsed.ok ? [] : parsed.error.issues;
  const update = (patch: Partial<PagingDraft>) =>
    dispatch({ type: 'paging-draft', draft: { ...draft, ...patch } });
  const error = (path: string) => issues.find((i) => i.path === path)?.message;
  const referenceIssues = issues.filter((i) => i.path.startsWith('references'));
  return (
    <Panel title="References" className="input-panel memory-editor">
      <div className="panel-body">
        <label className="field-label" htmlFor="paging-name">
          Workload name
        </label>
        <input
          id="paging-name"
          value={draft.name}
          maxLength={80}
          onChange={(e) => update({ name: e.target.value })}
          aria-invalid={!!error('name')}
          aria-describedby="paging-name-error"
        />
        <p id="paging-name-error" className="field-error">
          {error('name')}
        </p>
        <label className="field-label" htmlFor="paging-frames">
          Frame count
        </label>
        <input
          id="paging-frames"
          type="number"
          min={1}
          max={12}
          step={1}
          value={draft.frames}
          onChange={(e) => update({ frames: e.target.value })}
          aria-invalid={!!error('frames')}
          aria-describedby="paging-frames-error"
        />
        <p id="paging-frames-error" className="field-error">
          {error('frames')}
        </p>
        <label className="field-label" htmlFor="paging-algorithm">
          Algorithm
        </label>
        <select
          id="paging-algorithm"
          value={draft.algorithm}
          onChange={(e) => {
            const algorithm = PAGING_ALGORITHMS.find(
              (a) => a === e.target.value,
            );
            if (algorithm) update({ algorithm });
          }}
        >
          {PAGING_ALGORITHMS.map((a) => (
            <option value={a} key={a}>
              {PAGE_NAMES[a]}
            </option>
          ))}
        </select>
        <label className="field-label" htmlFor="paging-references">
          Reference sequence
        </label>
        <textarea
          id="paging-references"
          value={draft.references}
          rows={5}
          onChange={(e) => update({ references: e.target.value })}
          aria-invalid={referenceIssues.length > 0}
          aria-describedby="paging-references-errors paging-limits"
        />
        <div id="paging-references-errors" className="field-error">
          {referenceIssues.slice(0, 4).map((i) => (
            <p key={i.path}>{i.message}</p>
          ))}
          {referenceIssues.length > 4 && (
            <p>{referenceIssues.length - 4} further invalid references.</p>
          )}
        </div>
        <p id="paging-limits" className="subtle small">
          Separate pages with commas or spaces. 1–200 references, page IDs
          0–9,999, and 1–12 frames.
        </p>
        <Button
          className="w-full"
          onClick={() =>
            dispatch({ type: 'paging-draft', draft: pagingExample() })
          }
        >
          Load reference example
        </Button>
        <details className="assumptions" open>
          <summary>Model assumptions</summary>
          <ul>
            <li>Frames begin empty</li>
            <li>Fill lowest empty index first</li>
            <li>FIFO hits keep insertion order</li>
            <li>LRU hits update last access</li>
            <li>Optimal knows the future sequence</li>
            <li>Optimal ties use lowest frame index</li>
            <li>Step index · no millisecond model</li>
          </ul>
        </details>
      </div>
    </Panel>
  );
}
