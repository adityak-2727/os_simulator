import { test, expect } from '@playwright/test';
test('corrupt experiment storage remains untouched while current work runs', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('os-lab-simulator.experiments.v1', '{corrupt'),
  );
  await page.goto('/#/system');
  await expect(page.getByRole('status')).toContainText(
    'Existing storage was preserved',
  );
  await page
    .getByRole('button', { name: 'Save experiment', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save locally', exact: true }).click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('os-lab-simulator.experiments.v1'),
    ),
  ).toBe('{corrupt');
  await expect(
    page.getByRole('button', { name: 'Export JSON', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByLabel('Replay frame', { exact: false }).focus();
  await page.keyboard.press('End');
  await expect(page.getByTestId('system-time')).toHaveText('8');
});
test('storage getter failure offers export and preserves editable inputs', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    }),
  );
  await page.goto('/#/system');
  await expect(page.getByRole('status')).toContainText(
    'Local storage is unavailable',
  );
  await page.getByLabel('Quantum (t)').fill('3');
  await expect(
    page.getByRole('button', { name: 'Export JSON', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByLabel('Replay frame', { exact: false }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.status')).toHaveText('Completed');
});
