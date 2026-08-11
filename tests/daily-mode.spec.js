// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoApp, expectNoHorizontalOverflow, expectReachable, STORAGE_KEY, APP_PATH } = require('./helpers');

/**
 * Daily Minimum mode and program pause/resume.
 *
 * The design rules under test come from BJ Fogg's Tiny Habits:
 * the floor is the commitment (passing it banks the day), one grace day a
 * week absorbs a miss, and a paused program resumes without collecting
 * missed sessions.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Seed a Daily Minimum program starting on a past Monday. */
async function seedDaily(page, opts = {}) {
  const { weeksBack = 1, daily = {}, completeDays = [], programWeeks = 12, completeAllPast = false } = opts;
  await page.addInitScript(({ weeksBack, daily, completeDays, programWeeks, completeAllPast, STORAGE_KEY }) => {
    localStorage.setItem('install_guide_seen', '1');
    const p = (n) => String(n).padStart(2, '0');
    const ds = (d) => d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) - weeksBack * 7);
    const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const completed = {};
    // completeAllPast leaves no miss behind, so the week's grace is untouched
    const offsets = completeAllPast
      ? Array.from({ length: Math.round((today - monday) / 86400000) }, (_, i) => i + 1)
      : completeDays;
    // offsets count days back from today; the key is week + weekday
    for (const back of offsets) {
      const d = new Date(today);
      d.setDate(today.getDate() - back);
      const week = Math.floor((d - monday) / (7 * 86400000)) + 1;
      const wd = dayKeys[(d.getDay() + 6) % 7];
      completed[week + '-' + wd] = new Date(d.getTime() + 3600000).toISOString();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      startDate: ds(monday),
      program: 'daily',
      programWeeks,
      days: dayKeys,
      daily: Object.assign({ target: 2, floor: 1, warmup: false, cooldown: false, restSec: 60 }, daily),
      maxHR: 176, swaps: {}, completed, defaultTimes: {}, sessionTimes: {},
    }));
  }, { weeksBack, daily, completeDays, programWeeks, completeAllPast, STORAGE_KEY });
  await page.goto(APP_PATH);
  await expect(page.locator('#schedule')).toHaveClass(/active/);
}

const readData = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);

test.describe('Daily Minimum setup', () => {
  test('the daily card opens its own options and stores them', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.program-card[data-prog="daily"]').click();
    await page.locator('#progNextBtn').click();

    await expect(page.locator('#dailySection')).toBeVisible();
    await expect(page.locator('#dailyEstimate')).toContainText('min a day');
    await expectReachable(page.locator('#dailyFloorBtns button[data-val="1"]'), 'floor picker');
    await expectNoHorizontalOverflow(page, 'daily setup step');

    // All seven days preselected: the program is meant to be every day
    await expect(page.locator('#dayPicker .day-btn.selected')).toHaveCount(7);
    await expect(page.locator('#numDaysBtns button[data-val="7"]')).toBeVisible();

    await page.locator('#dailyTargetBtns button[data-val="3"]').click();
    await page.locator('#dailyRestBtns button[data-val="30"]').click();
    await page.locator('#dailyWeeksBtns button[data-val="4"]').click();
    await page.locator('#dailyWarmup').check();

    await page.locator('#daysNextBtn').click();
    await page.locator('#dateInput').fill(await page.evaluate(() => {
      const d = new Date();
      const q = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + q(d.getMonth() + 1) + '-' + q(d.getDate());
    }));
    await page.locator('#onboardBtn').click();
    await expect(page.locator('#schedule')).toHaveClass(/active/);

    const data = await readData(page);
    expect(data.program).toBe('daily');
    expect(data.programWeeks).toBe(4);
    expect(data.daily).toMatchObject({ target: 3, floor: 1, restSec: 30, warmup: true, cooldown: false });
    expect(data.days).toHaveLength(7);
    await expect(page.locator('#progBadge')).toContainText('4w');
    await expect(page.locator('.week-group')).toHaveCount(4);
  });

  test('the floor can never exceed the target', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.program-card[data-prog="daily"]').click();
    await page.locator('#progNextBtn').click();
    // A floor above the target is unreachable from the start
    await expect(page.locator('#dailyFloorBtns button[data-val="3"]')).toBeDisabled();
    await page.locator('#dailyTargetBtns button[data-val="3"]').click();
    await page.locator('#dailyFloorBtns button[data-val="3"]').click();
    await expect(page.locator('#dailyFloorBtns button[data-val="3"]')).toHaveClass(/selected/);
    // Lowering the target pulls the floor down with it
    await page.locator('#dailyTargetBtns button[data-val="1"]').click();
    await expect(page.locator('#dailyFloorBtns button[data-val="3"]')).toBeDisabled();
    await expect(page.locator('#dailyFloorBtns button[data-val="1"]')).toHaveClass(/selected/);
    await expect(page.locator('#dailyEstimate')).toContainText('About 5 min a day.');
  });
});

