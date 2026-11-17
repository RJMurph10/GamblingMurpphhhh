"""Check a team's entered PLL box-score sheets against ESPN's final scores and the other clubs' sheets.

  python3 -I scripts/lacrosse/check-sheets.py <Team> <season> [src/data/pll-player-games.json]
ESPN results come from src/test/fixtures/pll-<season>-espn.json (one row per game: id, date, status,
sides [[homeAway, shortName, abbr, score]]). A game passes when the team's goals (2-pointers count 2)
equal its ESPN score and its goalies' scores-against equal the opponent's.
"""
import json, sys, datetime as dt, collections

team, season = sys.argv[1], int(sys.argv[2])
data = json.load(open(sys.argv[3] if len(sys.argv) > 3 else "src/data/pll-player-games.json"))
espn = json.load(open(f"src/test/fixtures/pll-{season}-espn.json"))
goals = lambda g: sum(p["stats"]["P"] - p["stats"]["A"] for p in g["players"])
against = lambda g: sum(p["stats"].get("SA") or 0 for p in g["players"])
mine = [g for g in data["games"] if g["team"] == team and g["season"] == season]
bad = 0
for g in sorted(mine, key=lambda g: g["date"]):
    d = dt.date.fromisoformat(g["date"])
    m = [e for e in espn if {s[1] for s in e["sides"]} >= {team, g["opponent"]}
         and abs((dt.date.fromisoformat(e["date"][:10]) - d).days) <= 1]
    other = [o for o in data["games"] if o["team"] == g["opponent"] and o["date"] == g["date"] and o["opponent"] == team]
    line = f"{g['date']} {g['opponent']:11s} sheet {goals(g)}-{against(g)}"
    if other:
        ok2 = goals(other[0]) == against(g) and against(other[0]) == goals(g)
        line += f" | {g['opponent']} sheet {goals(other[0])}-{against(other[0])} {'agrees' if ok2 else 'DISAGREES'}"
        bad += not ok2
    if len(m) != 1:
        line += f" | ESPN: {len(m)} matches"; bad += 1
    else:
        sc = {s[1]: int(s[3] or 0) for s in m[0]["sides"]}
        ok = sc[team] == goals(g) and sc[g["opponent"]] == against(g)
        line += f" | ESPN {sc[team]}-{sc[g['opponent']]} {'OK' if ok else 'MISMATCH'}"
        bad += not ok
    print(line)
played = [e for e in espn if team in {s[1] for s in e["sides"]} and e["status"] == "STATUS_FINAL"]
have = {(g["date"], g["opponent"]) for g in mine}
missing = [(e["date"][:10], [s[1] for s in e["sides"] if s[1] != team][0]) for e in played
           if not any(abs((dt.date.fromisoformat(e["date"][:10]) - dt.date.fromisoformat(d)).days) <= 1 and o in {s[1] for s in e["sides"]} for d, o in have)]
print(f"{len(mine)} sheets; ESPN has {len(played)} finished {team} games; not in the sheets: {missing}")
pl = [p for g in mine for p in g["players"]]
pts = collections.Counter()
for p in pl: pts[p["name"]] += p["stats"]["P"]
print("players", len(pts), "lines", len(pl), "blank CT", sum(p["stats"].get("CT") is None for p in pl), "blank TO", sum(p["stats"].get("TO") is None for p in pl))
print("no number", sorted({(g["date"], p["name"], p["pos"]) for g in mine for p in g["players"] if not p["num"]}))
print("GA derived", [(g["date"], p["name"]) for g in mine for p in g["players"] if p["pos"] == "G" and p["stats"].get("GA") is None])
print("goalies", {g["date"]: [(p["name"].split()[-1], p["stats"]["SA"]) for p in g["players"] if p["stats"].get("SA") is not None] for g in mine if sum(p["stats"].get("SA") is not None for p in g["players"]) > 1})
print("top", pts.most_common(3))
sys.exit(1 if bad else 0)
