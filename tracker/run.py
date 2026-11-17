"""One daily run: fetch every source, rebuild the history, write the status, post the issue."""
import csv
import gzip
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from .build import build
from .config import SOURCES
from .fetch import FETCHERS
from .issues import GitHub, issue_body
from .moves import appeared_and_gone, compute_moves
from .status import make_status, write_status


def save_raw(path, payload):
    # mtime=0 keeps the gzip header free of the time of writing
    with open(path, "wb") as fh, gzip.GzipFile(fileobj=fh, mode="wb", mtime=0) as gz:
        gz.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))


def append_log(path, run_time, date, results):
    path = Path(path)
    new = not path.exists()
    with open(path, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        if new:
            w.writerow(["run_time", "date", "source", "ok", "count", "error"])
        for s in results:
            w.writerow([run_time, date, s["name"], s["ok"], s["count"], s.get("error", "")])


def run(root=".", now=None, fetchers=None, github=None):
    root = Path(root)
    now = now or datetime.now(timezone.utc)
    date = now.strftime("%Y-%m-%d")  # the UTC date of the moment the run starts
    fetchers = fetchers or FETCHERS

    # A second run on the same day replaces that day's raw files.
    day_dir = root / "data" / "raw" / date
    if day_dir.exists():
        shutil.rmtree(day_dir)
    day_dir.mkdir(parents=True)

    results = []
    for name in SOURCES:
        try:
            payload, count = fetchers[name]()
            save_raw(day_dir / f"{name}.json.gz", payload)
            results.append({"name": name, "ok": True, "count": count})
            print(f"{name}: ok, {count} artists")
        except Exception as e:  # one source failing does not stop the run
            results.append({"name": name, "ok": False, "count": 0, "error": str(e)[:200]})
            print(f"{name}: FAILED: {e}")
    if not any(day_dir.iterdir()):
        day_dir.rmdir()

    rows = build(root)
    status = make_status(root, rows, results, now)
    write_status(status, root / "data" / "status.json")
    append_log(root / "data" / "run_log.csv", status["run_time"], date, results)

    moves = compute_moves(rows)
    appeared, gone = appeared_and_gone(rows)
    body = issue_body(date, moves, appeared, gone, status)
    if github is None and os.environ.get("GITHUB_TOKEN") and os.environ.get("GITHUB_REPOSITORY"):
        github = GitHub(os.environ["GITHUB_REPOSITORY"], os.environ["GITHUB_TOKEN"])
    if github is not None:
        number = github.publish(date, body)
        print(f"issue #{number} for {date}")
    else:
        print(body)
    return status
