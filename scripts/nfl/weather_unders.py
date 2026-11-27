"""★ Weather receiving unders (NFL), plus a tracked QB passing-yards under in wind.

Research (research/nfl/weather_receivers/, project doc nfl-weather-receivers.md), opening lines 2024-26:
  ★ WR whose share of catches going 20+ yards is 18%+ (this season + half of last), receiving-yards line 40+,
    outdoor / open-roof game with 1+ mm of rain or 15+ mph wind (kickoff to +3 h) -> UNDER.
    79-31 (71.8%), +37.7u at -115; positive every season (2024 +14.0u, 2025 +17.3u, 2026 +6.4u).
    The same receivers in normal weather: 60%. Holds at every big-play cut (16-25%) and line cut (35-45+).
  Tracked (not ★): QB passing yards UNDER with 15+ mph wind: 46-20 (69.7%), +20.0u at -115, every season.

Weather: Open-Meteo at the stadium, kickoff to +3 h: total precipitation and max 10 m wind x1.09 (reads like
the reported wind; nfl-stadium-wind.md). Upcoming games use the forecast; a pick is locked the first time it
shows (with the forecast it was made on) and graded live from LIVE_FROM. Earlier games this season are a
replay on the recorded weather.

Inputs: props-site/nfl/<season>/<day>.json (finished: [name, team, market, opening line, over, under, actual]),
props-site/nfl/upcoming.json ([..., current line]), nflverse games.csv (stadium, roof, kickoff) and weekly
player stats (catches of 20+ yards).
Output: <site>/nfl/weather-unders-<season>.json
  { season, updated, liveFrom, rule, record: { wr: {replay, live}, qb: {replay, live} } ([w, l, push, units]),
    picks: [[date, game, player, team, kind, line, under price, actual, result, weather, bigPlay, locked]],
    upcoming: [[date, game, player, team, kind, opening line, under price, current line, weather, bigPlay]],
    locked: { key: [date, game, player, team, kind, line, under price, weather, bigPlay] },
    recorded: { nflverse game_id: weather } }  (archive weather for finished games, so reruns skip them)
  kind = "wr" (★) or "qb" (tracked); weather = [precip mm, wind mph].

  python3 scripts/nfl/weather_unders.py --site props-site --cache nflverse-cache [--season 2026]
"""
import argparse, functools, glob, json, os, re, time, urllib.request
from datetime import datetime, timedelta, timezone

import pandas as pd

LIVE_FROM = "2026-11-27"
BIG, LINE, RAIN, WIND = 0.18, 40, 1.0, 15
ap = argparse.ArgumentParser()
ap.add_argument("--site", default="props-site")
ap.add_argument("--cache", default="nflverse-cache")
ap.add_argument("--season", type=int, default=None)
ap.add_argument("--weather-file", default=None, help="offline: {nflverse game_id: {precip, wind}}")
args = ap.parse_args()
now = datetime.now(timezone.utc)
SEASON = args.season or (now.year if now.month >= 8 else now.year - 1)
os.makedirs(args.cache, exist_ok=True)
TEAM = {"WSH": "WAS", "LAR": "LA", "JAC": "JAX"}  # ESPN -> nflverse
UA = {"User-Agent": "gamblingnfl-weather-unders"}


def get(url, path=None, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                data = r.read()
            if path:
                open(path, "wb").write(data)
            return data
        except Exception:
            time.sleep(2 * (i + 1))
    return None


# --- games: stadium, roof, kickoff (UTC)
get("https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv", f"{args.cache}/games.csv")
G = pd.read_csv(f"{args.cache}/games.csv", low_memory=False)
G = G[(G.game_type == "REG") & (G.season == SEASON)].copy()
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "kickoff-wind.mjs")).read()
STAD = {k: (float(a), float(b)) for k, a, b in re.findall(r"([A-Z]{3}\d{2}): \[(-?[\d.]+), (-?[\d.]+)\]", src)}


def kickoff_utc(g):
    y, m, d = map(int, g.gameday.split("-"))
    hh, mm = map(int, g.gametime.split(":"))
    off = 4 if (3 < m < 11 or (m == 11 and d < 3)) else 5  # ET -> UTC
    return datetime(y, m, d, hh, mm, tzinfo=timezone.utc) + timedelta(hours=off)


