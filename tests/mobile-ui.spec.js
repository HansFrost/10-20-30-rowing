// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoApp, expectNoHorizontalOverflow, expectNoVerticalClipping, expectReachable, completeOnboarding, APP_PATH, STORAGE_KEY } = require('./helpers');

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

  test('walk day buttons still work after revisiting step 2', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#progNextBtn').click();
    await page.locator('#daysBackBtn').click();
    await expect(page.locator('#stepProgram')).toHaveClass(/active/);
    await page.locator('#progNextBtn').click();
    const wed = page.locator('#obWalkPicker .day-btn[data-day="wed"]');
    await wed.click();
    await expect(wed, 'walk day should select with a single tap after re-entering step 2').toHaveClass(/selected/);
  });

  test('step 3 (date + max HR): inputs fit and accept values', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#progNextBtn').click();
    await page.locator('#daysNextBtn').click();
    await expect(page.locator('#stepDate')).toHaveClass(/active/);
    await expectReachable(page.locator('#dateInput'), 'date input');
    expect(await page.locator('#dateInput').evaluate((el) => getComputedStyle(el).colorScheme),
      'date input should render dark native UI').toContain('dark');
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
    await expectNoVerticalClipping(page, 'schedule screen');
    // Walk button sits above the week grid, not below it
    const walkY = (await page.locator('#walkBtn').boundingBox()).y;
    const gridY = (await page.locator('#weekGrid').boundingBox()).y;
    expect(walkY, 'walk button should be above the week grid').toBeLessThan(gridY);
    await expectNoHorizontalOverflow(page, 'schedule top');
  });

  test('rest day: compact banner with a single walk button', async ({ page }) => {
    await gotoApp(page, { seedProgram: true, restToday: true });
    await expect(page.locator('.sched-rest-banner')).toBeVisible();
    await expectReachable(page.locator('#restWalkBtn'), 'walk button in rest banner');
    await expect(page.locator('#walkBtn'), 'standalone walk button should hide when the banner offers a walk').toBeHidden();
    await expectNoHorizontalOverflow(page, 'rest day schedule');
  });

  test('checkmark: recorded sessions are locked, manual check-offs toggle freely', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    // Seed one recorded and one manual completion on past/today sessions
    await page.evaluate((STORAGE_KEY) => {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const days = d.days;
      d.completed['1-' + days[0]] = new Date().toISOString();
      d.sessionStats = { ['1-' + days[0]]: { m: 5000, avgW: 120, blocks: 3 } };
      d.completed['1-' + days[1]] = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    }, STORAGE_KEY);
    // Re-render without reload (reload would re-run the seeding init script)
    await page.locator('.tab-btn[data-tab="#progress"]').click();
    await page.locator('.tab-btn[data-tab="#schedule"]').click();
    const days = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).days, STORAGE_KEY);
    const recorded = page.locator(`.session-card[data-key="1-${days[0]}"]`);
    await expect(recorded).toHaveClass(/completed/);
    await recorded.locator('.s-check').click();
    await expect(page.locator('#confirmOverlay'), 'locked check should explain itself').toHaveClass(/active/);
    await expect(page.locator('#confirmMsg')).toContainText('locked');
    await page.locator('#confirmOk').click();
    expect(await page.evaluate((k) => {
      const d = JSON.parse(localStorage.getItem(k));
      return Object.keys(d.completed).length;
    }, STORAGE_KEY), 'recorded session must stay completed').toBe(2);
    // The manual one (no stats) still toggles off
    const manual = page.locator(`.session-card[data-key="1-${days[1]}"]`);
    await manual.locator('.s-check').click();
    expect(await page.evaluate((k) => Object.keys(JSON.parse(localStorage.getItem(k)).completed).length, STORAGE_KEY),
      'manual check-off should uncheck').toBe(1);
  });

  test('STOP asks for confirmation and cancel keeps the session running', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await page.locator('#todayStartBtn').click();
    await expect(page.locator('#timer')).toHaveClass(/active/);
    await page.locator('#stopBtn').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/active/);
    await page.locator('#confirmCancel').click();
    await expect(page.locator('#timer'), 'cancel should keep the session').toHaveClass(/active/);
    await page.locator('#stopBtn').click();
    await page.locator('#confirmOk').click();
    await expect(page.locator('#schedule'), 'confirm should stop and return').toHaveClass(/active/);
  });

  test('starting a walk registers it on the schedule with date and time', async ({ page }) => {
    await gotoApp(page, { seedProgram: true, restToday: true });
    await page.locator('#restWalkBtn').click();
    await expect(page.locator('#timer')).toHaveClass(/active/);
    // Stop without finishing: the walk card must still exist with a start time
    await page.locator('#stopBtn').click();
    await page.locator('#confirmOk').click();
    await expect(page.locator('#schedule')).toHaveClass(/active/);
    const walkCard = page.locator('.week-group:not(.collapsed) .session-card[data-type="walk"]').first();
    await expect(walkCard, 'stopped walk should still be planned on the schedule').toBeVisible();
    await expect(walkCard.locator('.s-time.has-time'), 'walk card should carry its start time').toBeVisible();
    // The delete control is a comfortably tappable trashcan
    const del = walkCard.locator('.s-delete');
    await expect(del).toBeVisible();
    const box = await del.boundingBox();
    expect(box.width, 'delete tap target width').toBeGreaterThanOrEqual(28);
    expect(box.height, 'delete tap target height').toBeGreaterThanOrEqual(28);
  });

  test('XP strip shows total XP alongside progress to the next level', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await page.evaluate((STORAGE_KEY) => {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
      d.completed['1-' + d.days[0]] = new Date().toISOString();
      d.sessionStats = { ['1-' + d.days[0]]: { m: 5000, blocks: 3 } }; // 100 base + 50 meters + 45 block XP
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    }, STORAGE_KEY);
    await page.locator('.tab-btn[data-tab="#progress"]').click();
    await expect(page.locator('#xpStrip .xp-nums')).toHaveText('195 XP · 195 / 300 to LVL 2');
  });

  test('walk screen shows keep-screen-on hint and flags tracking interruptions', async ({ page }) => {
    await gotoApp(page, { seedProgram: true, restToday: true });
    await page.locator('#restWalkBtn').click();
    await expect(page.locator('#timer')).toHaveClass(/active/);
    const hint = page.locator('#walkHint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Keep the screen on');
    // Simulate the screen locking for >5s, then coming back
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(5300);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(hint).toHaveClass(/warn/);
    await expect(hint).toContainText('Tracking was paused');
  });

  test('long program name truncates instead of wrapping the header', async ({ page }) => {
    await gotoApp(page, { seedProgram: true, customName: 'FitterHappierMoreProductive' });
    const nameBox = await page.locator('#progName').boundingBox();
    const helpBox = await page.locator('#helpBtn').boundingBox();
    expect(helpBox.y, 'help button should stay on the title row, not wrap below').toBeLessThan(nameBox.y + nameBox.height);
    await expectNoHorizontalOverflow(page, 'header with long name');
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
    await expectNoVerticalClipping(page, 'progress screen');
    await page.locator('.tab-btn[data-tab="#connect"]').click();
    await expect(page.locator('#connect')).toHaveClass(/active/);
    await expectReachable(page.locator('#pm5Btn'), 'PM5 connect button');
    await expectReachable(page.locator('#hrBtn'), 'HR strap button');
    // Device rows carry live-status slots that fill with bpm/watts when connected
    await expect(page.locator('#hrLive')).toBeAttached();
    await expect(page.locator('#pm5Live')).toBeAttached();
    expect(await page.locator('#hrLive').textContent(), 'live slot empty while disconnected').toBe('');
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
    // Settings must scroll, never compress its group cards (iPhone clipping bug)
    await expectNoVerticalClipping(page, 'settings screen');
    for (const [sel, label] of [
      ['#changProgBtn', 'Change Program button'],
      ['#historyBtn', 'Program History button'],
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

  test('add-session modal can add a walk to a week', async ({ page }) => {
    await page.locator('.week-group:not(.collapsed) .add-session-btn').click();
    await expect(page.locator('#addSessionOverlay')).toHaveClass(/active/);
    await expectReachable(page.locator('#addSessionTypePicker'), 'session type picker');
    await page.locator('#addSessionTypePicker button[data-stype="walk"]').click();
    await expect(page.locator('#addSessionBlockPicker'), 'blocks picker hides for walks').toBeHidden();
    await page.locator('#addSessionDayPicker .day-btn[data-day="sun"]').click();
    await expectNoHorizontalOverflow(page, 'add session modal');
    await page.locator('#addSessionSave').click();
    await expect(page.locator('#addSessionOverlay')).not.toHaveClass(/active/);
    const walkCard = page.locator('.week-group:not(.collapsed) .session-card[data-type="walk"]').first();
    await expect(walkCard, 'walk card should appear in the week').toBeVisible();
    await expectReachable(walkCard, 'added walk card');
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

  test('changing training days remaps completed, sessionStats and bonusXP keys', async ({ page }) => {
    // Force known days and seed per-session data keyed by them. The app reads
    // localStorage fresh on every handler, so no reload is needed (a reload
    // would re-run the seed init script and wipe this).
    await page.evaluate((KEY) => {
      const d = JSON.parse(localStorage.getItem(KEY));
      d.days = ['mon', 'wed', 'fri'];
      d.completed['2-fri'] = true;
      d.sessionStats = { '2-fri': { m: 1234, w: 87 }, '1-mon': { m: 500, w: 90 } };
      d.bonusXP = { '2-fri': 100 };
      localStorage.setItem(KEY, JSON.stringify(d));
    }, STORAGE_KEY);
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await page.locator('#changeDaysBtn').click();
    await expect(page.locator('#changeDaysOverlay')).toHaveClass(/active/);
    // Move Friday to Saturday
    await page.locator('#cdDayPicker .day-btn[data-day="fri"]').click();
    await page.locator('#cdDayPicker .day-btn[data-day="sat"]').click();
    await expect(page.locator('#changeDaysSave')).toBeEnabled();
    await page.locator('#changeDaysSave').click();
    await expect(page.locator('#changeDaysOverlay')).not.toHaveClass(/active/);
    const after = await page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), STORAGE_KEY);
    expect(after.days).toEqual(['mon', 'wed', 'sat']);
    expect(after.completed['2-sat'], 'completion should follow the moved day').toBe(true);
    expect(after.completed['2-fri']).toBeUndefined();
    expect(after.sessionStats['2-sat'], 'session stats should follow the moved day').toEqual({ m: 1234, w: 87 });
    expect(after.sessionStats['2-fri']).toBeUndefined();
    expect(after.sessionStats['1-mon'], 'stats on unmoved days must be untouched').toEqual({ m: 500, w: 90 });
    expect(after.bonusXP['2-sat'], 'golden-session XP should follow the moved day').toBe(100);
    expect(after.bonusXP['2-fri']).toBeUndefined();
  });

  test('default times modal fits', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await page.locator('#defTimesBtn').click();
    await expect(page.locator('#defTimesOverlay')).toHaveClass(/active/);
    await expectReachable(page.locator('#defTimesList'), 'times list');
    await expectReachable(page.locator('#defTimesSave'), 'save button');
    // Every time field in the modal (incl. the gradual-goal input) must be dark-themed
    const badInputs = await page.locator('#defTimesOverlay').evaluate((overlay) => {
      const bad = [];
      for (const inp of overlay.querySelectorAll('time-field, input[type="time"]')) {
        const rgb = getComputedStyle(inp).backgroundColor.match(/\d+/g).map(Number);
        const luminance = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
        if (luminance >= 100) bad.push((inp.id || inp.className) + ' luminance ' + Math.round(luminance));
      }
      return bad;
    });
    expect(badInputs, 'time fields rendering with a light/native background').toEqual([]);
    // Time fields are custom 24h selectors: value round-trips as HH:MM, no native AM/PM control
    const tf = await page.locator('#defTimesOverlay').evaluate((overlay) => {
      const el = overlay.querySelector('.te-input');
      el.value = '18:30';
      return {
        value: el.value,
        hour: el.querySelector('.tf-h').value,
        nativeTimeInputs: overlay.querySelectorAll('input[type="time"]').length,
      };
    });
    expect(tf.value, 'time-field should round-trip 24h values').toBe('18:30');
    expect(tf.hour, 'hour select should hold the 24h hour').toBe('18');
    expect(tf.nativeTimeInputs, 'no locale-dependent native time inputs should remain').toBe(0);
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

  test('program history modal opens, fits, and shows the empty state', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await page.locator('#historyBtn').click();
    await expect(page.locator('#historyOverlay')).toHaveClass(/active/);
    await expectReachable(page.locator('#historyBox .dt-title'), 'history modal title');
    await expectReachable(page.locator('#historyClose'), 'history close button');
    await expect(page.locator('#historyList .history-empty'))
      .toHaveText('Programs you finish or replace will appear here.');
    await expectNoHorizontalOverflow(page, 'program history modal');
    await page.locator('#historyClose').click();
    await expect(page.locator('#historyOverlay')).not.toHaveClass(/active/);
  });

  test('future start date shows a starts banner instead of a rest day', async ({ page }) => {
    // Init scripts run in the order added: this one runs after the seed
    // script from beforeEach's gotoApp, so it can push the start date out.
    await page.addInitScript(() => {
      const d = JSON.parse(localStorage.getItem('rowing-102030-schedule'));
      const start = new Date();
      const dow = start.getDay();
      start.setDate(start.getDate() + ((1 - dow + 7) % 7 || 7)); // next Monday, strictly in the future
      const pad = (n) => String(n).padStart(2, '0');
      d.startDate = start.getFullYear() + '-' + pad(start.getMonth() + 1) + '-' + pad(start.getDate());
      localStorage.setItem('rowing-102030-schedule', JSON.stringify(d));
    });
    await page.reload();
    await expect(page.locator('.sched-rest-banner')).toContainText('Starts Mon');
    await expect(page.locator('.sched-rest-banner')).toContainText('First session:');
    await expectNoHorizontalOverflow(page, 'pre-start schedule');
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

test.describe('Program history', () => {
  test('replacing a program archives it and Resume swaps it back', async ({ page }) => {
    await gotoApp(page, { seedProgram: true, customName: 'Program A' });
    await expect(page.locator('#progName')).toHaveText('Program A');
    // Mark one week-1 session done so the history entry shows a real count.
    // The archive snapshot is taken from localStorage at replace time, so no
    // reload is needed (a reload would re-run the seeding init script).
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('rowing-102030-schedule'));
      d.completed['1-' + d.days[0]] = new Date().toISOString();
      localStorage.setItem('rowing-102030-schedule', JSON.stringify(d));
    });

    // Start program B through the change-program onboarding flow
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await page.locator('#changProgBtn').click();
    await expect(page.locator('#onboarding')).toHaveClass(/active/);
    await page.locator('.program-card[data-prog="beginner"]').click();
    await page.locator('#progNextBtn').click();
    await expect(page.locator('#daysNextBtn')).toBeEnabled();
    await page.locator('#daysNextBtn').click();
    await page.locator('#onboardBtn').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/active/);
    await expect(page.locator('#confirmMsg')).toContainText('Program History');
    await page.locator('#confirmOk').click();
    await expect(page.locator('#schedule')).toHaveClass(/active/);
    await expect(page.locator('#progBadge')).toContainText('Beginner');

    // Program A is archived with its completion count (intermediate: 7w x 3d = 21)
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await page.locator('#historyBtn').click();
    await expect(page.locator('#historyOverlay')).toHaveClass(/active/);
    const entry = page.locator('.history-entry');
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText('Program A');
    await expect(entry).toContainText('Intermediate');
    await expect(entry).toContainText('1 / 21 sessions');
    await expectReachable(entry.locator('.history-resume'), 'Resume button');
    await expectNoHorizontalOverflow(page, 'history modal with an entry');

    // Resume swaps: A becomes active again, B goes into history
    await entry.locator('.history-resume').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/active/);
    await page.locator('#confirmOk').click();
    await expect(page.locator('#schedule')).toHaveClass(/active/);
    await expect(page.locator('#progBadge')).toContainText('Intermediate');
    await expect(page.locator('#progName')).toHaveText('Program A');
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await page.locator('#historyBtn').click();
    await expect(page.locator('.history-entry')).toHaveCount(1);
    await expect(page.locator('.history-entry')).toContainText('Beginner');
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

test.describe('Walk sessions and rowing progression', () => {
  test('walks count neither toward progress nor streak nor habit stage', async ({ page }) => {
    await page.addInitScript(({ KEY }) => {
      localStorage.setItem('install_guide_seen', '1');
      const pad = (n) => String(n).padStart(2, '0');
      const ds = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      // Program started three weeks ago on a Monday
      const monday = new Date();
      const dow = monday.getDay();
      monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1) - 21);
      const day = (off) => { const d = new Date(monday); d.setDate(d.getDate() + off); return ds(d); };
      const iso = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify({
        startDate: ds(monday), program: 'intermediate', days: ['mon', 'wed', 'fri'],
        maxHR: 176, swaps: {}, defaultTimes: {}, sessionTimes: {},
        // Week-1 Tuesday walk planned but skipped; Saturday walk completed
        walkDays: ['tue'], walkStart: ds(monday),
        completed: { '1-mon': iso, '1-wed': iso, ['walk-' + day(5)]: iso },
      }));
    }, { KEY: STORAGE_KEY });
    await page.goto(APP_PATH);
    await expect(page.locator('#schedule')).toHaveClass(/active/);
    // 21 rowing sessions total (7 weeks x 3 days); the completed walk must not count
    await expect(page.locator('#progLabel')).toHaveText('2 / 21 sessions');
    await expect(page.locator('#progPct')).toHaveText('10%');
    // The skipped Tuesday walk must not break the Mon -> Wed rowing streak
    await expect(page.locator('#habitStrip .habit-streak b')).toHaveText('\u{1F525} 2');
    // Habit stage progress counts rowing sessions only (3 completions would show 3 / 4)
    await expect(page.locator('#habitStrip .habit-progress')).toHaveText('2 / 4 to next stage');
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

test.describe('Session log', () => {
  test('shows the empty state before any session is completed', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await page.locator('.tab-btn[data-tab="#progress"]').click();
    await expect(page.locator('#progress')).toHaveClass(/active/);
    await expect(page.locator('#sessionLog')).toContainText('Sessions you complete will appear here with their stats.');
  });

  test('lists completed sessions newest-first with expandable details', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await page.evaluate((KEY) => {
      const data = JSON.parse(localStorage.getItem(KEY));
      const iso = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString(); };
      const pad = (n) => String(n).padStart(2, '0');
      const walkDate = new Date();
      walkDate.setDate(walkDate.getDate() - 1);
      const walkKey = 'walk-' + walkDate.getFullYear() + '-' + pad(walkDate.getMonth() + 1) + '-' + pad(walkDate.getDate());
      // Oldest: manual check-off (no stats). Middle: walk. Newest: full rowing session.
      data.completed = { '1-mon': iso(2), [walkKey]: iso(1), '1-wed': iso(0) };
      data.sessionStats = {
        '1-wed': {
          m: 6420, avgW: 145, peakW: 320, bestSprint: 310, strokes: 812,
          avgHr: 152, maxHr: 174, rateHits: 12, blocks: 3, steady: false,
          sprintPeaks: [280, 310], sprintRates: [31, 32], timeline: [[300, 1200], [1800, 6420]],
        },
        [walkKey]: { walk: true, m: 3200, min: 38, avgHr: 110, maxHr: 128 },
      };
      data.bonusXP = { '1-wed': 100 };
      localStorage.setItem(KEY, JSON.stringify(data));
    }, STORAGE_KEY);
    await page.locator('.tab-btn[data-tab="#progress"]').click();
    await expect(page.locator('#progress')).toHaveClass(/active/);

    const rows = page.locator('#sessionLog .log-row');
    await expect(rows).toHaveCount(3);
    // Newest first: rowing (today), walk (yesterday), manual check-off (2 days ago)
    await expect(rows.nth(0).locator('.log-tag')).toHaveText('Rowing 3 blocks');
    await expect(rows.nth(1).locator('.log-tag')).toHaveText('Walk');
    await expect(rows.nth(2).locator('.log-tag')).toHaveText(/Rowing/);

    // Tapping the rowing row expands its detail grid
    await rows.nth(0).locator('.log-head').click();
    await expect(rows.nth(0)).toHaveClass(/open/);
    await expect(rows.nth(0).locator('.log-details')).toContainText('6,420 m');
    await expect(rows.nth(0).locator('.log-details')).toContainText('145 W');
    await expect(rows.nth(0).locator('.log-details')).toContainText('+100 XP');

    // The manual row shows the no-data note; opening it closes the first row
    await rows.nth(2).locator('.log-head').click();
    await expect(rows.nth(2).locator('.log-details')).toContainText('No recorded data (checked off manually)');
    await expect(rows.nth(0)).not.toHaveClass(/open/);

    await expectReachable(rows.nth(0).locator('.log-head'), 'first session log row');
    await expectNoHorizontalOverflow(page, 'progress screen with session log');
  });
});

test.describe('XP rebalance and guide', () => {
  /** One session of each type with known stats, so the graded totals are predictable. */
  const seedXpSessions = async (page) => {
    await page.evaluate((KEY) => {
      const d = JSON.parse(localStorage.getItem(KEY));
      const iso = new Date().toISOString();
      const walkKey = 'walk-2026-01-05';
      d.completed = { ['1-' + d.days[0]]: iso, ['1-' + d.days[1]]: iso, [walkKey]: iso };
      d.sessionStats = {
        // Interval: 100 base + 50 meters + 45 blocks + 10 rate hits = 205
        ['1-' + d.days[0]]: { m: 5000, blocks: 3, rateHits: 2 },
        // Steady: 100 base + 80 meters + 60 minutes = 240
        ['1-' + d.days[1]]: { m: 8000, blocks: 0, steady: true, min: 30 },
        // Walk: 100 base + 9 km XP (no meters-per-100m XP) = 109
        [walkKey]: { walk: true, m: 3500, min: 40 },
      };
      d.bonusXP = { ['1-' + d.days[0]]: 100 }; // golden session +100
      localStorage.setItem(KEY, JSON.stringify(d));
    }, STORAGE_KEY);
    await page.locator('.tab-btn[data-tab="#progress"]').click();
  };

  test('calcXP grades sessions by type: blocks, steady minutes, walk kilometers', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await seedXpSessions(page);
    // 205 + 100 golden + 240 + 109 = 654 total -> level 2, 354 into the 450 needed
    await expect(page.locator('#xpStrip .xp-nums')).toHaveText('654 XP · 354 / 450 to LVL 3');
  });

  test('tapping the XP strip opens the guide with earning rules and the rank ladder', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await seedXpSessions(page);
    // The strip hints it is tappable and opens the guide
    await expect(page.locator('#xpStrip .xp-chevron')).toBeVisible();
    await page.locator('#xpStrip .xp-strip').click();
    await expect(page.locator('#xpGuideOverlay')).toHaveClass(/active/);
    // Rules table lists the graded earning rules
    const rules = page.locator('#xpgRules');
    await expect(rules).toContainText('Complete any session');
    await expect(rules).toContainText('+100 XP');
    await expect(rules).toContainText('interval block');
    await expect(rules).toContainText('+15 XP');
    await expect(rules).toContainText('Steady-state');
    await expect(rules).toContainText('+2 XP / min');
    await expect(rules).toContainText('+3 XP / km');
    await expect(rules).toContainText('+1 XP / 100 m');
    await expect(rules).toContainText('+5 XP');
    // Full ladder with the current rank highlighted (654 XP = LVL 2 = Deckhand)
    await expect(page.locator('#xpgRanks .xpg-rank')).toHaveCount(11);
    await expect(page.locator('.xpg-rank.current .xpg-rank-name')).toHaveText('Deckhand');
    await expect(page.locator('#xpgRanks .xpg-status')).toContainText('654 XP total');
    await expect(page.locator('#xpgRanks .xpg-status')).toContainText('next rank Paddler at 750 XP');
    // The modal fits the viewport; the highlighted rank is reachable
    await expectReachable(page.locator('#xpGuideBox'), 'XP guide box');
    await expectReachable(page.locator('.xpg-rank.current'), 'highlighted current rank row');
    // Backdrop tap closes the guide
    await page.locator('#xpGuideOverlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#xpGuideOverlay')).not.toHaveClass(/active/);
  });
});

