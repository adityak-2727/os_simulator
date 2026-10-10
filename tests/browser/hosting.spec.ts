import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('static assets, hash refresh, saving and JSON export work under the repository path', async ({
  page,
}, info) => {
  test.skip(
    process.env.PLAYWRIGHT_MODE !== 'pages',
    'Requires the repository-path production build.',
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto('/os_simulator/#/system');
  await expect(
    page.getByRole('heading', { name: 'Integrated system', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Save experiment', exact: true })
    .click();
  await page.getByLabel('Experiment name').fill('Repository path check');
  await page.getByRole('button', { name: 'Save locally', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Integrated system', exact: true }),
  ).toBeVisible();
  await page.goto('/os_simulator/#/experiments');
  await expect(
    page.getByRole('button', {
      name: 'Open Repository path check',
      exact: true,
    }),
  ).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export Repository path check', exact: true })
    .click();
  const filePath = `artifacts/hosting-${info.project.name}.json`;
  await (await downloaded).saveAs(filePath);
  await page.getByLabel('Import experiment JSON').setInputFiles({
    name: 'experiment.json',
    mimeType: 'application/json',
    buffer: Buffer.from(await readFile(filePath, 'utf8')),
  });
  await page
    .getByRole('button', { name: 'Open imported scenario', exact: true })
    .click();
  await expect(page.getByTestId('system-time')).toHaveText('0');
  await page.goto('/os_simulator/#/deadlock');
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  expect(errors).toEqual([]);
});
