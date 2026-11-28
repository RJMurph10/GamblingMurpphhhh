"""Every college ★ rule, season by season, as the site applies them (same precedence), on
research/football/data/football.csv (FBS vs FBS, consensus lines). 1u at -110.
Run from a working folder after cfb_totals_open.py (it reads that script's cfb_games.csv input and
preds.csv output): see claude/cfb-star-seasons.md."""
import re, numpy as np, pandas as pd
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
W = 100 / 110
c = pd.read_csv("cfb_games.csv")
p = pd.read_csv("preds.csv")[["season", "week", "home", "away", "m_blend"]]
c = c.merge(p, on=["season", "week", "home", "away"], how="left")
RIV = {
    frozenset((float(a), float(b)))
    for a, b in re.findall(r"\[(\d+), (\d+)\]", (ROOT / "src/data/cfb/cfb-rivalries.ts").read_text())
}
ACAD = {349.0, 2426.0, 2005.0}
c["pts"] = c.home_pts + c.away_pts
c["margin"] = c.home_pts - c.away_pts
rows = []
for _, g in c.iterrows():
    acad = g.home_id in ACAD and g.away_id in ACAD
    # totals: academy / early-week unders first, else the model vs the opener (week 3+)
    if acad or g.week <= 2:
        for line in ("close", "open"):
            t = g[f"total_{line}"] if line == "close" else g.open
            if pd.notna(t): rows.append((g.season, "academy" if acad else "early", line, np.sign(t - g.pts)))
    elif g.week >= 3 and pd.notna(g.open) and pd.notna(g.m_blend) and abs(g.m_blend - g.open) >= 4:
        over = g.m_blend > g.open
        rows.append((g.season, "open-total", "open", np.sign((g.pts - g.open) * (1 if over else -1))))
        if pd.notna(g.total_close):
            rows.append((g.season, "open-total", "close", np.sign((g.pts - g.total_close) * (1 if over else -1))))
    # spreads
    riv = (not g.neutral) and frozenset((g.home_id, g.away_id)) in RIV and pd.notna(g.travel_miles) and g.travel_miles < 800
    bounce = pd.notna(g.away_last_margin) and g.away_last_margin <= -28 and g.week >= 2
    travel = (not g.neutral) and pd.notna(g.travel_miles) and g.travel_miles >= 2000
    rule = side = None
    if riv: rule, side = "rivalry", -1
    elif bounce != travel: rule, side = ("bounce", -1) if bounce else ("travel", 1)
    if rule:
        for line in ("close", "open"):
            s = g[f"spread_{line}"]
            if pd.notna(s): rows.append((g.season, rule, line, np.sign((g.margin + s) * side)))
R = pd.DataFrame(rows, columns=["season", "rule", "line", "r"])
def cell(x):
    w, l = int((x.r > 0).sum()), int((x.r < 0).sum())
    if w + l == 0: return "-"
    return f"{w}-{l} {100*w/(w+l):.1f}% {w*W-l:+.1f}u"
RULES = ["open-total", "rivalry", "bounce", "travel", "early", "academy"]
for line in ("close", "open"):
    print(f"\n=== graded at the {line.upper()} ===")
    print(f"{'rule':12}" + "".join(f"{s:>24}" for s in (2022, 2023, 2024, 2025)) + f"{'2022-25':>26}{'2019-21':>26}{'2013-18':>26}")
    for rule in RULES + ["ALL"]:
        x = R[(R.line == line) & ((R.rule == rule) | (rule == "ALL"))]
        if rule == "open-total" and line == "close": pass
        cells = [cell(x[x.season == s]) for s in (2022, 2023, 2024, 2025)]
        cells += [cell(x[x.season.between(2022, 2025)]), cell(x[x.season.between(2019, 2021)]), cell(x[x.season.between(2013, 2018)])]
        print(f"{rule:12}" + "".join(f"{v:>24}" for v in cells[:4]) + "".join(f"{v:>26}" for v in cells[4:]))
