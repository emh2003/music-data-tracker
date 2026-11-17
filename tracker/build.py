"""Build data/history.csv from the raw files alone.

Run on its own with:  python -m tracker build
"""
import csv
import gzip
import json
import re
from pathlib import Path

from .config import COLUMNS
from .convert import CONVERTERS

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def raw_dates(raw_root):
    """Dates (folder names) that hold at least one raw source file, oldest first."""
    raw_root = Path(raw_root)
    if not raw_root.exists():
        return []
    return sorted(
        p.name for p in raw_root.iterdir()
        if p.is_dir() and DATE_RE.match(p.name) and any(p.glob("*.json.gz"))
    )


def read_raw(path):
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return json.load(f)


def build_rows(raw_root):
    rows = []
    for date in raw_dates(raw_root):
        for source, convert in CONVERTERS.items():
            path = Path(raw_root) / date / f"{source}.json.gz"
            if path.exists():  # no raw file -> no rows from that source that day
                rows.extend(convert(date, read_raw(path)))
    rows.sort(key=lambda r: (r["date"], r["item_id"], r["source"]))
    return rows


def write_history(rows, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({k: ("" if r.get(k) is None else r[k]) for k in COLUMNS})


def read_history(path):
    """Read history.csv back, with numbers as ints and blanks as None."""
    from .config import METRICS
    out = []
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            for k in METRICS + ["albums"]:
                r[k] = int(r[k]) if r[k] != "" else None
            for k in ("top_track", "image"):
                r[k] = r[k] or None
            out.append(r)
    return out


def build(root="."):
    root = Path(root)
    rows = build_rows(root / "data" / "raw")
    write_history(rows, root / "data" / "history.csv")
    return rows
