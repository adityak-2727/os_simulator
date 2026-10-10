import { test, expect, type Page } from '@playwright/test';
async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-10T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-10T12:00:01Z'));
  await page.goto('/#/synchronization');
}
async function frame(page: Page, cursor: number | 'last') {
  await page.getByLabel('Replay frame', { exact: false }).focus();
  await page.keyboard.press(cursor === 'last' ? 'End' : 'Home');
  if (cursor !== 'last')
    for (let i = 0; i < cursor; i++) await page.keyboard.press('ArrowRight');
}
async function captured(page: Page, path: string) {
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
test('counter race, protected PCs, FIFO handoff, replay invariance and input invalidation', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'P1: read-counter r', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'P1 execution state', exact: true }),
  ).toContainText('PC 1 / 3');
  await frame(page, 'last');
  await expect(page.getByTestId('shared-counter')).toHaveText('1');
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await captured(page, `artifacts/counter-race-${info.project.name}.png`);
  await page
    .getByLabel('Synchronization example')
    .selectOption('counter-mutex');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 2);
  await expect(
    page.getByRole('region', { name: 'P2 execution state', exact: true }),
  ).toContainText('PC 0 / 5');
  await expect(
    page.getByRole('region', { name: 'P2 execution state', exact: true }),
  ).toContainText('blocked');
  await expect(
    page
      .getByRole('region', { name: 'Mutex state', exact: true })
      .getByRole('row')
      .nth(1)
      .locator('th,td'),
  ).toHaveText(['m', 'P1', 'P2']);
  await captured(page, `artifacts/counter-blocked-${info.project.name}.png`);
  await frame(page, 6);
  await expect(
    page.getByRole('region', { name: 'P2 execution state', exact: true }),
  ).toContainText('PC 1 / 5');
  await expect(
    page
      .getByRole('region', { name: 'Mutex state', exact: true })
      .getByRole('row')
      .nth(1)
      .locator('th,td'),
  ).toHaveText(['m', 'P2', 'Empty']);
  await expect(
    page.getByText(/hands ownership directly to FIFO waiter P2/),
  ).toBeVisible();
  await frame(page, 'last');
  await expect(page.getByTestId('shared-counter')).toHaveText('2');
  await page.getByLabel('Speed', { exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.clock.runFor(2500);
  await expect(page.getByTestId('shared-counter')).toHaveText('2');
  await captured(page, `artifacts/counter-mutex-${info.project.name}.png`);
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.getByLabel('Initial shared counter', { exact: true }).fill('4');
  await expect(page.getByTestId('shared-counter')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'No active result', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page.getByTestId('shared-counter')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('manual choices explicitly branch after rewind, cancel safely, and reach a different computed result', async ({
  page,
}, info) => {
  await open(page);
  await frame(page, 1);
  await page.getByLabel('Process selection mode').selectOption('manual');
  await page.getByRole('button', { name: 'Step P1', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Branch from step 1', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/discards 5 future choices/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Cancel branch', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Branch from step 1', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel('Scheduled process choices', { exact: true }),
  ).toHaveValue('P1, P2, P1, P2, P1, P2');
  await page.getByRole('button', { name: 'Step P1', exact: true }).click();
  await page
    .getByRole('button', { name: 'Branch and step P1', exact: true })
    .click();
  await expect(
    page.getByLabel('Scheduled process choices', { exact: true }),
  ).toHaveValue('P1, P1');
  await expect(
    page.getByText(/Branched at step 1. Discarded 5 future choices/),
  ).toBeVisible();
  await expect(
    page.getByText('Awaiting choice', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Step P1', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Step P1', exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId('shared-counter')).toHaveText('1');
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Step P2', exact: true }).click();
  await expect(page.getByTestId('shared-counter')).toHaveText('2');
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await captured(
    page,
    `artifacts/interleaving-branch-${info.project.name}.png`,
  );
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('shared-counter')).toHaveText('0');
  await page.getByLabel('Speed', { exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(1500);
  await expect(page.getByTestId('shared-counter')).toHaveText('2');
});
test('producer-consumer shows reservations, exact semaphore wake-up and FIFO A then B', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page
    .getByLabel('Synchronization example')
    .selectOption('producer-consumer');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 10);
  await expect(
    page.getByRole('region', { name: 'Buffer slots', exact: true }),
  ).toContainText('A');
  await expect(
    page.getByRole('region', { name: 'Buffer slots', exact: true }),
  ).toContainText('B');
  await expect(
    page.getByText('Maximum occupancy so far: 2 slots.', { exact: false }),
  ).toBeVisible();
  await captured(page, `artifacts/buffer-full-${info.project.name}.png`);
  await frame(page, 'last');
  await expect(page.getByTestId('consumed-sequence')).toHaveText('A → B');
  await expect(
    page
      .getByRole('region', { name: 'Semaphore state', exact: true })
      .getByRole('row')
      .nth(1)
      .locator('th,td'),
  ).toHaveText(['empty', '2', 'Empty']);
  await page
    .getByRole('button', { name: 'Start empty manual schedule', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Step Consumer', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Step Consumer', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('region', { name: 'Consumer execution state', exact: true }),
  ).toContainText('PC 0 / 10');
  await page
    .getByRole('button', { name: 'Step Producer', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', {
        name: 'In-flight buffer reservations',
        exact: true,
      })
      .getByRole('row')
      .nth(1)
      .locator('th,td'),
  ).toHaveText(['Producer', 'empty', 'Before buffer operation']);
  await page
    .getByRole('button', { name: 'Step Producer', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Step Producer', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', {
        name: 'In-flight buffer reservations',
        exact: true,
      })
      .getByRole('row')
      .nth(1)
      .locator('th,td'),
  ).toHaveText(['Producer', 'empty', 'Buffer changed; signal pending']);
  await captured(page, `artifacts/buffer-reservation-${info.project.name}.png`);
  await page
    .getByRole('button', { name: 'Step Producer', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Step Producer', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Consumer execution state', exact: true }),
  ).toContainText('PC 1 / 10');
  await expect(
    page
      .getByRole('region', { name: 'Semaphore state', exact: true })
      .getByRole('row')
      .nth(2)
      .locator('th,td'),
  ).toHaveText(['full', '0', 'Empty']);
  await expect(
    page.getByRole('button', { name: 'Step Consumer', exact: true }),
  ).toBeEnabled();
  for (let i = 0; i < 4; i++)
    await page
      .getByRole('button', { name: 'Step Consumer', exact: true })
      .click();
  for (let i = 0; i < 5; i++)
    await page
      .getByRole('button', { name: 'Step Producer', exact: true })
      .click();
  for (let i = 0; i < 5; i++)
    await page
      .getByRole('button', { name: 'Step Consumer', exact: true })
      .click();
  await expect(page.getByTestId('consumed-sequence')).toHaveText('A → B');
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Buffer slots', exact: true })
      .getByText('Empty', { exact: true }),
  ).toHaveCount(2);
  await captured(page, `artifacts/buffer-completed-${info.project.name}.png`);
  expect(errors).toEqual([]);
});
test('schedule exhaustion, stalled programs, model errors, invalid/empty recovery and navigation pause', async ({
  page,
}, info) => {
  await open(page);
  await page
    .getByLabel('Scheduled process choices', { exact: true })
    .fill('P1');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(
    page.getByText('Awaiting choice', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Schedule exhausted/)).toBeVisible();
  await page.getByLabel('Semaphore definitions', { exact: true }).fill('s 0');
  await page.getByLabel('P1 program', { exact: true }).fill('wait s');
  await page.getByLabel('P2 program', { exact: true }).fill('wait s');
  await page
    .getByLabel('Scheduled process choices', { exact: true })
    .fill('P1, P2');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(page.getByText('Stalled', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Stalled: no process can run',
      exact: true,
    }),
  ).toBeVisible();
  await captured(
    page,
    `artifacts/interleaving-stalled-${info.project.name}.png`,
  );
  await page.getByLabel('Mutex IDs', { exact: true }).fill('m');
  await page.getByLabel('P1 program', { exact: true }).fill('unlock m');
  await page.getByLabel('P2 program', { exact: true }).fill('read-counter r');
  await page
    .getByLabel('Scheduled process choices', { exact: true })
    .fill('P1');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await frame(page, 'last');
  await expect(page.getByText('Model error', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('not its owner');
  await expect(
    page.getByRole('region', { name: 'P1 execution state', exact: true }),
  ).toContainText('PC 0 / 1');
  await page.getByLabel('P1 program', { exact: true }).fill('unknown r');
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('unknown instruction');
  await captured(
    page,
    `artifacts/interleaving-invalid-${info.project.name}.png`,
  );
  await page.getByLabel('P1 program', { exact: true }).fill('');
  await expect(
    page.getByRole('heading', { name: 'Add a workload', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel('Synchronization example')
    .selectOption('counter-mutex');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  if ((page.viewportSize()?.width ?? 1440) <= 768)
    await page
      .getByRole('button', { name: 'Open navigation', exact: true })
      .click();
  await page.getByRole('link', { name: 'Deadlock', exact: true }).click();
  if ((page.viewportSize()?.width ?? 1440) <= 768)
    await page
      .getByRole('button', { name: 'Open navigation', exact: true })
      .click();
  await page
    .getByRole('link', { name: 'Synchronization', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Synchronization example')).toHaveValue(
    'counter-mutex',
  );
});