test.describe('Daily banner', () => {
  test('shows the floor and the target, and offers a floor-only session', async ({ page }) => {
    await seedDaily(page, { weeksBack: 0, completeAllPast: true, daily: { target: 2, floor: 1 } });
    const banner = page.locator('.sched-today-banner.daily');
    await expect(banner).toBeVisible();
    await expect(banner.locator('.dose-item.floor .dose-num')).toHaveText('1');
    await expect(banner.locator('.dose-item.floor')).toContainText('counts the day');
    await expect(banner.locator('.dose-item').nth(1).locator('.dose-num')).toHaveText('2');
    await expect(page.locator('#floorOnlyBtn')).toContainText('JUST THE FLOOR');
    await expect(banner).toContainText('grace day left');
    // No streak-at-risk pressure in daily mode
    await expect(banner.locator('.streak-warning')).toHaveCount(0);
    await expectNoHorizontalOverflow(page, 'daily today banner');
    await expectReachable(page.locator('#todayStartBtn'), 'daily start button');
  });

  test('floor equal to target hides the floor-only shortcut', async ({ page }) => {
    await seedDaily(page, { daily: { target: 1, floor: 1 } });
    await expect(page.locator('.sched-today-banner.daily')).toBeVisible();
    await expect(page.locator('#floorOnlyBtn')).toHaveCount(0);
  });

  test('a spent grace day still reads as encouragement, not a warning', async ({ page }) => {
    // A week begun last Monday with nothing done has already used its grace
    await seedDaily(page, { weeksBack: 1 });
    const banner = page.locator('.sched-today-banner.daily');
    await expect(banner).toContainText('Grace used this week');
    await expect(banner).toContainText('the floor keeps the chain alive');
    await expect(banner.locator('.streak-warning')).toHaveCount(0);
  });
});

