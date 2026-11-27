import json, numpy as np, pandas as pd
D = pd.read_parquet('rec.parquet'); Wx = json.load(open('weather.json'))
D['precip'] = D.game_id.map(lambda g: Wx.get(g, {}).get('precip', np.nan))
D['wx_wind'] = D.game_id.map(lambda g: Wx.get(g, {}).get('wind', np.nan))
D['wind_any'] = D.wind.where(D.wind.notna(), D.wx_wind)
D['outdoor'] = D.roof.isin(['outdoors', 'open'])
D = D[(D.adot.notna()) & (D.actual != D.line)]
pay = lambda o: np.where(np.isnan(o), 100 / 110, np.where(o < 0, 100 / -o, o / 100))
D['u_under'] = np.where(D.actual < D.line, pay(D.under.astype(float).values), -1.0)
D['deep'] = D.adot >= 12; D['short'] = D.adot < 7
bad = D.outdoor & ((D.precip >= 1) | (D.wind_any >= 15))
rain = D.outdoor & (D.precip >= 1); windy = D.outdoor & (D.wind_any >= 15)
calm = D.outdoor & (D.precip.fillna(0) < 0.3) & (D.wind_any < 10) | ~D.outdoor
def rep(name, sel):
    x = D[sel]
    by = x.groupby('season').agg(n=('u_under', 'size'), under=('u_under', lambda u: (u > 0).mean()), roi=('u_under', 'mean')).round(3)
    yds = (x.actual - x.line).mean()
    print(f"{name:52s} n={len(x):5d} under {(x.u_under>0).mean():.3f} ROI {x.u_under.mean():+.3f} yds vs line {yds:+5.1f} | " + ' '.join(f"{s}:{int(r.n)} {r.roi:+.3f}" for s, r in by.iterrows()))
print('UNDERS on receiving yards (-110 unless priced)')
rep('all receivers', D.line > 0)
rep('deep threats (aDOT 12+), all games', D.deep)
rep('deep threats, dome / calm', D.deep & calm)
rep('deep threats, rain 1mm+ or wind 15+', D.deep & bad)
rep('   deep threats, rain 1mm+', D.deep & rain)
rep('   deep threats, wind 15+', D.deep & windy)
rep('mid (aDOT 7-12), rain or wind 15+', ~D.deep & ~D.short & bad)
rep('short (aDOT <7), rain or wind 15+', D.short & bad)
rep('all receivers, rain or wind 15+', bad)
rep('deep threats, rain/wind, line 40+', D.deep & bad & (D.line >= 40))
rep('deep threats, rain/wind, line <40', D.deep & bad & (D.line < 40))
rep('deep threats (aDOT 14+), rain/wind', (D.adot >= 14) & bad)
