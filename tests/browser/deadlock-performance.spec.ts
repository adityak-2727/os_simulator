import { test, expect } from '@playwright/test';
import { cpus } from 'node:os';
import type { EngineResponse } from '../../src/engine/contracts';
import type {
  BankerResult,
  BankerScenario,
  GraphResult,
  GraphScenario,
} from '../../src/engine/deadlock/types';
test('resource engines measure small and maximum workloads and leave inputs responsive', async ({
  page,
}, info) => {
  await page.goto('/#/deadlock');
  const measurements = await page.evaluate(async () => {
    const bankerPath = '/src/engine/deadlock/banker.ts',
      graphPath = '/src/engine/deadlock/graph.ts';
    const banker: {
      runBanker: (s: BankerScenario) => EngineResponse<BankerResult>;
    } = await import(bankerPath);
    const graph: {
      analyzeGraph: (s: GraphScenario) => EngineResponse<GraphResult>;
    } = await import(graphPath);
    const smallBanker: BankerScenario = {
      kind: 'deadlock',
      mode: 'banker',
      processIds: ['P0', 'P1', 'P2', 'P3', 'P4'],
      resourceIds: ['A', 'B', 'C'],
      total: [10, 5, 7],
      allocation: [
        [0, 1, 0],
        [2, 0, 0],
        [3, 0, 2],
        [2, 1, 1],
        [0, 0, 2],
      ],
      max: [
        [7, 5, 3],
        [3, 2, 2],
        [9, 0, 2],
        [2, 2, 2],
        [4, 3, 3],
      ],
    };
    const smallGraph: GraphScenario = {
      kind: 'deadlock',
      mode: 'graph',
      processIds: ['P1', 'P2'],
      resourceIds: ['R1', 'R2'],
      allocations: [
        { processId: 'P1', resourceId: 'R1' },
        { processId: 'P2', resourceId: 'R2' },
      ],
      requests: [
        { processId: 'P1', resourceId: 'R2' },
        { processId: 'P2', resourceId: 'R1' },
      ],
    };
    const maxBanker: BankerScenario = {
      kind: 'deadlock',
      mode: 'banker',
      processIds: Array.from({ length: 10 }, (_, i) => `P${i}`),
      resourceIds: Array.from({ length: 8 }, (_, i) => `R${i}`),
      total: Array.from({ length: 8 }, () => 1000),
      allocation: Array.from({ length: 10 }, () =>
        Array.from({ length: 8 }, () => 100),
      ),
      max: Array.from({ length: 10 }, () =>
        Array.from({ length: 8 }, () => 100),
      ),
      request: { processId: 'P0', amount: Array.from({ length: 8 }, () => 0) },
    };
    const processes = Array.from({ length: 12 }, (_, i) => `P${i}`),
      resources = Array.from({ length: 12 }, (_, i) => `R${i}`);
    const maxGraph: GraphScenario = {
      kind: 'deadlock',
      mode: 'graph',
      processIds: processes,
      resourceIds: resources,
      allocations: [],
      requests: processes.flatMap((processId) =>
        resources.map((resourceId) => ({ processId, resourceId })),
      ),
    };
    function measure<R extends { events: readonly unknown[] }>(
      run: () => EngineResponse<R>,
    ) {
      const start = performance.now(),
        r = run(),
        ms = performance.now() - start;
      if (!r.ok) throw new Error(r.error.message);
      return { ms, events: r.result.events.length };
    }
    return {
      smallBanker: measure(() => banker.runBanker(smallBanker)),
      smallGraph: measure(() => graph.analyzeGraph(smallGraph)),
      maxBanker: measure(() => banker.runBanker(maxBanker)),
      maxGraph: measure(() => graph.analyzeGraph(maxGraph)),
      browser: navigator.userAgent,
      logicalProcessors: navigator.hardwareConcurrency,
    };
  });
  expect(measurements.smallBanker.events).toBe(6);
  expect(measurements.smallGraph.events).toBe(5);
  expect(measurements.maxBanker.events).toBe(13);
  expect(measurements.maxGraph.events).toBe(49);
  console.log(
    `Resource browser measurements: ${JSON.stringify({ project: info.project.name, cpu: cpus()[0]?.model, ...measurements })}`,
  );
  await page.getByLabel('Graph process IDs').fill('P1, P2, P3');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Banker’s algorithm', exact: true })
    .click();
  await expect(page.getByLabel('Total A', { exact: true })).toHaveValue('10');
});