test.describe('Shop and cosmetics', () => {
  test('shop opens from Settings and Progress, default avatar equipped', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await page.locator('.tab-btn[data-tab="#settings"]').click();
    await expectReachable(page.locator('#shopBtn'), 'Shop & Avatars settings row');
    await page.locator('#shopBtn').click();
    await expect(page.locator('#shopOverlay')).toHaveClass(/active/);
    await expectReachable(page.locator('#shopCoins'), 'coin balance');
    await expect(page.locator('#shopCoins')).toContainText('0 coins');
    await expect(page.locator('#shopLog')).toContainText('Coins you earn will show up here.');
    // Default rower avatar reads as equipped even with nothing bought
    const rower = page.locator('.shop-item[data-id="rower"]');
    await expectReachable(rower, 'default rower item');
    await expect(rower).toHaveClass(/equipped/);
    await expect(rower.locator('.shop-state')).toHaveText('Equipped');
    await expectNoHorizontalOverflow(page, 'shop modal');
    await page.locator('#shopClose').click();
    await expect(page.locator('#shopOverlay')).not.toHaveClass(/active/);
    // Same modal from the Progress card under the XP strip
    await page.locator('.tab-btn[data-tab="#progress"]').click();
    await expectReachable(page.locator('#shopCard .shop-card'), 'shop card on progress screen');
    await page.locator('#shopCard .shop-card').click();
    await expect(page.locator('#shopOverlay')).toHaveClass(/active/);
    await expectReachable(page.locator('#shopClose'), 'shop close button');
  });

  test('buying a coin item, equipping it, and the coin log record', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await page.evaluate((KEY) => {
      const d = JSON.parse(localStorage.getItem(KEY));
      d.coins = 500;
      d.coinLog = [
        { ts: Date.now() - 3600000, amount: 20, reason: 'Sprint challenge' },
        { ts: Date.now() - 1800000, amount: 30, reason: 'Golden session' },
      ];
      d.completed['1-' + d.days[0]] = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(d));
    }, STORAGE_KEY);
    // Re-render via tab switch (reload would re-run the seeding init script)
    await page.locator('.tab-btn[data-tab="#progress"]').click();
    await page.locator('#shopCard .shop-card').click();
    await expect(page.locator('#shopCoins')).toContainText('500 coins');

    // Buy the kayak (150 coins) through the confirm dialog
    const kayak = page.locator('.shop-item[data-id="kayak"]');
    await expect(kayak.locator('.shop-state')).toContainText('150');
    await kayak.click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/active/);
    await expect(page.locator('#confirmMsg')).toContainText('Buy Kayak for 150 coins?');
    await page.locator('#confirmOk').click();
    await expect(kayak.locator('.shop-state')).toHaveText('Tap to equip');
    await expect(page.locator('#shopCoins')).toContainText('350 coins');
    const after = await page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), STORAGE_KEY);
    expect(after.coins, 'coins reduced by the price').toBe(350);
    expect(after.cosmetics.owned, 'kayak recorded as owned').toContain('kayak');

    // Coin log: purchase on top as a negative entry, seeded earnings below
    const logRows = page.locator('#shopLog .shop-log-row');
    await expect(logRows.nth(0).locator('.shop-log-amt')).toHaveText('-150');
    await expect(logRows.nth(0).locator('.shop-log-reason')).toHaveText('Kayak');
    await expect(logRows.nth(0).locator('.shop-log-ts')).toHaveText(/^\w{3} \d{1,2} \w{3} \d{2}:\d{2}$/);
    await expect(logRows.nth(1).locator('.shop-log-amt')).toHaveText('+30');
    await expect(logRows.nth(1).locator('.shop-log-reason')).toHaveText('Golden session');
    await expect(logRows.nth(2).locator('.shop-log-amt')).toHaveText('+20');
    await expect(logRows.nth(2).locator('.shop-log-reason')).toHaveText('Sprint challenge');
    await expectNoHorizontalOverflow(page, 'shop modal with coin history');

    // Equip: item highlights and the XP strip level circle shows the kayak
    await kayak.click();
    await expect(kayak).toHaveClass(/equipped/);
    await expect(kayak.locator('.shop-state')).toHaveText('Equipped');
    await page.locator('#shopClose').click();
    await expect(page.locator('#xpStrip .xp-avatar')).toHaveText('\u{1F6F6}');
    await expect(page.locator('#xpStrip .lvl-badge')).toHaveText('1');
  });

  test('rank-locked items become owned at high XP, still-locked ones show their rank', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await page.evaluate((KEY) => {
      const d = JSON.parse(localStorage.getItem(KEY));
      const k = '1-' + d.days[0];
      d.completed[k] = new Date().toISOString();
      d.bonusXP = { [k]: 5000 }; // 5100 XP -> LVL 7 -> rank index 3 (Oarsman)
      localStorage.setItem(KEY, JSON.stringify(d));
    }, STORAGE_KEY);
    await page.locator('.tab-btn[data-tab="#progress"]').click();
    await page.locator('#shopCard .shop-card').click();
    // Longship needs rank 2 (LVL 5): auto-owned now, no purchase required
    const longship = page.locator('.shop-item[data-id="longship"]');
    await expect(longship).not.toHaveClass(/locked/);
    await expect(longship.locator('.shop-state')).toHaveText('Tap to equip');
    // Viking needs rank 5 (LVL 11): still locked and says so
    const viking = page.locator('.shop-item[data-id="viking"]');
    await expect(viking).toHaveClass(/locked/);
    await expect(viking.locator('.shop-state')).toContainText('Unlocks at Stroke Seat');
    await viking.click(); // tapping a locked item must do nothing
    await expect(page.locator('#confirmOverlay')).not.toHaveClass(/active/);
    // Equip the rank-unlocked longship and check the strip
    await longship.click();
    await expect(longship).toHaveClass(/equipped/);
    await page.locator('#shopClose').click();
    await expect(page.locator('#xpStrip .xp-avatar')).toHaveText('⛵');
    await expect(page.locator('#xpStrip .lvl-badge')).toHaveText('7');
  });
});

