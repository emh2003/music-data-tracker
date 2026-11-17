from tracker.moves import appeared_and_gone, compute_moves


def row(date, item_id, source="lastfm", **v):
    base = {"date": date, "item_id": item_id, "item": item_id.upper(), "source": source,
            "fans": None, "top_track_rank": None, "listeners": None, "playcount": None}
    base.update(v)
    return base


def test_first_day_has_no_moves():
    rows = [row("2026-11-17", "a", listeners=100)]
    assert compute_moves(rows) == []
    assert appeared_and_gone(rows) == ([], [])


def test_moves_ranked_by_absolute_percent():
    rows = [
        row("2026-11-17", "a", listeners=100, playcount=1000),
        row("2026-11-17", "b", listeners=200),
        row("2026-11-18", "a", listeners=110, playcount=1001),  # +10%, +0.1%
        row("2026-11-18", "b", listeners=150),                  # -25%
    ]
    moves = compute_moves(rows)
    assert [(m["item_id"], m["metric"]) for m in moves] == [("b", "listeners"), ("a", "listeners"), ("a", "playcount")]
    assert moves[0]["old"] == 200 and moves[0]["new"] == 150
    assert moves[0]["change"] == -50
    assert round(moves[0]["pct"], 6) == -25.0


def test_moves_skip_unchanged_empty_and_zero():
    rows = [
        row("2026-11-17", "a", listeners=100, playcount=None, fans=0),
        row("2026-11-18", "a", listeners=100, playcount=50, fans=10),
    ]
    assert compute_moves(rows) == []


def test_moves_compare_with_previous_date_only():
    rows = [
        row("2026-11-16", "a", listeners=50),
        row("2026-11-17", "a", listeners=100),
        row("2026-11-18", "a", listeners=120),
    ]
    (m,) = compute_moves(rows)
    assert m["old"] == 100 and m["new"] == 120


def test_moves_match_same_source():
    rows = [
        row("2026-11-17", "a", "deezer", fans=100),
        row("2026-11-17", "a", "lastfm", listeners=100),
        row("2026-11-18", "a", "deezer", fans=101),
    ]
    (m,) = compute_moves(rows)
    assert m["source"] == "deezer" and m["metric"] == "fans"


def test_limit():
    rows = [row("2026-11-17", f"x{i}", listeners=100) for i in range(20)]
    rows += [row("2026-11-18", f"x{i}", listeners=100 + i + 1) for i in range(20)]
    assert len(compute_moves(rows)) == 10
    assert compute_moves(rows)[0]["item_id"] == "x19"


def test_appeared_and_gone():
    rows = [row("2026-11-17", "a"), row("2026-11-17", "b"),
            row("2026-11-18", "b"), row("2026-11-18", "c")]
    assert appeared_and_gone(rows) == (["C"], ["A"])