def game_of(date_iso, name):
    away, home = [TEAM.get(t, t) for t in name.split(" @ ")] if " @ " in name else (None, None)
    day = pd.Timestamp(date_iso) - pd.Timedelta(hours=5)
    x = G[(G.home_team == home) & (G.away_team == away) & ((pd.to_datetime(G.gameday) - day.tz_localize(None).normalize()).abs() <= pd.Timedelta(days=1))]
    return x.iloc[0] if len(x) else None


offline = json.load(open(args.weather_file)) if args.weather_file else None
out_path = f"{args.site}/nfl/weather-unders-{SEASON}.json"
try:
    _prev = json.load(open(out_path))
except Exception:
    _prev = {}
SEEN = _prev.get("recorded", {})  # game_id -> recorded weather, games finished 6+ days ago (archive data)
_wx = {}


def weather(g):
    """[precip mm, max wind mph x1.09] from kickoff to +3 h; None indoors / unknown."""
    if g is None or g.roof not in ("outdoors", "open"):
        return None
    if offline is not None:
        w = offline.get(g.game_id)
        return [w["precip"], w["wind"]] if w else None
    if g.game_id in _wx:
        return _wx[g.game_id]
    if g.game_id in SEEN:
        return SEEN[g.game_id]
    c = STAD.get(g.stadium_id)
    if not c:
        return None
    k = kickoff_utc(g)
    day0, day1 = k.strftime("%Y-%m-%d"), (k + timedelta(hours=4)).strftime("%Y-%m-%d")
    old = k < now - timedelta(days=6)
    base = "https://archive-api.open-meteo.com/v1/archive" if old else "https://api.open-meteo.com/v1/forecast"
    q = f"?latitude={c[0]}&longitude={c[1]}&hourly=precipitation,wind_speed_10m&wind_speed_unit=mph&timezone=UTC&start_date={day0}&end_date={day1}"
    raw = get(base + q)
    out = None
    if raw:
        h = json.loads(raw).get("hourly", {})
        idx = {t: i for i, t in enumerate(h.get("time", []))}
        p = w = 0.0; n = 0
        for i in range(4):
            t = (k.replace(minute=0) + timedelta(hours=i)).strftime("%Y-%m-%dT%H:00")
            if t in idx:
                n += 1
                p += h["precipitation"][idx[t]] or 0
                w = max(w, h["wind_speed_10m"][idx[t]] or 0)
        out = [round(p, 1), round(w * 1.09)] if n else None
    _wx[g.game_id] = out
    if old and out is not None:
        SEEN[g.game_id] = out
    return out


# --- big-play rate: share of catches of 20+ yards, this season before the game + half of last season
def stats(season):
    path = f"{args.cache}/stats_player_week_{season}.csv.gz"
    if season == SEASON or not os.path.exists(path):
        get(f"https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{season}.csv.gz", path)
    try:
        return pd.read_csv(path, low_memory=False)
    except Exception:
        return pd.DataFrame()
W = pd.concat([stats(SEASON - 1), stats(SEASON)])
W = W[W.season_type == "REG"] if len(W) else W
key = lambda s: re.sub(r"[^a-z]", "", re.sub(r"\b(jr|sr|ii|iii|iv)\b\.?", "", str(s).lower()))
W = W.copy()
if len(W):
    W["k"] = W.player_display_name.map(key)


BY = {k: x for k, x in W[W.position == "WR"].groupby("k")} if len(W) else {}


@functools.lru_cache(maxsize=None)
def big_play(name, week):
    x = BY.get(key(name))
    if x is None:
        return None
    cur = x[(x.season == SEASON) & (x.week < week)]
    prev = x[x.season == SEASON - 1]
    rec = cur.receptions.sum() + 0.5 * prev.receptions.sum()
    r20 = cur.receiving_20.sum() + 0.5 * prev.receiving_20.sum()
    return round(r20 / rec, 3) if rec >= 10 else None


def qualifies(kind, line, wx, bp):
    if wx is None or line is None:
        return False
    if kind == "wr":
        return bp is not None and bp >= BIG and line >= LINE and (wx[0] >= RAIN or wx[1] >= WIND)
    return wx[1] >= WIND


