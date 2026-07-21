// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoApp, expectNoHorizontalOverflow, expectReachable, completeOnboarding } = require('./helpers');

test.describe('Onboarding', () => {
  test('step 1 (program choice): all controls fit the phone', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#onboarding')).toHaveClass(/active/);
    await expectReachable(page.locator('#onboarding h1'), 'App title');
    for (const prog of ['beginner', 'intermediate', 'advanced']) {
      await expectReachable(page.locator(`.program-card[data-prog="${prog}"]`), `${prog} program card`);
    }
    await expectReachable(page.locator('#progNextBtn'), 'NEXT button');
    await expectReachable(page.locator('#onboardCloudBtn'), 'Sign in to sync button');
    await expectReachable(page.locator('#onboardImportBtn'), 'Import Progress button');
    await expectNoHorizontalOverflow(page, 'onboarding step 1');
  });

  test('cloud sign-in modal opens from onboarding and fits', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#onboardCloudBtn').click();
    await expect(page.locator('#cloudOverlay')).toHaveClass(/active/);
    await expectReachable(page.locator('#cloudEmail'), 'email input');
    await expectReachable(page.locator('#cloudSendBtn'), 'send code button');
    await expectNoHorizontalOverflow(page, 'cloud sign-in modal');
    await page.locator('#cloudCloseBtn').click();
    await expect(page.locator('#cloudOverlay')).not.toHaveClass(/active/);
  });

  test('step 2 (training days): day picker fits and is tappable', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#progNextBtn').click();
    await expect(page.locator('#stepDays')).toHaveClass(/active/);
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      await expectReachable(page.locator(`#dayPicker .day-btn[data-day="${day}"]`), `${day} button`);
    }
    await expectReachable(page.locator('#numDaysBtns'), 'sessions-per-week buttons');
    await expectReachable(page.locator('#daysNextBtn'), 'NEXT button');
    await expectReachable(page.locator('#daysBackBtn'), 'Back button');
    await expectNoHorizontalOverflow(page, 'onboarding step 2');
  });

  test('step 3 (date + max HR): inputs fit and accept values', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#progNextBtn').click();
    await page.locator('#daysNextBtn').click();
    await expect(page.locator('#stepDate')).toHaveClass(/active/);
    await expectReachable(page.locator('#dateInput'), 'date input');
    await expectReachable(page.locator('#maxHrInput'), 'max HR input');
    await expectReachable(page.locator('#onboardBtn'), 'START PROGRAM button');
    await expectNoHorizontalOverflow(page, 'onboarding step 3');
  });

  test('full onboarding flow reaches the schedule', async ({ page }) => {
    await gotoApp(page);
    await completeOnboarding(page);
    await expect(page.locator('#weekGrid .week-group').first()).toBeVisible();
    await expectNoHorizontalOverflow(page, 'schedule after onboarding');
  });
});

