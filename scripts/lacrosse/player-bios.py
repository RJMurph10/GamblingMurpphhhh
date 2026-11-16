"""Adds bios to src/data/pll-player-games.json for every player in it, from the Lacrosse API pull's player
records (college, PLL experience, number, position). Height, weight, shot and hometown come from the
Wikipedia rosters already in src/data/pll-players.json, matched on the site.

Usage: python3 scripts/lacrosse/player-bios.py <lacrosse-api data dir> src/data/pll-player-games.json
"""
import json, sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])
data = json.loads(out.read_text())
names = {p["name"] for g in data["games"] for p in g["players"]}
bios = {}
for f in (src / "players").glob("*.json"):
    d = json.loads(f.read_text()).get("data") or {}
    n = d.get("display_name")
    if n in names:
        bios[n] = {k: d.get(k) for k in ("college", "experience", "jersey_number", "position_name") if d.get(k) is not None}
data["bios"] = dict(sorted(bios.items()))
out.write_text(json.dumps(data, indent=0, ensure_ascii=False))
print(f"bios for {len(bios)} of {len(names)} players; missing: {sorted(names - set(bios))}")
