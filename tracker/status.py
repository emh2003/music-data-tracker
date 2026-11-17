"""Write data/status.json describing the latest run."""
import json
from pathlib import Path

from .build import raw_dates
from .moves import appeared_and_gone, latest_and_previous


def make_status(root, rows, source_results, run_time):
    root = Path(root)
    dates = raw_dates(root / "data" / "raw")
    latest, _ = latest_and_previous(rows)
    new, gone = appeared_and_gone(rows)
    return {
        "run_time": run_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "first_run_date": dates[0] if dates else None,
        "days_with_success": len(dates),
        "items": len({r["item_id"] for r in rows if r["date"] == latest}),
        "new_today": new,
        "gone_today": gone,
        "sources": [
            {"name": s["name"], "ok": s["ok"], "count": s["count"]} for s in source_results
        ],
    }


def write_status(status, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
