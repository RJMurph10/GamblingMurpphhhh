import pandas as pd, numpy as np
gm = pd.read_parquet('games.parquet'); sc = pd.read_parquet('sched.parquet')
H = sc[sc.side == 'H'].set_index('game_id').add_prefix('h_'); A = sc[sc.side == 'A'].set_index('game_id').add_prefix('a_')
g = gm.set_index('game_id').join(H).join(A).reset_index()
code = {'ANA':'LAA','CHA':'CHW','CHN':'CHC','KCA':'KC','LAN':'LAD','NYA':'NYY','NYN':'NYM','SDN':'SD','SFN':'SF','SLN':'STL','TBA':'TB'}
# ---- lines
s = pd.read_csv('/home/claude/mlbdata/sbr_mlb.csv', low_memory=False)
s = s[s.season.between(2012, 2021)]
sh = s[s.home_away == 'H'][['game_id', 'total_line', 'moneyline', 'score_for', 'score_against']].rename(columns={'total_line': 'close', 'moneyline': 'h_ml_c', 'score_for': 'hs', 'score_against': 'as_'})
sa = s[s.home_away == 'A'][['game_id', 'moneyline']].rename(columns={'moneyline': 'a_ml_c'})
S = sh.merge(sa, on='game_id'); S['co'] = -110; S['cu'] = -110
o = pd.read_csv('/home/claude/mlbdata/odds_flat.csv'); o = o[o.sportsbook == 'draftkings']
o['home'] = o.home.replace({'AZ': 'ARI'}); o['away'] = o.away.replace({'AZ': 'ARI'})
t = o[o.market == 'totals'][['date','home','away','home_score','away_score','opening_total','opening_over_odds','opening_under_odds','closing_total','closing_over_odds','closing_under_odds']]
m = o[o.market == 'moneyline'][['date','home','away','home_score','away_score','opening_home_odds','opening_away_odds','closing_home_odds','closing_away_odds']]
D = t.merge(m, on=['date','home','away','home_score','away_score'])
g2 = g[g.season >= 2021].copy(); g2['h'] = g2.home.map(lambda x: code.get(x, x)); g2['a'] = g2.away.map(lambda x: code.get(x, x)); g2['d'] = pd.to_datetime(g2.date).dt.strftime('%Y-%m-%d')
D = g2[['game_id','d','h','a','home_runs','away_runs']].merge(D, left_on=['d','h','a','home_runs','away_runs'], right_on=['date','home','away','home_score','away_score']).drop_duplicates('game_id', keep=False)
okp = lambda x: x.between(-400, 350)
D = D[okp(D.closing_over_odds) & okp(D.closing_under_odds) & okp(D.closing_home_odds) & okp(D.closing_away_odds) & ((D.closing_total - D.opening_total).abs() <= 2)]
D = D.rename(columns={'opening_total':'open','opening_over_odds':'oo','opening_under_odds':'ou','closing_total':'close','closing_over_odds':'co','closing_under_odds':'cu',
                      'opening_home_odds':'h_ml_o','opening_away_odds':'a_ml_o','closing_home_odds':'h_ml_c','closing_away_odds':'a_ml_c','home_runs':'hs','away_runs':'as_'})
D = D[['game_id','open','oo','ou','close','co','cu','h_ml_o','a_ml_o','h_ml_c','a_ml_c','hs','as_']]
S = S[~S.game_id.isin(D.game_id) & (S.game_id.str[3:7] != '2021')]
L = pd.concat([S, D]).merge(g, on='game_id'); L['tot'] = L.hs + L.as_
pay = lambda o: np.where(o < 0, 100 / -o, o / 100)
def nv(a, b):  # no-vig prob of side a
    ia = np.where(a < 0, -a / (-a + 100), 100 / (a + 100)); ib = np.where(b < 0, -b / (-b + 100), 100 / (b + 100)); return ia / (ia + ib)
def tot_bet(df, side, line='close', po='co', pu='cu'):
    df = df[df[line].notna() & (df.tot != df[line])]
    win = (df.tot > df[line]) if side == 'over' else (df.tot < df[line])
    return pd.Series(np.where(win, pay((df[po] if side == 'over' else df[pu]).values), -1.0), index=df.season.values), (df.tot - df[line]).mean()
