import { expect, it } from 'vitest';
import {
  allocationExample,
  createMemoryState,
  memoryReducer,
  pagingExample,
  parseAllocation,
  parsePaging,
} from '../../src/features/memory/memoryState';
import { compareAllocation } from '../../src/engine/memory/allocation';
import { comparePaging } from '../../src/engine/memory/paging';

it('allocation edit stops playback, invalidates both results, and preserves paging state', () => {
  const initial = createMemoryState();
  if (!initial.allocation.result) throw new Error('Missing computed example');
  const running = memoryReducer(initial, {
    type: 'allocation-run',
    result: initial.allocation.result,
  });
  const edited = memoryReducer(running, {
    type: 'allocation-draft',
    draft: { ...running.allocation.draft, capacity: '2048' },
  });
  expect(edited.allocation).toMatchObject({
    result: null,
    comparison: null,
    changed: true,
    replay: { playing: false, cursor: 0 },
  });
  expect(edited.paging).toBe(initial.paging);
});
it('paging edits clear comparison and preserve allocation', () => {
  const initial = createMemoryState(),
    parsed = parsePaging(initial.paging.draft);
  if (!parsed.ok) throw new Error('Invalid example');
  const compared = comparePaging(parsed.result);
  if (!compared.ok) throw new Error('Comparison failed');
  const state = memoryReducer(initial, {
    type: 'paging-compare',
    results: compared.result,
  });
  const edited = memoryReducer(state, {
    type: 'paging-draft',
    draft: { ...state.paging.draft, references: '1 2 1' },
  });
  expect(edited.paging.result).toBeNull();
  expect(edited.paging.comparison).toBeNull();
  expect(edited.allocation).toBe(initial.allocation);
});
it('replay, speed, reset, and inspection reuse the exact allocation result', () => {
  const initial = createMemoryState(),
    parsed = parseAllocation(initial.allocation.draft);
  if (!parsed.ok) throw new Error('Invalid example');
  const compared = compareAllocation(parsed.result);
  if (!compared.ok || !compared.result[1]) throw new Error('Comparison failed');
  let state = memoryReducer(initial, {
    type: 'allocation-inspect',
    result: compared.result[1],
  });
  expect(state.allocation.draft.strategy).toBe('best-fit');
  for (const action of [
    { type: 'speed', speed: 4 },
    { type: 'previous' },
    { type: 'reset' },
    { type: 'play' },
    { type: 'pause' },
  ] as const)
    state = memoryReducer(state, { type: 'replay', lab: 'allocation', action });
  expect(state.allocation.result).toBe(compared.result[1]);
  expect(state.allocation.replay).toMatchObject({
    cursor: 0,
    playing: false,
    speed: 4,
  });
});
it('paging comparison trace opens the chosen result and correct algorithm', () => {
  const initial = createMemoryState(),
    parsed = parsePaging(initial.paging.draft);
  if (!parsed.ok) throw new Error('Invalid example');
  const compared = comparePaging(parsed.result);
  if (!compared.ok || !compared.result[2]) throw new Error('Comparison failed');
  const state = memoryReducer(initial, {
    type: 'paging-inspect',
    result: compared.result[2],
  });
  expect(state.paging.draft.algorithm).toBe('optimal');
  expect(state.paging.result).toBe(compared.result[2]);
  expect(state.paging.replay.cursor).toBe(13);
});
it('explicit numeric parsing rejects blank fields rather than treating them as zero', () => {
  expect(
    parseAllocation({ ...allocationExample('reference'), capacity: '' }).ok,
  ).toBe(false);
  expect(parsePaging({ ...pagingExample(), frames: '' }).ok).toBe(false);
  expect(
    parseAllocation({ ...allocationExample('reference'), name: ' ' }).ok,
  ).toBe(false);
  expect(parsePaging({ ...pagingExample(), name: ' ' }).ok).toBe(false);
});
it('paging parser accepts comma/space separation and rejects noninteger tokens', () => {
  expect(
    parsePaging({ ...pagingExample(), references: '0, 1\n2 3' }),
  ).toMatchObject({ ok: true, result: { references: [0, 1, 2, 3] } });
  for (const references of ['', '-0', '-1', '1.5', 'word', '0x10', '1e2'])
    expect(parsePaging({ ...pagingExample(), references }).ok).toBe(false);
});
it('free has no size requirement but malformed allocate values stop a run', () => {
  const draft = allocationExample('reference');
  expect(
    parseAllocation({
      ...draft,
      operations: [{ key: 1, kind: 'free', id: 'A', size: '' }],
    }).ok,
  ).toBe(true);
  expect(
    parseAllocation({
      ...draft,
      operations: [{ key: 1, kind: 'allocate', id: 'A', size: '' }],
    }).ok,
  ).toBe(false);
});
