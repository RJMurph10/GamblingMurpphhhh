import json, numpy as np, pandas as pd
D = pd.read_parquet('rec.parquet'); Wx = json.load(open('weather.json'))
D['precip'] = D.game_id.map(lambda g: Wx.get(g, {}).get('precip', np.nan))
D['ww'] = D.wind.where(D.wind.notna(), D.game_id.map(lambda g: Wx.get(g, {}).get('wind', np.nan)))
out = D.roof.isin(['outdoors', 'open'])
D['bad'] = out & ((D.precip >= 1) | (D.ww >= 15))
D = D[D.actual != D.line]
def rep(name, sel, side='under'):
    x = D[sel]
    win = (x.actual < x.line) if side == 'under' else (x.actual > x.line)
    by = x.assign(w=win.values).groupby('season').w.agg(['size', 'mean']).round(3)
    print(f"{name:58s} n={len(x):4d} games {x.game_id.nunique():3d} {side} {win.mean():.3f} (-115 ROI {win.mean()*(1+100/115)-1:+.3f}) yds vs line {(x.actual-x.line).mean():+5.1f} | " + ' '.join(f"{s}:{int(r['size'])} {r['mean']:.2f}" for s, r in by.iterrows()))
wr, te, rb = D.pos == 'WR', D.pos == 'TE', D.pos == 'RB'
big = D.big >= 0.22   # 22%+ of catches go 20+ yards (top ~15%)
print('--- bad weather (rain 1mm+ or wind 15+) vs all games ---')
for nm, sel in (('WR', wr), ('WR big-play (22%+ of catches 20+ yds)', wr & big), ('WR not big-play', wr & ~big), ('TE', te), ('RB', rb)):
    rep(f'{nm}, all games', sel)
    rep(f'{nm}, BAD weather', sel & D.bad)
print('--- running backs: OVERS (checkdown idea) ---')
rep('RB, all games', rb, 'over'); rep('RB, BAD weather', rb & D.bad, 'over'); rep('RB, rain 1mm+', rb & out & (D.precip >= 1), 'over')
print('--- big-play WRs in bad weather by line ---')
rep('WR big-play, bad, line 40+', wr & big & D.bad & (D.line >= 40)); rep('WR big-play, bad, line <40', wr & big & D.bad & (D.line < 40))
rep('WR (all), bad, line 40+', wr & D.bad & (D.line >= 40)); rep('WR (all), bad, line <40', wr & D.bad & (D.line < 40))
rep('WR+TE, bad, line 40+', (wr | te) & D.bad & (D.line >= 40))
print('--- controls: same groups in GOOD weather / domes ---')
good = ~D.bad
rep('WR (all), line 40+, not bad weather', wr & good & (D.line >= 40))
rep('WR big-play, line 40+, not bad weather', wr & big & good & (D.line >= 40))
rep('WR+TE, line 40+, not bad weather', (wr | te) & good & (D.line >= 40))
