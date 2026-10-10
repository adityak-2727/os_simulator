import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

test('all v1 routes have accessible controls, contained layouts and no browser errors', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  for (const [route, heading] of [
    ['cpu', 'CPU scheduling'],
    ['allocation', 'Memory allocation'],
    ['paging', 'Page replacement'],
    ['deadlock', 'Deadlock & resource safety'],
    ['synchronization', 'Synchronization & interleavings'],
    ['disk', 'Disk scheduling'],
    ['system', 'Integrated system'],
    ['experiments', 'Experiments'],
    ['dashboard', 'Dashboard'],
    ['help', 'Help & model notes'],
  ] as const) {
    await page.goto(`/#/${route}`);
    await expect(
      page.getByRole('heading', { name: heading, exact: true }).first(),
    ).toBeVisible();
    if (route === 'deadlock')
      await expect(page.locator('.react-flow__node')).toHaveCount(4);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    await info.attach(`${route}-accessibility`, {
      body: JSON.stringify(audit, null, 2),
      contentType: 'application/json',
    });
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
      route,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
    if (
      [
        'cpu',
        'allocation',
        'paging',
        'deadlock',
        'synchronization',
        'disk',
        'system',
      ].includes(route)
    ) {
      await page.getByRole('button', { name: 'Run', exact: true }).click();
      await page.getByLabel('Replay frame', { exact: false }).focus();
      await page.keyboard.press('End');
      const finalAudit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        finalAudit.violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
        `${route} final`,
      ).toEqual([]);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        scrollTo(0, 0);
      });
      await page.screenshot({
        path: `artifacts/release-${route}-${info.project.name}.png`,
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});

test('reduced motion retains keyboard editing, stepping, completed and empty states', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/#/cpu');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to workspace' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  const next = page.getByRole('button', { name: 'Next event' });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Replay frame', { exact: false })).toHaveValue(
    '1',
  );
  await expect(page.locator('[role="status"]').last()).toHaveAttribute(
    'aria-live',
    'polite',
  );
  await page.getByLabel('Replay frame', { exact: false }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.status')).toHaveText('Completed');
  const style = await page
    .locator('.button.primary')
    .first()
    .evaluate((e) => ({
      transition: getComputedStyle(e).transitionDuration,
      animation: getComputedStyle(e).animationName,
    }));
  expect(style).toEqual({ transition: '0s', animation: 'none' });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    scrollTo(0, 0);
  });
  await page.screenshot({
    path: `artifacts/release-reduced-motion-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel('P1 burst time').fill('0');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await page.clock.resume();
  const invalidAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(invalidAudit.violations).toEqual([]);
  await page.goto('/#/experiments');
  await expect(
    page.getByRole('heading', { name: 'No saved experiments', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/release-empty-${info.project.name}.png`,
    fullPage: true,
  });
});

test('saving Banker safety preserves analysis rather than submitting a configured request', async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/#/deadlock');
  await page
    .getByRole('button', { name: 'Banker’s algorithm', exact: true })
    .click();
  await page.getByLabel('Banker example').selectOption('grant');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByLabel('Replay frame', { exact: false }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.status')).toHaveText('Safe');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const path = await (await downloaded).path();
  const json = await readFile(path!, 'utf8');
  expect(JSON.parse(json).scenario.request).toBeUndefined();
  await page
    .getByRole('link', { name: 'Open experiments', exact: true })
    .click();
  await page.getByLabel('Import experiment JSON').setInputFiles({
    name: 'safety.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await page
    .getByRole('button', { name: 'Open imported scenario', exact: true })
    .click();
  await page.getByLabel('Replay frame', { exact: false }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.status')).toHaveText('Safe');
  await expect(
    page
      .getByRole('region', { name: 'Actual resource vectors', exact: true })
      .getByRole('row')
      .nth(2)
      .locator('td'),
  ).toHaveText(['3', '3', '2']);
  await page.clock.resume();
  const safetyAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(safetyAudit.violations).toEqual([]);
  await page.getByLabel('Banker example').selectOption('wait-safety');
  await page
    .getByRole('button', { name: 'Evaluate request', exact: true })
    .click();
  await page.getByLabel('Replay frame', { exact: false }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.status')).toHaveText('Wait for safety');
  const requestDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const requestPath = await (await requestDownload).path();
  expect(
    JSON.parse(await readFile(requestPath!, 'utf8')).scenario.request,
  ).toEqual({ processId: 'P4', amount: [3, 3, 0] });
  const rollbackAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(rollbackAudit.violations).toEqual([]);
});
