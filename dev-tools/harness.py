"""Runs one module of the shared dev-harness against THIS repository.

    python dev-tools/harness.py <module> [args]

    gate commit|push|all          the checks in harness.toml, side by side
    main_guard [--commit]         source is edited on a worktree, never on main here
    vet_gate                      no answer and no merge without a vet record
    merge_record <hook>           the same record, enforced by git itself
    merge_markers [commit]        what the served page owes after a merge
    worktree new|remove-merged|sweep|servers|clear-leftovers
    after_edit                    the advisory lint just after an edit
    diagrams check|publish        a diagram follows an allowed template and is the published one
    shim page_log|reports|pho|vet [args]   the readers, on this app's files
    registry register|show        the ports the require-debug hook refuses bare
    release [--dry] | check <b>   a library's SemVer release, and its change-note gate
    libraries status|ack|acked|built|imports|versions   library renewal and consumer versions
    rebuild                       rebuild once when a built-in library merged after [app] dist
    restart [--now] [--wait <s>]  restart the server when idle, then check its health

The harness itself is ONE copy: the `harness` package, installed editable
from D:\\Projects\\dev-harness (`pip install -e`, 2026-09-20). Before that
this file searched for the checkout by path. This file is stamped by
dev-harness. Do not edit it here: change the template and re-stamp.
"""

import importlib
import os
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# one line neither black (88) nor ruff at 79 rewraps: a string is never split
MISSING = "dev-harness not found: pip install -e D:/Projects/dev-harness into this Python (and pagedebug beside it)"


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    module = sys.argv.pop(1)
    os.environ.setdefault("HARNESS_REPO", str(ROOT))
    # This file is itself `harness.py`, and a script's own folder is
    # sys.path[0], so a bare `import harness` would import this shim
    # (MEASURED 2026-09-20: "module 'harness' has no attribute '__path__'"
    # from every hook). The folder goes before the import.
    here = str(Path(__file__).resolve().parent)
    sys.path[:] = [p for p in sys.path if p and str(Path(p).resolve()) != here]
    # In dev-harness itself, or one of its worktrees, the tree's own copy
    # runs, not the installed one: the editable install points at the MAIN
    # checkout, so a hook or a test in a worktree ran main's code and a
    # branch's fix was never what the gate checked (MEASURED 2026-09-21:
    # a test OK with PYTHONPATH=../src, FAILED without, same tree).
    # The hooks start Python with -S, which skips site-packages and with
    # them the editable installs' finders (harness, and pagelog beside it).
    # site.main() puts them back BEFORE any import, so the tree's own
    # harness below still finds pagelog (MEASURED 2026-09-21: with the
    # site call only in the except branch, dev-harness's own vet_gate
    # died with "No module named 'pagelog'" on every merge).
    if sys.flags.no_site:
        import site

        site.main()
    own = ROOT / "src" / "harness" / "__init__.py"
    if own.is_file():
        sys.path.insert(0, str(own.parent.parent))
    try:
        importlib.import_module("harness")  # the installed package, by name
    except ImportError as bad:
        sys.exit(f"{MISSING} ({bad})")
    runpy.run_module(f"harness.{module}", run_name="__main__", alter_sys=True)


if __name__ == "__main__":
    main()
