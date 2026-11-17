"""Turn one day's raw payload from a source into rows with the common columns."""
from .config import BY_ID, COLUMNS


def _int(v):
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _row(date, item_id, source, **values):
    meta = BY_ID.get(item_id)
    if meta is None:  # an artist no longer tracked: keep the history clean
        return None
    row = {c: None for c in COLUMNS}
    row.update(date=date, item_id=item_id, item=meta["item"], source=source, genre=meta["genre"])
    row.update(values)
    return row


def convert_deezer(date, payload):
    rows = []
    for item_id, d in sorted(payload.get("artists", {}).items()):
        info = d.get("artist") or {}
        if "error" in info:
            continue
        tracks = (d.get("top") or {}).get("data") or []
        top = tracks[0] if tracks else {}
        r = _row(date, item_id, "deezer",
                 fans=_int(info.get("nb_fan")),
                 albums=_int(info.get("nb_album")),
                 top_track=top.get("title"),
                 top_track_rank=_int(top.get("rank")))
        if r:
            rows.append(r)
    return rows


def convert_lastfm(date, payload):
    rows = []
    for item_id, d in sorted(payload.get("artists", {}).items()):
        stats = (d.get("artist") or {}).get("stats") or {}
        r = _row(date, item_id, "lastfm",
                 listeners=_int(stats.get("listeners")),
                 playcount=_int(stats.get("playcount")))
        if r:
            rows.append(r)
    return rows


CONVERTERS = {"deezer": convert_deezer, "lastfm": convert_lastfm}
