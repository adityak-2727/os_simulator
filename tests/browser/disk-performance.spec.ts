import { test, expect } from '@playwright/test';
import { cpus } from 'node:os';
import type { EngineResponse } from '../../src/engine/contracts';
import type { DiskScenario, DiskResult } from '../../src/engine/disk/types';
test('disk engines measure reference and maximum batches and retain input/navigation responsiveness', async ({
  page,
}, info) => {
  await page.goto('/#/disk');
  const measurements = await page.evaluate(async () => {
    const path = '/src/engine/disk/schedule.ts';
    const engine: {
      scheduleDisk: (
        s: DiskScenario,
        budget?: number,
      ) => EngineResponse<DiskResult>;
      compareDisk: (s: DiskScenario) => EngineResponse<readonly DiskResult[]>;
    } = await import(path);
    const reference: DiskScenario = {
      kind: 'disk',
      minCylinder: 0,
      maxCylinder: 199,
      initialHead: 53,
      direction: 'higher',
      algorithm: 'cscan',
      requests: [98, 183, 37, 122, 14, 124, 65, 67].map((cylinder, i) => ({
        id: `D${i + 1}`,
        cylinder,
      })),
    };
    const start = performance.now(),
      small = engine.scheduleDisk(reference),
      smallMs = performance.now() - start;
    const maximum: DiskScenario = {
      ...reference,
      maxCylinder: 100000,
      initialHead: 50000,
      requests: Array.from({ length: 100 }, (_, i) => ({
        id: `R${i + 1}`,
        cylinder: i * 997,
      })),
    };
    const maxStart = performance.now(),
      comparisons = engine.compareDisk(maximum),
      maxMs = performance.now() - maxStart;
    if (!small.ok || !comparisons.ok)
      throw new Error('Supported disk workload rejected');
    for (const r of comparisons.result) {
      if (
        r.summary.serviceOrder.length !== 100 ||
        new Set(r.summary.serviceOrder).size !== 100 ||
        r.summary.totalMovement !==
          r.events.reduce((sum, e) => sum + Math.abs(e.to - e.from), 0)
      )
        throw new Error('Disk invariant failed');
    }
    const rejected = engine.scheduleDisk(reference, 2);
    return {
      smallMs,
      maxMs,
      smallEvents: small.result.events.length,
      smallMovement: small.result.summary.totalMovement,
      maximumRequests: 100,
      maxEvents: comparisons.result.map((r) => ({
        algorithm: r.scenario.algorithm,
        events: r.events.length,
        totalMovement: r.summary.totalMovement,
      })),
      rejectedCode: rejected.ok ? 'unexpected-success' : rejected.error.code,
      browser: navigator.userAgent,
      logicalProcessors: navigator.hardwareConcurrency,
    };
  });
  expect(measurements.smallEvents).toBe(10);
  expect(measurements.smallMovement).toBe(382);
  expect(measurements.maxEvents.map((r) => r.events)).toEqual([
    100, 100, 101, 102,
  ]);
  expect(measurements.rejectedCode).toBe('limit-exceeded');
  console.log(
    `Disk browser measurements: ${JSON.stringify({ project: info.project.name, cpu: cpus()[0]?.model, ...measurements })}`,
  );
  await page.getByLabel('Initial head', { exact: true }).fill('60');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Duplicates and endpoints', exact: true })
    .click();
  await expect(page.getByLabel('Initial head', { exact: true })).toHaveValue(
    '50',
  );
  if ((page.viewportSize()?.width ?? 1440) <= 768)
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Help', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Help & model notes', exact: true }),
  ).toBeVisible();
});
