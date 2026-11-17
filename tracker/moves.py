"""The move rule.

For every artist, source and numeric column (fans, top_track_rank, listeners,
playcount), compare the value on the latest date with the value on the previous
date in the history:

    change = new - old
    pct    = change / old * 100

Pairs where either value is empty, old is 0, or nothing changed are skipped.
Moves are ranked by the size of pct (largest first, up or down); ties go by
item_id, then column. The daily issue lists the top TOP_MOVES.

An artist "appeared" if it has rows on the latest date but none on the previous
date, and "disappeared" if the reverse. On the very first date nothing is compared.
"""
from .config import METRICS, TOP_MOVES


def dates_in(rows):
    return sorted({r["date"] for r in rows})


def latest_and_previous(rows):
    ds = dates_in(rows)
    latest = ds[-1] if ds else None
    previous = ds[-2] if len(ds) > 1 else None
    return latest, previous


def compute_moves(rows, limit=TOP_MOVES):
    latest, previous = latest_and_previous(rows)
    if previous is None:
        return []
    old = {(r["item_id"], r["source"]): r for r in rows if r["date"] == previous}
    moves = []
    for r in rows:
        if r["date"] != latest:
            continue
        o = old.get((r["item_id"], r["source"]))
        if not o:
            continue
        for m in METRICS:
            a, b = o.get(m), r.get(m)
            if a is None or b is None or a == 0 or a == b:
                continue
            moves.append({
                "item_id": r["item_id"], "item": r["item"], "source": r["source"], "metric": m,
                "old": a, "new": b, "change": b - a, "pct": (b - a) / a * 100,
            })
    moves.sort(key=lambda x: (-abs(x["pct"]), x["item_id"], x["metric"]))
    return moves[:limit] if limit else moves


def appeared_and_gone(rows):
    """Lists of item names that appeared / disappeared on the latest date."""
    latest, previous = latest_and_previous(rows)
    if previous is None:
        return [], []
    names = {r["item_id"]: r["item"] for r in rows}
    now = {r["item_id"] for r in rows if r["date"] == latest}
    before = {r["item_id"] for r in rows if r["date"] == previous}
    return sorted(names[i] for i in now - before), sorted(names[i] for i in before - now)
