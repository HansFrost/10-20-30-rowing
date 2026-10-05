"""pagedebug's vet reader on THIS app's files (stamped by dev-harness).
Run it as `python scripts/vet.py ...`, with pagedebug's flags."""

import runpy
import sys
from pathlib import Path

LAUNCHER = Path(__file__).resolve().parent.parent / "dev-tools" / "harness.py"
sys.argv[1:1] = ["shim", "vet"]
runpy.run_path(str(LAUNCHER), run_name="__main__")
