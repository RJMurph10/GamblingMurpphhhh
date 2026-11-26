"""Unified NBA / NHL game table with lines + schedule features.
SBR closing (spread at -110 / moneyline / total) 2007-08 .. 2022-23; lines-history open + close 2023-24 .. 2026-27
(NHL 2022-23/2023-24 Bet365 prices broken -> SBR only for those)."""
import gzip, json, numpy as np, pandas as pd
def am(x):
    try: return float(str(x.get('american') or x.get('alternateDisplayValue')).replace('+', ''))
    except Exception: return np.nan
def from_lh(league, years):
    rows = []
    for y in years:
        for l in gzip.open(f'/tmp/lh/main_{league}_{y}.jsonl.gz'):
            g = json.loads(l)
            if g.get('type') != 2 or g.get('status') != 'STATUS_FINAL' or not g.get('books'): continue
            b = g['books'][0]; h = next(t for t in g['teams'] if t['homeAway'] == 'home'); a = next(t for t in g['teams'] if t['homeAway'] == 'away')
            ho, ao = b.get('homeTeamOdds', {}), b.get('awayTeamOdds', {})
            rows.append(dict(src='lh', season=y, date=g['date'], h=h['abbr'], a=a['abbr'], hs=h['score'], as_=a['score'],
                sp_o=am(ho.get('open', {}).get('pointSpread', {})), sp_c=am(ho.get('close', {}).get('pointSpread', {})),
                hsp_o=am(ho.get('open', {}).get('spread', {})), asp_o=am(ao.get('open', {}).get('spread', {})),
                hsp_c=am(ho.get('close', {}).get('spread', {})), asp_c=am(ao.get('close', {}).get('spread', {})),
                h_ml_o=am(ho.get('open', {}).get('moneyLine', {})), a_ml_o=am(ao.get('open', {}).get('moneyLine', {})),
                h_ml_c=am(ho.get('close', {}).get('moneyLine', {})), a_ml_c=am(ao.get('close', {}).get('moneyLine', {})),
                t_o=am(b.get('open', {}).get('total', {})), t_c=am(b.get('close', {}).get('total', {})),
                oo=am(b.get('open', {}).get('over', {})), ou=am(b.get('open', {}).get('under', {})),
                co=am(b.get('close', {}).get('over', {})), cu=am(b.get('close', {}).get('under', {}))))
    return pd.DataFrame(rows)
def from_sbr(league, last):
    s = pd.read_csv(f'/home/claude/mlbdata/sbr_{league}.csv', low_memory=False)
    s = s[(s.game_type == 'regular') & s.moneyline.notna()]
    s['y'] = s.season_label.str[:4].astype(int) + 1
    s = s[s.y <= last]
    h = s[s.home_away == 'H'].set_index('game_id'); a = s[s.home_away == 'A'].set_index('game_id')
    g = h[['y', 'date', 'team', 'score_for', 'score_against', 'moneyline', 'line', 'total_line']].join(a[['team', 'moneyline']], rsuffix='_a', how='inner')
    return pd.DataFrame(dict(src='sbr', season=g.y, date=g.date, h=g.team, a=g.team_a, hs=g.score_for, as_=g.score_against,
                             sp_c=g.line, h_ml_c=g.moneyline, a_ml_c=g.moneyline_a, t_c=g.total_line)).reset_index(drop=True)
def table(league):
    if league == 'nba':
        D = pd.concat([from_sbr('nba', 2023), from_lh('nba', [2024, 2025, 2026, 2027])], ignore_index=True)
    else:
        D = pd.concat([from_sbr('nhl', 2022), from_lh('nhl', [2025, 2026, 2027])], ignore_index=True)
    lh = D.src == 'lh'
    dt = pd.Series(pd.NaT, index=D.index, dtype='datetime64[ns]')
    dt[lh] = pd.to_datetime(D.date[lh], utc=True, format='ISO8601').dt.tz_convert('America/New_York').dt.tz_localize(None).dt.normalize()
    dt[~lh] = pd.to_datetime(D.date[~lh], format='%Y-%m-%d')
    D['dt'] = dt
    D = D.sort_values('dt').reset_index(drop=True); D['gi'] = D.index
    tl = pd.concat([D[['gi', 'season', 'dt', 'h', 'hs', 'as_']].rename(columns={'h': 'team'}).assign(home=1, margin=D.hs - D.as_),
                    D[['gi', 'season', 'dt', 'a', 'hs', 'as_']].rename(columns={'a': 'team'}).assign(home=0, margin=D.as_ - D.hs)]).sort_values(['team', 'dt', 'gi'])
    g = tl.groupby(['team', 'season'])
    tl['rest'] = g.dt.diff().dt.days - 1
    tl['g4'] = [0] * len(tl)
    out = []
    for _, d in g:
        ds = d.dt.values; out.append(pd.Series([((ds < x) & (ds >= x - np.timedelta64(3, 'D'))).sum() for x in ds], index=d.index))
    tl['g4'] = pd.concat(out)   # games in the previous 3 days (2 -> this is the 3rd game in 4 days)
    tl['prev_margin'] = g.margin.shift(1); tl['prev_home'] = g.home.shift(1)
    tl['road_run'] = g.home.transform(lambda s: (s == 0).groupby((s != s.shift()).cumsum()).cumcount() + 1) * (1 - tl.home)
    tl['gp'] = g.cumcount()
    f = tl.set_index(['gi', 'home'])[['rest', 'g4', 'prev_margin', 'road_run', 'gp']]
    hf = f.xs(1, level='home').add_prefix('h_'); af = f.xs(0, level='home').add_prefix('a_')
    return D.join(hf, on='gi').join(af, on='gi')
if __name__ == '__main__':
    for lg in ('nba', 'nhl'):
        T = table(lg); T.to_parquet(f'{lg}.parquet')
        print(lg, T.groupby('season').agg(n=('h', 'size'), src=('src', 'first'), b2b_share=('a_rest', lambda s: (s == 0).mean())).round(3).to_dict('index'))
