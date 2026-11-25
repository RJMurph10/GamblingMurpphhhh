import pandas as pd, numpy as np
M = pd.read_parquet('nhl_lines_goalies.parquet')
imp = lambda o: np.where(o < 0, -o / (-o + 100), 100 / (o + 100)); pay = lambda o: np.where(o < 0, 100 / -o, o / 100)
nv = lambda a, b: imp(a) / (imp(a) + imp(b))
M['p_o'] = nv(M.h_ml_o, M.a_ml_o); M['p_c'] = nv(M.h_ml_c, M.a_ml_c)
print('open vs close home win prob: median |move|', round((M.p_o - M.p_c).abs().median(), 3), ' share moved >10 pts', round(((M.p_o - M.p_c).abs() > .10).mean(), 3))
M = M[(M.p_o - M.p_c).abs() <= 0.15]  # drop broken openers
M['hwin'] = M.hs > M.as_; M['tot'] = M.hs + M.as_
def ml(name, sel, bet_home):
    x = M[sel]
    for w in ('o', 'c'):
        price = np.where(bet_home, x[f'h_ml_{w}'], x[f'a_ml_{w}']); win = np.where(bet_home, x.hwin, ~x.hwin)
        p = np.where(bet_home, x[f'p_{w}'], 1 - x[f'p_{w}'])
        u = np.where(win, pay(price), -1.0)
        by = pd.Series(u, index=x.season.values).groupby(level=0).mean().round(3).to_dict()
        print(f"  {name:62s} @{'open ' if w=='o' else 'close'} n={len(x):4d} won {win.mean():.3f} vs fair {p.mean():.3f}  ROI {u.mean():+.3f}  {by}")
def tot(name, sel, side):
    x = M[sel]
    for w, t, po, pu in (('open ', 't_o', 'oo', 'ou'), ('close', 't_c', 'co', 'cu')):
        y = x[x.tot != x[t]]
        win = (y.tot > y[t]) if side == 'over' else (y.tot < y[t])
        u = np.where(win, pay((y[po] if side == 'over' else y[pu]).values), -1.0)
        by = pd.Series(u, index=y.season.values).groupby(level=0).mean().round(3).to_dict()
        print(f"  {name+' '+side:62s} @{w} n={len(y):4d} hit {win.mean():.3f}  ROI {u.mean():+.3f}  {by}")
q = (M.h_gp >= 8) & (M.a_gp >= 8)
hb, ab = (M.h_backup == True) & q, (M.a_backup == True) & q
hn, an = (M.h_backup == False) & q, (M.a_backup == False) & q
print('backup start share', round(hb.mean(), 3), round(ab.mean(), 3), '| b2b share', round(M.h_b2b.mean(), 3), round(M.a_b2b.mean(), 3))
print('MONEYLINE')
ml('home starts backup, road starts #1 -> bet road', hb & an, False)
ml('road starts backup, home starts #1 -> bet home', ab & hn, True)
ml('home on back-to-back, road rested -> bet road', M.h_b2b & ~M.a_b2b, False)
ml('road on back-to-back, home rested -> bet home', M.a_b2b & ~M.h_b2b, True)
ml('road b2b AND starts backup, home #1 -> bet home', M.a_b2b & ab & hn, True)
ml('road b2b but starts #1 anyway -> bet road', M.a_b2b & an & ~M.h_b2b, False)
print('TOTALS')
tot('either team starts its backup', hb | ab, 'over')
tot('both teams start #1', hn & an, 'under')
tot('a team on a back-to-back', M.h_b2b | M.a_b2b, 'over')
# how much does the line move when a backup starts? (open -> close, toward the backup's opponent)
x = M[ab & hn]; print('\nroad backup: home fair prob open', round(x.p_o.mean(), 3), '-> close', round(x.p_c.mean(), 3), ' actual home win', round(x.hwin.mean(), 3))
x = M[hb & an]; print('home backup: home fair prob open', round(x.p_o.mean(), 3), '-> close', round(x.p_c.mean(), 3), ' actual home win', round(x.hwin.mean(), 3))
