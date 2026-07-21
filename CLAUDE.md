# 10-20-30 Rowing - Project Instructions

Evidence-based 10-20-30 interval training app for Concept2 rowers. Static site on GitHub Pages
(https://hansfrost.github.io/10-20-30-rowing/), used on iPhone in the Bluefy browser (Web Bluetooth
for the PM5 monitor). No framework, no build step, no bundler - this is a deliberate constraint.

---

## Architecture

| Piece | Where | Notes |
|-------|-------|-------|
| Entry page | `10-20-30_rowing_timer.html` | Markup only; links CSS and loads `js/main.js` as an ES module. Keep this filename - it is the public URL and the tests navigate to it. |
| Styles | `css/*.css` | Split by concern; plain CSS, custom properties in `:root`. |
| Logic | `js/*.js` | Native ES modules, no transpilation. Must run in iOS WKWebView (Bluefy) and Chromium. |
| Data | `localStorage` (offline-first) + Supabase Postgres (per-user authoritative copy) | Sync is last-write-wins by newest local modification. The publishable key in `js/cloud.js` is intentionally public; RLS protects data. |
| Rower | PM5 over Web Bluetooth (`js/pm5.js`) | Only works in Bluefy on iOS. All PM5 code must no-op gracefully when no rower is connected. |
| Tests | `tests/*.spec.js` (Playwright) | Run `npx playwright test`. Served over HTTP by `http-server` (see `playwright.config.js`); ES modules do not load from `file://`. |

---

## Code size and modularity rules

Derived from clean-code guidance (Rule of 30, cyclomatic-complexity limits, community file-size
consensus). Apply to all new and refactored code:

- **Functions: aim for <= 30 lines, hard limit 50** (excluding blanks/comments). If a function
  exceeds this, extract helpers rather than adding section comments inside it.
- **Cyclomatic complexity < 10 per function.** Deep `if`/`else` ladders get extracted or table-driven.
- **Files: aim for <= 300 lines, hard limit 400.** When a module approaches the limit, split by
  responsibility, not by line count.
- **One responsibility per module.** A module's name must describe everything in it. Prefer many
  small feature modules over "utils dumping grounds".
- **Named exports only** (no default exports). Import only what is used.
- **Dependency direction:** low-level modules (`util.js`, `dom.js`, `store.js`, `content.js`) must
  not import feature modules. Where a low-level module needs to trigger feature behavior (e.g.
  storage writes triggering cloud sync), expose a hook/callback that the feature module registers.
  Feature-to-feature circular imports are allowed only when every cross-call happens at runtime
  (inside functions), never at module-evaluation time.

---

## Working rules

- After any change, run the full Playwright suite; all tests must pass before committing.
- Syntax-check edited modules with `node --check` before running the suite.
- The app must keep working with: no rower, no cloud session, no network. Every PM5/cloud code path
  needs a graceful no-op fallback.
- Multiple Claude sessions sometimes work in this repo concurrently. Check `git status` before
  starting multi-file work, commit promptly when done, and never revert changes you did not make.
- Fonts: only load Dosis weights that are actually used; never reference a `font-weight` heavier
  than the loaded faces (regression-tested in `tests/font-weights.spec.js`).
