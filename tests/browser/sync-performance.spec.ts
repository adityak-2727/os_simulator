import { test, expect } from '@playwright/test';
import { cpus } from 'node:os';
import type { EngineResponse } from '../../src/engine/contracts';
import type {
  SyncInstruction,
  SyncResult,
  SyncScenario,
} from '../../src/engine/synchronization/types';
test('instruction engine measures reference and maximum schedules without blocking subsequent editing', async ({
  page,
}, info) => {
  await page.goto('/#/synchronization');
  const measurements = await page.evaluate(async () => {
    const enginePath = '/src/engine/synchronization/interpreter.ts';
    const engine: {
      runSync: (input: SyncScenario) => EngineResponse<SyncResult>;
    } = await import(enginePath);
    const small: SyncScenario = {
      kind: 'synchronization',
      preset: 'counter-race',
      initialCounter: 0,
      capacity: 2,
      mutexIds: [],
      semaphores: [],
      processes: ['P1', 'P2'].map((id) => ({
        id,
        instructions: [
          { op: 'read-counter', register: 'r' },
          { op: 'add-local', register: 'r', value: 1 },
          { op: 'write-counter', register: 'r' },
        ],
      })),
      schedule: ['P1', 'P2', 'P1', 'P2', 'P1', 'P2'],
    };
    const instructions: SyncInstruction[] = [
      { op: 'read-counter', register: 'r' },
      ...Array.from({ length: 98 }, (): SyncInstruction => ({
        op: 'add-local',
        register: 'r',
        value: 1,
      })),
      { op: 'write-counter', register: 'r' },
    ];
    const processes = ['P1', 'P2', 'P3', 'P4'].map((id) => ({
      id,
      instructions,
    }));
    const maximum: SyncScenario = {
      ...small,
      capacity: 10,
      processes,
      schedule: [
        ...processes.flatMap((p) => Array.from({ length: 100 }, () => p.id)),
        ...Array.from({ length: 600 }, () => 'P1'),
      ],
    };
    const start = performance.now(),
      reference = engine.runSync(small),
      smallMs = performance.now() - start;
    const maxStart = performance.now(),
      result = engine.runSync(maximum),
      maxMs = performance.now() - maxStart;
    if (!reference.ok || !result.ok)
      throw new Error('Supported schedule rejected');
    return {
      smallMs,
      maxMs,
      smallEvents: reference.result.events.length,
      maxEvents: result.result.events.length,
      smallCounter: reference.result.summary.counter,
      maxCounter: result.result.summary.counter,
      maxOutcome: result.result.outcome,
      rejectedChoices: result.result.events.filter(
        (e) => e.kind === 'selection-rejected',
      ).length,
      browser: navigator.userAgent,
      logicalProcessors: navigator.hardwareConcurrency,
    };
  });
  expect(measurements).toMatchObject({
    smallEvents: 6,
    maxEvents: 1000,
    smallCounter: 1,
    maxCounter: 392,
    maxOutcome: 'completed',
    rejectedChoices: 600,
  });
  console.log(
    `Synchronization browser measurements: ${JSON.stringify({ project: info.project.name, cpu: cpus()[0]?.model, ...measurements })}`,
  );
  await page.getByLabel('Initial shared counter', { exact: true }).fill('3');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel('Synchronization example')
    .selectOption('producer-consumer');
  await expect(
    page.getByLabel('Producer program', { exact: true }),
  ).toHaveValue(/enqueue A/);
});