pay = lambda o: 100 / -o if o < 0 else o / 100
local_day = lambda iso: (pd.Timestamp(iso) - pd.Timedelta(hours=5)).strftime("%Y-%m-%d")
locked = _prev.get("locked", {})


def candidates(g, props):
    """(kind, prop) for WR receiving-yards and QB passing-yards lines in this game."""
    qbs = {p[0] for p in props if p[2] in ("Pass yds", "Completions", "Pass att")}
    for p in props:
        if p[2] == "Rec yds" and p[0] not in qbs:
            yield "wr", p
        elif p[2] == "Pass yds":
            yield "qb", p


# --- upcoming: forecast; lock picks the first time they show
upc = []
try:
    upcoming = json.load(open(f"{args.site}/nfl/upcoming.json"))
except Exception:
    upcoming = []
for gm in upcoming:
    g = game_of(gm["date"], gm["name"])
    if g is None or datetime.fromisoformat(gm["date"].replace("Z", "+00:00")) < now:
        continue
    wx = weather(g)
    if wx is None:
        continue
    for kind, p in candidates(gm, gm.get("props", [])):
        line = p[6] if p[6] is not None else p[3]
        bp = big_play(p[0], g.week) if kind == "wr" else None
        if not qualifies(kind, line, wx, bp):
            continue
        upc.append([gm["date"], gm["name"], p[0], p[1], kind, p[3], p[5], p[6], wx, bp])
        k = f"{gm['date']}|{gm['name']}|{p[0]}|{kind}"
        if k not in locked and local_day(gm["date"]) >= LIVE_FROM:
            locked[k] = [gm["date"], gm["name"], p[0], p[1], kind, line, p[5], wx, bp]
upc.sort(key=lambda x: (x[4] != "wr", x[0], x[2]))

# --- graded: live = locked picks (forecast-based); replay = earlier games on the recorded weather
picks = []
for f in sorted(glob.glob(f"{args.site}/nfl/{SEASON}/*.json")):
    for gm in json.load(open(f)):
        live_game = local_day(gm["date"]) >= LIVE_FROM
        g = game_of(gm["date"], gm["name"])
        for kind, p in candidates(gm, gm.get("props", [])):
            if p[3] is None or p[6] is None:
                continue
            k = f"{gm['date']}|{gm['name']}|{p[0]}|{kind}"
            if live_game:
                if k not in locked:
                    continue
                L = locked[k]
                line, price, wx, bp = L[5], L[6], L[7], L[8]
            else:
                wx = weather(g)
                bp = big_play(p[0], g.week) if (kind == "wr" and g is not None) else None
                line, price = p[3], p[5]
                if not qualifies(kind, line, wx, bp):
                    continue
            res = "win" if p[6] < line else "loss" if p[6] > line else "push"
            picks.append([gm["date"], gm["name"], p[0], p[1], kind, line, price, p[6], res, wx, bp, live_game])
picks.sort(key=lambda x: x[0])


def record(rs):
    w = sum(r[8] == "win" for r in rs); l = sum(r[8] == "loss" for r in rs); pu = sum(r[8] == "push" for r in rs)
    u = sum(pay(r[6] if r[6] is not None else -115) if r[8] == "win" else -1 if r[8] == "loss" else 0 for r in rs)
    return [w, l, pu, round(u, 2)]


rec = {kind: {"replay": record([p for p in picks if p[4] == kind and not p[11]]),
              "live": record([p for p in picks if p[4] == kind and p[11]])} for kind in ("wr", "qb")}
out = {"season": SEASON, "updated": now.isoformat(), "liveFrom": LIVE_FROM,
       "rule": {"bigPlay": BIG, "line": LINE, "rainMm": RAIN, "windMph": WIND},
       "record": rec, "picks": picks, "upcoming": upc, "locked": locked, "recorded": SEEN}
os.makedirs(f"{args.site}/nfl", exist_ok=True)
json.dump(out, open(out_path, "w"))
print(f"{SEASON} weather unders: WR ★ replay {rec['wr']['replay']} live {rec['wr']['live']}; QB wind replay {rec['qb']['replay']} live {rec['qb']['live']}; "
      f"upcoming {sum(u[4]=='wr' for u in upc)} WR, {sum(u[4]=='qb' for u in upc)} QB")
