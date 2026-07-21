// @ts-check
const { expect } = require('@playwright/test');

const APP_PATH = '/10-20-30_rowing_timer.html';
const STORAGE_KEY = 'rowing-102030-schedule';

/**
 * Open the app. Marks the install guide as seen (it auto-opens on first
 * visit) unless opts.showInstallGuide is set. With opts.seedProgram, a
 * program is written to localStorage first so the app boots straight to
 * the schedule screen, with today as a training day.
 */
async function gotoApp(page, opts = {}) {
  const { seedProgram = false, showInstallGuide = false, program = 'intermediate', restToday = false, customName = '' } = opts;
  await page.addInitScript(({ seedProgram, showInstallGuide, program, restToday, customName, STORAGE_KEY }) => {
    if (!showInstallGuide) localStorage.setItem('install_guide_seen', '1');
    if (seedProgram) {
      const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const today = new Date();
      const monday = new Date(today);
      const dow = today.getDay();
      monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      // Today is a training day by default; restToday makes it a rest day
      const days = restToday
        ? dayKeys.filter((d) => d !== dayKeys[dow]).slice(0, 3)
        : [...new Set([dayKeys[dow], 'mon', 'wed', 'fri'])].slice(0, 3);
      const data = {
        startDate: dateStr(monday),
        program,
        days,
        maxHR: 176,
        swaps: {},
        completed: {},
        defaultTimes: {},
        sessionTimes: {},
      };
      if (program === 'advanced') data.steadyDay = days.find((d) => d !== dayKeys[dow]) || 'sun';
      if (customName) data.programName = customName;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, { seedProgram, showInstallGuide, program, restToday, customName, STORAGE_KEY });
  await page.goto(APP_PATH);
}

/**
 * The page must never scroll horizontally: everything has to fit the
 * phone's width. Checks the document and the currently active screen.
 */
async function expectNoHorizontalOverflow(page, context = 'page') {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const docOverflow = doc.scrollWidth - doc.clientWidth;
    let worst = { selector: 'document', overflow: docOverflow };
    // Any element extending past the viewport's right edge (or left of 0)
    const vw = doc.clientWidth;
    for (const el of document.querySelectorAll('.screen.active, .screen.active *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const over = Math.max(r.right - vw, -r.left);
      if (over > worst.overflow) {
        worst = {
          selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
            (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : ''),
          overflow: over,
        };
      }
    }
    return worst;
  });
  expect(overflow.overflow, `${context}: "${overflow.selector}" extends ${Math.round(overflow.overflow)}px past the viewport edge`).toBeLessThanOrEqual(2);
}

/**
 * Element must be reachable and fully inside the viewport horizontally
 * (scrolling vertically to it first is allowed - that is normal phone UX).
 */
async function expectReachable(locator, label) {
  await expect(locator, `${label} should be visible`).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, `${label} should have a bounding box`).toBeTruthy();
  const vw = await locator.page().evaluate(() => document.documentElement.clientWidth);
  const vh = await locator.page().evaluate(() => document.documentElement.clientHeight);
  expect(box.x, `${label} clipped on the left`).toBeGreaterThanOrEqual(-2);
  expect(box.x + box.width, `${label} clipped on the right (box ends at ${Math.round(box.x + box.width)}, viewport is ${vw})`).toBeLessThanOrEqual(vw + 2);
  expect(box.y + box.height, `${label} below the viewport after scroll`).toBeLessThanOrEqual(vh + 2);
  expect(box.width, `${label} has zero width`).toBeGreaterThan(0);
  expect(box.height, `${label} has zero height`).toBeGreaterThan(0);
}

/**
 * No element on the active screen may be vertically compressed below its
 * content (the scrollable-flex-column bug: flex children shrink to fit the
 * viewport instead of the screen scrolling, clipping their own content).
 */
async function expectNoVerticalClipping(page, context = 'page') {
  const clipped = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('.screen.active, .screen.active *')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') continue; // scrollers may scroll
      if (el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) {
        bad.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
          (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '') +
          ` content ${el.scrollHeight}px in ${el.clientHeight}px box`);
      }
    }
    return bad.slice(0, 8);
  });
  expect(clipped, `${context}: elements clipping their own content vertically`).toEqual([]);
}

/** Complete onboarding through the UI, landing on the schedule screen. */
async function completeOnboarding(page) {
  await page.locator('.program-card[data-prog="intermediate"]').click();
  await page.locator('#progNextBtn').click();
  // Defaults pre-select 3 days, so NEXT is enabled
  await expect(page.locator('#daysNextBtn')).toBeEnabled();
  await page.locator('#daysNextBtn').click();
  await page.locator('#dateInput').fill(await page.evaluate(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }));
  await page.locator('#onboardBtn').click();
  await expect(page.locator('#schedule')).toHaveClass(/active/);
}

module.exports = { gotoApp, expectNoHorizontalOverflow, expectNoVerticalClipping, expectReachable, completeOnboarding, APP_PATH, STORAGE_KEY };
