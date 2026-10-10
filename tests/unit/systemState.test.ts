import { it, expect } from 'vitest';
import {
  createSystemState,
  systemReducer,
  parseSystem,
  systemDraft,
  systemExample,
} from '../../src/features/system/systemState';
it('reuses the immutable result when pausing, seeking, changing speed or replaying', () => {
  let s = createSystemState();
  const r = s.result;
  s = systemReducer(s, { type: 'run' });
  s = systemReducer(s, { type: 'replay', action: { type: 'tick' } });
  expect(s.replay.cursor).toBe(1);
  s = systemReducer(s, { type: 'replay', action: { type: 'pause' } });
  s = systemReducer(s, { type: 'replay', action: { type: 'speed', speed: 4 } });
  expect(s.result).toBe(r);
  s = systemReducer(s, {
    type: 'replay',
    action: { type: 'seek', cursor: 99999 },
  });
  expect(s.replay.cursor).toBe(r!.frames.length - 1);
  s = systemReducer(s, { type: 'run' });
  expect(s.result).toBe(r);
  expect(s.replay.cursor).toBe(0);
});
it('edits and loads stop replay and invalidate results, with descriptive syntax errors', () => {
  let s = createSystemState();
  s = systemReducer(s, { type: 'run' });
  s = systemReducer(s, { type: 'edit', draft: { ...s.draft, quantum: '0' } });
  expect(s.result).toBeNull();
  expect(s.replay.playing).toBe(false);
  s = systemReducer(s, { type: 'run' });
  expect(s.error?.code).toBe('validation');
  s = systemReducer(s, {
    type: 'load',
    scenario: systemExample('idle'),
    name: 'Idle',
  });
  expect(s.error).toBeNull();
  expect(parseSystem(s.draft).ok).toBe(true);
  expect(
    parseSystem({
      ...s.draft,
      processes: [
        { id: 'A', arrival: '0', memory: '1', code: 'eval something' },
      ],
    }).ok,
  ).toBe(false);
  expect(parseSystem(systemDraft(systemExample('cycle'))).ok).toBe(true);
});
