import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import imported from '../../fixtures/experiment-import.json' with { type: 'json' };
async function open(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/#/system');
}
async function last(page: Page) {
  await page.getByLabel('Replay frame', { exact: false }).focus();
  await page.keyboard.press('End');
}
async function paused(page: Page) {
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
}
async function nav(page: Page, route: string) {
  if ((page.viewportSize()?.width ?? 1440) <= 768)
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: route, exact: true })
    .click();
}
async function capture(page: Page, path: string) {
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
  await page.screenshot({ path, fullPage: true });
}
test('integrated replay, ownership, waiting, dashboard and edits share one frame', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await paused(page);
  await last(page);
  await expect(page.locator('.status')).toHaveText('Completed');
  await expect(page.getByTestId('system-time')).toHaveText('8');
  const table = page.getByRole('region', {
    name: 'Integrated process results',
    exact: true,
  });
  await expect(table.getByRole('row').nth(1).locator('th,td')).toHaveText([
    'P1',
    'terminated',
    '4',
    '5',
    '2',
    '0',
    '0',
    '7',
    '7',
    '0',
  ]);
  await expect(table.getByRole('row').nth(2).locator('th,td')).toHaveText([
    'P2',
    'terminated',
    '3',
    '2',
    '1',
    '2',
    '0',
    '6',
    '5',
    '3',
  ]);
  await expect(table.getByRole('row').nth(3).locator('th,td')).toHaveText([
    'P3',
    'terminated',
    '1',
    '1',
    '1',
    '0',
    '4',
    '8',
    '6',
    '5',
  ]);
  await capture(page, `artifacts/system-final-${info.project.name}.png`);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const time = await page.getByTestId('system-time').textContent();
  await page.getByLabel('Speed', { exact: true }).selectOption('4');
  await page.clock.runFor(5000);
  await expect(page.getByTestId('system-time')).toHaveText(time!);
  await nav(page, 'Dashboard');
  await expect(page.getByTestId('system-time')).toHaveText(time!);
  await page.getByRole('link', { name: 'Continue run' }).click();
  await last(page);
  await page.getByLabel('Capacity (KiB)', { exact: true }).fill('128');
  await expect(page.getByTestId('system-time')).toHaveCount(0);
  await expect(
    page.getByText('Inputs changed. Run again to update results.'),
  ).toBeVisible();
  await paused(page);
  await last(page);
  await expect(table.getByRole('row').nth(3).locator('td').nth(5)).toHaveText(
    '0',
  );
  expect(errors).toEqual([]);
});
test('resource blocking, genuine cycle, invalid input and empty recovery', async ({
  page,
}, info) => {
  await open(page);
  await paused(page);
  await last(page);
  const slider = page.getByLabel('Replay frame', { exact: false });
  await slider.focus();
  await page.keyboard.press('Home');
  let found = false;
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('ArrowRight');
    const title = await page.locator('.event-title').textContent();
    if (title?.includes('resource-blocked')) {
      found = true;
      break;
    }
  }
  expect(found).toBe(true);
  await expect(page.getByTestId('system-time')).toHaveText('2');
  await expect(
    page
      .getByRole('region', {
        name: 'Integrated resource ownership',
        exact: true,
      })
      .getByRole('row')
      .nth(1)
      .locator('th,td'),
  ).toHaveText(['R1', 'P1', 'P2']);
  await expect(page.getByTestId('system-memory-wait')).toHaveText('P3');
  await expect(page.getByText(/retains 32 KiB and loses/)).toBeVisible();
  await capture(page, `artifacts/system-blocked-${info.project.name}.png`);
  await page
    .getByRole('button', { name: 'Two-resource cycle', exact: true })
    .click();
  await paused(page);
  await last(page);
  await expect(page.locator('.status')).toHaveText('Deadlocked');
  await expect(page.getByText(/Proven wait cycle/)).toBeVisible();
  await page.getByLabel('Process 1 program').fill('cpu 0');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Remove process 1' }).click();
  await page.getByRole('button', { name: 'Remove process 1' }).click();
  await expect(page.locator('.status')).toHaveText('Empty');
  await expect(
    page.getByRole('heading', { name: 'Add a process', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add process', exact: true }).click();
  await paused(page);
  await last(page);
  await expect(page.locator('.status')).toHaveText('Completed');
});
test('save, rename, duplicate, export, delete and import round trip', async ({
  page,
}, info) => {
  await open(page);
  await paused(page);
  await last(page);
  await page
    .getByRole('button', { name: 'Save experiment', exact: true })
    .click();
  await page
    .getByLabel('Experiment name', { exact: true })
    .fill('Integrated classroom');
  await page.getByRole('button', { name: 'Save locally', exact: true }).click();
  await expect(page.getByText('Saved locally.', { exact: true })).toBeVisible();
  await page
    .getByRole('link', { name: 'Open experiments', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Rename Integrated classroom', exact: true })
    .click();
  await page.getByLabel('New experiment name').fill('Reference run');
  await page.getByRole('button', { name: 'Confirm rename' }).click();
  await page
    .getByRole('button', { name: 'Duplicate Reference run', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Open Reference run (copy)',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Delete Reference run (copy)', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export Reference run', exact: true })
    .click();
  const file = await download,
    path = await file.path();
  expect(path).not.toBeNull();
  const json = await readFile(path!, 'utf8');
  expect(JSON.parse(json).scenario.kind).toBe('system');
  await page.getByLabel('Import experiment JSON').setInputFiles({
    name: 'experiment.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await expect(
    page.getByRole('heading', { name: 'Validated import' }),
  ).toBeVisible();
  await capture(page, `artifacts/experiments-${info.project.name}.png`);
  await page.getByRole('button', { name: 'Open imported scenario' }).click();
  await expect(page.getByTestId('system-time')).toHaveText('0');
  await paused(page);
  await last(page);
  await expect(page.getByTestId('system-time')).toHaveText('8');
  const resultDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export results CSV' }).click();
  const csvPath = await (await resultDownload).path();
  expect(await readFile(csvPath!, 'utf8')).toContain(
    '"P2","6","5","2","1","2","0","3"',
  );
  await page.reload();
  await page.getByRole('link', { name: 'Open experiments' }).click();
  await expect(
    page.getByRole('button', { name: 'Open Reference run', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Module filter').selectOption('cpu');
  await expect(
    page.getByText('No saved experiments match this module.'),
  ).toBeVisible();
});
test('invalid imports preserve inputs; valid CPU oracle opens and recalculates', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Process 1 program').fill('cpu 9');
  await page.getByRole('link', { name: 'Open experiments' }).click();
  await page.getByLabel('Import experiment JSON').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  });
  await expect(page.getByRole('alert')).toContainText('Malformed JSON');
  await expect(
    page.getByRole('button', { name: 'Open imported scenario' }),
  ).toHaveCount(0);
  await nav(page, 'Integrated system');
  await expect(page.getByLabel('Process 1 program')).toHaveValue('cpu 9');
  await page.getByRole('link', { name: 'Open experiments' }).click();
  await page.getByLabel('Import experiment JSON').setInputFiles({
    name: 'cpu.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect(
    page.getByRole('region', { name: 'Import review' }),
  ).toContainText('Round Robin classroom example');
  await page.getByRole('button', { name: 'Open imported scenario' }).click();
  await paused(page);
  await last(page);
  const table = page.getByRole('region', {
    name: 'Process results',
    exact: false,
  });
  await expect(table).toContainText('9');
  await expect(page.getByLabel('P1 burst time', { exact: false })).toHaveValue(
    '5',
  );
});
test('quota failure preserves active work and offers export', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await open(page);
  await page
    .getByRole('button', { name: 'Save experiment', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save locally', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    'Current work was preserved',
  );
  await expect(page.getByLabel('Process 1 program')).toHaveValue(
    'acquire R1\ncpu 4\nrelease R1\ncpu 1',
  );
  await expect(
    page.getByRole('button', { name: 'Export JSON', exact: true }),
  ).toBeEnabled();
  await paused(page);
  await last(page);
  await expect(page.getByTestId('system-time')).toHaveText('8');
});
test('every standalone lab can save and reopen its source', async ({
  page,
}) => {
  await page.goto('/#/cpu');
  for (const route of [
    'cpu',
    'allocation',
    'paging',
    'deadlock',
    'synchronization',
    'disk',
  ]) {
    await page.goto(`/#/${route}`);
    await page
      .getByRole('button', { name: 'Save experiment', exact: true })
      .click();
    await page
      .getByLabel('Experiment name', { exact: true })
      .fill(`Saved ${route}`);
    await page
      .getByRole('button', { name: 'Save locally', exact: true })
      .click();
    await page
      .getByRole('link', { name: 'Open experiments', exact: true })
      .click();
    await page
      .getByRole('button', { name: `Open Saved ${route}`, exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirm open' }).click();
    await expect(page).toHaveURL(new RegExp(`#/${route}$`));
    await expect(
      page.getByRole('button', { name: 'Save experiment', exact: true }),
    ).toBeEnabled();
  }
});
