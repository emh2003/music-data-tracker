"""Open (or update) the daily GitHub Issue and close the previous one."""
import re

import requests

DATE_TITLE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
LABELS = {"fans": "Deezer fans", "top_track_rank": "Top-track rank",
          "listeners": "Last.fm listeners", "playcount": "Last.fm plays"}


def issue_body(date, moves, appeared, gone, status):
    lines = [f"Daily report for **{date}** (run at {status['run_time']}).", ""]
    lines.append("## Sources")
    for s in status["sources"]:
        lines.append(f"- {s['name']}: {'ok' if s['ok'] else 'FAILED'} ({s['count']} artists)")
    lines += ["", "## Biggest moves since the previous run", ""]
    if moves:
        lines.append("| Artist | Value | Old | New | Change |")
        lines.append("|---|---|---:|---:|---:|")
        for m in moves:
            lines.append(f"| {m['item']} | {LABELS[m['metric']]} | {m['old']:,} | {m['new']:,} | "
                         f"{m['change']:+,} ({m['pct']:+.2f}%) |")
    else:
        lines.append("No values changed since the previous run (or this is the first run).")
    lines += ["", "## Appeared / disappeared", ""]
    lines.append(f"- Appeared: {', '.join(appeared) if appeared else 'none'}")
    lines.append(f"- Disappeared: {', '.join(gone) if gone else 'none'}")
    lines += ["", "Move rule: percent change of each value since the previous date in the history; "
              "the 10 largest (up or down) are listed. See the README."]
    return "\n".join(lines) + "\n"


def plan_issue(open_issues, date):
    """Given open issues [{number, title}], decide what to do today.
    Returns (number_to_update_or_None, [numbers_to_close]).
    A second run on the same day updates that day's issue instead of opening another."""
    today = [i["number"] for i in open_issues if i["title"] == date]
    older = [i["number"] for i in open_issues
             if DATE_TITLE.match(i["title"]) and i["title"] != date]
    return (min(today) if today else None), sorted(older + sorted(today)[1:])


class GitHub:
    def __init__(self, repo, token):
        self.base = f"https://api.github.com/repos/{repo}"
        self.s = requests.Session()
        self.s.headers.update({"Authorization": f"Bearer {token}",
                               "Accept": "application/vnd.github+json"})

    def open_issues(self):
        out, page = [], 1
        while True:
            r = self.s.get(f"{self.base}/issues", params={"state": "open", "per_page": 100, "page": page}, timeout=30)
            r.raise_for_status()
            batch = [i for i in r.json() if "pull_request" not in i]
            out += [{"number": i["number"], "title": i["title"]} for i in batch]
            if len(r.json()) < 100:
                return out
            page += 1

    def publish(self, date, body):
        update, close = plan_issue(self.open_issues(), date)
        if update:
            self.s.patch(f"{self.base}/issues/{update}", json={"body": body}, timeout=30).raise_for_status()
            number = update
        else:
            r = self.s.post(f"{self.base}/issues", json={"title": date, "body": body}, timeout=30)
            r.raise_for_status()
            number = r.json()["number"]
        for n in close:
            self.s.patch(f"{self.base}/issues/{n}",
                         json={"state": "closed", "state_reason": "completed"}, timeout=30).raise_for_status()
        return number