test.describe('Coin bonuses and challenges', () => {
  /** Mark every week-1 session except today's as completed; returns today's key. */
  const seedWeekAlmostDone = async (page) => {
    const todayKey = await page.evaluate((KEY) => {
      const d = JSON.parse(localStorage.getItem(KEY));
      const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const tk = '1-' + dayKeys[new Date().getDay()];
      for (const day of d.days) if ('1-' + day !== tk) d.completed['1-' + day] = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(d));
      return tk;
    }, STORAGE_KEY);
    // Re-render via tab switch (reload would re-run the seeding init script)
    await page.locator('.tab-btn[data-tab="#progress"]').click();
    await page.locator('.tab-btn[data-tab="#schedule"]').click();
    return todayKey;
  };
  const dismissDialogs = async (page) => {
    for (let i = 0; i < 6; i++) {
      const ok = page.locator('#confirmOverlay.active #confirmOk');
      if (await ok.isVisible().catch(() => false)) { await ok.click(); await page.waitForTimeout(250); }
      else break;
    }
  };

  test('manual checkmark completing week 1 awards the weekly bonus once', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    const todayKey = await seedWeekAlmostDone(page);
    await page.locator(`.session-card[data-key="${todayKey}"] .s-check`).click();
    await dismissDialogs(page); // milestone celebrations pop after the 3rd completion
    await expect.poll(() => page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)).coins, STORAGE_KEY),
      'weekly bonus coins should land in storage').toBe(30);
    const d = await page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), STORAGE_KEY);
    expect(d.weekBonus, 'week 1 recorded as awarded').toEqual([1]);
    expect(d.coinLog.map((r) => r.reason)).toContain('Full week completed');
    // The award shows up in the shop: balance and coin log entry
    await page.locator('.tab-btn[data-tab="#progress"]').click();
    await page.locator('#shopCard .shop-card').click();
    await expect(page.locator('#shopCoins')).toContainText('30 coins');
    await expect(page.locator('#shopLog')).toContainText('Full week completed');
    await expect(page.locator('#shopLog .shop-log-amt').first()).toHaveText('+30');
    await page.locator('#shopClose').click();
    // Un-check + re-check must NOT double-award (weekBonus guard)
    await page.locator('.tab-btn[data-tab="#schedule"]').click();
    await page.locator(`.session-card[data-key="${todayKey}"] .s-check`).click(); // off
    await page.locator(`.session-card[data-key="${todayKey}"] .s-check`).click(); // on again
    await dismissDialogs(page);
    expect(await page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)).coins, STORAGE_KEY),
      'no double award for the same week').toBe(30);
  });

  test('finishing the last week-1 session in the timer awards the weekly bonus', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await seedWeekAlmostDone(page);
    await page.locator('#todayStartBtn').click();
    await expect(page.locator('#timer')).toHaveClass(/active/);
    await page.locator('#finishBtn').click();
    const confirm = page.locator('#confirmOverlay.active #confirmOk');
    if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) await confirm.click();
    await expect(page.locator('#done')).toHaveClass(/active/);
    await expect.poll(() => page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)).coins, STORAGE_KEY),
      'timer finish path should award the weekly bonus').toBe(30);
    const d = await page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), STORAGE_KEY);
    expect(d.weekBonus).toEqual([1]);
    expect(d.coinLog.map((r) => r.reason)).toContain('Full week completed');
    // No PM5 data: no watt/PB bonuses may sneak in
    expect(d.coins).toBe(30);
    expect(d.wattMarks || []).toEqual([]);
  });

  test('computeBonuses: power PB, watt thresholds and week completion rules', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    const res = await page.evaluate(async (KEY) => {
      const { computeBonuses } = await import('/js/challenges.js');
      const base = JSON.parse(localStorage.getItem(KEY));
      const done = {};
      base.days.forEach((day) => { done['1-' + day] = 'x'; });
      return {
        pb: computeBonuses({ peakW: 260 }, { ...base, pm5PB: { peakW: 240 }, wattMarks: [200], completed: {} }, null),
        none: computeBonuses({ peakW: 240 }, { ...base, pm5PB: { peakW: 300 }, wattMarks: [200, 250], completed: {} }, null),
        firstEver: computeBonuses({ peakW: 205 }, { ...base, completed: {} }, null),
        walkStats: computeBonuses({ walk: true, peakW: 300 }, { ...base, completed: {} }, null),
        week: computeBonuses(null, { ...base, completed: done }, '1-' + base.days[0]),
        weekDup: computeBonuses(null, { ...base, completed: done, weekBonus: [1] }, '1-' + base.days[0]),
        weekPartial: computeBonuses(null, { ...base, completed: { ['1-' + base.days[0]]: 'x' } }, '1-' + base.days[0]),
        walkKey: computeBonuses(null, { ...base, completed: done }, 'walk-2026-01-05'),
        combo: computeBonuses({ peakW: 420 }, { ...base, pm5PB: { peakW: 180 }, completed: done }, '1-' + base.days[0]),
      };
    }, STORAGE_KEY);
    expect(res.pb).toEqual([
      { amount: 50, reason: 'New power PB' },
      { amount: 25, reason: 'First time over 250 W', mark: 250 },
    ]);
    expect(res.none, 'below PB and already-marked thresholds earn nothing').toEqual([]);
    expect(res.firstEver, 'first recorded peak counts as a PB and marks 200 W').toEqual([
      { amount: 50, reason: 'New power PB' },
      { amount: 25, reason: 'First time over 200 W', mark: 200 },
    ]);
    expect(res.walkStats, 'walk stats never earn watt bonuses').toEqual([]);
    expect(res.week).toEqual([{ amount: 30, reason: 'Full week completed', week: 1 }]);
    expect(res.weekDup, 'weekBonus guard blocks double award').toEqual([]);
    expect(res.weekPartial, 'incomplete week earns nothing').toEqual([]);
    expect(res.walkKey, 'walk completions never trigger the week bonus').toEqual([]);
    expect(res.combo.map((a) => a.amount).reduce((a, b) => a + b, 0), 'PB + all five thresholds + week').toBe(50 + 5 * 25 + 30);
  });

  test('challenge banner: present, hidden without PM5, fits when visible', async ({ page }) => {
    await gotoApp(page, { seedProgram: true });
    await page.locator('#todayStartBtn').click();
    await expect(page.locator('#timer')).toHaveClass(/active/);
    const banner = page.locator('#challengeBanner');
    await expect(banner).toBeAttached();
    await expect(banner, 'banner starts hidden').toBeHidden();
    // Skip through warm-up and into the interval sprints: with no PM5
    // connected a challenge must never fire, so the banner stays hidden
    for (let i = 0; i < 9; i++) await page.locator('#skipBtn').click();
    await expect(banner, 'banner stays hidden without a rower').toBeHidden();
    // Forced visible (challenge, success and miss states) it must fit the phone
    for (const [cls, text] of [
      ['on', 'CHALLENGE: hit 250 W on this sprint for 20 coins'],
      ['on success', '⚡ 250 W hit! +20 coins'],
      ['on miss', 'Challenge missed, next time!'],
    ]) {
      await page.evaluate(([cls, text]) => {
        const el = document.getElementById('challengeBanner');
        el.textContent = text;
        el.className = cls;
      }, [cls, text]);
      await expect(banner).toBeVisible();
      await expectNoHorizontalOverflow(page, `timer with challenge banner (${cls})`);
    }
  });
});
