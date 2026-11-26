import gzip, json, pandas as pd, numpy as np
# --- lines (ESPN BET 2024-25, 2025-26; DraftKings 2026-27), opening + closing ML and total
def am(x):
    try: return float(str(x.get('american') or x.get('alternateDisplayValue')).replace('+', ''))
    except Exception: return np.nan
L = []
for f, season in (('main_nhl_2025', '2024-25'), ('main_nhl_2026', '2025-26'), ('main_nhl_2027', '2026-27')):
    for l in gzip.open(f'/tmp/lh/{f}.jsonl.gz'):
        g = json.loads(l)
        if g.get('type') != 2 or g.get('status') != 'STATUS_FINAL' or not g.get('books'): continue
        b = g['books'][0]; h = next(t for t in g['teams'] if t['homeAway'] == 'home'); a = next(t for t in g['teams'] if t['homeAway'] == 'away')
        ho, ao = b.get('homeTeamOdds', {}), b.get('awayTeamOdds', {})
        row = dict(season=season, date=g['date'], h=h['abbr'], a=a['abbr'], hs=h['score'], as_=a['score'], book=b.get('id'),
                   h_ml_o=am(ho.get('open', {}).get('moneyLine', {})), a_ml_o=am(ao.get('open', {}).get('moneyLine', {})),
                   h_ml_c=am(ho.get('close', {}).get('moneyLine', {})), a_ml_c=am(ao.get('close', {}).get('moneyLine', {})),
                   t_o=am(b.get('open', {}).get('total', {})), oo=am(b.get('open', {}).get('over', {})), ou=am(b.get('open', {}).get('under', {})),
                   t_c=am(b.get('close', {}).get('total', {})), co=am(b.get('close', {}).get('over', {})), cu=am(b.get('close', {}).get('under', {})))
        L.append(row)
L = pd.DataFrame(L); L['d'] = pd.to_datetime(L.date).dt.tz_localize(None)
print('lines', L.groupby('season').size().to_dict(), 'with ML open', L.groupby('season').h_ml_o.apply(lambda x: x.notna().mean()).round(2).to_dict(),
      'total open', L.groupby('season').t_o.apply(lambda x: x.notna().mean()).round(2).to_dict())
# --- starters
G = []
for s in ('2024-25', '2025-26', '2026-27'):
    for l in gzip.open(f'/home/claude/nhlwork/p-{s}.jsonl.gz'):
        g = json.loads(l)
        if g.get('type') != 2 or not g.get('goalies'): continue
        st = {}
        for side in ('home', 'away'):
            s_ = [x for x in g['goalies'][side] if x[2]]
            st[side] = s_[0][0] if s_ else None
        G.append(dict(season=s, gid=g['id'], date=g['date'], start=g['start'], home=g['home'], away=g['away'], h_g=st['home'], a_g=st['away']))
G = pd.DataFrame(G).sort_values('start').reset_index(drop=True)
# team logs: #1 goalie = most starts in the team's previous 20 games this season; back-to-back = played the day before
tl = pd.concat([G.assign(team=G.home, goalie=G.h_g, side='H'), G.assign(team=G.away, goalie=G.a_g, side='A')]).sort_values('start')
tl['dt'] = pd.to_datetime(tl.date)
recs = []
for (t, s), d in tl.groupby(['team', 'season']):
    prev = []; prev_dt = None
    for r in d.itertuples():
        top = pd.Series(prev[-20:]).value_counts() if prev else None
        no1 = top.index[0] if top is not None and len(prev) >= 8 else None
        recs.append((r.gid, r.side, r.goalie, no1, (r.goalie != no1) if no1 else None,
                     prev_dt is not None and (r.dt - prev_dt).days == 1, len(prev)))
        prev.append(r.goalie); prev_dt = r.dt
R = pd.DataFrame(recs, columns=['gid', 'side', 'goalie', 'no1', 'backup', 'b2b', 'gp'])
H = R[R.side == 'H'].drop(columns='side').set_index('gid').add_prefix('h_'); A = R[R.side == 'A'].drop(columns='side').set_index('gid').add_prefix('a_')
G = G.set_index('gid').join(H).join(A).reset_index()
# --- join lines to games (ESPN abbreviations differ)
MAP = {'NJ': 'NJD', 'TB': 'TBL', 'LA': 'LAK', 'SJ': 'SJS', 'UTAH': 'UTA', 'WSH': 'WSH', 'MON': 'MTL', 'CBJ': 'CBJ', 'NAS': 'NSH', 'VGK': 'VGK', 'LV': 'VGK'}
L['H'] = L.h.map(lambda x: MAP.get(x, x)); L['A'] = L.a.map(lambda x: MAP.get(x, x))
G['st'] = pd.to_datetime(G.start).dt.tz_localize(None)
M = L.merge(G, left_on=['H', 'A'], right_on=['home', 'away'], suffixes=('', '_g'))
M = M[(M.d - M.st).abs() <= pd.Timedelta(hours=6)]
print('matched', len(M), 'of', len(L), '| unmatched abbrs', sorted(set(L.H) - set(G.home)))
M.to_parquet('/home/claude/nhlwork/nhl_lines_goalies.parquet')
