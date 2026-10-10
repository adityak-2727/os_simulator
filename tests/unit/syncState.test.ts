import { expect, it } from 'vitest';
import {
  createSyncState,
  syncReducer,
} from '../../src/features/synchronization/syncState';
import { draftFrom, parseSync } from '../../src/features/synchronization/edit';
import {
  PRESETS,
  syncExample,
} from '../../src/features/synchronization/presets';
it('round-trips every preset without fixture answers and rejects malformed programs and fields', () => {
  for (const preset of PRESETS) {
    const source = syncExample(preset.id);
    expect(parseSync(draftFrom(source))).toEqual({ ok: true, result: source });
  }
  const d = createSyncState().draft;
  for (const patch of [
    { initialCounter: '' },
    { capacity: '1.5' },
    { semaphores: 's zero' },
    { semaphores: 's 1 extra' },
    { schedule: 'Unknown' },
    { processes: [{ id: 'P1', code: 'eval alert(1)' }, d.processes[1]!] },
    { processes: [{ id: 'P1', code: 'lock unknown' }, d.processes[1]!] },
  ])
    expect(parseSync({ ...d, ...patch }).ok).toBe(false);
});
it('matching recorded choices advances by reference; a different choice requires confirmation and discards the exact future', () => {
  const initial = createSyncState(),
    one = syncReducer(initial, { type: 'choice', processId: 'P1' });
  expect(one.result).toBe(initial.result);
  expect(one.replay.cursor).toBe(1);
  const pending = syncReducer(one, { type: 'choice', processId: 'P1' });
  expect(pending.pendingBranch).toEqual({
    processId: 'P1',
    cursor: 1,
    discarded: 5,
  });
  expect(pending.result).toBe(initial.result);
  expect(pending.draft.schedule).toBe(initial.draft.schedule);
  const canceled = syncReducer(pending, { type: 'cancel-branch' });
  expect(canceled.result).toBe(initial.result);
  const branch = syncReducer(pending, { type: 'confirm-branch' });
  expect(branch.result?.scenario.schedule).toEqual(['P1', 'P1']);
  expect(branch.replay.cursor).toBe(2);
  expect(branch.notice).toContain('Discarded 5');
  expect(initial.result?.events).toHaveLength(6);
  const finishP1 = syncReducer(branch, { type: 'choice', processId: 'P1' });
  expect(finishP1.result?.summary.counter).toBe(1);
  expect(finishP1.result?.summary.status).toBe('awaiting-choice');
  const finished = ['P2', 'P2', 'P2'].reduce(
    (s, processId) => syncReducer(s, { type: 'choice', processId }),
    finishP1,
  );
  expect(finished.result?.summary.counter).toBe(2);
  expect(finished.result?.summary.status).toBe('completed');
});
it('rewinding, playback speed and mode changes preserve the result and cancel stale branch approval', () => {
  const initial = createSyncState(),
    one = syncReducer(initial, { type: 'replay', action: { type: 'next' } }),
    pending = syncReducer(one, { type: 'choice', processId: 'P1' }),
    seek = syncReducer(pending, {
      type: 'replay',
      action: { type: 'seek', cursor: 0 },
    });
  expect(seek.pendingBranch).toBeNull();
  expect(syncReducer(seek, { type: 'confirm-branch' })).toBe(seek);
  const speed = syncReducer(seek, {
    type: 'replay',
    action: { type: 'speed', speed: 4 },
  });
  expect(speed.result).toBe(initial.result);
  expect(speed.replay.speed).toBe(4);
  const run = syncReducer(speed, { type: 'run' });
  expect(run.result).toBe(initial.result);
  expect(
    syncReducer(run, { type: 'mode', mode: 'manual' }).replay.playing,
  ).toBe(false);
});
it('blocked/completed manual choices are rejected without appending or losing the current trace', () => {
  const loaded = syncReducer(createSyncState(), {
      type: 'load',
      preset: 'counter-mutex',
    }),
    run = syncReducer(loaded, { type: 'run' }),
    blocked = syncReducer(run, {
      type: 'replay',
      action: { type: 'seek', cursor: 2 },
    }),
    rejected = syncReducer(blocked, { type: 'choice', processId: 'P2' });
  expect(rejected.error?.message).toContain('blocked');
  expect(rejected.result).toBe(run.result);
  expect(rejected.draft.schedule).toBe(run.draft.schedule);
  expect(rejected.replay.cursor).toBe(2);
});
it('empty manual schedules await valid choices and source edits pause and invalidate results', () => {
  const empty = syncReducer(createSyncState(), { type: 'empty-schedule' }),
    run = syncReducer(empty, { type: 'run' });
  expect(run.result?.summary.status).toBe('awaiting-choice');
  expect(run.replay.playing).toBe(false);
  const step = syncReducer(empty, { type: 'choice', processId: 'P2' });
  expect(step.result?.scenario.schedule).toEqual(['P2']);
  expect(step.replay.cursor).toBe(1);
  const edit = syncReducer(step, {
    type: 'edit',
    draft: { ...step.draft, initialCounter: '2' },
  });
  expect(edit.result).toBeNull();
  expect(edit.replay.playing).toBe(false);
  expect(edit.changed).toBe(true);
});
