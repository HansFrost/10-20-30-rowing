// follow-state on THIS app (stamped by dev-harness). The tool itself lives in
// the shared dev-harness package (src/harness/js/follow-state.mjs, since
// 2026-09-30); this shim runs it through the launcher, in the caller's folder,
// so `node scripts/follow-state.mjs <url> [options]` works as before.
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const launcher = join(dirname(fileURLToPath(import.meta.url)), '..', 'dev-tools', 'harness.py')
const done = spawnSync('python', [launcher, 'follow_state', ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(done.status ?? 2)
