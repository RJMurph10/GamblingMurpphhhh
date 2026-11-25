"""Star hitter out of the starting lineup vs moneyline / total, close 2012-25 and open 2021-25.
Star value = batting runs above average (wRAA, from wOBA weights) from the prior season, or this season to date.
'Out' = a current team regular (started 1+ of the team's previous 5 games) who isn't in today's lineup.
One-day rest (started the previous game) vs a longer absence (missed the previous game too)."""
import pandas as pd, numpy as np
exec(open('sched_test.py').read().split('T = pd.Series(True')[0])   # loads L (games + lines) and helpers
pa = pd.read_parquet('pa.parquet', columns=['game_id', 'season', 'batter', 'woba', 'bat_home'])
lg = pa.groupby('season').woba.mean()
pa['rv'] = (pa.woba - pa.season.map(lg)) / 1.2
gm = pd.read_parquet('games.parquet')
gm['dt'] = pd.to_datetime(gm.date)
# prior-season wRAA
season_rv = pa.groupby(['season', 'batter']).rv.sum()
# to-date wRAA (before each game): cumulative over the season in game order
gm_order = gm.sort_values(['dt', 'number']).reset_index(drop=True); gm_order['k'] = np.arange(len(gm_order))
pa = pa.merge(gm_order[['game_id', 'k']], on='game_id')
pg = pa.groupby(['season', 'batter', 'k']).rv.sum().reset_index().sort_values('k')
pg['cum_before'] = pg.groupby(['season', 'batter']).rv.cumsum() - pg.rv
todate = {}
for r in pg.itertuples(): todate[(r.season, r.batter, r.k)] = r.cum_before
# team game sequence of lineups
tg = pd.concat([gm_order.assign(team=gm_order.home, lu=gm_order.lineup1, side='H'), gm_order.assign(team=gm_order.away, lu=gm_order.lineup0, side='A')]).sort_values(['team', 'k'])
rows = []
for (team, season), d in tg.groupby(['team', 'season']):
    last = []  # lineups of previous games
    seen_k = {}
    for r in d.itertuples():
        today = set(r.lu)
        regulars = set().union(*last[-5:]) if last else set()
        prev = last[-1] if last else set()
        best = None
        for b in regulars - today:
            v_prior = season_rv.get((season - 1, b), 0.0)
            # to-date value: last known cumulative before this game
            v_now = seen_k.get(b, 0.0)
            v = max(v_prior, v_now * 1.5)
            if best is None or v > best[1]: best = (b, v, b in prev)
        rows.append((r.game_id, r.side, best[1] if best else 0.0, best[2] if best else False, len(last)))
        for b in today: pass
        # update to-date values for today's batters (after the game)
        for b in today:
            seen_k[b] = todate.get((season, b, r.k), seen_k.get(b, 0.0)) + pa_rv if False else todate.get((season, b, r.k), seen_k.get(b, 0.0))
        last.append(today)
st = pd.DataFrame(rows, columns=['game_id', 'side', 'out_val', 'one_day', 'gp'])
H = st[st.side == 'H'].drop(columns='side').set_index('game_id').add_prefix('h_'); A = st[st.side == 'A'].drop(columns='side').set_index('game_id').add_prefix('a_')
L2 = L.drop(columns=[c for c in L.columns if c.startswith(('h_out','a_out','h_one','a_one','h_gp','a_gp'))]).set_index('game_id').join(H).join(A).reset_index()
L2 = L2[(L2.h_gp >= 10) & (L2.a_gp >= 10)]
L = L2
T = pd.Series(True, index=L.index); F = ~T
for thr in (15, 25):
    for kind, sel_h, sel_a in (('any', T, T), ('one-day rest', L.h_one_day, L.a_one_day), ('longer absence', ~L.h_one_day, ~L.a_one_day)):
        h_out = (L.h_out_val >= thr) & sel_h & (L.a_out_val < 5)
        a_out = (L.a_out_val >= thr) & sel_a & (L.h_out_val < 5)
        ang_ml(f'home star ({thr}+ runs) out [{kind}] -> bet road', h_out, F)
        ang_ml(f'road star ({thr}+ runs) out [{kind}] -> bet home', a_out, T)
    ang_total(f'any star ({thr}+) out, either team', (L.h_out_val >= thr) | (L.a_out_val >= thr), 'under')
    ang_total(f'stars ({thr}+) out on BOTH teams', (L.h_out_val >= thr) & (L.a_out_val >= thr), 'under')
print('share of team-games missing a 15+ star:', round(((L.h_out_val >= 15).mean() + (L.a_out_val >= 15).mean()) / 2, 3))
