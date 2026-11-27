"""Passing, rushing, receptions, rush+rec yards, longest reception props: bad weather vs all games."""
import gzip, json, numpy as np, pandas as pd
P = pd.read_csv('players.csv.gz', low_memory=False)[['gsis_id', 'espn_id', 'position']].dropna(subset=['espn_id'])
P['espn_id'] = P.espn_id.astype(float).astype(int).astype(str); e2g = dict(zip(P.espn_id, P.gsis_id)); pos = dict(zip(P.gsis_id, P.position))
W = pd.concat([pd.read_csv(f'w_{y}.csv.gz', low_memory=False) for y in (2024, 2025, 2026)]); W = W[W.season_type == 'REG']
W['rr'] = W.rushing_yards.fillna(0) + W.receiving_yards.fillna(0)
act = {(r.player_id, r.season, r.week): r for r in W.itertuples()}
G = pd.read_csv('/tmp/games.csv', low_memory=False); G = G[(G.game_type == 'REG') & G.season.between(2024, 2026)]
gmap = {str(int(e)): r for e, r in zip(G.espn, G.itertuples()) if pd.notna(e)}
Wx = json.load(open('weather.json'))
MK = {'Total Passing Yards (incl. overtime)': 'passing_yards', 'Total Rushing Yards (incl. overtime)': 'rushing_yards',
      'Total Receptions (incl. overtime)': 'receptions', 'Total Rushing Plus Receiving Yards (incl. overtime)': 'rr',
      'Total Passing Completions (incl. overtime)': 'completions', 'Total Passing Attempts (incl. overtime)': 'attempts',
      'Total Rushing Attempts (incl. overtime)': 'carries'}
if 'carries' not in W.columns: pass
LONG = 'Longest Reception (incl. overtime)'
rows = []
for season in (2024, 2025, 2026):
    for l in gzip.open(f'props-{season}.jsonl.gz'):
        g = json.loads(l)
        if str(g.get('seasonType')) != '2' or g['id'] not in gmap: continue
        gr = gmap[g['id']]; seen = set()
        box = g.get('box') or {}
        for b in g['books'].values():
            for r in b['rows']:
                if (r['t'] not in MK and r['t'] != LONG) or (r['a'], r['t']) in seen: continue
                op = r.get('op') or [None]
                if op[0] is None: continue
                gs = e2g.get(r['a']); a = act.get((gs, gr.season, gr.week)) if gs else None
                if r['t'] == LONG:
                    v = (box.get(r['a']) or {}).get('s', {}).get('receiving.LONG')
                    try: val = float(v)
                    except Exception: continue
                else:
                    if a is None: continue
                    val = getattr(a, MK[r['t']])
                    if pd.isna(val): continue
                seen.add((r['a'], r['t']))
                wx = Wx.get(gr.game_id, {}); wind = gr.wind if pd.notna(gr.wind) else wx.get('wind')
                bad = gr.roof in ('outdoors', 'open') and ((wx.get('precip') or 0) >= 1 or (wind or 0) >= 15)
                rows.append(dict(season=season, game_id=gr.game_id, market=r['t'].split(' (')[0], pos=pos.get(gs), line=op[0], actual=float(val), bad=bad))
D = pd.DataFrame(rows); D = D[D.actual != D.line]
print(f'{len(D)} props')
D.to_parquet('other.parquet')
for mk, x in D.groupby('market'):
    for cond, y in (('all games', x), ('BAD weather', x[x.bad])):
        if len(y) < 30: continue
        u = (y.actual < y.line)
        by = y.assign(w=u.values).groupby('season').w.mean().round(2).to_dict()
        print(f"{mk:38s} {cond:12s} n={len(y):5d} games {y.game_id.nunique():3d} UNDER {u.mean():.3f}  vs line {(y.actual-y.line).mean():+6.1f} | {by}")
