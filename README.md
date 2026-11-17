# Music Data Tracker

[![Tests](https://github.com/emh2003/music-data-tracker/actions/workflows/tests.yml/badge.svg)](https://github.com/emh2003/music-data-tracker/actions/workflows/tests.yml)
[![Daily run](https://github.com/emh2003/music-data-tracker/actions/workflows/daily.yml/badge.svg)](https://github.com/emh2003/music-data-tracker/actions/workflows/daily.yml)

**Live site:** https://emh2003.github.io/music-data-tracker/

Every day, on its own, this tool downloads the latest Deezer and Last.fm numbers for
15 artists, adds them to a history with one row per artist per source per day, opens a
GitHub Issue listing what moved, and publishes the result to a website.
Built for the Financial Data Analytics Data Tracker project.

## Artists tracked

SZA, Tyler Childers, Led Zeppelin, Fontaines D.C., Megan Thee Stallion, Flo Milli,
Flatland Cavalry, Zara Larsson, Green Day, Tame Impala, 21 Savage, Brent Faiyaz,
Frank Ocean, Kacey Musgraves and Don Toliver.

The key that lines an artist up from day to day is `item_id`, a slug defined in
`tracker/config.py` (for example `tame-impala`). It never changes, even if a source
renames the artist. The same file holds each artist's Deezer ID, the name sent to
Last.fm, and the genre label used as a filter on the site.

## Sources

| Source | Format | Endpoint | Login | What is kept |
|---|---|---|---|---|
| `deezer` | JSON | `https://api.deezer.com/artist/<id>` and `https://api.deezer.com/artist/<id>/top?limit=1` | none | The full artist record, and only the artist's #1 track (we request `limit=1` instead of the default 50). |
| `lastfm` | JSON | `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo` | API key in the repository secret `LASTFM_API_KEY` | Only `name`, `mbid`, `url`, `stats` (listeners, playcount) and `tags`. The biography, similar artists and images are dropped. |

Each source is called once per artist. The day's responses are saved together as one
JSON object, `{"artists": {"<item_id>": {...response...}}}`, compressed, at
`data/raw/<date>/<source>.json.gz`. The API key is never written to any file: it is
read from the environment and never printed.

## History file: `data/history.csv`

One row per artist, per source, per day. Deezer rows carry the Deezer columns and
Last.fm rows carry the Last.fm columns. A value a source does not report is left
empty. Rows are sorted by `date`, then `item_id`, then `source`.

| Column | Meaning | Unit |
|---|---|---|
| `date` | UTC date of the run that collected the row | `YYYY-MM-DD` |
| `item_id` | Artist key (our own slug) | text |
| `item` | Artist name | text |
| `source` | `deezer` or `lastfm` | text |
| `genre` | Our genre label for the artist (from `tracker/config.py`) | text |
| `fans` | Deezer fans: users who follow the artist on Deezer (`nb_fan`) | people |
| `albums` | Releases listed for the artist on Deezer (`nb_album`) | count |
| `top_track` | Title of the artist's most popular track on Deezer | text |
| `top_track_rank` | Deezer's popularity score for that track (`rank`; higher = more popular) | score (no unit) |
| `listeners` | Last.fm listeners: unique people who have ever scrobbled the artist | people |
| `playcount` | Last.fm plays: total scrobbles of the artist, all time | plays |

The history file depends on the raw files alone. Rebuild it at any time with:

```bash
python -m tracker build
```

Running it again produces the same file byte for byte, and a change to a conversion
rule applies to every day of the history.

## Status file: `data/status.json`

Describes the latest run: `run_time` (UTC), `first_run_date` (date of the earliest raw
file), `days_with_success` (number of different dates with a raw file), `items` (artists
in the latest run), `new_today` and `gone_today` (artist names that appeared or
disappeared since the previous date; both empty on the first day), and `sources`
(`name`, `ok`, `count` for each source in this run).

Every source result, success or failure, is also appended to `data/run_log.csv`,
with the error message when a source failed.

## Move rule

For every artist, source and numeric column (`fans`, `top_track_rank`, `listeners`,
`playcount`), compare the value on the latest date with the value on the previous date
in the history:

```
change = new − old
pct    = change ÷ old × 100
```

Pairs where either value is empty, the old value is 0, or nothing changed are skipped.
Moves are ranked by the size of `pct` (largest first, up or down; ties by `item_id`,
then column). The daily issue lists the **10 largest**, with old and new values, plus
any artist that appeared or disappeared. The Today page applies the same rule in the
browser.

## A daily run

`python -m tracker run` (run by `.github/workflows/daily.yml` every day at 13:23 UTC):

1. Calls each source and saves its raw file in `data/raw/<UTC date>/`. A source that
   fails writes no raw file that day, and the run carries on with the rest.
2. Rebuilds `data/history.csv` from all the raw files.
3. Writes `data/status.json` and appends to `data/run_log.csv`.
4. Opens an issue titled with the date, listing the biggest moves, and closes the
   previous day's issue. It opens one every day, even when nothing changed.
5. The workflow commits `data/` and publishes the site.

A second run on the same day deletes and replaces that day's raw files, rebuilds the
history, and updates that day's issue instead of opening a new one, so each day
counts once.

## Website

Three pages share one navigation bar and one stylesheet. They load
`data/history.csv` and `data/status.json` and do every calculation in the browser.

- **Today** (`index.html`): time of the last run, the status of each source, the counts
  from the status file, the latest values with their change since the previous run,
  and the biggest moves.
- **Browse** (`browse.html`): latest values for every artist, with filters (genre,
  Last.fm listeners, Deezer fans, shortlist), a search box, sorting by every numeric
  column up and down, and a ☆ star that saves an artist to a shortlist kept in the
  browser's `localStorage`.
- **Trends** (`trends.html`): a chart of each value over the days with an artist picker,
  and five findings computed from the history, each with a chart and a table.

The site is installable as an app (`manifest.webmanifest` plus `sw.js`). Online, every
request goes to the network first. Offline, the service worker serves the last copy it
saved, so the site still opens with the last data it loaded.

## Files

| Path | What it does |
|---|---|
| `tracker/config.py` | Artists (keys, Deezer IDs, Last.fm names, genres), sources, history columns |
| `tracker/fetch.py` | Calls Deezer and Last.fm and returns each day's payload |
| `tracker/convert.py` | Converts each source's raw payload into rows with the common columns |
| `tracker/build.py` | Builds `data/history.csv` from `data/raw/` (`python -m tracker build`) |
| `tracker/moves.py` | The move rule, plus the artists that appeared or disappeared |
| `tracker/status.py` | Writes `data/status.json` |
| `tracker/issues.py` | Writes the issue text, and opens, updates or closes issues through the GitHub API |
| `tracker/run.py` | One daily run: fetch, save raw files, build, status, log, issue |
| `tracker/__main__.py` | Command line: `python -m tracker run` or `python -m tracker build` |
| `tests/test_convert.py` | Converting each source to the common columns |
| `tests/test_moves.py` | The move rule and appeared/disappeared |
| `tests/test_history.py` | History build, rebuild from raw files, a second run on the same day, failed sources, status file, issue planning |
| `tests/fixtures/` | Sample Deezer (real response) and Last.fm payloads |
| `tests/conftest.py` | Loads the fixtures for the tests |
| `.github/workflows/daily.yml` | Daily schedule: tests, run, commit `data/`, then publish the site |
| `.github/workflows/tests.yml` | Runs `pytest` on every push |
| `.github/workflows/pages.yml` | Copies `site/` and the two data files into the site and deploys it to GitHub Pages |
| `data/raw/<date>/<source>.json.gz` | Compressed raw responses, one file per source per day |
| `data/history.csv` | The history (see above) |
| `data/status.json` | The latest run (see above) |
| `data/run_log.csv` | Every source result of every run |
| `site/index.html`, `site/browse.html`, `site/trends.html` | The three pages |
| `site/css/style.css` | Shared fonts and colors |
| `site/js/common.js` | Navigation, CSV loading, the move rule, formatting, shortlist storage |
| `site/js/charts.js` | SVG line and bar charts with hover tooltips (no library, so it works offline) |
| `site/js/today.js`, `site/js/browse.js`, `site/js/trends.js` | Code for each page |
| `site/manifest.webmanifest`, `site/sw.js`, `site/icons/` | Installable app: manifest, service worker, icons |
| `tools/make_icons.py` | Redraws the PNG app icons |
| `requirements.txt` | Python packages (`requests`, `pytest`) |

## Run it yourself

```bash
python -m pip install -r requirements.txt
pytest                                  # run the tests
LASTFM_API_KEY=... python -m tracker run  # one run (no issue unless GITHUB_TOKEN is set)
python -m tracker build                 # rebuild the history from data/raw
```
