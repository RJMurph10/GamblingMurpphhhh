"""Calibrate the NBA player-prop ranges (src/data/nba/prop-range-calibration.json).

Input: /tmp/nbabt.json, a walk-forward replay of the site's NBA projectStat (src/lib/nba/nba-model.ts)
on regular-season box scores (props-history branch, nba/<season>.jsonl.gz). Rows: [season, stat, mean,
sd, p25, p75, actual, games before]. For each stat, projections are split into 10 size bins (quantiles
of the fit seasons' means), and each bin gets the narrowest range holding TARGET of results: as
multiples of the projection (points and combos) or as whole numbers (rebounds, assists, threes, steals,
blocks, turnovers). Fit 2023-24 + 2024-25; check on 2025-26.
Usage: python3 research/props/nba_prop_range_calibrate.py 0.70
"""
import json, math, collections, sys
TARGET = float(sys.argv[1]) if len(sys.argv) > 1 else 0.70
d = json.load(open('/tmp/nbabt.json'))
INT = {'stl', 'blk', 'tov'}
OFF = {'reb', 'ast', 'fg3m'}
FIT = {'2023-24', '2024-25'}; TEST = '2025-26'
def shortest(vals, cov):
    s = sorted(vals); k = max(1, math.ceil(cov * len(s))) - 1
    i = min(range(len(s) - k), key=lambda i: (s[i + k] - s[i], -i))
    return s[i], s[i + k]
cal = {}
for stat in sorted({r[1] for r in d}):
    pts = [(r[2], r[6]) for r in d if r[1] == stat and r[0] in FIT and r[2] > 0]
    nb = 10
    ms = sorted(m for m, _ in pts); edges = [ms[int(len(ms) * i / nb)] for i in range(1, nb)]
    bins = []; lo = -1
    for i in range(nb):
        hi = edges[i] if i < nb - 1 else None
        b = [(m, a) for m, a in pts if m > lo and (hi is None or m <= hi)]
        lo = hi if hi is not None else lo
        if not b: continue
        if stat in OFF:
            L, U = shortest([a - m for m, a in b], TARGET); bins.append({'upTo': hi, 'lo': round(L, 2), 'hi': round(U, 2)})
        elif stat in INT:
            L, U = shortest([a for _, a in b], TARGET); bins.append({'upTo': hi, 'lo': int(L), 'hi': int(U)})
        else:
            L, U = shortest([a / m for m, a in b], TARGET); bins.append({'upTo': hi, 'lo': round(L, 3), 'hi': round(U, 3)})
    cal[stat] = {'type': 'offset' if stat in OFF else 'int' if stat in INT else 'ratio', 'bins': bins}
def rng(stat, m):
    c = cal[stat]; b = next(b for b in c['bins'] if b['upTo'] is None or m <= b['upTo'])
    if c['type'] == 'int': return b['lo'], max(b['lo'], b['hi'])
    if c['type'] == 'offset': return max(0, round(m + b['lo'])), max(0, round(m + b['hi']))
    return math.floor(m * b['lo']), math.ceil(m * b['hi'])
agg = collections.defaultdict(lambda: [0, 0, 0, 0.0, 0.0])
for s, stat, m, sd, p25, p75, a, j in d:
    if s != TEST or m <= 0: continue
    L, U = rng(stat, m)
    for k in (stat, 'ALL'):
        g = agg[k]; g[0] += L <= a <= U; g[1] += p25 <= a <= p75; g[2] += 1; g[3] += U - L; g[4] += p75 - p25
for k in sorted(agg):
    g = agg[k]; print(f"{k:5s} {TEST} new {100*g[0]/g[2]:4.1f}% width {g[3]/g[2]:5.1f} | old mid-50 {100*g[1]/g[2]:4.1f}% width {g[4]/g[2]:5.1f}  n={g[2]}")
json.dump({'target': TARGET, 'markets': cal}, open('/tmp/nbacal.json', 'w'))
