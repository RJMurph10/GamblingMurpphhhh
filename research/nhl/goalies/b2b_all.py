"""Road team on the 2nd night of a back-to-back vs a rested home team: bet home. All lines seasons in lines-history."""
import gzip, json, pandas as pd, numpy as np
def am(x):
    try: return float(str(x.get('american') or x.get('alternateDisplayValue')).replace('+', ''))
    except Exception: return np.nan
rows = []
for y in (2023, 2024, 2025, 2026, 2027):
    for l in gzip.open(f'/tmp/lh/main_nhl_{y}.jsonl.gz'):
        g = json.loads(l)
        if g.get('type') != 2 or g.get('status') != 'STATUS_FINAL': continue
        h = next(t for t in g['teams'] if t['homeAway'] == 'home'); a = next(t for t in g['teams'] if t['homeAway'] == 'away')
        b = (g.get('books') or [{}])[0]; ho, ao = b.get('homeTeamOdds', {}), b.get('awayTeamOdds', {})
        rows.append(dict(season=y, date=g['date'], h=h['abbr'], a=a['abbr'], hs=h['score'], as_=a['score'], book=b.get('id'), name=b.get('name'),
                         h_o=am(ho.get('open', {}).get('moneyLine', {})), a_o=am(ao.get('open', {}).get('moneyLine', {})),
                         h_c=am(ho.get('close', {}).get('moneyLine', {})) if ho.get('close') else ho.get('moneyLine'),
                         a_c=am(ao.get('close', {}).get('moneyLine', {})) if ao.get('close') else ao.get('moneyLine')))
D = pd.DataFrame(rows); D['dt'] = pd.to_datetime(D.date).dt.tz_convert('America/New_York').dt.normalize()
print(D.groupby('season').agg(n=('h', 'size'), book=('name', lambda s: s.mode().iat[0] if s.notna().any() else None), open_ok=('h_o', lambda s: s.notna().mean()), close_ok=('h_c', lambda s: pd.Series(s).notna().mean())))
tl = pd.concat([D.assign(team=D.h, idx=D.index), D.assign(team=D.a, idx=D.index)]).sort_values('dt')
tl['b2b'] = tl.groupby(['team', 'season']).dt.diff().dt.days.eq(1)
b = tl.groupby(['idx', 'team']).b2b.first()
D['h_b2b'] = [b.get((i, t), False) for i, t in zip(D.index, D.h)]; D['a_b2b'] = [b.get((i, t), False) for i, t in zip(D.index, D.a)]
imp = lambda o: np.where(o < 0, -o / (-o + 100), 100 / (o + 100)); pay = lambda o: np.where(o < 0, 100 / -o, o / 100)
for name, sel, home in (('road b2b, home rested -> home', D.a_b2b & ~D.h_b2b, True), ('home b2b, road rested -> road', D.h_b2b & ~D.a_b2b, False),
                        ('both b2b -> home', D.a_b2b & D.h_b2b, True)):
    for w in ('o', 'c'):
        x = D[sel & D[f'h_{w}'].notna() & D[f'a_{w}'].notna()]
        x = x[(x[f'h_{w}'].abs() >= 100) & (x[f'a_{w}'].abs() >= 100)]
        price = x[f'h_{w}'] if home else x[f'a_{w}']; opp = x[f'a_{w}'] if home else x[f'h_{w}']
        win = (x.hs > x.as_) if home else (x.as_ > x.hs)
        fair = imp(price) / (imp(price) + imp(opp)); u = np.where(win, pay(price.values), -1.0)
        by = pd.DataFrame({'u': u, 's': x.season.values, 'w': win.values}).groupby('s').agg(n=('u', 'size'), roi=('u', 'mean'), won=('w', 'mean')).round(3)
        print(f"{name:32s} @{'open ' if w=='o' else 'close'} n={len(x):4d} won {win.mean():.3f} fair {fair.mean():.3f} ROI {u.mean():+.3f} | " + ' '.join(f"{s}:{r.n} {r.roi:+.3f}" for s, r in by.iterrows()))
print('--- control: every home team')
for w in ('o', 'c'):
    x = D[D[f'h_{w}'].notna() & D[f'a_{w}'].notna()]; x = x[(x[f'h_{w}'].abs() >= 100) & (x[f'a_{w}'].abs() >= 100)]
    win = x.hs > x.as_; u = np.where(win, pay(x[f'h_{w}'].values), -1.0); vig = (imp(x[f'h_{w}']) + imp(x[f'a_{w}']) - 1)
    print(w, pd.DataFrame({'u': u, 's': x.season.values, 'vig': vig}).groupby('s').agg(n=('u', 'size'), roi=('u', 'mean'), vig=('vig', 'mean')).round(3).to_dict('index'))
