"""PLL play-by-play from the owner's sheets (copied from the PLL game page, one .xlsx per game).

Usage: python3 -I scripts/lacrosse/pll-pbp.py <season> <dir of .xlsx> <out.json>

Each file is named "M_D Home vs Away" (Home = the club the PLL lists first) and holds one row per period:
row 1 = Q1 ... row 4 = Q4, a 5th row for overtime. Each row is one long text cell of plays, newest first:
  Shot CHA logo 50.35% (+3.32%) NYA logo Q1 0:01 Missed shot(2pt) by Liam Entenmann.
  = type, [favored club (old code) + its win probability + change], acting club (city code), period, clock
  remaining, description. Overtime reads "OT 7:36" in place of "Q5 7:36". Groundballs and penalties carry
  no win probability. The win probability belongs to whichever club is favored at that moment, so it is
  stored as the home club's chance (100 - p when the away club is the favored one).

What is cleaned, nothing else:
  - plays come out oldest first;
  - a "Goal" with no scorer that doesn't change the score is dropped (one in 2026: Redwoods-Archers 5/8,
    Q4 9:17, the box shows it was a saved shot);
  - the same play repeated back to back (same period, clock and text) is shown once;
  - a faceoff listed twice (a copy at the goal, then the real one seconds later; some 2024 games) once;
  - club codes in the text become club names ("Save by NYA L. Entenmann" -> "Save by Atlas L. Entenmann").
The box-score sheets stay the source of every stat total; this is the game's event log.
See the project doc pll-play-by-play.md for the checks against the box scores.
"""
import json, re, sys
from pathlib import Path

import openpyxl

CLUB = {
    # city codes (the acting club)
    "UTA": "Archers", "NYA": "Atlas", "BOS": "Cannons", "CAR": "Chaos", "DEN": "Outlaws",
    "CAL": "Redwoods", "PHI": "Waterdogs", "MDW": "Whipsnakes",
    # club codes (the favored club on the win probability)
    "ARC": "Archers", "ATL": "Atlas", "CAN": "Cannons", "CHA": "Chaos", "OUT": "Outlaws",
    "RED": "Redwoods", "WAT": "Waterdogs", "WHP": "Whipsnakes",
}
TYPES = "Shot|Groundball|Turnover|Faceoff|Goal|Violation|Penalty|Timeout"
EV = re.compile(
    r"(?:(?P<type>" + TYPES + r") "
    r"(?:(?P<wpteam>[A-Z]{2,4}) logo (?P<wp>[\d.]+)% \((?P<dwp>[+-]?[\d.]+)%\) )?"
    r"(?P<team>[A-Z]{2,4}) logo"
    r"|(?P<start>Game Start) (?P<swpteam>[A-Z]{2,4}) logo (?P<swp>[\d.]+)% logo"
    r"|(?P<final>Final) logo)"
    r" (?:Q(?P<q>\d)|(?P<ot>OT\d?)) (?P<clock>\d+:\d\d) "
)
SCORE = re.compile(r"\s*([A-Z]{2,4}) (\d+) ([A-Z]{2,4}) (\d+)\s*$")
CODE = re.compile(r"\b(" + "|".join(CLUB) + r")\b")
KIND = {"Shot": "shot", "Groundball": "gb", "Turnover": "to", "Faceoff": "fo", "Violation": "viol",
        "Penalty": "pen", "Timeout": "timeout"}


def rows_of(path):
    ws = openpyxl.load_workbook(path, read_only=True).worksheets[0]
    return [str(r[0]) for r in ws.iter_rows(values_only=True) if r and r[0]]


def secs(e):
    m, s = map(int, e["c"].split(":"))
    return (e["p"] - 1) * 720 + 720 - (m * 60 + s)


