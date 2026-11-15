"""Usage: python3 scripts/pll-wiki-players.py <wikitext json.gz> src/data/pll-players.json
PLL team rosters and season statistical leaders from Wikipedia (CC BY-SA 4.0). Wikipedia's leader tables
cite the PLL's stats site; rosters cite the PLL's player pages."""
import gzip, json, re, sys

d = json.load(gzip.open(sys.argv[1]))
link = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]")

def clean(s):
    s = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>|<ref[^>]*>.*$", "", s)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"\{\{(?:small|nowrap)\|([^}]*)\}\}", r"\1", s)
    s = link.sub(lambda m: m.group(1), s)
    s = re.sub(r"'''|''|\{\{[^}]*\}\}|<[^>]+>", "", s)
    s = s.replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", s).strip()

def tables(w):
    """Each wikitable as (caption, header cells, rows of cells)."""
    out = []
    for m in re.finditer(r"\n\{\|(.*?)\n\|\}", w, re.S):
        body = m.group(1); cap = ""; head = []; rows = []; cur = None
        for line in body.split("\n")[1:]:
            line = line.rstrip()
            if line.startswith("|+"): cap = clean(line[2:].split("|")[-1]); continue
            if line.startswith("|-"):
                if cur: rows.append(cur)
                cur = []; continue
            if line.startswith("!"):
                for c in re.split(r"!!", line[1:]): head.append(clean(c.split("|")[-1]))
                continue
            if line.startswith("|") and cur is not None:
                for c in line[1:].split("||"):
                    c = re.sub(r'^\s*(?:style|colspan|rowspan|align|bgcolor)="?[^|]*?"?\s*\|(?!\|)', "", c)
                    cur.append(clean(c))
        if cur: rows.append(cur)
        out.append((cap, head, rows))
    return out

def section(w, name):
    m = re.search(r"\n(==+)\s*" + name + r"\s*\1", w)
    if not m: return ""
    n = re.search(r"\n==\s*[^=]", w[m.end():])
    return w[m.start(): m.end() + (n.start() if n else len(w))]

PAGES = {"127631": "Utah_Archers", "127632": "Atlas_Lacrosse_Club", "122997": "Boston_Cannons", "127634": "Carolina_Chaos",
         "122896": "Denver_Outlaws", "127636": "Redwoods_Lacrosse_Club", "127637": "Philadelphia_Waterdogs", "127638": "Maryland_Whipsnakes"}
NAMES = {"archers": "127631", "atlas": "127632", "cannons": "122997", "chaos": "127634", "outlaws": "122896", "chrome": "127635",
         "redwoods": "127636", "waterdogs": "127637", "whipsnakes": "127638"}
def team_id(s):
    for k, v in NAMES.items():
        if k in s.lower(): return v
    return None

rosters = {}
for tid, page in PAGES.items():
    w = d[page]; sec = section(w, "Roster")
    hm = re.search(r"'''(\d{4})\s[^']*'''", sec)
    for cap, head, rows in tables(sec):
        if "Name" not in head: continue
        col = {h: i for i, h in enumerate(head)}
        players = []
        for r in rows:
            if len(r) < len(head) - 1 or not r[col["Name"]]: continue
            name = r[col["Name"]]; cap_ = "(C)" in name
            p = dict(num=r[col["#"]].strip(), name=name.replace("(C)", "").strip(), pos=r[col["Position"]].strip())
            for k, h in (("shot", "Shot"), ("height", "Height"), ("weight", "Weight"), ("college", "College"), ("hometown", "Hometown")):
                if h in col and col[h] < len(r) and r[col[h]]: p[k] = r[col[h]]
            if cap_: p["captain"] = True
            players.append(p)
        rosters[tid] = dict(season=int(hm.group(1)) if hm else None, page=page, players=players)
        break

leaders = {}
for y in range(2019, 2027):
    page = f"{y}_Premier_Lacrosse_League_season"; w = d.get(page, "")
    sec = section(w, r"(?:Regular-season statistical leaders|League leaders)")
    if not sec: continue
    out = []
    for cap, head, rows in tables(sec):
        if head[:2] == ["Statistic", "Player"]:  # one row per stat: "Name (value)"
            for r in rows:
                if len(r) < 4: continue
                m = re.match(r"(.+?)\s*\(([^)]+)\)\s*([\^+*]*)\s*$", r[1])
                if m:
                    row = dict(stat=r[0], player=m.group(1), value=m.group(2), team=team_id(r[3]), rank=1)
                    if "^" in m.group(3): row["note"] = "PLL single-season record"
                    elif "+" in m.group(3): row["note"] = "ties the PLL single-season record"
                    out.append(row)
        elif head and head[0] == "Player" and cap:  # a table per stat, ranked
            for i, r in enumerate(rows):
                if len(r) >= 3 and r[0]:
                    out.append(dict(stat=cap, player=r[0], value=r[2], team=team_id(r[1]), rank=i + 1))
    leaders[y] = dict(page=page, rows=out)

json.dump({"source": "Wikipedia (CC BY-SA 4.0): PLL team pages and season pages", "rosters": rosters, "leaders": leaders},
          open(sys.argv[2], "w"), indent=0, ensure_ascii=False)
for t, r in rosters.items(): print("roster", t, r["season"], len(r["players"]), r["players"][:1])
for y, l in leaders.items(): print("leaders", y, len(l["rows"]), sorted({x["stat"] for x in l["rows"]})[:14], l["rows"][:1])
