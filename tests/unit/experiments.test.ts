import { it, expect } from 'vitest';
import fixture from '../../fixtures/experiment-import.json';
import {
  parseExperiment,
  validateExperiment,
  validateScenario,
  csv,
} from '../../src/experiments/format';
import {
  EXPERIMENT_KEY,
  readExperiments,
  writeExperiments,
  readPreferences,
} from '../../src/experiments/storage';
import { scheduleCpu } from '../../src/engine/cpu/schedule';
import type { Scenario } from '../../src/engine/scenarios';
import { allocateMemory } from '../../src/engine/memory/allocation';
import { replacePages } from '../../src/engine/memory/paging';
import { analyzeGraph } from '../../src/engine/deadlock/graph';
import { runBanker } from '../../src/engine/deadlock/banker';
import { runSync } from '../../src/engine/synchronization/interpreter';
import { scheduleDisk } from '../../src/engine/disk/schedule';
import { runSystem } from '../../src/engine/system/schedule';
import { systemExample } from '../../src/features/system/systemState';
it('every scenario discriminator round-trips allowed source fields and recomputes identically', () => {
  const inputs: Scenario[] = [
    {
      kind: 'allocation',
      totalKiB: 10,
      strategy: 'first-fit',
      operations: [
        { kind: 'allocate', id: 'A', sizeKiB: 4 },
        { kind: 'free', id: 'A' },
      ],
    },
    { kind: 'paging', algorithm: 'lru', frames: 2, references: [1, 2, 1, 3] },
    {
      kind: 'deadlock',
      mode: 'graph',
      processIds: ['P'],
      resourceIds: ['R'],
      allocations: [],
      requests: [{ processId: 'P', resourceId: 'R' }],
    },
    {
      kind: 'deadlock',
      mode: 'banker',
      processIds: ['P'],
      resourceIds: ['R'],
      total: [2],
      max: [[2]],
      allocation: [[1]],
      request: { processId: 'P', amount: [1] },
    },
    {
      kind: 'synchronization',
      preset: 'counter-race',
      capacity: 1,
      initialCounter: 0,
      mutexIds: [],
      semaphores: [],
      processes: [
        { id: 'A', instructions: [{ op: 'read-counter', register: 'r' }] },
        { id: 'B', instructions: [{ op: 'read-counter', register: 'r' }] },
      ],
      schedule: ['A', 'B'],
    },
    {
      kind: 'disk',
      minCylinder: 0,
      maxCylinder: 9,
      initialHead: 3,
      direction: 'higher',
      algorithm: 'cscan',
      requests: [{ id: 'D', cylinder: 5 }],
    },
    systemExample(),
  ];
  function calculate(s: Scenario) {
    switch (s.kind) {
      case 'cpu':
        return scheduleCpu(s);
      case 'allocation':
        return allocateMemory(s);
      case 'paging':
        return replacePages(s);
      case 'deadlock':
        return s.mode === 'graph' ? analyzeGraph(s) : runBanker(s);
      case 'synchronization':
        return runSync(s);
      case 'disk':
        return scheduleDisk(s);
      case 'system':
        return runSystem(s);
    }
  }
  for (const scenario of inputs) {
    const r = parseExperiment(JSON.stringify({ ...fixture, scenario }));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.result.scenario).toEqual(scenario);
    expect(calculate(r.result.scenario)).toEqual(calculate(scenario));
  }
});
it('round-trips the import oracle and recomputes identical CPU results', () => {
  const r = parseExperiment(JSON.stringify(fixture));
  expect(r.ok).toBe(true);
  if (!r.ok || r.result.scenario.kind !== 'cpu') return;
  expect(r.result).toEqual(fixture);
  const after = parseExperiment(JSON.stringify(r.result));
  if (!after.ok || after.result.scenario.kind !== 'cpu')
    throw new Error('Round trip failed');
  expect(scheduleCpu(after.result.scenario)).toEqual(
    scheduleCpu(r.result.scenario),
  );
});
it('rejects malformed, future, wrong-format, oversized and cross-field invalid imports', () => {
  for (const v of [
    '{',
    JSON.stringify({ ...fixture, schemaVersion: 2 }),
    JSON.stringify({ ...fixture, format: 'os-lab-fixture' }),
    JSON.stringify({
      ...fixture,
      scenario: {
        ...fixture.scenario,
        processes: [
          fixture.scenario.processes[0],
          fixture.scenario.processes[0],
        ],
      },
    }),
    ' '.repeat(1048577),
    JSON.stringify({
      ...fixture,
      scenario: {
        kind: 'deadlock',
        mode: 'banker',
        processIds: ['A'],
        resourceIds: ['R'],
        total: [1],
        allocation: [[2]],
        max: [[1]],
      },
    }),
  ])
    expect(parseExperiment(v).ok).toBe(false);
});
it('builds allowed-field objects without merging untrusted keys or HTML', () => {
  const r = parseExperiment(
    JSON.stringify({
      ...fixture,
      name: '<b>Example</b>',
      __proto__: { polluted: true },
      scenario: { ...fixture.scenario, evil: 'eval' },
    }),
  );
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.result.scenario).not.toHaveProperty('evil');
    expect(r.result.name).toBe('<b>Example</b>');
  }
  expect({}).not.toHaveProperty('polluted');
});
it('handles nested wrong shapes without throwing', () => {
  for (const kind of [
    'cpu',
    'allocation',
    'paging',
    'deadlock',
    'synchronization',
    'disk',
    'system',
  ])
    for (const processes of [null, 3, {}, [null]])
      expect(() => validateScenario({ kind, processes })).not.toThrow();
  expect(validateExperiment({ ...fixture, createdAt: 'bad' }).ok).toBe(false);
  expect(validateScenario({ ...fixture.scenario, quantum: '2' }).ok).toBe(
    false,
  );
});
it('stores only validated source experiments and preserves corrupt or unavailable storage', () => {
  const r = validateExperiment(fixture);
  if (!r.ok) throw new Error('Fixture invalid');
  const memory = new Map<string, string>(),
    storage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memory.set(k, v);
      },
    };
  expect(writeExperiments(storage, [r.result]).ok).toBe(true);
  expect(readExperiments(storage)).toEqual({ ok: true, value: [r.result] });
  const good = memory.get(EXPERIMENT_KEY);
  expect(writeExperiments(storage, [{ ...r.result, name: '' }]).ok).toBe(false);
  expect(memory.get(EXPERIMENT_KEY)).toBe(good);
  expect(
    writeExperiments(
      storage,
      Array.from({ length: 31 }, (_, i) => ({ ...r.result, id: String(i) })),
    ).ok,
  ).toBe(false);
  memory.set(EXPERIMENT_KEY, '{bad');
  expect(readExperiments(storage).ok).toBe(false);
  expect(memory.get(EXPERIMENT_KEY)).toBe('{bad');
  const denied = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  expect(readExperiments(denied).ok).toBe(false);
  expect(writeExperiments(denied, [r.result]).ok).toBe(false);
  expect(readPreferences(denied).ok).toBe(false);
});
it('escapes CSV formula markers, quotes, commas and newlines', () => {
  expect(csv([['=SUM(A1)', ' +2', '@x', '-1', 'a"b,c\nd', null]])).toBe(
    '"\'=SUM(A1)","\' +2","\'@x","\'-1","a""b,c\nd",""\r\n',
  );
});