test.describe('Banking the floor', () => {
  /** Tap SKIP until the floor banner appears, or give up after `limit` taps. */
  async function skipToFloor(page, limit = 30) {
    for (let i = 0; i < limit; i++) {
      if (await page.locator('#floorBanner.on').count()) return i;
      await page.locator('#skipBtn').click();
    }
    return -1;
  }

  test('passing the floor banks the day mid-session and celebrates it', async ({ page }) => {
    await seedDaily(page, { daily: { target: 2, floor: 1 } });
    await page.locator('#todayStartBtn').click();
    await expect(page.locator('#timer')).toHaveClass(/active/);

    // No warm-up in daily mode by default: the first phase is the countdown
    await expect(page.locator('#phaseName')).toHaveText('GET READY');

    const taps = await skipToFloor(page);
    expect(taps, 'floor banner should appear while the session is still running').toBeGreaterThan(0);
    await expect(page.locator('#floorBanner')).toContainText('Day banked');
    await expect(page.locator('#timer')).toHaveClass(/active/);

    // The day is recorded before FINISH is ever pressed
    const data = await readData(page);
    const key = Object.keys(data.completed);
    expect(key).toHaveLength(1);
    expect(key[0]).toMatch(/^\d+-(mon|tue|wed|thu|fri|sat|sun)$/);
    await expectNoHorizontalOverflow(page, 'timer with the floor banner');
  });

  test('stopping after the floor keeps the day, and STOP says so', async ({ page }) => {
    await seedDaily(page, { daily: { target: 2, floor: 1 } });
    await page.locator('#todayStartBtn').click();
    await skipToFloor(page);

    await page.locator('#stopBtn').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/active/);
    await expect(page.locator('#confirmMsg')).toContainText('already banked');
    await page.locator('#confirmOk').click();
    await expect(page.locator('#schedule')).toHaveClass(/active/);

    const data = await readData(page);
    expect(Object.keys(data.completed)).toHaveLength(1);
    // The banked day now shows as done, so today's banner is gone
    await expect(page.locator('.sched-today-banner.daily')).toHaveCount(0);
  });

  test('a floor-only session is the whole commitment and banks at the end', async ({ page }) => {
    await seedDaily(page, { daily: { target: 3, floor: 1 } });
    await page.locator('#floorOnlyBtn').click();
    await expect(page.locator('#timer')).toHaveClass(/active/);
    // One block only: no rest phase is built, so the session is short
    await page.locator('#finishBtn').click();
    await expect(page.locator('#done')).toHaveClass(/active/);
    await expect(page.locator('#summaryBox')).toContainText('Blocks');
    const data = await readData(page);
    expect(Object.keys(data.completed)).toHaveLength(1);
  });
});

test.describe('Grace day', () => {
  test('one missed day per week does not break the streak', async ({ page }) => {
    // Eight days completed, with the single gap at yesterday
    const done = [0, 2, 3, 4, 5, 6, 7, 8];
    await seedDaily(page, { weeksBack: 2, completeDays: done });
    await expect(page.locator('.habit-streak b')).toHaveText('🔥 ' + done.length);
    await expect(page.locator('.habit-streak')).toContainText('grace');
  });

  test('a second miss in the same week ends the streak', async ({ page }) => {
    // Grace is granted per program week (Mon-Sun), so both gaps must land in
    // one week. The last two days of the previous week always do, whatever
    // weekday the test runs on.
    const sinceMonday = await page.evaluate(() => (new Date().getDay() + 6) % 7);
    const thisWeek = Array.from({ length: sinceMonday + 1 }, (_, i) => i);
    const beforeGaps = [3, 4, 5, 6, 7].map((n) => sinceMonday + n);
    await seedDaily(page, { weeksBack: 2, completeDays: thisWeek.concat(beforeGaps) });
    // Grace bridges the first gap; the second one in the same week stops the count
    await expect(page.locator('.habit-streak b')).toHaveText('🔥 ' + thisWeek.length);
    await expect(page.locator('.habit-streak')).toContainText('grace');
  });
});