test.describe('Schedule screen', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await expect(page.locator('#schedule')).toHaveClass(/active/);
  });

  test('header, progress and today-banner fit the phone', async ({ page }) => {
    await expectReachable(page.locator('#progName'), 'program name');
    await expectReachable(page.locator('#helpBtn'), 'help button');
    await expectReachable(page.locator('.sched-progress'), 'progress bar');
    await expectReachable(page.locator('#todayStartBtn'), "START TODAY'S SESSION button");
    await expectReachable(page.locator('#walkBtn'), 'Start a Walk button');
    // Walk button sits above the week grid, not below it
    const walkY = (await page.locator('#walkBtn').boundingBox()).y;
    const gridY = (await page.locator('#weekGrid').boundingBox()).y;
    expect(walkY, 'walk button should be above the week grid').toBeLessThan(gridY);
    await expectNoHorizontalOverflow(page, 'schedule top');
  });

  test('tab bar: all four tabs visible, switch screens, hidden during workout', async ({ page }) => {
    await expect(page.locator('#tabBar')).toBeVisible();
    for (const tab of ['#schedule', '#progress', '#connect', '#settings']) {
      await expectReachable(page.locator(`.tab-btn[data-tab="${tab}"]`), `${tab} tab`);
    }
    await page.locator('.tab-btn[data-tab="#progress"]').click();
    await expect(page.locator('#progress')).toHaveClass(/active/);
    await expectReachable(page.locator('#progress h1'), 'progress heading');
    await expectReachable(page.locator('#progress .finish-stats'), 'lifetime stats block');
    await page.locator('.tab-btn[data-tab="#connect"]').click();
    await expect(page.locator('#connect')).toHaveClass(/active/);
    await expectReachable(page.locator('#pm5Btn'), 'PM5 connect button');
    await expectReachable(page.locator('#hrBtn'), 'HR strap button');
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await expect(page.locator('#settings')).toHaveClass(/active/);
    await page.locator('.tab-btn[data-tab="#schedule"]').click();
    await expect(page.locator('#schedule')).toHaveClass(/active/);
    // During a workout the bar must disappear
    await page.locator('#todayStartBtn').click();
    await expect(page.locator('#timer')).toHaveClass(/active/);
    await expect(page.locator('#tabBar')).not.toBeVisible();
  });

  test('week accordion: current week open, others collapse and expand on tap', async ({ page }) => {
    const weekGroups = page.locator('.week-group');
    const count = await weekGroups.count();
    expect(count, 'schedule should render all program weeks').toBeGreaterThanOrEqual(7);
    // Exactly one week (the current one) starts expanded
    expect(await page.locator('.week-group:not(.collapsed)').count(), 'only the current week should start expanded').toBe(1);
    await expect(page.locator('.week-group:not(.collapsed) .session-card').first()).toBeVisible();
    // Collapsed weeks show their label row and expand on tap
    const wk = await page.locator('.week-group.collapsed').first().getAttribute('data-week');
    const group = page.locator(`.week-group[data-week="${wk}"]`);
    await expectReachable(group.locator('.week-label'), 'collapsed week label');
    await group.locator('.week-label').click();
    await expect(group).not.toHaveClass(/collapsed/);
    await expectReachable(group.locator('.session-card').first(), 'card in expanded week');
    await expectNoHorizontalOverflow(page, 'schedule week grid');
  });

  test('every week and session card is reachable and fits', async ({ page }) => {
    // Expand all weeks first (accordion collapses non-current weeks)
    const collapsedLabels = page.locator('.week-group.collapsed .week-label');
    while (await collapsedLabels.count()) {
      await collapsedLabels.first().click();
    }
    const weekGroups = page.locator('.week-group');
    const count = await weekGroups.count();
    for (let i = 0; i < count; i++) {
      await expectReachable(weekGroups.nth(i).locator('.week-label'), `week ${i + 1} label`);
    }
    // Session cards: check the first, one mid-program and the last
    const cards = page.locator('.session-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(20);
    for (const idx of [0, Math.floor(cardCount / 2), cardCount - 1]) {
      await expectReachable(cards.nth(idx), `session card ${idx}`);
    }
    await expectNoHorizontalOverflow(page, 'schedule week grid');
  });

  test('settings tab: every control is reachable', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await expect(page.locator('#settings')).toHaveClass(/active/);
    for (const [sel, label] of [
      ['#changProgBtn', 'Change Program button'],
      ['#changeDaysBtn', 'Change Training Days button'],
      ['#defTimesBtn', 'Set Default Times button'],
      ['#maxHrEdit', 'max HR input'],
      ['#maxHrSaveBtn', 'max HR save button'],
      ['#remindersBtn', 'reminders button'],
      ['#cloudBtn', 'cloud sync button'],
      ['#exportBtn', 'Export button'],
      ['#importBtn', 'Import button'],
      ['#resetBtn', 'Reset button'],
    ]) {
      await expectReachable(page.locator(sel), label);
    }
    await expectNoHorizontalOverflow(page, 'settings screen');
  });

  test('help overlay opens, fits, and closes', async ({ page }) => {
    await page.locator('#helpBtn').click();
    await expect(page.locator('#helpOverlay')).toHaveClass(/active/);
    await expectReachable(page.locator('#helpBox h2'), 'help title');
    await expectReachable(page.locator('#helpClose'), 'help close button');
    // Open every collapsible section and confirm content fits
    const sections = page.locator('#helpBox details');
    const n = await sections.count();
    for (let i = 0; i < n; i++) {
      const details = sections.nth(i);
      if (!(await details.getAttribute('open'))) await details.locator('summary').click();
    }
    await expectNoHorizontalOverflow(page, 'help overlay expanded');
    await page.locator('#helpClose').click();
    await expect(page.locator('#helpOverlay')).not.toHaveClass(/active/);
  });

  test('change training days modal fits', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await page.locator('#changeDaysBtn').click();
    await expect(page.locator('#changeDaysOverlay')).toHaveClass(/active/);
    await expectReachable(page.locator('#cdDayPicker'), 'day picker in modal');
    await expectReachable(page.locator('#changeDaysSave'), 'save button');
    await expectReachable(page.locator('#changeDaysCancel'), 'cancel button');
    // Time editor inputs must be dark-themed, not native white
    const timeInput = page.locator('#changeDaysOverlay .te-input').first();
    await expect(timeInput, 'time editor should render in the modal').toBeVisible();
    const luminance = await timeInput.evaluate((el) => {
      const rgb = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number);
      return rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
    });
    expect(luminance, 'time input background should be dark-themed, not native white').toBeLessThan(100);
    await expectNoHorizontalOverflow(page, 'change days modal');
    await page.locator('#changeDaysCancel').click();
  });

  test('default times modal fits', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await page.locator('#defTimesBtn').click();
    await expect(page.locator('#defTimesOverlay')).toHaveClass(/active/);
    await expectReachable(page.locator('#defTimesList'), 'times list');
    await expectReachable(page.locator('#defTimesSave'), 'save button');
    // Every time input in the modal (incl. the gradual-goal input) must be dark-themed
    const badInputs = await page.locator('#defTimesOverlay').evaluate((overlay) => {
      const bad = [];
      for (const inp of overlay.querySelectorAll('input[type="time"]')) {
        const rgb = getComputedStyle(inp).backgroundColor.match(/\d+/g).map(Number);
        const luminance = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
        if (luminance >= 100) bad.push((inp.id || inp.className) + ' luminance ' + Math.round(luminance));
      }
      return bad;
    });
    expect(badInputs, 'time inputs rendering with a light/native background').toEqual([]);
    await expectNoHorizontalOverflow(page, 'default times modal');
    await page.locator('#defTimesCancel').click();
  });

  test('session swap modal fits', async ({ page }) => {
    const swap = page.locator('.session-card .s-swap').first();
    await swap.scrollIntoViewIfNeeded();
    await swap.click();
    await expect(page.locator('#swapOverlay')).toHaveClass(/active/);
    await expectNoHorizontalOverflow(page, 'swap modal');
  });

  test('reset confirmation dialog fits', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await page.locator('#resetBtn').scrollIntoViewIfNeeded();
    await page.locator('#resetBtn').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/active/);
    await expectReachable(page.locator('#confirmMsg'), 'confirm message');
    await expectReachable(page.locator('#confirmOk'), 'OK button');
    await expectReachable(page.locator('#confirmCancel'), 'Cancel button');
    await expectNoHorizontalOverflow(page, 'confirm dialog');
    await page.locator('#confirmCancel').click();
  });
});

