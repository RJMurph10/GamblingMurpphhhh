"""Usage: python3 scripts/pll-wiki-history.py <wikitext json.gz> src/data/pll-2019-2021.json
PLL 2019-2021 games from Wikipedia's season pages (CC BY-SA 4.0): date, teams, final score, OT, venue, city."""
import gzip, json, re, sys
d = json.load(gzip.open(sys.argv[1]))
MON = "January February March April May June July August September October November December".split()
link = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]")
def clean(s):
    s = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>|<ref[^>]*>.*$", "", s)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = link.sub(lambda m: m.group(1), s)
    s = re.sub(r"\{\{small\|([^}]*)\}\}", r"\1", s)
    s = re.sub(r"'''|''|\{\{[^}]*\}\}|\(‡\)", "", s)
    return re.sub(r"\s+", " ", s).strip()
strip_rs = lambda c: re.sub(r'^\s*(rowspan|colspan)="?\d+"?\s*\|', '', c)
IDS = {"Archers": "127631", "Atlas": "127632", "Chaos": "127634", "Redwoods": "127636", "Waterdogs": "127637",
       "Whipsnakes": "127638", "Cannons": "122997", "Chrome": "127635"}
ALLSTAR = {"Team Baptiste": "as-baptiste", "Team Rambo": "as-rambo", "Adversaries": "as-adversaries", "Defenders": "as-defenders"}
games = []
for t, w in d.items():
    year = int(t[:4])
    if year > 2021: continue
    hm = re.search(r"\n==+\s*Championship Series Schedule\s*==+", w) or re.search(r"\n==+\s*[^=\n]*Schedule[^=\n]*==+", w)
    i = hm.start(); j = w.find("\n|}", w.find("\n{|", i))
    date = venue = city = None
    for line in w[i:j].split("\n"):
        if not line.startswith("|") or line.startswith(("|-", "|}", "|+")): continue
        cells = [strip_rs(c) for c in line.lstrip("|").split("||")]
        gi = None
        for k, c in enumerate(cells):
            cc = clean(c)
            if re.search(r"\d{1,2}\s?[–-]\s?\d{1,2}", cc) and re.search(r"[A-Za-z]", cc) and not re.search(r"\b(am|pm)\b", cc):
                gi = k; break
            m = re.search(r"(" + "|".join(MON) + r")\s+(\d{1,2})", cc)
            if m: date = (MON.index(m.group(1)) + 1, int(m.group(2)))
        if gi is None or date is None: continue
        if len(cells) > gi + 3:
            venue, city = clean(cells[gi + 2]), clean(cells[gi + 3])
        g = re.match(r"(?:(Championship Game|Draft Pick Game|Semifinals?|Quarterfinals?|Final)\s*:\s*)?(.+?)\s(\d{1,2})\s?[–-]\s?(\d{1,2})(?:\s*\((\d?OT)\))?\s(.+?)(?:\s*\((\d?OT)\))?$", clean(cells[gi]))
        if not g: continue
        label, a, sa, sb, ot1, b, ot2 = g.groups()
        if label == "Draft Pick Game": continue  # an exhibition for draft picks, not a PLL game
        ta, tb = IDS.get(a) or ALLSTAR.get(a), IDS.get(b) or ALLSTAR.get(b)
        if not ta or not tb: print("skip", year, a, b); continue
        mo, dy = date
        games.append(dict(id=f"wiki-{year}-{sum(1 for x in games if x["season"] == year) + 1:02d}", date=f"{year}-{mo:02d}-{dy:02d}T20:00Z", season=year,
                          away=ta, home=tb, awayScore=int(sa), homeScore=int(sb), ot=bool(ot1 or ot2),
                          label=label, venue=venue, city=city))
# phases: All-Star teams; 2020's bubble = Championship Series; the regular season is each season's first
# N club games by date (2019: 6 teams x 10 games / 2 = 30; 2021: 8 x 9 / 2 = 36), the rest are playoffs
REGULAR = {2019: 30, 2021: 36}
seen = {}
for g in sorted(games, key=lambda g: g["date"]):
    if g["away"].startswith("as-") or g["home"].startswith("as-"): g["phase"] = "allstar"
    elif g["season"] == 2020: g["phase"] = "champ"
    else:
        seen[g["season"]] = seen.get(g["season"], 0) + 1
        g["phase"] = "regular" if seen[g["season"]] <= REGULAR[g["season"]] else "playoffs"
    g.pop("label")
from collections import Counter
print(Counter((g["season"], g["phase"]) for g in games))
print([g for g in games if g["season"] == 2021][-3:])
json.dump({"source": "Wikipedia, 2019-2021 Premier Lacrosse League season pages (CC BY-SA 4.0)", "games": games},
          open(sys.argv[2], "w"), indent=0)
