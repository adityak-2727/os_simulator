import { test, expect } from '@playwright/test';
import { cpus } from 'node:os';
import type { CpuScenario, EngineResponse } from '../../src/engine/contracts';
import type { CpuResult } from '../../src/engine/cpu/types';

test('browser engine handles a near-budget trace and rejects an oversized workload', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const measurements = await page.evaluate(async () => {
    const modulePath = '/src/engine/cpu/schedule.ts';
    const engine: {
      scheduleCpu: (input: CpuScenario) => EngineResponse<CpuResult>;
    } = await import(modulePath);
    const input = (
      count: number,
      burst: number,
      quantum: number,
    ): CpuScenario => ({
      kind: 'cpu',
      algorithm: 'rr',
      quantum,
      contextSwitchCost: 0,
      processes: Array.from({ length: count }, (_, i) => ({
        id: `P${i + 1}`,
        arrival: 0,
        burst,
        priority: 1,
      })),
    });
    const measure = (scenario: CpuScenario) => {
      const start = performance.now();
      const response = engine.scheduleCpu(scenario);
      const elapsedMs = performance.now() - start;
      if (!response.ok) throw new Error(response.error.message);
      return {
        elapsedMs,
        eventCount: response.result.events.length,
        finishTime: response.result.summary.finishTime,
        busyTime: response.result.summary.busyTime,
      };
    };
    const small = measure({
      kind: 'cpu',
      algorithm: 'rr',
      quantum: 2,
      contextSwitchCost: 0,
      processes: [
        { id: 'P1', arrival: 0, burst: 5, priority: 2 },
        { id: 'P2', arrival: 1, burst: 3, priority: 1 },
        { id: 'P3', arrival: 2, burst: 1, priority: 3 },
      ],
    });
    const large = measure(input(24, 1000, 1));
    const rejected = engine.scheduleCpu(input(50, 1000, 1));
    return {
      small,
      large,
      rejectedCode: rejected.ok ? null : rejected.error.code,
      userAgent: navigator.userAgent,
      logicalProcessors: navigator.hardwareConcurrency,
    };
  });
  expect(measurements.small).toMatchObject({
    eventCount: 15,
    finishTime: 9,
    busyTime: 9,
  });
  expect(measurements.large).toMatchObject({
    eventCount: 48_024,
    finishTime: 24_000,
    busyTime: 24_000,
  });
  expect(measurements.rejectedCode).toBe('limit-exceeded');
  console.log(
    `CPU browser measurements: ${JSON.stringify({ project: testInfo.project.name, cpu: cpus()[0]?.model, ...measurements })}`,
  );
});