test.describe('Pause and resume', () => {
  test('pausing archives the program and resuming shifts its dates forward', async ({ page }) => {
    // A 4-week-old intermediate program with week 1 finished
    await page.addInitScript(({ STORAGE_KEY }) => {
      localStorage.setItem('install_guide_seen', '1');
      const p = (n) => String(n).padStart(2, '0');
      const ds = (d) => d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const dow = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) - 28);
      const days = ['mon', 'wed', 'fri'];
      const completed = {};
      days.forEach((d) => { completed['1-' + d] = new Date().toISOString(); });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        startDate: ds(monday), program: 'intermediate', days, programName: 'Winter Block',
        maxHR: 176, swaps: {}, completed, defaultTimes: {}, sessionTimes: {},
      }));
    }, { STORAGE_KEY });
    await page.goto(APP_PATH);
    await expect(page.locator('#schedule')).toHaveClass(/active/);
    // Four weeks away leaves a long trail of missed sessions behind
    const missedBefore = await page.locator('.wd-miss').count();
    expect(missedBefore).toBeGreaterThanOrEqual(6);

    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await expectReachable(page.locator('#pauseProgBtn'), 'Pause Program row');
    await page.locator('#pauseProgBtn').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/active/);
    await expect(page.locator('#confirmMsg')).toContainText('Program History');
    await page.locator('#confirmOk').click();

    // Pausing leaves no active program, so onboarding takes over
    await expect(page.locator('#onboarding')).toHaveClass(/active/);
    let data = await readData(page);
    expect(data.program).toBeUndefined();
    expect(data.archive).toHaveLength(1);
    expect(data.archive[0].pausedAt).toBeTruthy();

    // Start the daily program in its place
    await page.locator('.program-card[data-prog="daily"]').click();
    await page.locator('#progNextBtn').click();
    await page.locator('#daysNextBtn').click();
    await page.locator('#dateInput').fill(await page.evaluate(() => {
      const d = new Date();
      const q = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + q(d.getMonth() + 1) + '-' + q(d.getDate());
    }));
    await page.locator('#onboardBtn').click();
    await expect(page.locator('#schedule')).toHaveClass(/active/);
    await expect(page.locator('#progBadge')).toContainText('Daily Minimum');

    // The paused program is listed as paused
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await page.locator('#historyBtn').click();
    const entry = page.locator('.history-entry', { hasText: 'Winter Block' });
    await expect(entry).toContainText('paused');
    await expectNoHorizontalOverflow(page, 'history modal with a paused entry');

    await entry.locator('.history-resume').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/active/);
    await page.locator('#confirmOk').click();
    await expect(page.locator('#schedule')).toHaveClass(/active/);
    await expect(page.locator('#progName')).toHaveText('Winter Block');

    // Week 1 was done, so week 2 lands on the current week (or the next one
    // when nothing of the current week is left).
    data = await readData(page);
    const mondays = await page.evaluate(() => {
      const q = (n) => String(n).padStart(2, '0');
      const ds = (d) => d.getFullYear() + '-' + q(d.getMonth() + 1) + '-' + q(d.getDate());
      const t = new Date(); t.setHours(0, 0, 0, 0);
      const dw = t.getDay();
      const mon = new Date(t);
      mon.setDate(t.getDate() - (dw === 0 ? 6 : dw - 1) - 7);
      const next = new Date(mon); next.setDate(mon.getDate() + 7);
      return { thisWeek: ds(mon), nextWeek: ds(next) };
    });
    expect([mondays.thisWeek, mondays.nextWeek]).toContain(data.startDate);
    // Completion records survived the shift because keys are week-based
    expect(Object.keys(data.completed).sort()).toEqual(['1-fri', '1-mon', '1-wed']);
    // The four-week gap no longer reads as missed sessions: at most the days
    // of the current week that had already passed when the program resumed.
    const missedAfter = await page.locator('.wd-miss').count();
    expect(missedAfter).toBeLessThanOrEqual(2);
    // Something is always still ahead
    await expect(page.locator('.session-card.today, .session-card.future').first()).toBeVisible();
  });

  test('a paused program survives a reload with no active program', async ({ page }) => {
    await page.addInitScript(({ STORAGE_KEY }) => {
      localStorage.setItem('install_guide_seen', '1');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        archive: [{
          startDate: '2026-01-05', program: 'intermediate', days: ['mon', 'wed', 'fri'],
          completed: {}, swaps: {}, programName: 'Parked', pausedAt: '2026-02-01T10:00:00.000Z',
          archivedAt: '2026-02-01T10:00:00.000Z',
        }],
      }));
    }, { STORAGE_KEY });
    await page.goto(APP_PATH);
    await expect(page.locator('#onboarding')).toHaveClass(/active/);
    const data = await readData(page);
    expect(data && data.archive).toHaveLength(1);
    expect(data.archive[0].programName).toBe('Parked');
  });
});
