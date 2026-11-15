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

# ESPN team ids for players' colleges (logos at a.espncdn.com/i/teamlogos/ncaa/500/<id>.png). LIU Post merged
# into LIU in 2019, so it takes LIU's logo; Wesleyan is Wesleyan (CT).
COLLEGE_ESPN = {
    "Albany": "399", "Army": "349", "Bellarmine": "91", "Brown": "225", "Bryant": "2803", "Colgate": "2142",
    "Cornell": "172", "Delaware": "48", "Denver": "2172", "Detroit Mercy": "2174", "Drexel": "2182", "Duke": "150",
    "Florida": "57", "Georgetown": "46", "Harvard": "108", "High Point": "2272", "Ithaca": "175", "Jacksonville": "294",
    "Johns Hopkins": "118", "Lafayette": "322", "Lehigh": "2329", "Loyola": "2352", "Marist": "2368", "Marquette": "269",
    "Maryland": "120", "Mercyhurst": "2385", "Michigan": "130", "North Carolina": "153", "Notre Dame": "87",
    "Ohio State": "194", "Penn": "219", "Penn State": "213", "Princeton": "163", "Providence": "2507", "Richmond": "257",
    "Rutgers": "164", "Saint Joseph's": "2603", "Salisbury": "2532", "St. Bonaventure": "179", "St. John's": "2599",
    "Syracuse": "183", "Towson": "119", "Tufts": "112", "UMass": "113", "Utah": "254", "Vermont": "261",
    "Villanova": "222", "Virginia": "258", "Wingate": "351", "Yale": "43",
    "Hobart": "174", "Wesleyan": "336", "LIU Post": "2341",
}
# Colleges ESPN doesn't list: public-domain marks from Wikimedia Commons, stored in public/logos/colleges
COLLEGE_LOCAL = {"Adelphi": "/logos/colleges/adelphi.png", "York": "/logos/colleges/york.png"}

def roster_marks(sec):
    """The page's legend: which symbol (*, **, ^) means which list (PUP, holdout, ...)."""
    marks = {}
    for m in re.finditer(r"(?:<nowiki>)?(\*\*|\*|\^)(?:</nowiki>)?\s*[Ii]ndicates (?:a )?player is on (?:the )?(.+?)(?: [Ll]ist)?\s*(?:<ref|\n|$)", sec):
        label = m.group(2).strip()
        label = {"physically unable to perform": "PUP"}.get(label.lower(), label[0].upper() + label[1:])
        marks[m.group(1)] = label
    return marks

rosters = {}
for tid, page in PAGES.items():
    w = d[page]; sec = section(w, "Roster")
    hm = re.search(r"'''(\d{4})\s[^']*'''", sec)
    marks = roster_marks(sec)
    # injury icons: [[File:Injury icon 2.svg|12px|Out]] -> {INJ:Out}
    sec = re.sub(r"\[\[File:Injury icon[^\]]*?\|([^\]|]*)\]\]", r" {INJ:\1}", sec)
    for cap, head, rows in tables(sec):
        if "Name" not in head: continue
        col = {h: i for i, h in enumerate(head)}
        players = []
        for r in rows:
            if len(r) < len(head) - 1 or not r[col["Name"]]: continue
            name = r[col["Name"]]; cap_ = "(C)" in name
            status = []
            inj = re.search(r"\{INJ:([^}]*)\}", name)
            if inj: status.append("Injured" if inj.group(1).strip().lower() == "out" else inj.group(1).strip())
            for sym in ("**", "^", "*"):  # longest first
                if sym in name and sym in marks:
                    status.append(marks[sym]); name = name.replace(sym, "")
            rookie = "(R)" in name
            name = re.sub(r"\{INJ:[^}]*\}|\(C\)|\(R\)|[*^]", "", name)
            name = re.sub(r"\s+", " ", name).strip()
            p = dict(num=r[col["#"]].strip(), name=name, pos=r[col["Position"]].strip())
            if status: p["status"] = status
            if rookie: p["rookie"] = True
            for k, h in (("shot", "Shot"), ("height", "Height"), ("weight", "Weight"), ("college", "College"), ("hometown", "Hometown")):
                if h in col and col[h] < len(r) and r[col[h]]: p[k] = r[col[h]]
            if cap_: p["captain"] = True
            c = p.get("college")
            if c in COLLEGE_ESPN: p["collegeLogo"] = f"https://a.espncdn.com/i/teamlogos/ncaa/500/{COLLEGE_ESPN[c]}.png"
            elif c in COLLEGE_LOCAL: p["collegeLogo"] = COLLEGE_LOCAL[c]
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
