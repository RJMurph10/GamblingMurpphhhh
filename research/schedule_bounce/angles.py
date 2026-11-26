import numpy as np, pandas as pd, sys
lg = sys.argv[1]
T = pd.read_parquet(f'{lg}.parquet')
pay = lambda o: np.where(np.isnan(o), 100 / 110, np.where(o < 0, 100 / -o, o / 100))
imp = lambda o: np.where(o < 0, -o / (-o + 100), 100 / (o + 100))
mg = T.hs - T.as_
if lg == 'nba':
    print('check spread sign: mean(home margin + close spread) =', round((mg + T.sp_c).mean(), 2))
PER = [('2008-15', (T.src == 'sbr') & (T.season <= 2015)), ('2016-23', (T.src == 'sbr') & (T.season >= 2016)), ('2024-27', T.src == 'lh')]
def bet(sel, bet_home, w):
    x = T[sel]
    if lg == 'nba':
        cov = mg[sel] + x[f'sp_{w}']; ok = cov.notna() & (cov != 0)
        win = (cov > 0) if bet_home else (cov < 0)
        price = (x[f'hsp_{w}'] if bet_home else x[f'asp_{w}']) if w == 'o' or True else None
        price = price.values if f'hsp_{w}' in x else np.full(len(x), np.nan)
        u = np.where(win, pay(price.astype(float)), -1.0)[ok.values]
        return u, x.season.values[ok.values], x.src.values[ok.values]
    else:
        hp, ap = x[f'h_ml_{w}'], x[f'a_ml_{w}']; ok = hp.notna() & ap.notna() & (hp.abs() >= 100) & (ap.abs() >= 100)
        win = (mg[sel] > 0) if bet_home else (mg[sel] < 0)
        u = np.where(win, pay((hp if bet_home else ap).values.astype(float)), -1.0)[ok.values]
        return u, x.season.values[ok.values], x.src.values[ok.values]
def show(name, sel, bet_home):
    out = []
    for w in ('c', 'o'):
        if w == 'o' and 'sp_o' not in T: continue
        u, s, src = bet(sel & (T.src == 'lh') if w == 'o' else sel, bet_home, w)
        if w == 'c':
            for pn, pm in (('2008-15', (src == 'sbr') & (s <= 2015)), ('2016-23', (src == 'sbr') & (s >= 2016)), ('2024-27', src == 'lh')):
                out.append(f"{pn} {pm.sum():4d} {u[pm].mean():+.3f}")
        else:
            out.append(f"OPEN 24-27 {len(u):4d} {u.mean():+.3f}")
    print(f"{name:55s} | close: " + ' | '.join(out[:3]) + ' || ' + (out[3] if len(out) > 3 else ''))
H, A = pd.Series(True, index=T.index), pd.Series(False, index=T.index)
q = (T.h_gp >= 5) & (T.a_gp >= 5)
print(f'== {lg.upper()} rest / schedule ({"ATS" if lg=="nba" else "moneyline"}) — ROI by period')
show('road on b2b, home rested -> home', q & (T.a_rest == 0) & (T.h_rest >= 1), True)
show('home on b2b, road rested -> road', q & (T.h_rest == 0) & (T.a_rest >= 1), False)
show('road 3rd game in 4 nights, home rested -> home', q & (T.a_g4 >= 2) & (T.h_rest >= 1), True)
show('road b2b + 4th+ game of road trip -> home', q & (T.a_rest == 0) & (T.a_road_run >= 4), True)
show('road 2+ days rest vs home on b2b -> road', q & (T.a_rest >= 2) & (T.h_rest == 0), False)
show('rest edge 2+ days (road more rested) -> road', q & (T.a_rest - T.h_rest >= 2), False)
show('rest edge 2+ days (home more rested) -> home', q & (T.h_rest - T.a_rest >= 2), True)
big = 20 if lg == 'nba' else 4
print(f'== {lg.upper()} bounce-back (previous game decided by {big}+)')
show(f'road team after losing by {big}+ -> road', q & (T.a_prev_margin <= -big), False)
show(f'home team after losing by {big}+ -> home', q & (T.h_prev_margin <= -big), True)
show(f'road team after WINNING by {big}+ -> fade (home)', q & (T.a_prev_margin >= big), True)
show(f'home team after WINNING by {big}+ -> fade (road)', q & (T.h_prev_margin >= big), False)
big2 = 30 if lg == 'nba' else 5
show(f'road team after losing by {big2}+ -> road', q & (T.a_prev_margin <= -big2), False)
show(f'home team after losing by {big2}+ -> home', q & (T.h_prev_margin <= -big2), True)
show('control: every home team', q, True)
