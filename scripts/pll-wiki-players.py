"""Usage: python3 scripts/pll-wiki-players.py scripts/pll-wiki/pages.json.gz src/data/pll-players.json \
          scripts/pll-wiki/roster-history-season-ends.json.gz scripts/pll-wiki/roster-history-extra.json.gz
The inputs are Wikipedia API snapshots: current team and season pages' wikitext, and team pages' roster
sections as they stood at past dates (prop=revisions&rvstart=<date>&rvdir=older), keyed "<page>|<season>".
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

# misspellings on Wikipedia's pages
NAME_FIX = {"Blaze Riordan": "Blaze Riorden"}

COLS = {"#": ("#", "No.", "No", "Number"), "Name": ("Name", "Player"), "Position": ("Position", "Pos.", "Pos")}

def parse_roster(sec):
    """A roster section's season (from its title row) and players."""
    # the season from the table's title row ('''2025 Utah Archers''') or caption (|+2021 Chrome Lacrosse Club)
    hm = re.search(r"'''(\d{4})\s[^']*'''", sec) or re.search(r"\n\|\+\s*(?:style=[^|\n]*\|)?\s*(\d{4})\b", sec)
    marks = roster_marks(sec)
    # injury icons: [[File:Injury icon 2.svg|12px|Out]] -> {INJ:Out}
    sec = re.sub(r"\[\[File:Injury icon[^\]]*?\|([^\]|]*)\]\]", r" {INJ:\1}", sec)
    for cap, head, rows in tables(sec):
        col = {h: i for i, h in enumerate(head)}
        for k, names in COLS.items():
            for n in names:
                if n in col and k not in col: col[k] = col[n]
        if "Name" not in col or "Position" not in col: continue
        players = []
        for r in rows:
            if len(r) < len(head) - 1 or col["Name"] >= len(r) or not r[col["Name"]]: continue
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
            name = NAME_FIX.get(name, name)
            p = dict(num=r[col["#"]].strip() if "#" in col and col["#"] < len(r) else "", name=name,
                     pos=r[col["Position"]].strip() if col["Position"] < len(r) else "")
            if status: p["status"] = status
            if rookie: p["rookie"] = True
            for k, h in (("shot", "Shot"), ("height", "Height"), ("weight", "Weight"), ("college", "College"), ("hometown", "Hometown")):
                if h in col and col[h] < len(r) and r[col[h]]: p[k] = r[col[h]]
            if cap_: p["captain"] = True
            c = p.get("college")
            if c in COLLEGE_ESPN: p["collegeLogo"] = f"https://a.espncdn.com/i/teamlogos/ncaa/500/{COLLEGE_ESPN[c]}.png"
            elif c in COLLEGE_LOCAL: p["collegeLogo"] = COLLEGE_LOCAL[c]
            players.append(p)
        if players: return (int(hm.group(1)) if hm else None), players
    return None, []

# rosters[teamId][season] = {page, revid?, players}
rosters = {}
for tid, page in PAGES.items():
    season, players = parse_roster(section(d[page], "Roster"))
    if players and season: rosters.setdefault(tid, {})[str(season)] = dict(page=page, players=players)

