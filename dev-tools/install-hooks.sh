#!/bin/sh
# Stamped by dev-harness: points git at dev-tools/hooks (no copy to drift)
# and makes a plain merge into the main branch a merge commit.
#   bash dev-tools/install-hooks.sh
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git config core.hooksPath dev-tools/hooks
# executable in git too: Windows keeps no file mode, so a hook added here went
# in as 100644 and git on Linux (a cloud thread) skipped it (2026-10-05). A
# tracked hook gets the bit in the index, a new one is added with it.
for hook in dev-tools/hooks/*; do
  mode="$(git ls-files -s -- "$hook" | cut -c1-6)"
  if [ -z "$mode" ]; then git add --chmod=+x -- "$hook" && echo "hooks: staged $hook, new, executable: commit it" || true
  elif [ "$mode" = "100644" ]; then git update-index --chmod=+x -- "$hook" && echo "hooks: staged $hook as executable: commit it" || true
  fi
done
MAIN="$(python dev-tools/harness.py config main 2>/dev/null || echo main)"
git config "branch.$MAIN.mergeoptions" --no-ff
# a plain `git push` also sends the annotated release tags on the pushed
# commits: extract_text's v1.1.0 and v1.3.0 stayed local while every other
# checkout read the old version (artikellaeser-70, 2026-09-30)
git config push.followTags true
echo "hooks: core.hooksPath=dev-tools/hooks, branch.$MAIN.mergeoptions=--no-ff, push.followTags=true"
