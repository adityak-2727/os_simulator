import { test, expect, type Page } from '@playwright/test';
async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-10T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-10T12:00:01Z'));
  await page.goto('/#/disk');
}
async function frame(page: Page, cursor: number | 'last') {
  await page.getByLabel('Replay frame', { exact: false }).focus();
  await page.keyboard.press(cursor === 'last' ? 'End' : 'Home');
  if (cursor !== 'last')
    for (let i = 0; i < cursor; i++) await page.keyboard.press('ArrowRight');
}
async function runPaused(page: Page) {
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
}
async function capture(page: Page, name: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    scrollTo(0, 0);
  });
  await page.screenshot({ path: name, fullPage: true });
}
test('reference replay keeps chart, metrics and ledger coherent through pause, speed, reset and edits', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await expect(
    page.getByRole('button', { name: 'Previous event' }),
  ).toBeDisabled();
  await expect(page.getByTestId('disk-head')).toHaveText('53');
  await expect(page.getByTestId('disk-movement')).toHaveText('0');
  await expect(page.getByTestId('disk-average')).toHaveText('—');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(1000);
  await expect(page.getByTestId('disk-head')).toHaveText('98');
  await expect(page.getByTestId('disk-movement')).toHaveText('45');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByLabel('Speed', { exact: true }).selectOption('4');
  await page.clock.runFor(1000);
  await expect(page.getByTestId('disk-movement')).toHaveText('45');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(250);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByTestId('disk-head')).toHaveText('183');
  await expect(page.getByTestId('disk-served')).toHaveText('2 / 8');
  await expect(page.getByTestId('disk-movement')).toHaveText('130');
  const ledger = page.getByRole('region', {
    name: 'Disk movement ledger',
    exact: true,
  });
  await expect(ledger.getByRole('row')).toHaveCount(3);
  await expect(
    page.getByRole('heading', { name: 'Serve D2 at 183', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Scaled disk head path' })
      .getByRole('img'),
  ).toHaveAttribute('aria-label', /selected head 183/);
  await frame(page, 'last');
  await expect(page.getByTestId('disk-movement')).toHaveText('640');
  await expect(page.getByTestId('disk-average')).toHaveText('80.00');
  await expect(page.getByTestId('disk-order')).toHaveText(
    'D1 → D2 → D3 → D4 → D5 → D6 → D7 → D8',
  );
  await expect(page.getByRole('button', { name: 'Next event' })).toBeDisabled();
  await expect(page.locator('.status')).toHaveText('Completed');
  await capture(page, `artifacts/disk-fcfs-${info.project.name}.png`);
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(page.getByTestId('disk-movement')).toHaveText('0');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await frame(page, 'last');
  await expect(page.getByTestId('disk-movement')).toHaveText('640');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('disk-served')).toHaveText('0 / 8');
  await page.getByLabel('Request 1 cylinder', { exact: true }).fill('99');
  await expect(page.getByTestId('disk-movement')).toHaveCount(0);
  await expect(
    page.getByText('Inputs changed. Run again to update results.'),
  ).toBeVisible();
  await runPaused(page);
  await frame(page, 'last');
  await expect(page.getByTestId('disk-movement')).toHaveText('640');
  expect(errors).toEqual([]);
});
test('comparison computes four reference totals from shared inputs and opens exact endpoint/wrap traces', async ({
  page,
}, info) => {
  await page.goto('/#/disk');
  await page
    .getByRole('button', { name: 'Compare algorithms', exact: true })
    .click();
  const table = page.getByRole('region', {
    name: 'Disk comparison metrics',
    exact: true,
  });
  const rows = [
    ['FCFS', '640', '80.00', '0', '0'],
    ['SSTF', '236', '29.50', '0', '0'],
    ['SCAN', '331', '41.38', '16', '0'],
    ['C-SCAN', '382', '47.75', '16', '199'],
  ];
  for (const [i, expected] of rows.entries())
    await expect(
      table
        .getByRole('row')
        .nth(i + 1)
        .locator('th,td')
        .filter({ hasNot: page.getByRole('button') }),
    ).toHaveText(expected);
  await expect(
    page.getByRole('region', { name: 'Shared disk inputs' }).getByRole('row'),
  ).toHaveCount(9);
  await capture(page, `artifacts/disk-comparison-${info.project.name}.png`);
  await page.getByRole('button', { name: 'Inspect C-SCAN trace' }).click();
  await expect(page.getByLabel('Algorithm', { exact: true })).toHaveValue(
    'cscan',
  );
  await frame(page, 7);
  await expect(page.getByTestId('disk-head')).toHaveText('199');
  await expect(page.getByTestId('disk-movement')).toHaveText('146');
  await expect(page.getByTestId('disk-served')).toHaveText('6 / 8');
  await expect(
    page.getByRole('heading', { name: 'Physical endpoint · 199', exact: true }),
  ).toBeVisible();
  await frame(page, 8);
  await expect(page.getByTestId('disk-head')).toHaveText('0');
  await expect(page.getByTestId('disk-movement')).toHaveText('345');
  await expect(page.getByTestId('disk-served')).toHaveText('6 / 8');
  await expect(
    page.getByRole('heading', { name: 'Circular wrap · 0', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/without servicing requests along the wrap/),
  ).toBeVisible();
  await expect(page.locator('line.disk-move-wrap')).toHaveCount(1);
  await expect(page.locator('line.disk-move-endpoint')).toHaveCount(1);
  await expect(
    page
      .getByRole('region', { name: 'Disk movement ledger', exact: true })
      .getByRole('row')
      .nth(8)
      .locator('th,td'),
  ).toHaveText(['8', 'wrap', '199', '0', '199']);
  await capture(page, `artifacts/disk-wrap-${info.project.name}.png`);
  await frame(page, 'last');
  await expect(page.getByTestId('disk-movement')).toHaveText('382');
  await expect(page.getByTestId('disk-order')).toHaveText(
    'D7 → D8 → D1 → D4 → D6 → D2 → D5 → D3',
  );
  await expect(page.locator('line.disk-move-wrap')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Compare algorithms', exact: true })
    .click();
  await page.getByRole('button', { name: 'Inspect SSTF trace' }).click();
  await frame(page, 1);
  await expect(
    page
      .getByRole('region', { name: 'SSTF request candidates', exact: true })
      .getByRole('row')
      .nth(1)
      .locator('th,td'),
  ).toHaveText(['D7', '65', '12']);
  await expect(
    page.getByRole('heading', { name: 'Serve D7 at 65', exact: true }),
  ).toBeVisible();
});
test('lower sweeps, endpoint duplicates and zero-distance services retain request identities', async ({
  page,
}, info) => {
  await open(page);
  await page.getByLabel('Algorithm', { exact: true }).selectOption('scan');
  await page
    .getByLabel('Initial sweep direction', { exact: true })
    .selectOption('lower');
  await runPaused(page);
  await frame(page, 3);
  await expect(page.getByTestId('disk-head')).toHaveText('0');
  await expect(page.getByTestId('disk-movement')).toHaveText('53');
  await expect(
    page.getByText(/Reverse to higher cylinders here/),
  ).toBeVisible();
  await frame(page, 'last');
  await expect(page.getByTestId('disk-movement')).toHaveText('236');
  await expect(page.getByTestId('disk-head')).toHaveText('183');
  await capture(page, `artifacts/disk-lower-scan-${info.project.name}.png`);
  await page.getByLabel('Algorithm', { exact: true }).selectOption('cscan');
  await runPaused(page);
  await frame(page, 4);
  await expect(page.getByTestId('disk-head')).toHaveText('199');
  await expect(page.getByTestId('disk-movement')).toHaveText('252');
  await frame(page, 'last');
  await expect(page.getByTestId('disk-movement')).toHaveText('386');
  await page
    .getByRole('button', { name: 'Duplicates and endpoints', exact: true })
    .click();
  await page.getByLabel('Algorithm', { exact: true }).selectOption('scan');
  await page
    .getByLabel('Initial sweep direction', { exact: true })
    .selectOption('lower');
  await runPaused(page);
  await frame(page, 2);
  await expect(page.getByTestId('disk-order')).toHaveText('D1 → D4');
  await expect(page.getByTestId('disk-movement')).toHaveText('0');
  await expect(page.getByTestId('disk-served')).toHaveText('2 / 6');
  await frame(page, 5);
  await expect(
    page.getByRole('heading', { name: 'Physical endpoint · 0', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/already at physical endpoint 0/)).toBeVisible();
  await expect(page.getByTestId('disk-served')).toHaveText('4 / 6');
  await frame(page, 'last');
  await expect(page.getByTestId('disk-order')).toHaveText(
    'D1 → D4 → D5 → D2 → D6 → D3',
  );
  await expect(page.getByTestId('disk-movement')).toHaveText('150');
  await capture(page, `artifacts/disk-duplicates-${info.project.name}.png`);
});
test('request editing, stable order, inline validation and empty recovery invalidate the computed trace', async ({
  page,
}, info) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Move request 2 earlier', exact: true })
    .click();
  await expect(page.getByLabel('Request 1 ID', { exact: true })).toHaveValue(
    'D2',
  );
  await runPaused(page);
  await frame(page, 1);
  await expect(page.getByTestId('disk-head')).toHaveText('183');
  await expect(page.getByTestId('disk-movement')).toHaveText('130');
  await page.getByLabel('Request 2 ID', { exact: true }).fill('D2');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel('Request 2 ID', { exact: true }),
  ).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/Duplicate request ID D2/)).toBeVisible();
  await expect(page.getByTestId('disk-head')).toHaveCount(0);
  await page.getByLabel('Request 2 ID', { exact: true }).fill('D1');
  await page.getByLabel('Request 1 cylinder', { exact: true }).fill('200');
  await expect(
    page.getByText('Request cylinder must be a whole number from 0 to 199.'),
  ).toBeVisible();
  await expect(
    page.getByLabel('Request 1 cylinder', { exact: true }),
  ).toHaveValue('200');
  await page.getByLabel('Maximum cylinder', { exact: true }).fill('0');
  await expect(
    page.getByText('Maximum cylinder must be a whole number from 1 to 100000.'),
  ).toBeVisible();
  await capture(page, `artifacts/disk-invalid-${info.project.name}.png`);
  await page
    .getByRole('button', { name: 'Load reference example', exact: true })
    .click();
  for (let i = 0; i < 8; i++)
    await page
      .getByRole('button', { name: 'Remove request 1', exact: true })
      .click();
  await expect(
    page.getByRole('heading', { name: 'Add a disk request', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Compare algorithms', exact: true }),
  ).toBeDisabled();
  await capture(page, `artifacts/disk-empty-${info.project.name}.png`);
  await page.getByRole('button', { name: 'Add request', exact: true }).click();
  await expect(
    page.getByLabel('Request 1 cylinder', { exact: true }),
  ).toHaveValue('53');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeEnabled();
  await runPaused(page);
  await frame(page, 'last');
  await expect(page.getByTestId('disk-movement')).toHaveText('0');
  await expect(page.getByTestId('disk-served')).toHaveText('1 / 1');
});
test('windowed path, equivalent ledger keyboard selection and navigation pause preserve results', async ({
  page,
}, info) => {
  await open(page);
  for (let i = 0; i < 6; i++)
    await page
      .getByRole('button', { name: 'Add request', exact: true })
      .click();
  await runPaused(page);
  await frame(page, 'last');
  await expect(page.getByTestId('disk-movement')).toHaveText('654');
  await expect(page.getByText('Processed steps 2–14')).toBeVisible();
  await page.getByRole('button', { name: 'Earlier', exact: true }).click();
  await expect(page.getByText('Processed steps 0–12')).toBeVisible();
  await page.getByRole('button', { name: 'Later', exact: true }).click();
  await expect(page.getByText('Processed steps 2–14')).toBeVisible();
  await page
    .getByRole('button', { name: 'Follow cursor', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Follow cursor', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Inspect move 2', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('disk-movement')).toHaveText('130');
  await expect(
    page.getByRole('heading', { name: 'Serve D2 at 183', exact: true }),
  ).toBeVisible();
  await frame(page, 'last');
  await capture(page, `artifacts/disk-window-${info.project.name}.png`);
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  if ((page.viewportSize()?.width ?? 1440) <= 768)
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Help', exact: true }).click();
  await page.clock.runFor(10000);
  if ((page.viewportSize()?.width ?? 1440) <= 768)
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .getByRole('link', { name: 'Disk scheduling', exact: true })
    .click();
  await expect(page.getByTestId('disk-movement')).toHaveText('0');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Request 14 ID', { exact: true })).toHaveValue(
    'D14',
  );
  await frame(page, 'last');
  await expect(page.getByTestId('disk-movement')).toHaveText('654');
});
