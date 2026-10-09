import { describe, expect, it } from 'vitest';
import { createPreview } from '../../src/engine/preview';
import {
  initialReplay,
  replayReducer,
  type ReplayAction,
} from '../../src/app/replay';
import { createInitialLab, labReducer } from '../../src/app/labReducer';

function example() {
  const response = createPreview({ firstDuration: 3, secondDuration: 2 });
  if (!response.ok) throw new Error(response.error.message);
  return response.result;
}

describe('scripted fixture contract', () => {
  it('has independently derived time transitions and intervals', () => {
    const result = example();
    expect(result.events.map((event) => event.simTime)).toEqual([
      0, 0, 3, 3, 5,
    ]);
    expect(result.frames.map((frame) => frame.index)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(result.frames[0]?.event).toBeNull();
    expect(result.frames[3]?.snapshot).toMatchObject({
      simTime: 3,
      running: null,
      ready: ['P2'],
      completed: ['P1'],
    });
    expect(result.frames[4]?.snapshot).toMatchObject({
      simTime: 3,
      running: 'P2',
      ready: [],
      completed: ['P1'],
    });
    expect(result.frames[5]?.snapshot.segments).toEqual([
      { processId: 'P1', start: 0, end: 3 },
      { processId: 'P2', start: 3, end: 5 },
    ]);
  });
  it('is deterministic, freezes nested trace data, and copies source input', () => {
    const input = { firstDuration: 3, secondDuration: 2 };
    const response = createPreview(input);
    expect(response).toEqual(createPreview(input));
    if (!response.ok) throw new Error(response.error.message);
    input.firstDuration = 15;
    expect(response.result.input.firstDuration).toBe(3);
    expect(
      Object.isFrozen(response.result.frames[5]?.snapshot.segments[0]),
    ).toBe(true);
    expect(Object.isFrozen(response.result.frames[1]?.snapshot.ready)).toBe(
      true,
    );
    expect(() =>
      Reflect.set(response.result.input, 'firstDuration', 12),
    ).not.toThrow();
    expect(response.result.input.firstDuration).toBe(3);
  });
  it.each([NaN, Infinity, -1, 0, 1.5, 21])(
    'rejects invalid duration %s with its field path',
    (duration) => {
      const result = createPreview({
        firstDuration: duration,
        secondDuration: 2,
      });
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'validation', issues: [{ path: 'firstDuration' }] },
      });
    },
  );
  it('rejects an insufficient trace budget without a partial result', () => {
    expect(
      createPreview({ firstDuration: 3, secondDuration: 2 }, 4),
    ).toMatchObject({ ok: false, error: { code: 'limit-exceeded' } });
  });
  it('preserves queue, completion, and time invariants across supported durations', () => {
    for (let firstDuration = 1; firstDuration <= 20; firstDuration++) {
      const response = createPreview({
        firstDuration,
        secondDuration: 21 - firstDuration,
      });
      if (!response.ok) throw new Error(response.error.message);
      const { frames, duration } = response.result;
      expect(duration).toBe(21);
      frames.forEach((frame, index) => {
        const s = frame.snapshot;
        const ids = [
          ...s.ready,
          ...s.completed,
          ...(s.running ? [s.running] : []),
        ];
        expect(new Set(ids).size).toBe(ids.length);
        expect(s.simTime).toBeGreaterThanOrEqual(
          frames[Math.max(0, index - 1)]?.snapshot.simTime ?? 0,
        );
        expect(
          s.segments.reduce(
            (sum, segment) => sum + segment.end - segment.start,
            0,
          ),
        ).toBe(s.simTime);
      });
    }
  });
});

describe('cursor playback', () => {
  it('moves, bounds, pauses, resets, and changes speed without mutating the trace', () => {
    const result = example();
    const serialized = JSON.stringify(result);
    let state = initialReplay;
    const apply = (action: ReplayAction) => {
      state = replayReducer(state, action, result.frames.length);
    };
    apply({ type: 'previous' });
    expect(state.cursor).toBe(0);
    apply({ type: 'next' });
    expect(state).toMatchObject({ cursor: 1, playing: false });
    apply({ type: 'play' });
    apply({ type: 'speed', speed: 4 });
    expect(state).toMatchObject({ cursor: 1, playing: true, speed: 4 });
    apply({ type: 'tick' });
    expect(state.cursor).toBe(2);
    apply({ type: 'pause' });
    apply({ type: 'tick' });
    expect(state.cursor).toBe(2);
    apply({ type: 'seek', cursor: 5 });
    expect(state.playing).toBe(false);
    apply({ type: 'next' });
    expect(state.cursor).toBe(5);
    apply({ type: 'play' });
    expect(state).toMatchObject({ cursor: 0, playing: true });
    for (let i = 0; i < 6; i++) apply({ type: 'tick' });
    expect(state).toMatchObject({ cursor: 5, playing: false });
    apply({ type: 'reset' });
    expect(state).toEqual({ cursor: 0, playing: false, speed: 4 });
    expect(JSON.stringify(result)).toBe(serialized);
  });
  it('does not play an absent trace or accept noninteger cursors', () => {
    expect(replayReducer(initialReplay, { type: 'play' }, 0).playing).toBe(
      false,
    );
    expect(replayReducer(initialReplay, { type: 'seek', cursor: NaN }, 6)).toBe(
      initialReplay,
    );
    expect(
      replayReducer(initialReplay, { type: 'seek', cursor: 1000 }, 6).cursor,
    ).toBe(5);
  });
  it('invalidates the result and stops playback on edits, preserving the edit', () => {
    const initial = createInitialLab();
    const playing = labReducer(initial, { type: 'run', result: example() });
    expect(playing.result).toBe(initial.result);
    const edited = labReducer(playing, {
      type: 'edit',
      field: 'firstDuration',
      value: '7',
    });
    expect(edited).toMatchObject({
      result: null,
      draft: { firstDuration: '7', secondDuration: '2' },
      changed: true,
      replay: { playing: false, cursor: 0 },
    });
    expect(initial.result?.duration).toBe(5);
  });
});
