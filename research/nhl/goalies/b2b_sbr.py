"""NHL road team on a back-to-back vs rested home team, closing moneylines from SBR (2007-2021 seasons)."""
import pandas as pd, numpy as np
s = pd.read_csv('/home/claude/mlbdata/sbr_nhl.csv', low_memory=False)
s = s[s.game_type == 'regular']
print('seasons with moneylines:', s[s.moneyline.notna()].groupby('season_label').size().to_dict())
s['dt'] = pd.to_datetime(s.date)
s = s.sort_values(['team', 'dt'])
s['b2b'] = s.groupby(['team', 'season']).dt.diff().dt.days.eq(1)
h = s[s.home_away == 'H'].set_index('game_id'); a = s[s.home_away == 'A'].set_index('game_id')
g = h[['season', 'season_label', 'team', 'score_for', 'score_against', 'moneyline', 'b2b']].join(a[['team', 'moneyline', 'b2b']], rsuffix='_a').dropna(subset=['moneyline', 'moneyline_a'])
g = g[(g.moneyline.abs() >= 100) & (g.moneyline_a.abs() >= 100)]
imp = lambda o: np.where(o < 0, -o / (-o + 100), 100 / (o + 100)); pay = lambda o: np.where(o < 0, 100 / -o, o / 100)
g['vig'] = imp(g.moneyline) + imp(g.moneyline_a) - 1
print('mean vig', round(g.vig.mean(), 3))
win = g.score_for > g.score_against
for name, sel, home in (('road b2b, home rested -> home', g.b2b_a & ~g.b2b, True), ('home b2b, road rested -> road', g.b2b & ~g.b2b_a, False), ('control: all home', g.b2b | ~g.b2b, True)):
    x = g[sel]; w = win[sel] if home else ~win[sel]
    price = x.moneyline if home else x.moneyline_a; opp = x.moneyline_a if home else x.moneyline
    u = np.where(w, pay(price.values), -1.0); fair = imp(price) / (imp(price) + imp(opp))
    by = pd.DataFrame({'u': u, 's': x.season_label.values}).groupby('s').u.agg(['size', 'mean']).round(3)
    print(f"{name:32s} n={len(x)} won {w.mean():.3f} fair {fair.mean():.3f} ROI {u.mean():+.3f}  seasons positive {int((by['mean']>0).sum())}/{len(by)}")
    print('   ', ' '.join(f"{i}:{r['mean']:+.3f}" for i, r in by.iterrows()))