# past seasons: each team page as it stood at the end of a season (Wikipedia page history)
HIST_PAGES = {  # page -> (team id, seasons the page describes that PLL club)
    "Utah_Archers": ("127631", 2019, 2099), "Atlas_Lacrosse_Club": ("127632", 2019, 2099),
    "Cannons_Lacrosse_Club": ("122997", 2021, 2099), "Boston_Cannons": ("122997", 2021, 2099),
    "Carolina_Chaos": ("127634", 2019, 2099),
    # Chrome's page became the Denver Outlaws' in 2024
    "Chrome_Lacrosse_Club": ("127635", 2019, 2023), "Denver_Outlaws": ("122896", 2024, 2099),
    "Redwoods_Lacrosse_Club": ("127636", 2019, 2099), "Philadelphia_Waterdogs": ("127637", 2020, 2099),
    "Maryland_Whipsnakes": ("127638", 2019, 2099),
}
# snapshots are keyed "<page>|<year>" (end of that season) or "<page>|<year><x>" (extra dates, kept only when
# the roster's own title names its season)
for path in sys.argv[3:]:
    hist = json.load(gzip.open(path))
    for key, h in sorted(hist.items()):
        page, label = key.split("|")
        tid, first, last = HIST_PAGES[page]
        if not h.get("roster"): continue
        season, players = parse_roster(h["roster"])
        if not players: continue
        if label.isdigit():
            # the roster the page had for that season (or untitled and edited that year)
            y = int(label)
            if (season or int(h["ts"][:4])) != y: continue
        elif season: y = season
        else: continue
        if not first <= y <= last or str(y) in rosters.get(tid, {}): continue
        rosters.setdefault(tid, {})[str(y)] = dict(page=page, revid=h["revid"], players=players)

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

def award_name(s):
    s = clean(s)
    s = re.sub(r"\s*-\s*Awarded to.*$", "", s)
    return s.strip()

awards = {}
for y in range(2019, 2027):
    w = d.get(f"{y}_Premier_Lacrosse_League_season", "")
    out = []
    # a table of winners: Award | Recipient | Team | Position
    for m in re.finditer(r"\n==+\s*(?:Awards|Award winners)\s*==+", w):
        sec = w[m.end():]
        sec = sec[: (re.search(r"\n==[^=]", sec) or re.search(r"$", sec)).start()]
        for cap, head, rows in tables(sec):
            if head[:2] != ["Award", "Recipient"]: continue
            for r in rows:
                if len(r) >= 3 and r[0] and r[1]:
                    out.append(dict(award=award_name(r[0]), player=r[1].strip(), team=team_id(r[2]), pos=r[3].strip() if len(r) > 3 else ""))
        if out: break
    # finalists, winner in bold: ===== Award ===== then "* '''Name''' <small>(Team)</small>"
    if not out:
        for m in re.finditer(r"\n=====\s*([^=\n]+?)\s*=====\n((?:\*[^\n]*\n?)+)", w):
            for line in m.group(2).split("\n"):
                if "'''" not in line: continue
                bold = re.search(r"'''(.+?)'''", line)
                tm = re.search(r"<small>\((.+?)\)</small>", line)
                out.append(dict(award=award_name(m.group(1)), player=clean(bold.group(1)), team=team_id(clean(tm.group(1))) if tm else None, pos=""))
                break
    # the infobox's MVPs: the only awards on some pages (2022), and the championship game MVP everywhere
    for key, label in (("MVP", "Jim Brown Most Valuable Player"), ("finals_MVP", "Championship Game MVP")):
        im = re.search(r"\|\s*" + key + r"\s*=\s*([^\n]+)", w)
        if not im or not clean(im.group(1)): continue
        val = clean(im.group(1)); tm = re.search(r"\(([^)]+)\)\s*$", val)
        name = re.sub(r"\s*\([^)]*\)\s*$", "", val).strip()
        if name and not any(r["award"] == label or (key == "MVP" and "Most Valuable" in r["award"]) for r in out):
            out.append(dict(award=label, player=name, team=team_id(tm.group(1)) if tm else None, pos=""))
    for r in out: r["player"] = NAME_FIX.get(r["player"], r["player"])
    if out: awards[y] = dict(page=f"{y}_Premier_Lacrosse_League_season", rows=out)

# ---- head coaches: each team page's coaches table ("# | Name | Term | record...") -> coach per season
TEAM_SEASONS = {  # team id -> (first, last) PLL seasons
    "127631": (2019, 2099), "127632": (2019, 2099), "122997": (2021, 2099), "127634": (2019, 2099),
    "127635": (2019, 2023), "122896": (2024, 2099), "127636": (2019, 2099), "127637": (2020, 2099), "127638": (2019, 2099),
}
LAST_SEASON = 2026

