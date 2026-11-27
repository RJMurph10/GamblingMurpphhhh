"""Receiving-yards props 2024-2026 with pre-game depth of target (aDOT) and game weather."""
import gzip, json, ast, numpy as np, pandas as pd
P = pd.read_csv('players.csv.gz', low_memory=False)[['gsis_id', 'espn_id', 'display_name', 'position']].dropna(subset=['espn_id'])
P['espn_id'] = P.espn_id.astype(float).astype(int).astype(str)
esp2gsis = dict(zip(P.espn_id, P.gsis_id)); pos = dict(zip(P.gsis_id, P.position))
W = pd.concat([pd.read_csv(f'w_{y}.csv.gz', low_memory=False) for y in (2023, 2024, 2025, 2026)])
W = W[W.season_type == 'REG'][['player_id', 'season', 'week', 'team', 'targets', 'receiving_air_yards', 'receiving_yards', 'receptions']].fillna(0)
W = W.sort_values(['player_id', 'season', 'week'])
# pre-game aDOT: this season's earlier weeks + last season, weighted; targets per game earlier this season
rows = {}
for pid, d in W.groupby('player_id'):
    prev = {}
    for s, ds in d.groupby('season'):
        ly = prev.get(s - 1, (0.0, 0.0, 0))
        cum_t = cum_a = 0.0; g = 0
        for r in ds.itertuples():
            t = cum_t + 0.5 * ly[0]; a = cum_a + 0.5 * ly[1]
            rows[(pid, s, r.week)] = (a / t if t >= 15 else np.nan, cum_t / g if g else np.nan, t)
            cum_t += r.targets; cum_a += r.receiving_air_yards; g += 1
        prev[s] = (cum_t, cum_a, g)
G = pd.read_csv('/tmp/games.csv', low_memory=False)
G = G[(G.game_type == 'REG') & G.season.between(2024, 2026)]
gmap = {str(int(e)): r for e, r in zip(G.espn, G.itertuples()) if pd.notna(e)}
out = []
for season in (2024, 2025, 2026):
    for l in gzip.open(f'props-{season}.jsonl.gz'):
        g = json.loads(l)
        if str(g.get('seasonType')) != '2' or g['id'] not in gmap: continue
        gr = gmap[g['id']]
        seen = set()
        for b in g['books'].values():
            for r in b['rows']:
                if r['t'] != 'Total Receiving Yards (incl. overtime)' or r['a'] in seen: continue
                op = r.get('op') or [None, None, None]
                if op[0] is None: continue
                gs = esp2gsis.get(r['a'])
                if not gs: continue
                key = (gs, gr.season, gr.week)
                if key not in rows: continue
                adot, tpg, tsamp = rows[key]
                act = W[(W.player_id == gs) & (W.season == gr.season) & (W.week == gr.week)]
                if act.empty: continue
                seen.add(r['a'])
                out.append(dict(season=season, week=gr.week, game_id=gr.game_id, espn=g['id'], book=b['name'], pid=gs, pos=pos.get(gs),
                                line=op[0], over=op[1], under=op[2], actual=float(act.receiving_yards.iloc[0]), targets=float(act.targets.iloc[0]),
                                adot=adot, tpg=tpg, roof=gr.roof, wind=gr.wind, temp=gr.temp))
D = pd.DataFrame(out)
D.to_parquet('rec.parquet')
print(D.groupby('season').agg(n=('line', 'size'), books=('book', lambda s: s.unique().tolist()), priced=('under', lambda s: s.notna().mean())).to_string())
print(D.adot.describe().round(1).to_dict())
