"""Drive-by-drive results for every FBS-vs-FBS game in research/football/data/football.csv (2013-2025), from
ESPN game summaries. One row per drive: game, team, quarter, start yard line, plays, yards, result, and for
field goals the kick distance (from the drive's last play text)."""
import csv, gzip, json, re, sys, time, urllib.request as u
from concurrent.futures import ThreadPoolExecutor
ids = []
with open("research/football/data/football.csv") as f:
    for r in csv.DictReader(f):
        if r["league"] == "cfb": ids.append((r["game_id"], r["season"]))
print("games", len(ids), flush=True)
S = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event="
def get(gid):
    for i in range(4):
        try:
            return json.load(u.urlopen(u.Request(S + gid, headers={"User-Agent": "Mozilla/5.0"}), timeout=30))
        except Exception:
            time.sleep(2 * (i + 1))
    return None
def drives(item):
    gid, season = item
    d = get(gid)
    rows = []
    if not d: return gid, None
    for dr in (d.get("drives") or {}).get("previous", []) or []:
        team = (dr.get("team") or {}).get("id")
        plays = dr.get("plays") or []
        last = plays[-1].get("text", "") if plays else ""
        fg = re.search(r"(\d+)\s*(?:Yd|yd|yard|Yard)s?\s*(?:Field Goal|FG)", last) or re.search(r"(\d+)\s*(?:Yd|yd)\s", last)
        start = (dr.get("start") or {}).get("yardsToEndzone")
        rows.append([gid, season, team, (dr.get("start") or {}).get("period", {}).get("number"), start,
                     dr.get("offensivePlays"), dr.get("yards"), dr.get("displayResult") or dr.get("result"),
                     fg.group(1) if fg and "field goal" in (dr.get("displayResult") or dr.get("result") or "").lower() else ""])
    return gid, rows
out = gzip.open("cfb_drives.csv.gz", "wt", newline=""); w = csv.writer(out)
w.writerow(["game_id", "season", "team_id", "period", "start_yds_to_ez", "plays", "yards", "result", "fg_yds"])
done = miss = nodrv = 0
with ThreadPoolExecutor(8) as ex:
    for gid, rows in ex.map(drives, ids):
        done += 1
        if rows is None: miss += 1
        elif not rows: nodrv += 1
        else: w.writerows(rows)
        if done % 500 == 0: print(done, "fetched; failed", miss, "no drives", nodrv, flush=True)
out.close()
print("DONE games", done, "failed", miss, "no drives", nodrv, flush=True)
