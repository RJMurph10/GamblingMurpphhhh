"""College snow games 2007-2012: ESPN schedule (kickoffs, home stadium) -> Open-Meteo archive (same
window and units as fetch_cfb_weather.mjs) -> snow games matched to sportsbookreviewsonline totals."""
import json, re, time, urllib.request as u, difflib, datetime as dt
def get(url, tries=5, js=True):
    for i in range(tries):
        try:
            r = u.urlopen(u.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60)
            b = r.read()
            return json.loads(b) if js else b.decode("utf8", "ignore")
        except Exception as e:
            time.sleep(3 * (i + 1) + (30 if "429" in str(e) else 0))
    return None
STAD = {}
for m in re.finditer(r'^\s*(\d+):\s*\[([-\d.]+),\s*([-\d.]+),\s*"[^"]+"(,\s*1)?\]', open("src/data/cfb/cfb-stadiums.ts").read(), re.M):
    STAD[m.group(1)] = (float(m.group(2)), float(m.group(3)), bool(m.group(4)))
B = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard"
games = []
for season in range(2007, 2013):
    for wk in range(1, 17):
        d = get(f"{B}?groups=80&dates={season}&seasontype=2&week={wk}&limit=400")
        for e in (d or {}).get("events", []):
            c = e["competitions"][0]
            if not c.get("status", {}).get("type", {}).get("completed"): continue
            h = next(x for x in c["competitors"] if x["homeAway"] == "home"); a = next(x for x in c["competitors"] if x["homeAway"] == "away")
            t = dt.datetime.fromisoformat(e["date"].replace("Z", "+00:00"))
            if t.month < 10: continue
            hid = str(h["team"]["id"]); s = STAD.get(hid)
            if not s or s[2] or c.get("neutralSite") or (c.get("venue") or {}).get("indoor"): continue
            nm = lambda x: [x["team"].get(k, "") for k in ("location", "displayName", "shortDisplayName", "abbreviation", "name")]
            games.append(dict(id=e["id"], season=season, t=t, hid=hid, home=nm(h), away=nm(a), hs=int(h.get("score") or 0), as_=int(a.get("score") or 0)))
    print("season", season, "candidates so far", len(games), flush=True)
groups = {}
for g in games: groups.setdefault((g["hid"], g["season"]), []).append(g)
snow = []
for i, ((hid, season), lst) in enumerate(groups.items()):
    lat, lon, _ = STAD[hid]
    ts = [g["t"] for g in lst]
    q = (f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date={(min(ts)-dt.timedelta(days=1)).date()}"
         f"&end_date={(max(ts)+dt.timedelta(days=1)).date()}&hourly=temperature_2m,precipitation,rain,snowfall,wind_speed_10m,wind_gusts_10m"
         f"&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=GMT")
    h = (get(q) or {}).get("hourly")
    time.sleep(0.6)
    if not h: print("no weather", hid, season); continue
    at = {tt[:13]: k for k, tt in enumerate(h["time"])}
    for g in lst:
        i0 = at.get(g["t"].strftime("%Y-%m-%dT%H"))
        if i0 is None: continue
        win = [i0 + d for d in range(4) if i0 + d < len(h["time"])]
        sn = sum(h["snowfall"][k] or 0 for k in win)
        if sn < 0.05: continue
        g.update(snow_in=round(sn, 3), wind=h["wind_speed_10m"][i0], gust=max(h["wind_gusts_10m"][k] or 0 for k in win), temp=h["temperature_2m"][i0])
        snow.append(g)
print("snow games", len(snow), flush=True)
# sportsbookreviewsonline totals
norm = lambda s: re.sub(r"[^a-z]", "", s.lower())
def sbr(season):
    s = get(f"https://www.sportsbookreviewsonline.com/scoresoddsarchives/ncaa-football-{season}-{str(season+1)[2:]}", js=False) or ""
    rows = [[re.sub(r"<[^>]+>", "", x).strip() for x in re.findall(r"<td.*?</td>", r, re.S)] for r in re.findall(r"<tr.*?</tr>", s, re.S)]
    rows = [r for r in rows if len(r) >= 12 and r[0].isdigit()]
    out = []
    for v, hh in zip(rows[0::2], rows[1::2]):
        num = lambda x: (0.0 if x.lower() in ("pk", "p") else float(x)) if re.match(r"^-?[\d.]+$|^pk$", x, re.I) else None
        o = [num(v[9]), num(hh[9])]; c = [num(v[10]), num(hh[10])]
        tot = lambda p: max([x for x in p if x is not None], default=None)
        md = v[0].zfill(4); mo = int(md[:2])
        out.append(dict(date=dt.date(season + (1 if mo < 7 else 0), mo, int(md[2:])), v=v[3], h=hh[3], vh=hh[2], open=tot(o), close=tot(c), vs=v[8], hs=hh[8]))
    return out
cache = {}
for g in snow:
    L = cache.setdefault(g["season"], sbr(g["season"]))
    local = (g["t"] - dt.timedelta(hours=5)).date()
    best, score = None, 0
    for r in L:
        if abs((r["date"] - local).days) > 1: continue
        sc = lambda sb, names: max(difflib.SequenceMatcher(None, norm(sb), norm(n)).ratio() for n in names if n)
        s1 = min(sc(r["h"], g["home"]), sc(r["v"], g["away"])); s2 = min(sc(r["v"], g["home"]), sc(r["h"], g["away"]))
        sc_ = max(s1, s2)
        if sc_ > score: best, score = r, sc_
    ok = best and score >= 0.55
    tot = g["hs"] + g["as_"]
    print("SNOW", g["t"].strftime("%Y-%m-%d"), g["away"][0], "@", g["home"][0], f"{g['as_']}-{g['hs']} tot {tot}", f"snow {g['snow_in']} wind {g['wind']} gust {g['gust']} temp {g['temp']}",
          "| SBR", (f"{best['v']}@{best['h']} {best['vs']}-{best['hs']} open {best['open']} close {best['close']} match {score:.2f}" if ok else f"NO MATCH ({score:.2f} {best and best['v']+'@'+best['h']})"), flush=True)
