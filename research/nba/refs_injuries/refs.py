import json, numpy as np, pandas as pd
d = json.load(open('off.json'))
rows = []
for gid, v in d.items():
    if len(v['off']) < 3 or len(v['teams']) != 2 or not v.get('date'): continue
    try:
        fouls = sum(float(t['stats'].get('fouls', 'nan')) for t in v['teams'])
        fta = sum(float(t['stats']['freeThrowsMade-freeThrowsAttempted'].split('-')[1]) for t in v['teams'])
    except Exception: continue
    rows.append(dict(id=gid, date=v['date'], refs=[o[0] for o in v['off'][:3]], fouls=fouls, fta=fta))
G = pd.DataFrame(rows); G['dt'] = pd.to_datetime(G.date); G = G.sort_values('dt').reset_index(drop=True)
G['season'] = np.where(G.dt.dt.month >= 9, G.dt.dt.year + 1, G.dt.dt.year)
lines = pd.read_parquet('nba_lines.parquet')[['id', 'season', 'hs', 'as_', 't_o', 't_c']].rename(columns={'season': 'ls'})
G = G.merge(lines, on='id', how='left'); G['pts'] = G.hs + G.as_
G['fta_r'] = G.fta - G.groupby('season').fta.transform('mean')
# walk-forward crew score: each ref's shrunk average FTA residual in all his earlier games
K = 40; hist = {}
crew = []
for r in G.itertuples():
    vals = []
    for ref in r.refs:
        s, n = hist.get(ref, (0.0, 0))
        vals.append(s / (n + K))
    crew.append(np.mean(vals))
    for ref in r.refs:
        s, n = hist.get(ref, (0.0, 0)); hist[ref] = (s + r.fta_r, n + 1)
G['crew'] = crew
# persistence: ref's FTA residual in season s vs his earlier seasons
ref_s = G.explode('refs').groupby(['refs', 'season']).fta_r.agg(['mean', 'size']).reset_index()
pp = []
for ref, x in ref_s.groupby('refs'):
    x = x.sort_values('season')
    for i in range(1, len(x)):
        prev = x.iloc[:i]; 
        if prev['size'].sum() >= 30 and x.iloc[i]['size'] >= 30: pp.append((np.average(prev['mean'], weights=prev['size']), x.iloc[i]['mean']))
pp = np.array(pp); print('ref FTA lean persistence (earlier seasons vs this season): r =', round(np.corrcoef(pp.T)[0, 1], 3), 'n', len(pp))
print('crew score sd (FTA per game):', round(G.crew.std(), 2), '| corr crew score vs actual FTA', round(G.crew.corr(G.fta_r), 3), ' vs fouls', round(G.crew.corr(G.fouls), 3))
L = G[G.t_c.notna() & (G.season >= 2024)].copy()
L['crew_q'] = pd.qcut(L.crew, 5, labels=['lowest FT crews', 'q2', 'q3', 'q4', 'highest FT crews'])
for w in ('t_o', 't_c'):
    y = L[L[w].notna() & (L.pts != L[w])]
    tb = y.groupby('crew_q', observed=True).apply(lambda z: pd.Series({'games': len(z), 'FTA': round(z.fta.mean(), 1), 'over%': round((z.pts > z[w]).mean(), 3), 'pts_vs_line': round((z.pts - z[w]).mean(), 2)}))
    print(f'\n--- vs {"opening" if w=="t_o" else "closing"} total (2023-24 on)'); print(tb.to_string())
    for q, side in (('highest FT crews', 'over'), ('lowest FT crews', 'under')):
        z = y[y.crew_q == q]; win = (z.pts > z[w]) if side == 'over' else (z.pts < z[w])
        by = z.assign(win=win).groupby('season').win.agg(['size', 'mean']).round(3)
        print(f"  {q} -> {side}: {win.mean():.3f} ({len(z)}), ROI at -110 {win.mean()*1.909-1:+.3f} | by season", by.to_dict('index'))
