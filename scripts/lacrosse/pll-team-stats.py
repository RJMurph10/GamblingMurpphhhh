"""PLL team game stats from the owner's sheets (copied from the PLL game page's team-stats tab, one .xlsx per game).

Usage: python3 -I scripts/lacrosse/pll-team-stats.py <season> <dir of .xlsx> <out.json>

Each file is named "M_D Home vs Away" (Home = the club the PLL lists first, the same names as the
play-by-play sheets). Column A holds one cell per line: section headings ("Overview", "Shooting", ...) and
stat lines written "<home value><Label><away value>", e.g. "38Shots46", "34.2%Shooting %26.1%",
"101 Point Goals12" (10 and 12), "1 of 3Power Play0 of 3". Labels that start with a digit are matched
whole, so the home value is everything before the label.

Nothing is changed: the values are the PLL's team totals. They are the source for team numbers that no
player gets credit for (team turnovers, passes, touches and caused turnovers run above the players' sum).
See the project doc pll-team-stats.md for the checks against the box scores and play-by-play.

Output: { source, season, fields: [[key, label, section, kind]], games: [{date, home, away, file, stats}] }
stats[i] = [home, away] for fields[i]; kind "n" (count), "pct" (percent), "of" ([made, chances]).
"""
import json, re, sys
from pathlib import Path

import openpyxl

FIELDS = [
    # key, PLL label, section, kind
    ("score", "Scores", "Overview", "n"),
    ("poss", "Possession %", "Overview", "pct"),
    ("shots", "Shots", "Shooting", "n"),
    ("shotPct", "Shooting %", "Shooting", "pct"),
    ("g1", "1 Point Goals", "Shooting", "n"),
    ("g2", "2 Point Goals", "Shooting", "n"),
    ("sog", "Shots on Goal", "Shooting", "n"),
    ("gb", "Ground Balls", "Possession", "n"),
    ("to", "Turnovers", "Possession", "n"),
    ("ct", "Caused Turnovers", "Possession", "n"),
    ("pass", "Passes", "Possession", "n"),
    ("touch", "Touches", "Possession", "n"),
    ("fow", "Faceoffs Won", "Faceoff", "n"),
    ("foPct", "Faceoff %", "Faceoff", "pct"),
    ("sv", "Saves", "Goalie", "n"),
    ("svPct", "Save %", "Goalie", "pct"),
    ("csv", "Clean Saves", "Goalie", "n"),
    ("pp", "Power Play", "Power Play", "of"),
    ("pen", "Penalties", "Power Play", "n"),
    ("pim", "Penalty Minutes", "Power Play", "n"),
]
SECTIONS = {"Overview", "Shooting", "Possession", "Faceoff", "Goalie", "Power Play"}
VAL = r"(\d+(?:\.\d+)?%?|\d+ of \d+|-)"
BY_LEN = sorted({f[1] for f in FIELDS}, key=len, reverse=True)


def num(v):
    if v == "-":
        return None
    if v.endswith("%"):
        return float(v[:-1])
    if " of " in v:
        a, b = v.split(" of ")
        return [int(a), int(b)]
    return float(v) if "." in v else int(v)


def parse(path):
    rows = [str(r[0]).strip() for r in openpyxl.load_workbook(path, read_only=True).worksheets[0].iter_rows(values_only=True)
            if r and r[0] is not None]
    out = {}
    for t in rows:
        if t in SECTIONS:
            continue
        for lab in BY_LEN:
            m = re.fullmatch(VAL + re.escape(lab) + VAL, t)
            if m:
                out.setdefault(lab, [num(m.group(1)), num(m.group(2))])
                break
        else:
            raise SystemExit(f"{path.name}: can't read line {t!r}")
    return out


def main():
    season, src, dst = int(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    games = []
    for f in sorted(src.glob("*.xlsx")):
        md, rest = f.stem.split(" ", 1)
        home, away = rest.split(" vs ")
        m, d = md.split("_")
        s = parse(f)
        missing = [f[1] for f in FIELDS if f[1] not in s]
        if missing:
            print(f"  {f.stem}: missing {missing}")
        games.append(dict(date=f"{season}-{int(m):02d}-{int(d):02d}", home=home, away=away, file=f.name,
                          stats=[s.get(lab, [None, None]) for _, lab, _, _ in FIELDS]))
    games.sort(key=lambda g: (g["date"], g["file"]))
    out = dict(source="The owner's copies of the PLL game page's team stats (scripts/lacrosse/team-sheets).",
               season=season, fields=[list(f) for f in FIELDS], games=games)
    dst.write_text(json.dumps(out, separators=(",", ":")))
    print(f"{len(games)} games -> {dst}")


main()
