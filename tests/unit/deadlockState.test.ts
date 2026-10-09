import { expect, it } from 'vitest';
import {
  bankerExample,
  createDeadlockState,
  deadlockReducer,
  parseBanker,
  parseGraph,
} from '../../src/features/deadlock/deadlockState';
import { runBanker } from '../../src/engine/deadlock/banker';
it('edits invalidate only the affected lab, pause playback and preserve speed', () => {
  const initial = createDeadlockState();
  const speeding = deadlockReducer(initial, {
    type: 'replay',
    mode: 'graph',
    action: { type: 'speed', speed: 4 },
  });
  const playing = deadlockReducer(speeding, {
    type: 'replay',
    mode: 'graph',
    action: { type: 'play' },
  });
  const edited = deadlockReducer(playing, {
    type: 'graph-edit',
    draft: { ...initial.graph.draft, processes: '' },
  });
  expect(edited.graph.result).toBeNull();
  expect(edited.graph.replay).toEqual({ cursor: 0, playing: false, speed: 4 });
  expect(edited.banker).toBe(initial.banker);
  expect(parseGraph(edited.graph.draft).ok).toBe(false);
});
it('mode and route navigation pause, while replay actions preserve the computed result', () => {
  const initial = createDeadlockState(),
    playing = deadlockReducer(initial, {
      type: 'replay',
      mode: 'banker',
      action: { type: 'play' },
    });
  const next = deadlockReducer(playing, {
    type: 'replay',
    mode: 'banker',
    action: { type: 'next' },
  });
  expect(next.banker.result).toBe(initial.banker.result);
  expect(
    deadlockReducer(playing, { type: 'mode', mode: 'graph' }).banker.replay
      .playing,
  ).toBe(false);
  expect(
    deadlockReducer(playing, { type: 'pause-all' }).banker.replay.playing,
  ).toBe(false);
});
it('a new request starts at frame zero, replay reuses the transaction, and request edits invalidate it', () => {
  const initial = createDeadlockState(),
    parsed = parseBanker(bankerExample('grant'), true);
  if (!parsed.ok) throw new Error('Invalid example');
  const response = runBanker(parsed.result);
  if (!response.ok) throw new Error('Invalid run');
  const atEnd = deadlockReducer(initial, {
    type: 'replay',
    mode: 'banker',
    action: { type: 'seek', cursor: 100 },
  });
  const run = deadlockReducer(atEnd, {
    type: 'banker-run',
    result: response.result,
  });
  expect(run.banker.replay.cursor).toBe(0);
  const seek = deadlockReducer(run, {
    type: 'replay',
    mode: 'banker',
    action: { type: 'seek', cursor: 2 },
  });
  const resume = deadlockReducer(seek, {
    type: 'banker-run',
    result: response.result,
  });
  expect(resume.banker.replay.cursor).toBe(2);
  expect(resume.banker.result).toBe(response.result);
  const edit = deadlockReducer(resume, {
    type: 'banker-edit',
    draft: { ...resume.banker.draft, amount: ['0', '0', '0'] },
  });
  expect(edit.banker.result).toBeNull();
  expect(edit.banker.replay.playing).toBe(false);
});
it('blank fields stay invalid, request validation is distinct from base matrix validation and errors are visible state', () => {
  const draft = bankerExample();
  expect(parseBanker({ ...draft, total: ['', '5', '7'] }).ok).toBe(false);
  const invalidRequest = parseBanker(
    { ...draft, amount: ['-1', '0', '0'] },
    true,
  );
  expect(invalidRequest.ok).toBe(true);
  if (invalidRequest.ok) {
    const result = runBanker(invalidRequest.result);
    expect(result.ok && result.result.summary.status).toBe('invalid');
  }
  const error = {
    code: 'limit-exceeded' as const,
    message: 'Budget exceeded',
    issues: [],
  };
  const state = deadlockReducer(createDeadlockState(), {
    type: 'error',
    mode: 'graph',
    error,
  });
  expect(state.graph.error).toBe(error);
  expect(state.graph.result).toBeNull();
});
