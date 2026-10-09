import { test, expect } from '@playwright/test';

test('coherent replay, input validation, and a recomputed fixture', async ({
  page,
}, testInfo) => {
  // Control only playback timers so concurrent browser workers cannot skip a frame.
  await page.clock.install({ time: new Date('2026-10-09T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-09T12:00:01Z'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/replay-preview');
  await expect(
    page.getByRole('heading', { name: 'CPU scheduling', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Fixture preview', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Previous event' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'P1 and P2 enter the queue',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: /P2 completes/ }).click();
  await expect(
    page.getByText('Completed', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next event' })).toBeDisabled();
  await expect(
    page
      .getByRole('region', { name: 'Completed fixture intervals', exact: true })
      .getByRole('row'),
  ).toHaveCount(3);
  await page.getByLabel('Speed').selectOption('4');
  await page.getByRole('button', { name: 'Previous event' }).click();
  await expect(
    page.getByRole('heading', { name: 'P2 starts', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Completed fixture intervals', exact: true })
      .getByRole('row'),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Initial frame', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Speed')).toHaveValue('4');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  await page.clock.runFor(250);
  await expect(page.locator('.frame-counter')).toContainText('Frame 1');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
  const frameText = await page.locator('.frame-counter').textContent();
  await page.clock.runFor(1000);
  await expect(page.locator('.frame-counter')).toHaveText(frameText ?? '');
  await page.getByLabel('P1 duration in time units').fill('0');
  await expect(
    page.getByText('Enter a whole number from 1 to 20 time units.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('Inputs changed. Run again to update results.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No active result', exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/replay-preview-${testInfo.project.name}-invalid.png`,
    fullPage: true,
  });
  await page.getByLabel('P1 duration in time units').fill('4');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(1250);
  await expect(
    page.getByRole('button', { name: 'Replay', exact: true }),
  ).toBeVisible({ timeout: 6000 });
  await expect(
    page.getByRole('heading', { name: 'P2 completes', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'P2 completes 2 time units of scripted work at t = 6. Its interval is now visible on the timeline.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  expect(errors).toEqual([]);
});

test('keyboard, routes, scroll containment, and screenshots', async ({
  page,
}, testInfo) => {
  await page.goto('/#/replay-preview');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to workspace' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByLabel('P1 duration in time units').focus();
  const focusOutline = await page
    .getByLabel('P1 duration in time units')
    .evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(focusOutline).toBe('2px');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('P2 duration in time units')).toBeFocused();
  await page.getByRole('button', { name: 'P1 starts', exact: false }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'P1 starts', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /P2 completes/ }).click();
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
  if (testInfo.project.name === 'desktop') {
    const canvas = await page
      .getByRole('region', { name: 'Replay workspace' })
      .boundingBox();
    expect(canvas?.width).toBeGreaterThanOrEqual(420);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/replay-preview-${testInfo.project.name}.png`,
    fullPage: true,
  });
  if ((page.viewportSize()?.width ?? 1440) <= 768)
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: /Synchronization/ }).click();
  await expect(
    page.getByRole('heading', { name: 'This lab is not implemented yet' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Synchronization', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Open CPU scheduling' }).click();
  await expect(
    page.getByRole('heading', { name: 'CPU scheduling', exact: true }),
  ).toBeVisible();
  await page.goto('/#/help');
  await expect(
    page.getByRole('heading', { name: 'Help & model notes' }),
  ).toBeVisible();
  await page.goto('/#/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Module availability' }),
  ).toBeVisible();
  await page.goto('/#/unknown');
  await expect(
    page.getByRole('heading', { name: 'Page unavailable', exact: true }),
  ).toBeVisible();
});