def coach_rows(w):
    m = re.search(r"\n(==+)\s*(?:All-time |Current )?[Hh]ead [Cc]oaches\s*\1", w)
    if not m: return []
    sec = w[m.end():]
    sec = sec[: (re.search(r"\n==[^=]", sec) or re.search(r"$", sec)).start()]
    out = []
    for cap, head, rows in tables(sec):
        ni = next((head.index(h) for h in ("Name", "Coach") if h in head), None)
        ti = next((head.index(h) for h in ("Term", "Seasons") if h in head), None)
        if ni is None or ti is None: continue
        for r in rows:
            if len(r) <= ti or not r[ni]: continue
            yrs = [int(x) for x in re.findall(r"\b(20\d\d)\b", r[ti])]
            if not yrs: continue
            open_ = bool(re.search(r"[–-]\s*$", r[ti])) or bool(re.search(r"present|current", r[ti], re.I))
            out.append(dict(name=re.sub(r"\s+", " ", r[ni]).strip(), first=yrs[0], last=LAST_SEASON if open_ else yrs[-1]))
    return out

coaches = {}
# Chrome's page became the Denver Outlaws' (same franchise), so Chrome's coaches come from that page
for tid, page in list(PAGES.items()) + [("127635", "Denver_Outlaws")]:
    first, last = TEAM_SEASONS[tid]
    for c in coach_rows(d[page]):
        for y in range(max(c["first"], first), min(c["last"], last) + 1):
            coaches.setdefault(tid, {}).setdefault(str(y), [])
            if c["name"] not in coaches[tid][str(y)]: coaches[tid][str(y)].append(c["name"])

# ---- draft history: "College Draft" tables per year on each team page
def draft_rows(w):
    m = re.search(r"\n(==+)\s*(?:All[- ]time [Dd]raft [Ss]elections|Draft history|Draft picks)\s*\1", w)
    if not m: return {}
    sec = w[m.end():]
    # the section runs to the next level-2 heading that isn't one of its draft years
    for h in re.finditer(r"\n==([^=].*?)==\s*\n", sec):
        if "Draft" not in h.group(1): sec = sec[: h.start()]; break
    out = {}
    pos = 0
    for tm in re.finditer(r"\n\{\|.*?\n\|\}", sec, re.S):
        before = sec[pos: tm.start()]; pos = tm.end()
        # heading-like lines only (bold, a link or a == heading naming a draft year), not prose or
        # references that mention a draft
        # (inside the draft section a bare bold year, '''[[2019 ...|2019]]''', is a draft year too)
        heads = [h for h in re.findall(r"\n((?:'''|\[\[|=)[^\n]*\d{4}[^\n]*)", before) if len(h) < 140 and "<ref" not in h]
        y = kind = None
        if heads:
            h = heads[-1]
            if re.search(r"Acquisition|Pool|Supplemental|Trade", h): continue
            # the year shown, not the link target's: [[2024 ...|'''2025 College Draft''']] is 2025
            shown = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", h)
            yrs = re.findall(r"\d{4}", shown) or re.findall(r"\d{4}", h)
            y = yrs[-1]
            kind = "Entry" if "Entry" in h else "Expansion" if "Expansion" in h else "College"
        if kind and kind != "College": continue
        for cap, head, rows in tables(tm.group(0)):
            if head and head[0] == "Draft":  # one table, the year in the first cell of each year's rows
                cur = None
                for r in rows:
                    if len(r) == len(head):
                        ym = re.search(r"(\d{4})", r[0]); cur = (ym.group(1), "(E)" in r[0] or "Entry" in r[0]) if ym else None
                        r = r[1:]
                    if not cur or cur[1] or len(r) < 5: continue
                    out.setdefault(cur[0], []).append(dict(round=r[0], pick=r[1], player=r[2], pos=r[3], college=r[4]))
                continue
            if y is None: continue
            col = {h: i for i, h in enumerate(head)}
            pi = col.get("Player"); ci = col.get("College"); po = col.get("Pos.", col.get("Position"))
            ri = col.get("Rnd.", col.get("Round")); ki = col.get("Pick #", col.get("Pick"))
            if pi is None: continue
            for r in rows:
                if len(r) <= pi or not r[pi]: continue
                g = lambda i: r[i].strip() if i is not None and i < len(r) else ""
                if ri is not None and not g(ri).isdigit(): continue  # "Undrafted" signings
                out.setdefault(y, []).append(dict(round=g(ri), pick=g(ki), player=re.sub(r"\s*\*?Note\*.*$", "", g(pi)).strip(),
                                                  pos=g(po), college=g(ci)))
    return out

