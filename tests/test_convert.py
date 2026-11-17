from tracker.config import COLUMNS
from tracker.convert import convert_deezer, convert_lastfm


def test_deezer_rows_have_common_columns(deezer_payload):
    rows = convert_deezer("2026-11-17", deezer_payload)
    assert all(list(r.keys()) == COLUMNS for r in rows)
    by = {r["item_id"]: r for r in rows}
    fc = by["flatland-cavalry"]
    assert fc["date"] == "2026-11-17"
    assert fc["item"] == "Flatland Cavalry"
    assert fc["source"] == "deezer"
    assert fc["genre"] == "Country"
    assert fc["fans"] == 2468
    assert fc["albums"] == 29
    assert fc["top_track"] == "A Life Where We Work Out"
    assert fc["top_track_rank"] == 347329
    # Deezer does not report Last.fm values: left empty
    assert fc["listeners"] is None and fc["playcount"] is None


def test_deezer_missing_top_track_left_empty(deezer_payload):
    by = {r["item_id"]: r for r in convert_deezer("2026-11-17", deezer_payload)}
    assert by["green-day"]["fans"] == 5258936
    assert by["green-day"]["top_track"] is None
    assert by["green-day"]["top_track_rank"] is None


def test_deezer_skips_untracked_artists(deezer_payload):
    ids = [r["item_id"] for r in convert_deezer("2026-11-17", deezer_payload)]
    assert "not-tracked" not in ids
    assert ids == sorted(ids)


def test_lastfm_rows(lastfm_payload):
    rows = convert_lastfm("2026-11-17", lastfm_payload)
    assert all(list(r.keys()) == COLUMNS for r in rows)
    by = {r["item_id"]: r for r in rows}
    assert by["sza"]["listeners"] == 4123456
    assert by["sza"]["playcount"] == 612345678
    assert by["sza"]["source"] == "lastfm"
    assert by["sza"]["fans"] is None
    # blank number from the source stays empty
    assert by["flo-milli"]["listeners"] == 812345
    assert by["flo-milli"]["playcount"] is None
