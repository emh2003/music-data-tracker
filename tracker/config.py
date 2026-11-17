"""What the tracker follows: the artists, their keys, and the columns of the history file."""

# item_id is the key that lines an artist up from one day to the next. It is our own
# slug, so it never changes even if a source renames the artist.
# deezer_id was looked up once with https://api.deezer.com/search/artist?q=<name>.
# lastfm_name is the name sent to Last.fm's artist.getInfo (with autocorrect on).
# genre is our own label, used as a filter on the site.
ARTISTS = [
    {"item_id": "sza", "item": "SZA", "deezer_id": 5531258, "lastfm_name": "SZA", "genre": "R&B"},
    {"item_id": "tyler-childers", "item": "Tyler Childers", "deezer_id": 5801503, "lastfm_name": "Tyler Childers", "genre": "Country"},
    {"item_id": "led-zeppelin", "item": "Led Zeppelin", "deezer_id": 848, "lastfm_name": "Led Zeppelin", "genre": "Rock"},
    {"item_id": "fontaines-dc", "item": "Fontaines D.C.", "deezer_id": 14175163, "lastfm_name": "Fontaines D.C.", "genre": "Alternative"},
    {"item_id": "megan-thee-stallion", "item": "Megan Thee Stallion", "deezer_id": 12816021, "lastfm_name": "Megan Thee Stallion", "genre": "Hip-Hop"},
    {"item_id": "flo-milli", "item": "Flo Milli", "deezer_id": 15103965, "lastfm_name": "Flo Milli", "genre": "Hip-Hop"},
    {"item_id": "flatland-cavalry", "item": "Flatland Cavalry", "deezer_id": 7954262, "lastfm_name": "Flatland Cavalry", "genre": "Country"},
    {"item_id": "zara-larsson", "item": "Zara Larsson", "deezer_id": 4331004, "lastfm_name": "Zara Larsson", "genre": "Pop"},
    {"item_id": "green-day", "item": "Green Day", "deezer_id": 52, "lastfm_name": "Green Day", "genre": "Rock"},
    {"item_id": "tame-impala", "item": "Tame Impala", "deezer_id": 134790, "lastfm_name": "Tame Impala", "genre": "Alternative"},
    {"item_id": "21-savage", "item": "21 Savage", "deezer_id": 6853403, "lastfm_name": "21 Savage", "genre": "Hip-Hop"},
    {"item_id": "brent-faiyaz", "item": "Brent Faiyaz", "deezer_id": 7397124, "lastfm_name": "Brent Faiyaz", "genre": "R&B"},
    {"item_id": "frank-ocean", "item": "Frank Ocean", "deezer_id": 1350335, "lastfm_name": "Frank Ocean", "genre": "R&B"},
    {"item_id": "kacey-musgraves", "item": "Kacey Musgraves", "deezer_id": 399990, "lastfm_name": "Kacey Musgraves", "genre": "Country"},
    {"item_id": "don-toliver", "item": "Don Toliver", "deezer_id": 13631667, "lastfm_name": "Don Toliver", "genre": "Hip-Hop"},
]

BY_ID = {a["item_id"]: a for a in ARTISTS}

# Sources in the order they are called. Each raw file is data/raw/<date>/<name>.json.gz
SOURCES = ["deezer", "lastfm"]

# Columns of data/history.csv. The first four are fixed by the assignment.
COLUMNS = [
    "date", "item_id", "item", "source",
    "genre", "fans", "albums", "top_track", "top_track_rank", "listeners", "playcount", "image",
]

# Numeric columns, used by the move rule, the status file and the site.
METRICS = ["fans", "top_track_rank", "listeners", "playcount"]

# How many moves the daily issue lists.
TOP_MOVES = 10
