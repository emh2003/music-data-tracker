"""Command line:
    python -m tracker run     # daily run: fetch, build, status, issue
    python -m tracker build   # rebuild data/history.csv from data/raw only
"""
import sys

from .build import build
from .run import run


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    cmd = argv[0] if argv else "run"
    if cmd == "build":
        rows = build(".")
        print(f"data/history.csv: {len(rows)} rows")
    elif cmd == "run":
        run(".")
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
