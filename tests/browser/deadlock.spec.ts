import { test, expect, type Page } from '@playwright/test';
async function clock(page: Page) {
  await page.clock.install({ time: new Date('2026-10-10T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-10T12:00:01Z'));
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
async function screenshot(page: Page, path: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path, fullPage: true });
}
async function banker(page: Page) {
  await clock(page);
  await page.goto('/#/deadlock');
  await page
    .getByRole('button', { name: 'Banker’s algorithm', exact: true })
    .click();
}
async function available(page: Page, values: string[]) {
  await expect(
    page
      .getByRole('region', { name: 'Actual resource vectors', exact: true })
      .getByRole('row')
      .nth(2)
      .locator('td'),
  ).toHaveText(values);
}
test('graph directions, cycle proof, keyboard operations, ownership errors and invalidation', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Keep React Flow's measurement/animation callbacks live; seek pauses replay explicitly.
  await page.goto('/#/deadlock');
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  const edges = page.getByRole('region', {
    name: 'Graph edges at selected frame',
    exact: true,
  });
  await expect(edges.getByRole('row').nth(1).locator('td')).toHaveText([
    'request',
    'process P1',
    'resource R2',
  ]);
  await expect(edges.getByRole('row').nth(3).locator('td')).toHaveText([
    'allocation',
    'resource R1',
    'process P1',
  ]);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(page.getByText('Deadlocked', { exact: true })).toBeVisible();
  await expect(page.getByTestId('graph-path')).toHaveText(
    'P1 → R2 → P2 → R1 → P1',
  );
  await expect(page.getByText(/Blocked cycle processes: P1, P2/)).toBeVisible();
  await contained(page);
  await screenshot(page, `artifacts/resource-cycle-${info.project.name}.png`);
  await page.getByLabel('Graph operation process').selectOption('P2');
  await page.getByRole('button', { name: 'Grant', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('R1 is owned by P1');
  await expect(page.getByText('Deadlocked', { exact: true })).toBeVisible();
  await page.getByLabel('Graph operation process').selectOption('P1');
  await page.getByRole('button', { name: 'Release', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('region', {
      name: 'Resource graph visualization',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Inputs changed. Run again to update results.').first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(page.getByText('No cycle', { exact: true })).toBeVisible();
  await page.getByLabel('Graph operation process').selectOption('P2');
  await page.getByRole('button', { name: 'Grant', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Editable graph edges' }).getByRole('row'),
  ).toHaveCount(4);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByLabel('Graph process IDs').fill('P1');
  await expect(page.getByRole('alert')).toContainText('Unknown process P2');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await contained(page);
  expect(errors).toEqual([]);
});
test('Banker safety uses one frame, preserves actual allocation, replays and invalidates edits', async ({
  page,
}, info) => {
  await banker(page);
  await available(page, ['3', '3', '2']);
  await expect(page.getByTestId('banker-work')).toHaveText('[3, 3, 2]');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByTestId('banker-work')).toHaveText('[5, 3, 2]');
  await expect(
    page.getByRole('heading', { name: 'P1 selected', exact: true }),
  ).toBeVisible();
  await available(page, ['3', '3', '2']);
  await expect(
    page
      .getByRole('region', { name: 'Actual Allocation', exact: true })
      .getByRole('row')
      .nth(2)
      .locator('td'),
  ).toHaveText(['2', '0', '0']);
  await frame(page, 'last');
  await expect(page.getByText('Safe', { exact: true })).toBeVisible();
  await expect(page.getByTestId('banker-sequence')).toHaveText(
    'P1 → P3 → P0 → P2 → P4',
  );
  await expect(page.getByTestId('banker-work')).toHaveText('[10, 5, 7]');
  await expect(
    page
      .getByRole('region', { name: 'Safety trace', exact: true })
      .getByRole('row'),
  ).toHaveCount(6);
  await page
    .getByRole('button', { name: 'Inspect safety step 3', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'P0 selected', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('banker-work')).toHaveText('[7, 5, 3]');
  await page.getByLabel('Speed', { exact: true }).selectOption('4');
  await frame(page, 'last');
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.clock.runFor(1500);
  await expect(page.getByText('Safe', { exact: true })).toBeVisible();
  await available(page, ['3', '3', '2']);
  await contained(page);
  await screenshot(page, `artifacts/banker-safe-${info.project.name}.png`);
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.getByLabel('Max P1 A', { exact: true }).fill('11');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('cannot exceed Total');
  await expect(
    page.getByRole('region', { name: 'Actual Allocation', exact: true }),
  ).toHaveCount(0);
  await screenshot(page, `artifacts/banker-invalid-${info.project.name}.png`);
  await contained(page);
});
test('independent requests show tentative state, grant, exact rollback, availability wait and invalid claim', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await banker(page);
  await page.getByLabel('Banker example').selectOption('grant');
  await page
    .getByRole('button', { name: 'Evaluate request', exact: true })
    .click();
  await frame(page, 1);
  await available(page, ['3', '3', '2']);
  await expect(
    page
      .getByRole('region', { name: 'Analysis Allocation', exact: true })
      .getByRole('row')
      .nth(2)
      .locator('td'),
  ).toHaveText(['3', '0', '2']);
  await expect(
    page.getByRole('heading', {
      name: 'Tentative analysis · not actual allocation',
      exact: true,
    }),
  ).toBeVisible();
  await frame(page, 'last');
  await expect(page.getByText('Granted', { exact: true })).toBeVisible();
  await available(page, ['2', '3', '0']);
  await expect(
    page
      .getByRole('region', { name: 'Actual Allocation', exact: true })
      .getByRole('row')
      .nth(2)
      .locator('td'),
  ).toHaveText(['3', '0', '2']);
  await page
    .getByRole('button', { name: 'Continue from granted state', exact: true })
    .click();
  await expect(page.getByLabel('Allocation P1 A', { exact: true })).toHaveValue(
    '3',
  );
  await expect(page.getByLabel('Allocation P1 C', { exact: true })).toHaveValue(
    '2',
  );
  for (const [example, status] of [
    ['wait-safety', 'Wait for safety'],
    ['wait-availability', 'Wait for availability'],
    ['invalid', 'Invalid request'],
  ]) {
    await page.getByLabel('Banker example').selectOption(example!);
    await page
      .getByRole('button', { name: 'Evaluate request', exact: true })
      .click();
    await frame(page, 'last');
    await expect(page.getByText(status!, { exact: true })).toBeVisible();
    await available(page, ['3', '3', '2']);
    await expect(
      page
        .getByRole('region', { name: 'Actual Allocation', exact: true })
        .getByRole('row')
        .nth(2)
        .locator('td'),
    ).toHaveText(['2', '0', '0']);
    if (example === 'wait-safety') {
      await expect(
        page.getByText(/Restore the exact original Allocation/),
      ).toBeVisible();
      await screenshot(
        page,
        `artifacts/banker-rollback-${info.project.name}.png`,
      );
    }
    if (example === 'wait-availability')
      await expect(
        page.getByRole('region', { name: 'Analysis Allocation', exact: true }),
      ).toHaveCount(0);
  }
  await page.getByLabel('Request A', { exact: true }).fill('-1');
  await page
    .getByRole('button', { name: 'Evaluate request', exact: true })
    .click();
  await frame(page, 'last');
  await expect(
    page.getByText('Invalid request', { exact: true }),
  ).toBeVisible();
  await available(page, ['3', '3', '2']);
  await contained(page);
  expect(errors).toEqual([]);
});
test('unsafe state, editable dimensions, mode navigation pause and empty input recovery', async ({
  page,
}, info) => {
  await banker(page);
  await page.getByLabel('Banker example').selectOption('unsafe');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(page.getByText('Unsafe', { exact: true })).toBeVisible();
  await expect(page.getByText(/R Need 1 > Work 0/)).toHaveCount(2);
  await expect(page.getByText(/Unsafe means no safe sequence/)).toBeVisible();
  await screenshot(page, `artifacts/banker-unsafe-${info.project.name}.png`);
  await page.getByLabel('Max P1 R', { exact: true }).fill('1');
  await page.getByLabel('Max P2 R', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(page.getByText('Safe', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add resource', exact: true }).click();
  await page.getByRole('button', { name: 'Add process', exact: true }).click();
  await expect(
    page.getByLabel('Allocation P3 R1', { exact: true }),
  ).toHaveCount(1);
  await expect(page.getByLabel('Process 3 ID', { exact: true })).toHaveValue(
    'P3',
  );
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(1000);
  await page
    .getByRole('button', { name: 'Resource graph', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Banker’s algorithm', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Remove resource R1', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Remove resource R', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('heading', { name: 'Add a workload', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add resource', exact: true }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(page.getByText('Safe', { exact: true })).toBeVisible();
  await contained(page);
});
