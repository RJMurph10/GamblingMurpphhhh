"""Park effect by the batter's effective side (R/L), per season, from an additive model
woba ~ batter-season + pitcher-season + park x side (alternating means, shrunk). Also HR/PA by park x side."""
import pandas as pd, numpy as np
pa = pd.read_parquet('pa.parquet')
gm = pd.read_parquet('games.parquet')[['game_id','park','home']]
# a park counts only where a team played a full home schedule there (drops London, Tokyo etc.)
cnt = gm.groupby('park').size(); main = set(cnt[cnt >= 150].index)
pa = pa[pa.park.isin(main)].copy()
out = []
for s, d in pa.groupby('season'):
    d = d.copy(); w = d.woba.values; mu = w.mean()
    d['b'] = 0.0; d['p'] = 0.0; d['k'] = 0.0
    d['bk'] = d.batter + '|' + d.eff; d['pk'] = d.pitcher; d['kk'] = d.park + '|' + d.eff
    for it in range(4):
        for col, key, K in (('b','bk',150), ('p','pk',150), ('k','kk',0)):
            r = w - mu - d[[c for c in ('b','p','k') if c != col]].sum(axis=1).values
            g = pd.DataFrame({'key': d[key].values, 'r': r}).groupby('key').r.agg(['sum','count'])
            g['e'] = g['sum'] / (g['count'] + K)
            d[col] = d[key].map(g.e).values
        d['k'] -= np.average(d.k, weights=None)  # center
    e = d.groupby(['park','eff']).agg(effect=('k','mean'), n=('woba','size'), hr=('hr','mean')).reset_index()
    lg_hr = d.groupby('eff').hr.mean()
    e['hr_ratio'] = e.hr / e.eff.map(lg_hr)
    e['season'] = s
    out.append(e)
    print(s, round(e.effect.std(), 4))
pf = pd.concat(out)
pf.to_parquet('parkhand.parquet')
