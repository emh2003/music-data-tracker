import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture
def deezer_payload():
    return json.loads((FIX / "deezer_sample.json").read_text())


@pytest.fixture
def lastfm_payload():
    return json.loads((FIX / "lastfm_sample.json").read_text())
