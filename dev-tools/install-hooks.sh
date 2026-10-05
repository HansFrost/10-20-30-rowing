#!/bin/sh
# Stamped by dev-harness: points git at dev-tools/hooks (no copy to drift)
# and makes a plain merge into the main branch a merge commit.
#   bash dev-tools/install-hooks.sh
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git config core.hooksPath dev-tools/hooks
MAIN="$(python dev-tools/harness.py config main 2>/dev/null || echo main)"
git config "branch.$MAIN.mergeoptions" --no-ff
# a plain `git push` also sends the annotated release tags on the pushed
# commits: extract_text's v1.1.0 and v1.3.0 stayed local while every other
# checkout read the old version (artikellaeser-70, 2026-09-30)
git config push.followTags true
echo "hooks: core.hooksPath=dev-tools/hooks, branch.$MAIN.mergeoptions=--no-ff, push.followTags=true"
