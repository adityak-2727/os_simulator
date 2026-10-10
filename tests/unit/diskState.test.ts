import { describe, expect, it } from 'vitest';
import {
  createDiskState,
  diskExample,
  diskReducer,
  parseDisk,
} from '../../src/features/disk/diskState';
describe('disk editor and replay state', () => {
  it('parses explicit whole-number fields and preserves invalid values with useful paths', () => {
    expect(parseDisk(diskExample()).ok).toBe(true);
    for (const text of ['', '2.5', '1e2', '0x10', '-1', 'Infinity']) {
      const r = parseDisk({ ...diskExample(), initialHead: text });
      expect(r.ok).toBe(false);
      if (!r.ok)
        expect(r.error.issues.some((i) => i.path === 'initialHead')).toBe(true);
    }
    const r = parseDisk({
      ...diskExample(),
      name: ' ',
      requests: [{ key: 0, id: 'bad id', cylinder: '200' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.error.issues.map((i) => i.path)).toEqual([
        'requests.0.id',
        'requests.0.cylinder',
        'name',
      ]);
  });
  it('reuses the computed trace for stepping, speed changes, pause, reset and replay', () => {
    const initial = createDiskState(),
      result = initial.result;
    let state = diskReducer(initial, { type: 'run' });
    expect(state.result).toBe(result);
    expect(state.replay.playing).toBe(true);
    state = diskReducer(state, {
      type: 'replay',
      action: { type: 'speed', speed: 4 },
    });
    state = diskReducer(state, { type: 'replay', action: { type: 'next' } });
    expect(state.replay).toEqual({ cursor: 1, speed: 4, playing: false });
    expect(state.result).toBe(result);
    state = diskReducer(state, {
      type: 'replay',
      action: { type: 'seek', cursor: 8 },
    });
    state = diskReducer(state, { type: 'run' });
    expect(state.result).toBe(result);
    expect(state.replay.cursor).toBe(0);
    state = diskReducer(state, { type: 'replay', action: { type: 'reset' } });
    expect(state.replay.playing).toBe(false);
    expect(state.draft).toBe(initial.draft);
  });
  it('invalidates both result and comparison after editing and stops playback', () => {
    let state = diskReducer(createDiskState(), { type: 'compare' });
    expect(state.comparison).toHaveLength(4);
    state = diskReducer(state, {
      type: 'edit',
      draft: { ...state.draft, initialHead: '999' },
    });
    expect(state).toMatchObject({
      result: null,
      comparison: null,
      view: 'replay',
      changed: true,
      replay: { cursor: 0, playing: false },
    });
    state = diskReducer(state, { type: 'run' });
    expect(state.result).toBeNull();
    expect(state.error?.issues.some((i) => i.path === 'initialHead')).toBe(
      true,
    );
    expect(state.draft.initialHead).toBe('999');
  });
  it('comparison pauses playback and trace inspection preserves the same shared inputs', () => {
    const initial = createDiskState();
    let state = diskReducer(diskReducer(initial, { type: 'run' }), {
      type: 'compare',
    });
    expect(state.view).toBe('compare');
    expect(state.replay.playing).toBe(false);
    expect(state.result).toBe(initial.result);
    const result = state.comparison?.[3];
    if (!result) throw new Error('Missing comparison');
    state = diskReducer(state, { type: 'inspect', result });
    expect(state.result).toBe(result);
    expect(state.draft.requests).toBe(initial.draft.requests);
    expect(state.draft.algorithm).toBe('cscan');
    expect(state.replay.cursor).toBe(0);
    expect(state.replay.playing).toBe(false);
    state = diskReducer(state, { type: 'compare' });
    state = diskReducer(state, { type: 'back' });
    expect(state.view).toBe('replay');
    expect(state.result).toBe(result);
  });
  it('loading an example or removing all requests exposes a fresh explicit empty/ready state', () => {
    let state = diskReducer(createDiskState(), {
      type: 'load',
      example: 'boundaries',
    });
    expect(state.result).toBeNull();
    expect(state.draft.requests.map((r) => r.cylinder)).toEqual([
      '50',
      '0',
      '100',
      '50',
      '40',
      '60',
    ]);
    state = diskReducer(state, {
      type: 'edit',
      draft: { ...state.draft, requests: [] },
    });
    expect(parseDisk(state.draft).ok).toBe(false);
    state = diskReducer(state, { type: 'run' });
    expect(state.result).toBeNull();
    expect(state.replay.playing).toBe(false);
  });
});
