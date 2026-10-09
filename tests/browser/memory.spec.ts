import { test, expect, type Page } from '@playwright/test';
import { cpus } from 'node:os';
import type { EngineResponse } from '../../src/engine/contracts';
import type {
  AllocationResult,
  AllocationScenario,
  PagingResult,
  PagingScenario,
} from '../../src/engine/memory/types';
async function clock(page: Page) {
  await page.clock.install({ time: new Date('2026-10-09T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-09T12:00:01Z'));
}
async function frame(page: Page, cursor: number | 'last') {
  await page.getByLabel('Replay frame', { exact: false }).focus();
  await page.keyboard.press(cursor === 'last' ? 'End' : 'Home');
  if (cursor !== 'last')
    for (let i = 0; i < cursor; i++) await page.keyboard.press('ArrowRight');
}
async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function rows(
  page: Page,
  label: string,
  expected: readonly (readonly string[])[],
) {
  const region = page.getByRole('region', { name: label, exact: true });
  await expect(region.getByRole('row')).toHaveCount(expected.length + 1);
  for (const [i, row] of expected.entries())
    await expect(
      region
        .getByRole('row')
        .nth(i + 1)
        .locator('th,td'),
    ).toHaveText([...row]);
}
test('allocation replay explains fragmentation, preserves memory, and invalidates edited results', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await clock(page);
  await page.goto('/#/allocation');
  await page.getByLabel('Load example').selectOption('fragmentation');
  await expect(
    page.getByText('Inputs changed. Run again to update results.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await frame(page, 5);
  const expected = [
    ['A', '0', '100', '100'],
    ['Free hole', '100', '400', '300'],
    ['C', '400', '500', '100'],
    ['D', '500', '800', '300'],
    ['Free hole', '800', '1024', '224'],
  ];
  await rows(page, 'Memory allocation ledger', expected);
  await page.getByRole('button', { name: 'Next event' }).click();
  await rows(page, 'Memory allocation ledger', expected);
  await expect(
    page.getByRole('heading', { name: 'E request rejected' }),
  ).toBeVisible();
  await expect(
    page
      .getByText(/Total free space is 524 KiB, but the largest hole is 300 KiB/)
      .first(),
  ).toBeVisible();
  await page.getByLabel('Speed', { exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.clock.runFor(1600);
  await rows(page, 'Memory allocation ledger', expected);
  await contained(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/allocation-failure-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel('Operation 6 size in KiB').fill('200');
  await expect(
    page.getByRole('region', { name: 'Memory allocation ledger' }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Inputs changed. Run again to update results.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(
    page.getByRole('heading', { name: 'E allocated', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Memory allocation ledger' })
      .getByRole('row')
      .nth(2)
      .locator('th,td'),
  ).toHaveText(['E', '100', '300', '200']);
  await page.getByLabel('Capacity (KiB)', { exact: true }).fill('0');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('Capacity must be a whole number from 1 to 65536.'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('allocation comparison, coalescing, editable order, and keyboard workbench', async ({
  page,
}, info) => {
  await page.goto('/#/allocation');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to workspace' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page
    .getByRole('button', { name: 'Compare algorithms', exact: true })
    .click();
  const table = page.getByRole('region', {
    name: 'allocation comparison metrics',
  });
  for (const [i, expected] of [
    ['First Fit', '5', '0', '324', '224'],
    ['Best Fit', '5', '0', '324', '300'],
    ['Worst Fit', '5', '0', '324', '224'],
  ].entries())
    await expect(
      table
        .getByRole('row')
        .nth(i + 1)
        .locator('th,td')
        .filter({ hasNot: page.getByRole('button') }),
    ).toHaveText(expected);
  await contained(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/allocation-comparison-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Inspect Best Fit trace' }).click();
  await expect(page.getByLabel('Strategy', { exact: true })).toHaveValue(
    'best-fit',
  );
  await expect(
    page
      .getByRole('region', { name: 'Memory allocation ledger' })
      .getByRole('row')
      .nth(5)
      .locator('th,td'),
  ).toHaveText(['E', '800', '1000', '200']);
  await page.getByLabel('Memory map zoom').selectOption('2');
  await page.getByLabel('Load example').selectOption('coalescing');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await rows(page, 'Memory allocation ledger', [
    ['A', '0', '100', '100'],
    ['Free hole', '100', '1024', '924'],
  ]);
  await expect(page.getByText(/Merged 2 free neighbors/)).toBeVisible();
  await contained(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/allocation-workbench-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Move operation 2 up' }).click();
  await expect(page.getByLabel('Operation 1 ID', { exact: true })).toHaveValue(
    'B',
  );
  await page
    .getByRole('button', { name: 'Remove operation 1', exact: true })
    .click();
  await expect(page.getByLabel('Operation 1 ID', { exact: true })).toHaveValue(
    'A',
  );
  await page.getByRole('button', { name: 'Add operation' }).click();
  await expect(
    page.getByLabel('Operation 7 action', { exact: true }),
  ).toHaveValue('allocate');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Memory allocation', exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 6; i++)
    await page
      .getByRole('button', { name: 'Remove operation 1', exact: true })
      .click();
  await expect(
    page.getByRole('heading', { name: 'Add a workload', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Add operation', exact: true })
    .click();
  await page.getByLabel('Capacity (KiB)', { exact: true }).fill('100');
  await page.getByLabel('Operation 1 ID', { exact: true }).fill('A');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await rows(page, 'Memory allocation ledger', [['A', '0', '100', '100']]);
  await page
    .getByRole('button', { name: 'Add operation', exact: true })
    .click();
  await page.getByLabel('Operation 2 ID', { exact: true }).fill('A');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(
    page.getByText(/Duplicate allocation rejected/).first(),
  ).toBeVisible();
  await rows(page, 'Memory allocation ledger', [['A', '0', '100', '100']]);
  await page.getByLabel('Operation 2 ID', { exact: true }).fill('bad id');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel('Operation 2 action', { exact: true })
    .selectOption('free');
  await page.getByLabel('Operation 2 ID', { exact: true }).fill('MISSING');
  await expect(
    page.getByLabel('Operation 2 size in KiB', { exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(
    page.getByText(/MISSING has no live allocation/).first(),
  ).toBeVisible();
  await rows(page, 'Memory allocation ledger', [['A', '0', '100', '100']]);
});
test('paging history, hits, eviction reason, replay, and independent lab state', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await clock(page);
  await page.goto('/#/paging');
  await expect(
    page
      .getByRole('region', { name: 'Paging frame metrics' })
      .getByText('—', { exact: true }),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.clock.runFor(2000);
  await rows(page, 'Current page frames', [
    ['0', '7', '1', '1'],
    ['1', 'Empty', '—', '—'],
    ['2', 'Empty', '—', '—'],
  ]);
  await frame(page, 4);
  await expect(
    page.getByText(
      /Evict page 7 from frame 0: oldest insertion at reference #1/,
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Inspect reference 5, page 0', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Page 0 · hit', exact: true }),
  ).toBeVisible();
  await rows(page, 'Current page frames', [
    ['0', '2', '4', '4'],
    ['1', '0', '2', '5'],
    ['2', '1', '3', '3'],
  ]);
  await page.getByLabel('Speed', { exact: true }).selectOption('4');
  await frame(page, 'last');
  await expect(
    page.getByRole('region', { name: 'Paging frame metrics' }),
  ).toContainText('10');
  await rows(page, 'Current page frames', [
    ['0', '0', '11', '11'],
    ['1', '2', '9', '13'],
    ['2', '3', '10', '12'],
  ]);
  await contained(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/paging-workbench-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.clock.runFor(3400);
  await expect(
    page.getByRole('button', { name: 'Replay', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Reference sequence', { exact: true })
    .fill('1, 2, 1, 3');
  await expect(
    page.getByRole('region', { name: 'Current page frames' }),
  ).toHaveCount(0);
  await page.getByLabel('Frame count', { exact: true }).fill('2');
  await page.getByLabel('Algorithm', { exact: true }).selectOption('lru');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(
    page.getByText(
      /Evict page 2 from frame 1: oldest last access at reference #2/,
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.clock.runFor(250);
  await page.evaluate(() => {
    location.hash = '/allocation';
  });
  await expect(page.getByLabel('Capacity (KiB)', { exact: true })).toHaveValue(
    '1024',
  );
  await page.clock.runFor(2000);
  await page.evaluate(() => {
    location.hash = '/paging';
  });
  await expect(
    page.getByLabel('Reference sequence', { exact: true }),
  ).toHaveValue('1, 2, 1, 3');
  await expect(page.getByLabel('Replay frame', { exact: false })).toHaveValue(
    '1',
  );
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('paging comparison 10/9/7, trace inspection, validation and empty state', async ({
  page,
}, info) => {
  await page.goto('/#/paging');
  await page
    .getByRole('button', { name: 'Compare algorithms', exact: true })
    .click();
  const table = page.getByRole('region', { name: 'paging comparison metrics' });
  for (const [i, expected] of [
    ['FIFO', '10', '3', '76.9%', '23.1%'],
    ['LRU', '9', '4', '69.2%', '30.8%'],
    ['Optimal', '7', '6', '53.8%', '46.2%'],
  ].entries())
    await expect(
      table
        .getByRole('row')
        .nth(i + 1)
        .locator('th,td')
        .filter({ hasNot: page.getByRole('button') }),
    ).toHaveText(expected);
  await contained(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/paging-comparison-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Inspect Optimal trace' }).click();
  await expect(page.getByLabel('Algorithm', { exact: true })).toHaveValue(
    'optimal',
  );
  await frame(page, 4);
  await expect(
    page.getByText(
      /no future use \(infinity\); lowest frame index breaks ties/,
    ),
  ).toBeVisible();
  await page
    .getByLabel('Reference sequence', { exact: true })
    .fill('1, -1, word');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      'Page at reference 2 must be a whole number from 0 to 9999.',
    ),
  ).toBeVisible();
  await page.getByLabel('Reference sequence', { exact: true }).fill('');
  await expect(
    page.getByRole('heading', { name: 'Add a workload', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Paging frame metrics' }),
  ).toHaveCount(0);
  await page.getByLabel('Frame count', { exact: true }).fill('13');
  await expect(
    page.getByText('Frame count must be a whole number from 1 to 12.'),
  ).toBeVisible();
  await contained(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/paging-invalid-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Load reference example' }).click();
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeEnabled();
});
test('memory engines benchmark supported maxima without importing fixture answers', async ({
  page,
}, info) => {
  await page.goto('/#/allocation');
  const measurements = await page.evaluate(async () => {
    const allocationPath = '/src/engine/memory/allocation.ts',
      pagingPath = '/src/engine/memory/paging.ts';
    const allocation: {
      allocateMemory: (
        input: AllocationScenario,
      ) => EngineResponse<AllocationResult>;
    } = await import(allocationPath);
    const paging: {
      replacePages: (input: PagingScenario) => EngineResponse<PagingResult>;
    } = await import(pagingPath);
    const smallStart = performance.now();
    const smallAllocation = allocation.allocateMemory({
      kind: 'allocation',
      strategy: 'first-fit',
      totalKiB: 1024,
      operations: [
        { kind: 'allocate', id: 'A', sizeKiB: 100 },
        { kind: 'free', id: 'A' },
      ],
    });
    const smallAllocationMs = performance.now() - smallStart;
    const smallPagingStart = performance.now();
    const smallPaging = paging.replacePages({
      kind: 'paging',
      algorithm: 'fifo',
      frames: 3,
      references: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2],
    });
    const smallPagingMs = performance.now() - smallPagingStart;
    const input: AllocationScenario = {
      kind: 'allocation',
      strategy: 'worst-fit',
      totalKiB: 65_536,
      operations: Array.from({ length: 200 }, (_, i) => ({
        kind: 'allocate',
        id: `A${i}`,
        sizeKiB: 1,
      })),
    };
    const start = performance.now(),
      ar = allocation.allocateMemory(input),
      allocationMs = performance.now() - start;
    const pstart = performance.now(),
      pr = paging.replacePages({
        kind: 'paging',
        algorithm: 'optimal',
        frames: 12,
        references: Array.from({ length: 200 }, (_, i) => i),
      }),
      pagingMs = performance.now() - pstart;
    if (!ar.ok || !pr.ok || !smallAllocation.ok || !smallPaging.ok)
      throw new Error('Supported workload rejected');
    return {
      allocationMs,
      pagingMs,
      smallAllocationMs,
      smallPagingMs,
      allocationEvents: ar.result.events.length,
      pagingEvents: pr.result.events.length,
      totalFreeKiB: ar.result.summary.totalFreeKiB,
      faults: pr.result.summary.faults,
      browser: navigator.userAgent,
    };
  });
  expect(measurements).toMatchObject({
    allocationEvents: 200,
    pagingEvents: 200,
    totalFreeKiB: 65_336,
    faults: 200,
  });
  console.log(
    `Memory browser measurements: ${JSON.stringify({ project: info.project.name, cpu: cpus()[0]?.model, ...measurements })}`,
  );
  await page.getByLabel('Capacity (KiB)', { exact: true }).fill('2048');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeEnabled();
});
