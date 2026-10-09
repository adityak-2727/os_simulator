import { describe, expect, it } from 'vitest';
import {
  createInitialCpu,
  cpuReducer,
  parseCpuDraft,
} from '../../src/features/cpu/cpuState';
import { compareCpu } from '../../src/engine/cpu/compare';

describe('CPU lab state lifecycle', () => {
  it('reuses its immutable result for run, pause, speed changes, and replay', () => {
    const original = createInitialCpu();
    if (!original.result) throw new Error('Missing initial schedule.');
    const playing = cpuReducer(original, {
      type: 'run',
      result: original.result,
    });
    const sped = cpuReducer(playing, {
      type: 'replay',
      action: { type: 'speed', speed: 4 },
    });
    const advanced = cpuReducer(sped, {
      type: 'replay',
      action: { type: 'tick' },
    });
    const reset = cpuReducer(advanced, {
      type: 'replay',
      action: { type: 'reset' },
    });
    expect(reset.result).toBe(original.result);
    expect(reset.replay).toEqual({ cursor: 0, speed: 4, playing: false });
  });
  it('clears both run and comparison on an edit while preserving the entered value', () => {
    const original = createInitialCpu();
    if (!original.result) throw new Error('Missing initial schedule.');
    const response = compareCpu(original.result.scenario);
    if (!response.ok) throw new Error(response.error.message);
    const compared = cpuReducer(original, {
      type: 'compare',
      results: response.result,
    });
    const edited = cpuReducer(compared, {
      type: 'edit-process',
      key: 0,
      field: 'burst',
      value: '0',
    });
    expect(edited).toMatchObject({
      result: null,
      comparison: null,
      view: 'run',
      changed: true,
      replay: { cursor: 0, playing: false },
    });
    expect(edited.draft.processes[0]?.burst).toBe('0');
    expect(original.draft.processes[0]?.burst).toBe('5');
  });
  it('preserves unique row keys and editable IDs after removal and insertion', () => {
    const original = createInitialCpu();
    const removed = cpuReducer(original, { type: 'remove', key: 1 });
    const added = cpuReducer(removed, { type: 'add' });
    expect(added.draft.processes.map((p) => p.key)).toEqual([0, 2, 3]);
    expect(added.draft.processes.map((p) => p.id)).toEqual(['P1', 'P3', 'P2']);
    expect(new Set(added.draft.processes.map((p) => p.id)).size).toBe(3);
  });
  it('rejects a blank arrival rather than converting it to zero', () => {
    const state = cpuReducer(createInitialCpu(), {
      type: 'edit-process',
      key: 0,
      field: 'arrival',
      value: '',
    });
    const response = parseCpuDraft(state.draft);
    expect(response).toMatchObject({
      ok: false,
      error: { issues: [{ path: 'processes.0.arrival' }] },
    });
  });
  it('validates RR quantum for comparison even when another algorithm is selected', () => {
    const initial = createInitialCpu();
    const state = cpuReducer(
      cpuReducer(initial, { type: 'edit-quantum', value: '0' }),
      { type: 'algorithm', algorithm: 'fcfs' },
    );
    expect(parseCpuDraft(state.draft).ok).toBe(true);
    expect(parseCpuDraft(state.draft, true)).toMatchObject({
      ok: false,
      error: { issues: [{ path: 'quantum' }] },
    });
  });
  it('opens the selected comparison result at its final frame without recomputation', () => {
    const initial = createInitialCpu();
    if (!initial.result) throw new Error('Missing initial schedule.');
    const comparison = compareCpu(initial.result.scenario);
    if (!comparison.ok) throw new Error(comparison.error.message);
    const sjf = comparison.result.find((r) => r.scenario.algorithm === 'sjf');
    if (!sjf) throw new Error('Missing SJF result.');
    const selected = cpuReducer(initial, {
      type: 'inspect-comparison',
      result: sjf,
    });
    expect(selected.result).toBe(sjf);
    expect(selected.draft.algorithm).toBe('sjf');
    expect(selected.replay).toMatchObject({
      cursor: sjf.frames.length - 1,
      playing: false,
    });
  });
});
