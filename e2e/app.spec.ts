import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const key = 'trn.notebook.v1';
async function nav(page: Page, name: string) {
  const selector = (page.viewportSize()?.width || 390) < 700 ? '.mobile-nav' : '.sidebar nav';
  await page.locator(selector).getByRole('button', { name, exact: true }).click();
}
async function state(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
async function start(page: Page) {
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('checkbox', { name: /completed gentle mobility/ }).check();
  await page.getByRole('button', { name: 'Begin session', exact: true }).click();
}

test('daily routine, all navigation, mobile layouts and reload', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('');
  await expect(page.getByRole('heading', { name: 'Today.', exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-today.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Open daily routine' }).click();
  await page.getByRole('button', { name: 'Complete daily routine', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'View completed routine' })).toBeVisible();
  for (const tab of ['Plan', 'Progress', 'Nutrition', 'Exercises', 'Settings']) {
    await nav(page, tab);
    await expect(page.locator('h1')).toBeVisible();
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(over, `${tab} overflows`).toBe(false);
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${tab.toLowerCase()}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test('logs every set, restores a live rest timer, and keeps the next workout in sequence', async ({
  page,
}, testInfo) => {
  await page.goto('');
  await start(page);
  await expect(page.locator('.workout-content h1')).toHaveText('Strict pull-up practice');
  await page.getByLabel('RIR · optional').fill('2');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  const before = await state(page);
  expect(before.draft.exercises[0].sets).toHaveLength(1);
  expect(before.draft.restEnd).toBeGreaterThan(Date.now());
  await page.reload();
  await expect(page.locator('.rest-panel')).toBeVisible();
  expect((await state(page)).draft.exercises[0].sets).toHaveLength(1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect((await state(page)).draft.pausedRest).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-workout.png`,
    fullPage: true,
  });
  for (let i = 0; i < 55; i++) {
    if (await page.getByRole('button', { name: 'Skip rest', exact: true }).isVisible()) {
      await page.getByRole('button', { name: 'Skip rest', exact: true }).click();
      continue;
    }
    if (await page.getByRole('button', { name: 'Review & finish', exact: true }).isVisible()) {
      await page.getByRole('button', { name: 'Review & finish', exact: true }).click();
      break;
    }
    if (await page.getByRole('button', { name: 'Next exercise', exact: true }).isVisible()) {
      await page.getByRole('button', { name: 'Next exercise', exact: true }).click();
      continue;
    }
    await page.getByLabel('RIR · optional').fill('2');
    await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  }
  await page.getByLabel('Session notes').fill('Comfortable technique.');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.locator('.workout-overlay')).toHaveCount(0);
  const after = await state(page);
  expect(after.sessions).toHaveLength(1);
  expect(
    after.sessions[0].exercises.every(
      (e: { sets: unknown[]; prescription: { sets: number } }) =>
        e.sets.length === e.prescription.sets,
    ),
  ).toBe(true);
  expect(after.cycles[0].nextIndex).toBe(1);
  expect(after.draft).toBeNull();
  await page.reload();
  expect((await state(page)).sessions[0].notes).toBe('Comfortable technique.');
  await expect(page.locator('.hero-card')).toContainText('workout B');
  await nav(page, 'Plan');
  await page.getByRole('button', { name: 'Calendar & history', exact: true }).click();
  await page.locator('.history-list button').first().click();
  await page.getByLabel('kg', { exact: true }).first().fill('1');
  await page.getByRole('button', { name: 'Save corrected record' }).click();
  expect((await state(page)).sessions[0].exercises[0].sets[0].weight).toBe(1);
});

test('cycle pause/resume, end, new cycle, extension and preserved history', async ({ page }) => {
  await page.goto('');
  await nav(page, 'Plan');
  await page.getByRole('button', { name: 'Cycle', exact: true }).click();
  await page.getByRole('button', { name: 'Pause cycle', exact: true }).click();
  expect((await state(page)).cycles[0].status).toBe('paused');
  await page.reload();
  await page.getByRole('button', { name: 'Cycle', exact: true }).click();
  await page.getByRole('button', { name: 'Resume cycle', exact: true }).click();
  expect((await state(page)).cycles[0].status).toBe('active');
  await page.getByRole('button', { name: 'Extend', exact: true }).click();
  await page.getByLabel('Additional weeks').fill('2');
  await page.getByRole('button', { name: 'Extend cycle', exact: true }).click();
  expect((await state(page)).cycles[0].weeks).toBe(10);
  await page.getByRole('button', { name: 'End cycle early', exact: true }).click();
  await page.getByLabel('Which areas improved most?').fill('Pull-ups');
  await page.getByRole('button', { name: 'End cycle & save feedback', exact: true }).click();
  expect((await state(page)).cycles[0].status).toBe('ended');
  await page.getByRole('button', { name: 'Start next cycle', exact: true }).click();
  await page.getByLabel('Cycle name', { exact: true }).fill('Build two');
  await page.getByLabel('Cycle length', { exact: true }).selectOption('6');
  await page.getByRole('button', { name: 'Create cycle', exact: true }).click();
  const d = await state(page);
  expect(d.cycles).toHaveLength(2);
  expect(d.cycles[0].feedback.improved).toBe('Pull-ups');
  expect(d.cycles[1].weeks).toBe(6);
  expect(d.weights).toHaveLength(1);
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  expect((await state(page)).cycles[0].archived).toBe(true);
});

test('settings, equipment-aware regeneration, nutrition, export/import and reset confirmation', async ({
  page,
}) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('');
  await nav(page, 'Settings');
  await page.getByLabel('Age · years').fill('36');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  expect((await state(page)).profile.age).toBe(36);
  await page
    .getByRole('navigation', { name: 'Settings sections' })
    .getByRole('button', { name: 'Equipment', exact: true })
    .click();
  await page.getByRole('button', { name: 'Parallel bars', exact: true }).click();
  await page.getByRole('button', { name: 'Save equipment', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Settings sections' })
    .getByRole('button', { name: 'Program', exact: true })
    .click();
  await page.getByRole('button', { name: 'Generate from saved settings' }).click();
  const d = await state(page);
  const active = d.programs.find((p: { id: string }) => p.id === d.currentProgramId);
  expect(
    active.workouts
      .flatMap((w: { exercises: unknown[] }) => w.exercises)
      .some((e: { exerciseId: string }) => e.exerciseId === 'dips'),
  ).toBe(false);
  await nav(page, 'Nutrition');
  await page.getByRole('button', { name: 'Mark breakfast eaten', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mark breakfast eaten' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Macro tracking', exact: true }).click();
  await page.getByRole('button', { name: 'Add food', exact: true }).click();
  await page.getByLabel('Food / meal').fill('Lunch');
  await page.getByLabel('Calories · kcal').fill('700');
  await page.getByLabel('Protein · g').fill('40');
  await page.getByRole('button', { name: 'Add to today’s log' }).click();
  expect((await state(page)).nutritionDays[0].logs[0].protein).toBe(40);
  await nav(page, 'Settings');
  await page
    .getByRole('navigation', { name: 'Settings sections' })
    .getByRole('button', { name: 'Data', exact: true })
    .click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all data' }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const original = await state(page);
  await page.getByLabel('Import data file').setInputFiles(filePath!);
  await page.getByRole('button', { name: 'Replace & restore', exact: true }).click();
  expect(await state(page)).toEqual(original);
  await page
    .getByRole('navigation', { name: 'Settings sections' })
    .getByRole('button', { name: 'Data', exact: true })
    .click();
  await page.getByLabel('Import data file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":1}'),
  });
  await expect(page.getByRole('alert')).toContainText('Import rejected');
  expect((await state(page)).profile.age).toBe(36);
  await page.getByRole('button', { name: 'Reset app', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete all data & reset' })).toBeDisabled();
  await page.getByLabel('Type RESET to confirm').fill('RESET');
  await page.getByRole('button', { name: 'Delete all data & reset' }).click();
  expect((await state(page)).profile.age).toBe(35);
});

test('postpone retains A, skip advances to B, and program edits create versions', async ({
  page,
}) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('');
  await page.getByRole('button', { name: 'Do tomorrow', exact: true }).click();
  expect((await state(page)).cycles[0].nextIndex).toBe(0);
  await expect(page.locator('.hero-card')).toContainText('Room to recover');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  expect((await state(page)).cycles[0].nextIndex).toBe(1);
  await nav(page, 'Plan');
  await page.getByRole('button', { name: 'Edit workout A', exact: true }).click();
  await page.getByLabel('Sets', { exact: true }).first().fill('2');
  await page.getByRole('button', { name: 'Save program version' }).click();
  const d = await state(page);
  expect(d.programs).toHaveLength(2);
  expect(d.programs[0].workouts[0].exercises[0].sets).toBe(3);
  expect(d.programs[1].workouts[0].exercises[0].sets).toBe(2);
});

test('short session keeps pull work and remembers a compatible substitution', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.locator('.time-options button').filter({ hasText: '20' }).click();
  await page.getByRole('checkbox', { name: /completed gentle mobility/ }).check();
  await page.getByRole('button', { name: 'Begin session', exact: true }).click();
  expect((await state(page)).draft.exercises).toHaveLength(3);
  await expect(page.locator('.workout-content h1')).toHaveText('Band-assisted pull-up');
  await page.getByRole('button', { name: 'Replace exercise', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Use this exercise from now on' }).check();
  await page
    .locator('.alternative-list button')
    .filter({ hasText: 'Strict pull-up practice' })
    .click();
  await expect(page.locator('.workout-content h1')).toHaveText('Strict pull-up practice');
  const d = await state(page);
  expect(d.programs).toHaveLength(2);
  expect(d.programs[1].workouts[0].exercises[0].exerciseId).toBe('pullup');
  expect(d.programs[0].workouts[0].exercises[0].exerciseId).toBe('assisted-pullup');
  await page.reload();
  expect((await state(page)).draft.exercises[0].exercise.id).toBe('pullup');
});
