"""Latency probe: Kalshi live data vs ESPN scoreboard. Polls both every ~2 s, logs each change with a timestamp."""
import json, time, urllib.request, sys
from datetime import datetime, timezone, timedelta
K = "https://api.elections.kalshi.com/trade-api/v2"
ESPN = {"nba": "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
        "ncaam": "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50&limit=300",
        "nfl": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
        "cfb": "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=300"}
def get(u):
    t = time.time()
    r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"}), timeout=15)
    return json.loads(r.read()), time.time() - t
now = datetime.now(timezone.utc)
ms = []
for typ in ("basketball_game", "football_game"):
    cur = None
    for _ in range(10):
        q = f"{K}/milestones?limit=500&type={typ}&minimum_start_date={(now - timedelta(hours=4)).strftime('%Y-%m-%dT%H:%M:%SZ')}" + (f"&cursor={cur}" if cur else "")
        try:
            d, _ = get(q)
        except Exception as e:
            print("milestones error", typ, e); break
        ms += d.get("milestones", [])
        cur = d.get("cursor")
        if not cur: break
print("milestones", len(ms))
if ms: print("SAMPLE MILESTONE", json.dumps(ms[0])[:1500])
live = [m for m in ms if datetime.fromisoformat(m["start_date"].replace("Z", "+00:00")) < now + timedelta(minutes=20)]
print("started or starting soon", len(live))
ids = [m["id"] for m in live][:100]
title = {m["id"]: m.get("title") for m in live}
if ids:
    d, _ = get(f"{K}/live_data/batch?" + "&".join(f"milestone_ids={i}" for i in ids))
    print("SAMPLE LIVE", json.dumps(d)[:3000])
log = open("probe/log.jsonl", "w")
lastk, laste = {}, {}
end = time.time() + float(sys.argv[1]) * 60
while time.time() < end:
    t0 = time.time()
    if ids:
        try:
            d, lat = get(f"{K}/live_data/batch?" + "&".join(f"milestone_ids={i}" for i in ids))
            for x in d.get("live_datas", []):
                mid = x.get("milestone_id"); det = x.get("details", {})
                sig = json.dumps({k: v for k, v in det.items() if "time" not in k.lower() and "updated" not in k.lower()}, sort_keys=True)
                if lastk.get(mid) != sig:
                    lastk[mid] = sig
                    log.write(json.dumps({"src": "kalshi", "t": t0, "lat": lat, "id": mid, "title": title.get(mid), "d": det}) + "\n")
        except Exception as e:
            print("kalshi err", e)
    for lg, u in ESPN.items():
        try:
            d, lat = get(u + ("&" if "?" in u else "?") + f"_={int(t0)}")
        except Exception as e:
            print("espn err", lg, e); continue
        for ev in d.get("events", []):
            st = ev["status"]["type"]["state"]
            if st != "in": continue
            c = ev["competitions"][0]
            sc = {x["homeAway"]: (x["team"]["abbreviation"], x.get("score")) for x in c["competitors"]}
            sig = json.dumps(sc, sort_keys=True)
            if laste.get(ev["id"]) != sig:
                laste[ev["id"]] = sig
                log.write(json.dumps({"src": "espn", "lg": lg, "t": t0, "lat": lat, "id": ev["id"], "name": ev["name"], "sc": sc, "clock": ev["status"].get("displayClock"), "period": ev["status"].get("period")}) + "\n")
    log.flush()
    time.sleep(max(0, 2 - (time.time() - t0)))
print("done")
