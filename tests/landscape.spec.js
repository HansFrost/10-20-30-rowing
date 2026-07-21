// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoApp, expectNoHorizontalOverflow } = require('./helpers');

// Runs only in the landscape project (see testMatch in playwright.config.js).
// A phone mounted sideways on a rowing machine is a realistic setup, so the
// timer must stay fully visible in landscape too.
test('timer controls stay on-screen in landscape', async ({ page }) => {
  await gotoApp(page, { seedProgram: true });
  await page.locator('#todayStartBtn').click();
  await expect(page.locator('#timer')).toHaveClass(/active/);
  const vh = await page.evaluate(() => document.documentElement.clientHeight);
  for (const sel of ['#countdown', '#pauseBtn', '#skipBtn', '#finishBtn', '#stopBtn']) {
    const el = page.locator(sel);
    await expect(el).toBeVisible();
    const box = await el.boundingBox();
    expect(box.y + box.height, `${sel} extends below the landscape fold`).toBeLessThanOrEqual(vh + 2);
  }
  await expectNoHorizontalOverflow(page, 'timer landscape');
});
