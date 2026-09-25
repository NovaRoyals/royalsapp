import { expect, type Page, test } from '@playwright/test';

const HYDRATION_PATTERNS = [/Hydration failed/i, /didn't match/i, /Minified React error #418/];

function attachConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });
  return errors;
}

function assertNoHydrationErrors(errors: string[]) {
  const hits = errors.filter((text) => HYDRATION_PATTERNS.some((pattern) => pattern.test(text)));
  expect(hits, `hydration errors:\n${hits.join('\n')}\n\nall errors:\n${errors.join('\n')}`).toEqual([]);
}

async function clickName(page: Page, name: string | RegExp) {
  const button = page.getByRole('button', { name });
  await button.waitFor({ state: 'visible', timeout: 20_000 });
  await button.click({ timeout: 20_000 });
}

async function dismissSplash(page: Page) {
  await page.waitForTimeout(2300);
}

async function seedParentWithSentRecap(page: Page) {
  await page.goto('/onboarding', { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'load' });
  await dismissSplash(page);
  await clickName(page, 'Get started');
  await clickName(page, 'Continue with Google');
  await page.getByText('What should we call you?').waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await clickName(page, /Coach\. Request staff/);
  await page.getByRole('tab', { name: 'Profile' }).waitFor({ timeout: 20_000 });
  await page.getByRole('tab', { name: 'Profile' }).click();
  await clickName(page, 'Coach / manager');
  await page.goto('/session/kids-2026-09-20/recap', { waitUntil: 'load' });
  await dismissSplash(page);
  await clickName(page, 'Preview parent view');
  await clickName(page, 'Approve and send');
  await page.getByRole('button', { name: 'Done' }).waitFor({ timeout: 15_000 });
  await page.goto('/profile', { waitUntil: 'load' });
  await dismissSplash(page);
  await clickName(page, 'Parent / guardian');
  await page.goto('/updates', { waitUntil: 'load' });
  await dismissSplash(page);
  await expect(page.getByText('SESSION RECAP')).toBeVisible({ timeout: 15_000 });
}

async function hardRefreshAndAssert(page: Page, path: string, visible: RegExp, errors: string[]) {
  errors.length = 0;
  await page.goto(path, { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
  await dismissSplash(page);
  await expect(page.getByText(visible).first()).toBeVisible({ timeout: 15_000 });
  assertNoHydrationErrors(errors);
}

test.describe('production export hydration', () => {
  // TODO(WEB-001): extend this suite so hard refreshes of /, /profile, /programs, and /updates
  // all fail the production-export run if console.error contains Hydration failed, didn't match,
  // or Minified React error #418. Block production web release until WEB-001 is actually fixed.
  test.todo('WEB-001 hard-refresh /, /profile, /programs, and /updates after persisted demo auth');

  test('seeded recap survives hard refresh without #418', async ({ page }) => {
    const errors = attachConsole(page);
    await seedParentWithSentRecap(page);
    await hardRefreshAndAssert(page, '/updates', /SESSION RECAP/, errors);
    await hardRefreshAndAssert(page, '/', /Coach updates/, errors);
    await hardRefreshAndAssert(page, '/profile', /Preview roles/, errors);
    await hardRefreshAndAssert(page, '/updates', /SESSION RECAP/, errors);
  });
});
