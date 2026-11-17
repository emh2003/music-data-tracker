"""Download the latest values from each source.

Each fetcher returns (payload, count): the JSON payload to save as the day's raw file
and the number of artists it holds. A fetcher raises an exception when the source
failed as a whole (no artists came back); the caller records that and moves on.
"""
import os
import time

import requests

from .config import ARTISTS

TIMEOUT = 20
HEADERS = {"User-Agent": "data-tracker class project (github.com/emh2003/music-data-tracker)"}


def _get_json(url, params=None, tries=3):
    last = None
    for attempt in range(tries):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError) as e:
            last = e
            time.sleep(1 + attempt)
    raise last


def fetch_deezer():
    """Deezer public API, no key. Two calls per artist:
    /artist/<id> (fans, albums) and /artist/<id>/top?limit=1 (top track and its rank).
    Only the top track is requested, not the full top-50 list."""
    artists = {}
    for a in ARTISTS:
        try:
            info = _get_json(f"https://api.deezer.com/artist/{a['deezer_id']}")
            top = _get_json(f"https://api.deezer.com/artist/{a['deezer_id']}/top", {"limit": 1})
        except Exception as e:  # one artist failing should not sink the source
            print(f"deezer: {a['item_id']} failed: {e}")
            continue
        if "error" in info:
            print(f"deezer: {a['item_id']} error: {info['error']}")
            continue
        artists[a["item_id"]] = {"artist": info, "top": top}
        time.sleep(0.15)  # stay well under Deezer's 50 requests / 5 seconds
    if not artists:
        raise RuntimeError("deezer returned no artists")
    return {"artists": artists}, len(artists)


def fetch_lastfm():
    """Last.fm artist.getInfo, needs LASTFM_API_KEY (a repository secret).
    Last.fm returns a biography, similar artists and images too; we keep only
    name, mbid, url, stats (listeners, playcount) and tags."""
    key = os.environ.get("LASTFM_API_KEY")
    if not key:
        raise RuntimeError("LASTFM_API_KEY is not set")
    artists = {}
    for a in ARTISTS:
        try:
            data = _get_json(
                "https://ws.audioscrobbler.com/2.0/",
                {"method": "artist.getinfo", "artist": a["lastfm_name"], "api_key": key,
                 "format": "json", "autocorrect": 1},
            )
        except Exception as e:
            # never print the URL: it holds the key
            print(f"lastfm: {a['item_id']} failed: {type(e).__name__}")
            continue
        if "artist" not in data:
            print(f"lastfm: {a['item_id']} error: {data.get('message')}")
            continue
        art = data["artist"]
        artists[a["item_id"]] = {"artist": {k: art.get(k) for k in ("name", "mbid", "url", "stats", "tags")}}
        time.sleep(0.25)
    if not artists:
        raise RuntimeError("lastfm returned no artists")
    return {"artists": artists}, len(artists)


FETCHERS = {"deezer": fetch_deezer, "lastfm": fetch_lastfm}