def ml_bet(df, team_is_home, which='c'):
    df = df[df[f'h_ml_{which}'].notna()]
    th = team_is_home.loc[df.index]
    price = np.where(th, df[f'h_ml_{which}'], df[f'a_ml_{which}']); opp = np.where(th, df[f'a_ml_{which}'], df[f'h_ml_{which}'])
    win = np.where(th, df.hs > df.as_, df.as_ > df.hs)
    return pd.Series(np.where(win, pay(price), -1.0), index=df.season.values), (win - nv(price, opp)).mean()
def show(name, u, extra):
    if len(u) == 0: print(f'{name:60s} n=0'); return
    d1, d2 = u[u.index <= 2018], u[u.index >= 2019]
    print(f"{name:60s} n={len(u):5d} ROI {u.mean():+.3f} | 2012-18 {d1.mean():+.3f} ({len(d1)}) | 2019-25 {d2.mean():+.3f} ({len(d2)}) | {extra}")
def ang_total(name, sel, side):
    x = L[sel]; u, r = tot_bet(x, side); show(f'[TOTAL {side}] ' + name + ' @close', u, f'runs vs line {r:+.2f}')
    y = x[x.open.notna()]; u, r = tot_bet(y, side, 'open', 'oo', 'ou'); show(f'[TOTAL {side}] ' + name + ' @open 21-25', u, f'runs vs line {r:+.2f}')
def ang_ml(name, sel, team_is_home):
    x = L[sel]; u, e = ml_bet(x, team_is_home[sel]); show('[ML] ' + name + ' @close', u, f'win% vs no-vig {e:+.3f}')
    y = x[x.h_ml_o.notna()]; u, e = ml_bet(y, team_is_home[sel & L.h_ml_o.notna()], 'o'); show('[ML] ' + name + ' @open 21-25', u, f'win% vs no-vig {e:+.3f}')
T = pd.Series(True, index=L.index); F = ~T
# travel / time zones (no day off)
for who, pre, other in (('road team', 'a_', 'h_'), ('home team', 'h_', 'a_')):
    tired = (L[pre + 'miles'] >= 1500) & (L[pre + 'rest'] <= 0)
    ang_ml(f'fade {who} after 1500+ mile trip, no day off', tired, T if pre == 'a_' else F)
    east = (L[pre + 'tz'] >= 2) & (L[pre + 'rest'] <= 0)
    ang_ml(f'fade {who} after 2+ zones EAST, no day off', east, T if pre == 'a_' else F)
    west = (L[pre + 'tz'] <= -2) & (L[pre + 'rest'] <= 0)
    ang_ml(f'fade {who} after 2+ zones WEST, no day off', west, T if pre == 'a_' else F)
# rest edge
rest_h = (L.h_rest >= 1) & (L.a_rest <= 0); rest_a = (L.a_rest >= 1) & (L.h_rest <= 0)
ang_ml('rested HOME team vs no-rest road team', rest_h, T)
ang_ml('rested ROAD team vs no-rest home team', rest_a, F)
ang_ml('fatigue: home 7+ games in 6 days -> back road', (L.h_g6 >= 7), T)
ang_ml('fatigue: road 7+ games in 6 days -> back home', (L.a_g6 >= 7), T)
ang_ml('getaway: road team day game after night game + travel 500+', (L.daynight == 'day') & L.a_prev_night & (L.a_miles >= 500), T)
# totals
ang_total('both teams off a day (rested)', (L.h_rest >= 1) & (L.a_rest >= 1), 'over')
ang_total('both teams off a day (rested)', (L.h_rest >= 1) & (L.a_rest >= 1), 'under')
ang_total('road team crossed 2+ zones, no day off', (L.a_tz.abs() >= 2) & (L.a_rest <= 0), 'under')
ang_total('road team crossed 2+ zones, no day off', (L.a_tz.abs() >= 2) & (L.a_rest <= 0), 'over')
ang_total('day game after night game (both teams)', (L.daynight == 'day') & L.h_prev_night & L.a_prev_night, 'under')
ang_total('doubleheader game 1', L.number.astype(int) == 1, 'under')
ang_total('doubleheader game 1', L.number.astype(int) == 1, 'over')
ang_total('doubleheader game 2', L.number.astype(int) == 2, 'under')
ang_total('doubleheader game 2', L.number.astype(int) == 2, 'over')
ang_ml('doubleheader game 2: home team', L.number.astype(int) == 2, T)
ang_ml('doubleheader game 2: road team', L.number.astype(int) == 2, F)