drafts = {}
for tid, page in list(PAGES.items()) + [("127635", "Denver_Outlaws")]:
    first, last = TEAM_SEASONS[tid]
    for y, rows in draft_rows(d[page]).items():
        if first <= int(y) <= last: drafts.setdefault(tid, {})[y] = rows

# awards listed without a team: the team whose roster had the player that season (else the closest season)
def team_of(player, y):
    for yy in sorted({int(k) for r in rosters.values() for k in r}, key=lambda k: abs(k - y)):
        for tid, by in rosters.items():
            if any(p["name"] == player for p in by.get(str(yy), {}).get("players", [])): return tid
    for l in leaders.get(y, {}).get("rows", []):
        if l["player"] == player: return l["team"]
    return None
for y, a in awards.items():
    for r in a["rows"]:
        if not r["team"]: r["team"] = team_of(r["player"], y)

# ---- championship games: the league page's Seasons table (season | champion | score | runner-up | leader)
champions = []
lw = d.get("Premier_Lacrosse_League", "")
sm = re.search(r"\n==\s*Seasons\s*==", lw)
if sm:
    sec = lw[sm.end():]
    sec = sec[: (re.search(r"\n==[^=]", sec) or re.search(r"$", sec)).start()]
    for tm in re.finditer(r"\n\{\|.*?\n\|\}", sec, re.S):
        for r in tm.group(0).split("\n|-")[1:]:
            cells = [clean(re.sub(r'^\s*(?:scope|style)="[^"]*"[^|]*\|', "", c)) for c in r.split("\n|")[1:]]
            cells = [c for c in cells if c != ""]
            if len(cells) < 4 or not re.fullmatch(r"\d{4}", cells[0]): continue
            y = int(cells[0])
            ot = "(OT)" in cells[2]
            sc = re.match(r"(\d+)\s*[–-]\s*(\d+)", cells[2])
            if not sc: continue
            mvp = next((a["player"] for a in awards.get(y, {}).get("rows", []) if a["award"] == "Championship Game MVP"), None)
            champions.append(dict(season=y, champion=team_id(cells[1]), score=[int(sc.group(1)), int(sc.group(2))], ot=ot,
                                  runnerUp=team_id(cells[3]), regularSeasonLeader=team_id(cells[4]) if len(cells) > 4 else None,
                                  mvp=mvp))

json.dump({"source": "Wikipedia (CC BY-SA 4.0): PLL team pages and season pages", "rosters": rosters, "leaders": leaders, "awards": awards, "coaches": coaches, "drafts": drafts, "champions": champions},
          open(sys.argv[2], "w"), separators=(",", ":"), ensure_ascii=False)
for t, r in rosters.items(): print("roster", t, {y: len(v["players"]) for y, v in sorted(r.items())})
for y, l in leaders.items(): print("leaders", y, len(l["rows"]), sorted({x["stat"] for x in l["rows"]})[:14], l["rows"][:1])
for y, a in awards.items(): print("awards", y, len(a["rows"]), [(r["award"][:28], r["player"], r["team"]) for r in a["rows"][:3]])
for t, c in coaches.items(): print("coaches", t, c)
for t, dr in drafts.items(): print("drafts", t, {y: len(v) for y, v in sorted(dr.items())}, list(dr.values())[0][:1])
for c in champions: print("champ", c)
