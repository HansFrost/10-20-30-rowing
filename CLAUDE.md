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

---

<!-- dev-harness:begin (stamped 2026-10-05; re-stamping replaces only this block) -->
## How work gets done here: the shared dev-harness

This repo is stamped by the dev-harness: `harness.toml` is what it says about itself, and its gates enforce it. Before you build here, load the `dev-harness:workflow` skill (a worktree branch per change, the gates, one vet round before every merge). Main is `master`, and the served page opens as `http://127.0.0.1:<port>/?debug=all`. Regression tests are written at keep (`scripts/vet.py keep`), after the seen and never before it: the fewest tests, each one failing on main. In an app with a phone page, keep also names the steps Hans checks on the phone (`--pho "<step>"`) or why there are none (`--no-pho "<why>"`), and the merge hands them over.

### In a cloud session

When `CLAUDE_CODE_REMOTE` is `true` (a session opened at claude.ai/code), nothing from a plugin loads, so before the task:

1. Attach the repos this one needs with add_repo and clone each beside it, `git clone https://github.com/HansFrost/<repo>.git ../<repo>`: always dev-harness and pagedebug, claude-plugins for any skill, and every repo a `file:` path names in ANY `package.json` here (`web/` and other subfolders too, not only the root one).
2. Run `bash ../dev-harness/scripts/cloud-bootstrap.sh`; if it ends "NOT ready", report its FAIL lines and stop.
3. A skill Hans names (flow, wireframe, guide, records, walkthrough, project, vet, workflow) is read from `../claude-plugins/plugins/*/skills/<name>/SKILL.md` and followed. Figma's skills come from `get_figma_skill`; with no `mcp__Figma__` tool present, ask Hans to turn Figma on under + > Connectors.
4. Then follow `../dev-harness/cloud/instructions.md`: a branch per change, push it often, never merge, end with its hand-over block. A commit message carries no Co-Authored-By line and no "Generated with": the message gate refuses both.
<!-- dev-harness:end -->
