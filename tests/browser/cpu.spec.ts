import { test, expect, type Page } from '@playwright/test';

async function manualClock(page: Page) {
  await page.clock.install({ time: new Date('2026-10-09T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-09T12:00:01Z'));
}
async function selectFrame(page: Page, cursor: number | 'last') {
  const slider = page.getByLabel('Replay frame', { exact: false });
  await slider.focus();
  if (cursor === 'last') await page.keyboard.press('End');
  else {
    await page.keyboard.press('Home');
    for (let i = 0; i < cursor; i++) await page.keyboard.press('ArrowRight');
  }
}
async function assertResults(
  page: Page,
  values: readonly (readonly string[])[],
) {
  const table = page.getByRole('region', {
    name: 'Process results',
    exact: true,
  });
  await expect(table.getByRole('row')).toHaveCount(values.length + 1);
  for (const [index, cells] of values.entries())
    await expect(
      table
        .getByRole('row')
        .nth(index + 1)
        .locator('th,td'),
    ).toHaveText([...cells]);
}

test('RR same-time queue, immutable replay, and result invalidation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await manualClock(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'CPU scheduling', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Previous event' }),
  ).toBeDisabled();
  await assertResults(page, [
    ['P1', '—', '—', '—', '—'],
    ['P2', '—', '—', '—', '—'],
    ['P3', '—', '—', '—', '—'],
  ]);
  await selectFrame(page, 4);
  await expect(
    page.getByRole('heading', { name: 'P3 arrives', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.queue .process-chip')).toHaveText(['P2', 'P3']);
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(
    page.getByRole('heading', { name: 'P1 quantum expires', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.queue .process-chip')).toHaveText([
    'P2',
    'P3',
    'P1',
  ]);
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(
    page.getByRole('heading', { name: 'P2 starts', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('P2 · Running', { exact: true })).toBeVisible();
  await assertResults(page, [
    ['P1', '—', '—', '—', '0'],
    ['P2', '—', '—', '—', '1'],
    ['P3', '—', '—', '—', '—'],
  ]);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByLabel('Speed', { exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(250);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
  const frame = await page
    .getByLabel('Replay frame', { exact: false })
    .inputValue();
  await page.clock.runFor(1500);
  await expect(page.getByLabel('Replay frame', { exact: false })).toHaveValue(
    frame,
  );
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(3500);
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await assertResults(page, [
    ['P1', '9', '9', '4', '0'],
    ['P2', '8', '7', '4', '1'],
    ['P3', '5', '3', '2', '2'],
  ]);
  await expect(page.getByRole('button', { name: 'Next event' })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous event' }).click();
  await page.getByLabel('Speed', { exact: true }).selectOption('2');
  await selectFrame(page, 'last');
  await assertResults(page, [
    ['P1', '9', '9', '4', '0'],
    ['P2', '8', '7', '4', '1'],
    ['P3', '5', '3', '2', '2'],
  ]);
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.clock.runFor(7500);
  await assertResults(page, [
    ['P1', '9', '9', '4', '0'],
    ['P2', '8', '7', '4', '1'],
    ['P3', '5', '3', '2', '2'],
  ]);
  await page.getByLabel('P1 burst time', { exact: true }).fill('4');
  await expect(
    page.getByText('Inputs changed. Run again to update results.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No active result' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Process results', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(6500);
  await assertResults(page, [
    ['P1', '7', '7', '3', '0'],
    ['P2', '8', '7', '4', '1'],
    ['P3', '5', '3', '2', '2'],
  ]);
  expect(errors).toEqual([]);
});

test('four-algorithm comparison uses shared inputs and opens computed traces', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Compare algorithms', exact: true })
    .click();
  const table = page.getByRole('region', {
    name: 'Algorithm comparison results',
  });
  await expect(table.getByRole('row')).toHaveCount(5);
  const expected = [
    ['FCFS', '3.33', '6.33', '3.33', '100.00', '0.333'],
    ['SJF', '2.67', '5.67', '2.67', '100.00', '0.333'],
    ['Priority', '3.33', '6.33', '3.33', '100.00', '0.333'],
    ['Round Robin', '3.33', '6.33', '1.00', '100.00', '0.333'],
  ];
  for (const [index, cells] of expected.entries())
    await expect(
      table
        .getByRole('row')
        .nth(index + 1)
        .locator('th,td')
        .filter({ hasNot: page.getByRole('button') }),
    ).toHaveText(cells);
  await expect(
    page
      .getByRole('region', { name: 'Shared comparison inputs' })
      .getByRole('row')
      .nth(1)
      .locator('th,td'),
  ).toHaveText(['P1', '0', '5', '2']);
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    panels: Array.from(
      document.querySelectorAll(
        '.workbench, .comparison-panel, .comparison-panel .panel-body, .comparison-chart, .comparison-panel .table-scroll',
      ),
    ).map((node) => ({
      className: node.className,
      width: node.getBoundingClientRect().width,
      right: node.getBoundingClientRect().right,
    })),
  }));
  expect(layout.overflow, JSON.stringify(layout)).toBe(false);
  await page.getByText('Per-process final results for every algorithm').click();
  await expect(
    page.getByRole('region', { name: 'Round Robin final process results' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByText('Per-process final results for every algorithm').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/cpu-comparison-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Inspect SJF trace' }).click();
  await expect(page.getByLabel('Algorithm', { exact: true })).toHaveValue(
    'sjf',
  );
  await expect(page.getByLabel('Time quantum', { exact: true })).toHaveCount(0);
  await assertResults(page, [
    ['P1', '5', '5', '0', '0'],
    ['P2', '9', '8', '5', '5'],
    ['P3', '6', '4', '3', '3'],
  ]);
  await selectFrame(page, 0);
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(
    page.getByRole('heading', { name: 'P1 arrives', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Compare algorithms', exact: true })
    .click();
  await page.getByLabel('P1 burst time', { exact: true }).fill('3');
  await expect(
    page.getByRole('region', { name: 'CPU algorithm comparison' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Compare algorithms', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Shared comparison inputs' })
      .getByRole('row')
      .nth(1)
      .locator('th,td'),
  ).toHaveText(['P1', '0', '3', '2']);
  await page.getByRole('button', { name: 'Inspect Round Robin trace' }).click();
  await assertResults(page, [
    ['P1', '6', '6', '3', '0'],
    ['P2', '7', '6', '3', '1'],
    ['P3', '5', '3', '2', '2'],
  ]);
});

test('invalid and empty workloads, conditional quantum, and initial idle metrics', async ({
  page,
}, testInfo) => {
  await manualClock(page);
  await page.goto('/');
  for (const algorithm of ['fcfs', 'sjf', 'priority']) {
    await page.getByLabel('Algorithm', { exact: true }).selectOption(algorithm);
    await expect(page.getByLabel('Time quantum', { exact: true })).toHaveCount(
      0,
    );
  }
  await page.getByLabel('P1 burst time', { exact: true }).fill('0');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('Burst must be a whole number from 1 to 1000.'),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/cpu-invalid-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel('P1 burst time', { exact: true }).fill('5');
  await page.getByLabel('P1 arrival time', { exact: true }).fill('');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('P1 arrival time', { exact: true }).fill('0');
  await page.getByLabel('Process 2 ID', { exact: true }).fill('P1');
  await expect(
    page.getByText('ID P1 is duplicated. Each process needs a unique ID.'),
  ).toBeVisible();
  await page.getByLabel('Process 2 ID', { exact: true }).fill('P2');
  for (const id of ['P3', 'P2', 'P1'])
    await page
      .getByRole('button', { name: `Remove process ${id}`, exact: true })
      .click();
  await expect(
    page.getByRole('heading', { name: 'Add a CPU workload', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Add at least one process or load an example.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add process', exact: true }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(3000);
  await assertResults(page, [['P1', '1', '1', '0', '0']]);
  await page.getByLabel('Load example', { exact: true }).selectOption('idle');
  await expect(page.getByLabel('P1 arrival time', { exact: true })).toHaveValue(
    '3',
  );
  await selectFrame(page, 'last');
  await assertResults(page, [['P1', '5', '2', '0', '0']]);
  await expect(page.getByText('40.0%', { exact: true })).toBeVisible();
  await page
    .getByText('Interval table · equivalent timeline data', { exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'CPU interval table' })
      .getByRole('row')
      .nth(1)
      .locator('th,td'),
  ).toHaveText(['Idle', '0', '3', '3']);
});

test('keyboard boundary inspection, scaled intervals, and responsive workbench', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to workspace' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByLabel('P1 burst time', { exact: true }).fill('4');
  await page.getByLabel('P2 arrival time', { exact: true }).fill('2');
  await page.getByLabel('P2 burst time', { exact: true }).fill('1');
  await page
    .getByRole('button', { name: 'Remove process P3', exact: true })
    .click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await selectFrame(page, 'last');
  await assertResults(page, [
    ['P1', '5', '5', '1', '0'],
    ['P2', '3', '1', '0', '0'],
  ]);
  await selectFrame(page, 4);
  await expect(
    page.getByRole('heading', { name: 'P1 quantum expires', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.queue .process-chip')).toHaveText(['P2', 'P1']);
  await page.getByRole('button', { name: 'Next event' }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'P2 starts', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Timeline scale', { exact: true }).selectOption('24');
  await selectFrame(page, 'last');
  const firstIntervalWidth = await page
    .getByRole('region', { name: 'CPU Gantt timeline, horizontal scroll' })
    .locator('g[role="button"] rect')
    .first()
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(firstIntervalWidth).toBe(48); // 2 time units at exactly 24 pixels / unit.
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/cpu-workbench-${testInfo.project.name}.png`,
    fullPage: true,
  });
  if (testInfo.project.name === 'desktop')
    expect(
      (
        await page
          .getByRole('region', { name: 'CPU replay workspace' })
          .boundingBox()
      )?.width,
    ).toBeGreaterThanOrEqual(420);
});
