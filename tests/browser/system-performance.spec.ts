import { test, expect } from '@playwright/test';
import { cpus } from 'node:os';
import type { EngineResponse } from '../../src/engine/contracts';
import type {
  SystemScenario,
  SystemResult,
} from '../../src/engine/system/types';
test('integrated engine measures small and maximum program counts and preflights excess work', async ({
  page,
}, info) => {
  await page.goto('/#/system');
  const measurements = await page.evaluate(async () => {
    const path = '/src/engine/system/schedule.ts',
      engine: {
        runSystem: (s: SystemScenario) => EngineResponse<SystemResult>;
      } = await import(path);
    const scenario = (
      processes: number,
      instructions: number,
      duration: number,
      quantum: number,
    ): SystemScenario => ({
      kind: 'system',
      algorithm: 'rr',
      totalKiB: 20,
      quantum,
      resources: [],
      processes: Array.from({ length: processes }, (_, i) => ({
        id: `P${i}`,
        arrival: 0,
        memoryKiB: 1,
        program: Array.from({ length: instructions }, () => ({
          op: 'cpu',
          duration,
        })),
      })),
    });
    const measure = (s: SystemScenario) => {
      const start = performance.now(),
        r = engine.runSystem(s),
        elapsedMs = performance.now() - start;
      if (!r.ok) throw new Error(r.error.message);
      return {
        elapsedMs,
        events: r.result.events.length,
        busy: r.result.summary.busyTime,
        completed: r.result.metrics.filter((p) => p.state === 'terminated')
          .length,
      };
    };
    const small = measure(scenario(3, 2, 2, 2)),
      large = measure(scenario(20, 100, 1, 1000)),
      start = performance.now(),
      rejected = engine.runSystem(scenario(20, 100, 1000, 1));
    return {
      small,
      large,
      rejectMs: performance.now() - start,
      rejectCode: rejected.ok ? null : rejected.error.code,
      userAgent: navigator.userAgent,
      logicalProcessors: navigator.hardwareConcurrency,
    };
  });
  expect(measurements.small.busy).toBe(12);
  expect(measurements.large).toMatchObject({
    events: 4101,
    busy: 2000,
    completed: 20,
  });
  expect(measurements.rejectCode).toBe('limit-exceeded');
  console.log(
    `Integrated measurements: ${JSON.stringify({ project: info.project.name, cpu: cpus()[0]?.model, ...measurements })}`,
  );
  await page.getByLabel('Quantum (t)').fill('3');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeEnabled();
  await page.goto('/#/experiments');
  await expect(
    page.getByRole('heading', { name: 'Experiments', exact: true }),
  ).toBeVisible();
});