test.describe('Timer and done screens', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await page.locator('#todayStartBtn').click();
    await expect(page.locator('#timer')).toHaveClass(/active/);
  });

  test('timer: countdown and all controls visible WITHOUT scrolling', async ({ page }) => {
    // During a workout nothing may require scrolling - hands are busy
    const vh = await page.evaluate(() => document.documentElement.clientHeight);
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    for (const [sel, label] of [
      ['#phaseLabel', 'phase label'],
      ['#countdown', 'countdown'],
      ['#pauseBtn', 'PAUSE button'],
      ['#skipBtn', 'SKIP button'],
      ['#finishBtn', 'FINISH button'],
      ['#stopBtn', 'STOP button'],
    ]) {
      const el = page.locator(sel);
      await expect(el, `${label} should be visible`).toBeVisible();
      const box = await el.boundingBox();
      expect(box, `${label} bounding box`).toBeTruthy();
      expect(box.y, `${label} above viewport`).toBeGreaterThanOrEqual(-2);
      expect(box.y + box.height, `${label} extends below the fold (ends at ${Math.round(box.y + box.height)}, viewport height ${vh})`).toBeLessThanOrEqual(vh + 2);
      expect(box.x, `${label} clipped left`).toBeGreaterThanOrEqual(-2);
      expect(box.x + box.width, `${label} clipped right`).toBeLessThanOrEqual(vw + 2);
    }
    await expectNoHorizontalOverflow(page, 'timer screen');
  });

  test('timer button labels are horizontally centered in their buttons', async ({ page }) => {
    // A label wider than the button's content box overflows to the RIGHT in
    // LTR (centered lines become start-aligned on overflow), so the text hugs
    // the left padding and crowds the right border. Guard: the label must fit
    // and sit symmetrically.
    const rows = await page.evaluate(() => {
      const out = [];
      for (const btn of document.querySelectorAll('.timer-btn')) {
        const b = btn.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(btn);
        const t = range.getBoundingClientRect();
        out.push({ label: btn.textContent, leftGap: t.left - b.left, rightGap: b.right - t.right });
      }
      return out;
    });
    for (const r of rows) {
      expect(Math.abs(r.leftGap - r.rightGap),
        `${r.label} label off-center: ${r.leftGap.toFixed(1)}px left vs ${r.rightGap.toFixed(1)}px right`).toBeLessThanOrEqual(2.5);
      expect(r.leftGap, `${r.label} label overflows its button`).toBeGreaterThan(0);
      expect(r.rightGap, `${r.label} label overflows its button`).toBeGreaterThan(0);
    }
  });

  test('pause and resume work on tap', async ({ page }) => {
    await page.locator('#pauseBtn').click();
    await expect(page.locator('#pauseBtn')).toHaveText('RESUME');
    await page.locator('#pauseBtn').click();
    await expect(page.locator('#pauseBtn')).toHaveText('PAUSE');
  });

  test('done screen after FINISH: summary and buttons fit', async ({ page }) => {
    await page.locator('#finishBtn').click();
    // FINISH may ask for confirmation via the custom dialog
    const confirm = page.locator('#confirmOverlay.active #confirmOk');
    if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirm.click();
    }
    await expect(page.locator('#done')).toHaveClass(/active/);
    await expectReachable(page.locator('#done h2'), 'WORKOUT COMPLETE heading');
    await expectReachable(page.locator('#summaryBox'), 'summary box');
    await expectReachable(page.locator('#doneBackBtn'), 'Back to Schedule button');
    await expectNoHorizontalOverflow(page, 'done screen');
    // Milestone celebrations may pop ~1.2s after finishing; dismiss them first
    await page.waitForTimeout(1400);
    for (let i = 0; i < 5; i++) {
      const ok = page.locator('#confirmOverlay.active #confirmOk');
      if (await ok.isVisible().catch(() => false)) { await ok.click(); await page.waitForTimeout(250); }
      else break;
    }
    // And back-navigation must land on the schedule
    await page.locator('#doneBackBtn').click();
    await expect(page.locator('#schedule')).toHaveClass(/active/);
  });
});

test.describe('Install guide', () => {
  test('first-visit install guide fits and can be dismissed', async ({ page }) => {
    await gotoApp(page, { showInstallGuide: true });
    await expect(page.locator('#installGuide')).toHaveClass(/active/);
    await expectReachable(page.locator('#installDismiss'), 'dismiss button');
    await expectNoHorizontalOverflow(page, 'install guide');
    await page.locator('#installDismiss').click();
    await expect(page.locator('#installGuide')).not.toHaveClass(/active/);
  });
});

test.describe('Advanced program', () => {
  test('steady-state sessions render and fit', async ({ page }) => {
    await gotoApp(page, { seedProgram: true, program: 'advanced' });
    await expect(page.locator('#schedule')).toHaveClass(/active/);
    const steadyCards = page.locator('.session-card.steady');
    expect(await steadyCards.count(), 'advanced program should show steady-state cards').toBeGreaterThanOrEqual(7);
    await expectReachable(steadyCards.first(), 'first steady-state card');
    await expectNoHorizontalOverflow(page, 'advanced schedule');
  });
});
