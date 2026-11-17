import copy
import json
from datetime import datetime, timezone

from tracker.build import build, read_history
from tracker.config import COLUMNS
from tracker.issues import plan_issue
from tracker.run import run, save_raw


class FakeGitHub:
    def __init__(self):
        self.calls = []

    def publish(self, date, body):
        self.calls.append((date, body))
        return len(self.calls)


def fetchers(deezer, lastfm, fail=()):
    def make(name, payload):
        def f():
            if name in fail:
                raise RuntimeError(f"{name} is down")
            return copy.deepcopy(payload), len(payload["artists"])
        return f
    return {"deezer": make("deezer", deezer), "lastfm": make("lastfm", lastfm)}


def at(day, hour=14):
    return datetime(2026, 11, day, hour, 0, tzinfo=timezone.utc)


def test_history_sorted_and_columns(tmp_path, deezer_payload, lastfm_payload):
    run(tmp_path, at(18), fetchers(deezer_payload, lastfm_payload), FakeGitHub())
    run(tmp_path, at(17), fetchers(deezer_payload, lastfm_payload), FakeGitHub())
    text = (tmp_path / "data/history.csv").read_text()
    assert text.splitlines()[0] == ",".join(COLUMNS)
    rows = read_history(tmp_path / "data/history.csv")
    keys = [(r["date"], r["item_id"], r["source"]) for r in rows]
    assert keys == sorted(keys)
    assert {r["date"] for r in rows} == {"2026-11-17", "2026-11-18"}


def test_rebuild_reproduces_history(tmp_path, deezer_payload, lastfm_payload):
    run(tmp_path, at(17), fetchers(deezer_payload, lastfm_payload), FakeGitHub())
    run(tmp_path, at(18), fetchers(deezer_payload, lastfm_payload), FakeGitHub())
    first = (tmp_path / "data/history.csv").read_bytes()
    (tmp_path / "data/history.csv").unlink()
    build(tmp_path)
    assert (tmp_path / "data/history.csv").read_bytes() == first


def test_second_run_same_day_replaces_that_day(tmp_path, deezer_payload, lastfm_payload):
    gh = FakeGitHub()
    run(tmp_path, at(17, 9), fetchers(deezer_payload, lastfm_payload), gh)
    changed = copy.deepcopy(deezer_payload)
    changed["artists"]["sza"]["artist"]["nb_fan"] = 1349999
    status = run(tmp_path, at(17, 15), fetchers(changed, lastfm_payload), gh)
    rows = read_history(tmp_path / "data/history.csv")
    sza = [r for r in rows if r["item_id"] == "sza" and r["source"] == "deezer"]
    assert len(sza) == 1 and sza[0]["fans"] == 1349999   # one row, the new value
    assert status["days_with_success"] == 1                  # the day counts once
    assert [d for d, _ in gh.calls] == ["2026-11-17", "2026-11-17"]


def test_second_run_drops_source_that_now_fails(tmp_path, deezer_payload, lastfm_payload):
    run(tmp_path, at(17, 9), fetchers(deezer_payload, lastfm_payload), FakeGitHub())
    run(tmp_path, at(17, 15), fetchers(deezer_payload, lastfm_payload, fail={"lastfm"}), FakeGitHub())
    assert not (tmp_path / "data/raw/2026-11-17/lastfm.json.gz").exists()
    rows = read_history(tmp_path / "data/history.csv")
    assert {r["source"] for r in rows} == {"deezer"}


def test_failed_source_does_not_stop_run(tmp_path, deezer_payload, lastfm_payload):
    status = run(tmp_path, at(17), fetchers(deezer_payload, lastfm_payload, fail={"deezer"}), FakeGitHub())
    assert status["sources"] == [
        {"name": "deezer", "ok": False, "count": 0},
        {"name": "lastfm", "ok": True, "count": 2},
    ]
    assert not (tmp_path / "data/raw/2026-11-17/deezer.json.gz").exists()
    assert (tmp_path / "data/raw/2026-11-17/lastfm.json.gz").exists()
    log = (tmp_path / "data/run_log.csv").read_text()
    assert "deezer,False,0,deezer is down" in log


def test_all_sources_fail_leaves_no_raw_day(tmp_path, deezer_payload, lastfm_payload):
    status = run(tmp_path, at(17), fetchers(deezer_payload, lastfm_payload, fail={"deezer", "lastfm"}), FakeGitHub())
    assert not (tmp_path / "data/raw/2026-11-17").exists()
    assert status["days_with_success"] == 0


def test_status_file(tmp_path, deezer_payload, lastfm_payload):
    run(tmp_path, at(17), fetchers(deezer_payload, lastfm_payload), FakeGitHub())
    fewer = copy.deepcopy(lastfm_payload)
    del fewer["artists"]["flo-milli"]
    run(tmp_path, at(18), fetchers(deezer_payload, fewer), FakeGitHub())
    status = json.loads((tmp_path / "data/status.json").read_text())
    assert status["run_time"] == "2026-11-18T14:00:00Z"
    assert status["first_run_date"] == "2026-11-17"
    assert status["days_with_success"] == 2
    assert status["items"] == 3          # flatland-cavalry, green-day, sza
    assert status["gone_today"] == ["Flo Milli"]
    assert status["new_today"] == []


def test_day_without_raw_file_has_no_rows(tmp_path, lastfm_payload):
    day = tmp_path / "data/raw/2026-11-17"
    day.mkdir(parents=True)
    save_raw(day / "lastfm.json.gz", lastfm_payload)
    rows = build(tmp_path)
    assert {r["source"] for r in rows} == {"lastfm"}


def test_plan_issue():
    issues = [{"number": 4, "title": "2026-11-16"}, {"number": 7, "title": "Bug report"}]
    assert plan_issue(issues, "2026-11-17") == (None, [4])
    issues.append({"number": 9, "title": "2026-11-17"})
    assert plan_issue(issues, "2026-11-17") == (9, [4])   # rerun updates, never duplicates