def drop_ghost_faceoffs(plays):
    """Some 2024 games list every faceoff twice: a copy stamped at the goal (or period start) a few seconds
    before the real one, with the same text. Drop a faceoff when the next faceoff has the same text, comes 15
    seconds or less later in the same period, and this one has no groundball right after it at the same clock
    (a real faceoff is followed by the groundball it names; a quick goal between two real faceoffs keeps both)."""
    fos = [i for i, e in enumerate(plays) if e["k"] == "fo"]
    ghost = set()
    for a, b in zip(fos, fos[1:]):
        # who picked the ball up: "... GB Chaos N. Rowlett." (else the winner)
        winner = re.search(r"GB \w+ (.+?)\.?$", plays[a]["d"]) or re.match(r"Faceoff win (.+?) \(vs", plays[a]["d"])
        nxt = plays[a + 1] if a + 1 < len(plays) else None
        own_gb = (
            nxt is not None
            and nxt["k"] == "gb"
            and nxt["c"] == plays[a]["c"]
            and nxt["p"] == plays[a]["p"]
            and bool(winner)
            and winner.group(1) in nxt["d"]
        )
        if (
            plays[a]["d"] == plays[b]["d"]
            and plays[a]["p"] == plays[b]["p"]
            and 0 <= secs(plays[b]) - secs(plays[a]) <= 15
            and not own_gb
        ):
            ghost.add(a)
    return [e for i, e in enumerate(plays) if i not in ghost]


def parse(path, home, away):
    plays, score = [], {home: 0, away: 0}
    for text in rows_of(path):
        ms = list(EV.finditer(text))
        row = []
        for i, m in enumerate(ms):
            g = m.groupdict()
            desc = text[m.end(): ms[i + 1].start() if i + 1 < len(ms) else len(text)].strip()
            period = int(g["q"]) if g["q"] else 4 + int(g["ot"][2:] or 1)
            fav, p = (g["wpteam"] or g["swpteam"]), (g["wp"] or g["swp"])
            home_wp = None
            if fav and p:
                home_wp = float(p) if CLUB[fav] == home else round(100 - float(p), 2)
            if g["start"]:
                kind, club, desc = "start", None, "Game start"
            elif g["final"]:
                kind, club, desc = "end", None, "Game end"
            else:
                kind, club = KIND.get(g["type"], "goal"), CLUB[g["team"]]
            sc = None
            if g["type"] == "Goal":
                s = SCORE.search(desc)
                if s:
                    sc = {CLUB[s.group(1)]: int(s.group(2)), CLUB[s.group(3)]: int(s.group(4))}
                    desc = desc[: s.start()].strip()
                lead = desc.split(" by ")[0]  # "GOAL", "2PT G", "PP Goal", "PP 2PT G"
                kind = ("goal2" if "2PT" in lead else "goal") + ("pp" if "PP" in lead else "")
            row.append(dict(p=period, c=g["clock"], k=kind, club=club, d=CODE.sub(lambda x: CLUB[x.group(1)], desc),
                            wp=home_wp, sc=sc))
        plays += reversed(row)  # each row lists the newest play first
    plays = drop_ghost_faceoffs(plays)
    out, last = [], None
    for e in plays:
        if e["k"].startswith("goal"):
            if not e["sc"] or e["sc"] == score:  # no score change: not a goal (feed error)
                continue
            score = e["sc"]
        sig = (e["p"], e["c"], e["k"], e["d"])
        if sig == last:
            continue
        last = sig
        out.append([e["p"], e["c"], e["k"], e["club"], e["d"], e["wp"],
                    *( [e["sc"][home], e["sc"][away]] if e["sc"] else [] )])
    return out, score


def main(season, folder, out_path):
    games = []
    for f in sorted(Path(folder).glob("*.xlsx")):
        md, rest = f.stem.split(" ", 1)
        home, away = rest.split(" vs ")
        m, d = md.split("_")
        plays, final = parse(f, home, away)
        games.append(dict(date=f"{season}-{int(m):02d}-{int(d):02d}", home=home, away=away, file=f.name,
                          final=[final[home], final[away]], plays=plays))
    games.sort(key=lambda g: (g["date"], g["home"]))
    doc = dict(
        source="The owner's copies of the PLL's game-page play-by-play (scripts/lacrosse/pbp-sheets).",
        season=int(season),
        fields="plays: [period (5 = OT), clock remaining, kind, club, text, home win % or null, "
               "home score, away score (goals only)]",
        games=games,
    )
    Path(out_path).write_text(json.dumps(doc, separators=(",", ":")) + "\n")
    print(f"{len(games)} games, {sum(len(g['plays']) for g in games)} plays -> {out_path}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
