import pandas as pd, numpy as np
gm = pd.read_parquet('games.parquet'); feat = pd.read_parquet('feat.parquet')
# closing lines 2012-2021: SBR (no prices -> -110)
s = pd.read_csv('/home/claude/mlbdata/sbr_mlb.csv', low_memory=False)
s = s[(s.home_away == 'H') & s.season.between(2012, 2021)][['game_id', 'total_line', 'score_for', 'score_against']]
s = s.rename(columns={'total_line': 'close', 'score_for': 'hs', 'score_against': 'as_'}); s['co'] = -110; s['cu'] = -110; s['open'] = np.nan
# 2022-2025: DraftKings open + close with prices
o = pd.read_csv('/home/claude/mlbdata/odds_flat.csv'); o = o[(o.market == 'totals') & (o.sportsbook == 'draftkings')]
o['home'] = o.home.replace({'AZ': 'ARI'}); o['away'] = o.away.replace({'AZ': 'ARI'})
code = {'ANA':'LAA','CHA':'CHW','CHN':'CHC','KCA':'KC','LAN':'LAD','NYA':'NYY','NYN':'NYM','SDN':'SD','SFN':'SF','SLN':'STL','TBA':'TB'}
g2 = gm[gm.season >= 2021].copy(); g2['h'] = g2.home.map(lambda x: code.get(x, x)); g2['a'] = g2.away.map(lambda x: code.get(x, x)); g2['d'] = pd.to_datetime(g2.date).dt.strftime('%Y-%m-%d')
m = g2.merge(o, left_on=['d', 'h', 'a', 'home_runs', 'away_runs'], right_on=['date', 'home', 'away', 'home_score', 'away_score'])
m = m.drop_duplicates('game_id', keep=False)
ok = lambda x: x.between(-250, 200)
m = m[ok(m.closing_over_odds) & ok(m.closing_under_odds) & ((m.closing_total - m.opening_total).abs() <= 2)]
d = m[['game_id', 'opening_total', 'opening_over_odds', 'opening_under_odds', 'closing_total', 'closing_over_odds', 'closing_under_odds', 'home_runs', 'away_runs']].rename(columns={
    'opening_total': 'open', 'opening_over_odds': 'oo', 'opening_under_odds': 'ou', 'closing_total': 'close', 'closing_over_odds': 'co', 'closing_under_odds': 'cu', 'home_runs': 'hs', 'away_runs': 'as_'})
s = s[~s.game_id.isin(d.game_id) & ~s.game_id.str[3:7].eq('2021')]  # 2021 from SBR only where DK is missing
L = pd.concat([s, d]).merge(feat, on='game_id')
L['tot'] = L.hs + L.as_
L.to_parquet('lines_feat.parquet')
pay = lambda odds: np.where(odds < 0, 100 / -odds, odds / 100)
def sim(df, line, po, pu, col, q, label):
    df = df[df[line].notna() & (df.tot != df[line])]
    lo, hi = df[col].quantile(q), df[col].quantile(1 - q)
    res = []
    for side, sel in (('over (top tilt)', df[col] >= hi), ('under (bottom tilt)', df[col] <= lo)):
        x = df[sel]
        win = (x.tot > x[line]) if side.startswith('over') else (x.tot < x[line])
        pr = pay(x[po].values if side.startswith('over') else x[pu].values)
        u = np.where(win, pr, -1.0)
        by = pd.Series(u, index=x.season.values).groupby(level=0).sum().round(1).to_dict()
        res.append(f"  {label} {side}: n={len(x)}, hit {win.mean():.3f}, ROI {u.mean():+.3f}, by season {by}")
    return res
L['resid_c'] = L.tot - L.close
print('games', len(L), 'by season', L.season.value_counts().sort_index().to_dict())
for col in ('tilt', 'htilt'):
    print(f'== {col}: corr with (runs - closing total) = {L[col].corr(L.resid_c):+.4f};',
          'slope', round(np.polyfit(L[col], L.resid_c, 1)[0], 3), 'runs per unit; sd', round(L[col].std(), 3))
    x = L[L.open.notna()]; print(f'   vs opening total (2021-25): corr {x[col].corr(x.tot - x.open):+.4f}, n {len(x)}')
    # raw runs check: does tilt predict runs at all (ignoring the line)?
    print(f'   corr with total runs (no line) {L[col].corr(L.tot):+.4f}')
    for q in (0.1, 0.05):
        for line in [r for r in sim(L, 'close', 'co', 'cu', col, q, f'close q{q}')]: print(line)
        x = L[L.open.notna()]
        for line in sim(x, 'open', 'oo', 'ou', col, q, f'open q{q}'): print(line)
