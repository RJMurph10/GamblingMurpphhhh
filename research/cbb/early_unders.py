import gzip, json, numpy as np, pandas as pd
def am(x):
    try: return float(str(x.get('american') or x.get('alternateDisplayValue')).replace('+', ''))
    except Exception: return np.nan
rows = []
for y in (2023, 2024, 2025, 2026, 2027):
    for l in gzip.open(f'/tmp/lh/cbb_{y}.jsonl.gz'):
        g = json.loads(l)
        if g.get('status') != 'STATUS_FINAL' or not g.get('books'): continue
        b = g['books'][0]; h = next((t for t in g['teams'] if t['homeAway'] == 'home'), None); a = next((t for t in g['teams'] if t['homeAway'] == 'away'), None)
        if not h or not a: continue
        rows.append(dict(season=y, type=g.get('type'), date=g['date'], book=b.get('name'), pts=(h['score'] or 0) + (a['score'] or 0),
                         t_o=am(b.get('open', {}).get('total', {})), t_c=am(b.get('close', {}).get('total', {})) if b.get('close') else b.get('overUnder'),
                         oo=am(b.get('open', {}).get('over', {})), ou=am(b.get('open', {}).get('under', {})),
                         co=am(b.get('close', {}).get('over', {})), cu=am(b.get('close', {}).get('under', {}))))
D = pd.DataFrame(rows); D['t_c'] = pd.to_numeric(D.t_c, errors='coerce')
D = D[D.book.isin(['BetfairSportsbook', 'ESPN BET', 'DraftKings', 'Caesars Sportsbook (Colorado)', 'Caesars Sportsbook'])]
D['dt'] = pd.to_datetime(D.date, utc=True, format='ISO8601')
start = D.groupby('season').dt.transform('min')
D['week'] = ((D.dt - start).dt.days // 7) + 1
D['phase'] = pd.cut(D.week, [0, 2, 4, 7, 30], labels=['wk 1-2', 'wk 3-4', 'wk 5-7', 'wk 8+'])
pay = lambda o: np.where(np.isnan(o), 100 / 110, np.where(o < 0, 100 / -o, o / 100))
for w, t, pu in (('open', 't_o', 'ou'), ('close', 't_c', 'cu')):
    x = D[D[t].notna() & (D.pts > 0) & (D.pts != D[t]) & (D[t] > 100)]
    x = x.assign(under=x.pts < x[t], u=np.where(x.pts < x[t], pay(x[pu].values.astype(float)), -1.0), diff=x.pts - x[t])
    tb = x.groupby(['phase', 'season'], observed=True).agg(n=('u', 'size'), under=('under', 'mean'), roi=('u', 'mean'), pts_vs_line=('diff', 'mean')).round(3)
    print(f'\n=== UNDERS vs {w} total (by season) ==='); print(tb.unstack('season').to_string())
