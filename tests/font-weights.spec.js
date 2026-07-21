// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoApp } = require('./helpers');

/**
 * Reproduces the blobby/smeared text seen on iPhone: when CSS asks for a
 * font-weight heavier than any face the webfont actually provides, the
 * browser synthesizes a fake bold (ugly smearing on iOS Safari). The page
 * loads Dosis at 400-800, so any element computing to a heavier weight is
 * rendered with faux bold. This test fails if such an element exists.
 */
test('every element uses a font weight the loaded Dosis faces provide', async ({ page }) => {
  await gotoApp(page, { seedProgram: true });
  const result = await page.evaluate(async () => {
    await document.fonts.ready;
    const weights = [];
    document.fonts.forEach((f) => {
      if (f.family.replace(/['"]/g, '') === 'Dosis') weights.push(parseInt(f.weight, 10));
    });
    const maxLoaded = Math.max(0, ...weights);
    const offenders = new Set();
    for (const el of document.querySelectorAll('body, body *')) {
      const cs = getComputedStyle(el);
      if (!/dosis/i.test(cs.fontFamily)) continue;
      const w = parseInt(cs.fontWeight, 10);
      if (w > maxLoaded) {
        offenders.add(
          el.tagName.toLowerCase() +
          (el.id ? '#' + el.id : '') +
          (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '') +
          ' wants ' + w
        );
      }
    }
    // Also scan stylesheet rules directly: dynamically-injected UI (done-screen
    // grade badge, milestones) is absent from the DOM here, but its CSS is not.
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; } // cross-origin (Google Fonts)
      const walk = (list) => {
        for (const r of list) {
          if (r.selectorText && r.style && r.style.fontWeight) {
            const w = parseInt(r.style.fontWeight, 10);
            if (w > maxLoaded) offenders.add(r.selectorText + ' wants ' + w);
          }
          if (r.cssRules) walk(r.cssRules);
        }
      };
      walk(rules);
    }
    return { maxLoaded, facesFound: weights.length, offenders: [...offenders].slice(0, 20) };
  });
  expect(result.facesFound, 'Dosis webfont faces should be loaded (network needed for fonts.googleapis.com)').toBeGreaterThan(0);
  expect(result.offenders, `rules or elements requesting weights heavier than the loaded max (${result.maxLoaded}) get synthesized faux bold on iOS`).toEqual([]);
});
