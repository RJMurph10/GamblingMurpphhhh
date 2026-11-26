"""NBA: team's star (top-2 by points+rebounds+assists in recent games) didn't play. Bet against that team, open vs close.
First game missed (he played the team's previous game) vs a continuing absence (known well before the opener)."""
import gzip, json, numpy as np, pandas as pd
games = []
for s in ('2023-24', '2024-25', '2025-26', '2026-27'):
    for l in gzip.open(f'box-{s}.jsonl.gz'):
        g = json.loads(l)
        if str(g.get('seasonType')) != '2': continue
        h, a = eval(g['home']) if isinstance(g['home'], str) else g['home'], eval(g['away']) if isinstance(g['away'], str) else g['away']
        pl = {}
        for k, v in g['box'].items():
            m = v['s'].get('MIN')
            try: m = int(m)
            except Exception: m = 0
            st = v['s']
            val = sum(float(st.get(x, 0) or 0) for x in ('PTS',)) + 0.7 * float(st.get('REB', 0) or 0) + 0.7 * float(st.get('AST', 0) or 0) if m > 0 else 0
            pl[k] = (v['tm'], m, val)
        games.append(dict(season=s, id=g['id'], date=g['date'], h=h['abbr'], a=a['abbr'], pl=pl))
games.sort(key=lambda g: g['date'])
team_hist = {}   # team -> list of (date, {pid: (min, val)})
rows = []
for g in games:
    dt = pd.Timestamp(g['date'])
    for side, tm in (('h', g['h']), ('a', g['a'])):
        hist = team_hist.setdefault((g['season'], tm), [])
        recent = hist[-10:]
        cand = {}
        for d, ps in recent:
            for p, (mn, val) in ps.items():
                c = cand.setdefault(p, [0, 0.0, 0]); c[0] += mn > 0; c[1] += val; c[2] += mn
        stars = sorted([(c[1] / max(c[0], 1), p) for p, c in cand.items() if c[0] >= 5 and c[2] / max(c[0], 1) >= 28], reverse=True)[:2]
        played = {p for p, (t, mn, _) in g['pl'].items() if t == tm and mn > 0}
        prev_played = {p for p, (mn, _) in hist[-1][1].items() if mn > 0} if hist else set()
        gap_ok = bool(hist) and (dt - hist[-1][0]).days <= 4
        out = [(v, p, p in prev_played) for v, p in stars if p not in played]
        rows.append(dict(id=g['id'], side=side, n_hist=len(hist), gap_ok=gap_ok,
                         star_out=len(out) > 0, top_out=bool(stars) and stars[0][1] not in played,
                         first_miss=any(fm for _, _, fm in out), out_val=max([v for v, _, _ in out], default=0)))
    for side, tm in (('h', g['h']), ('a', g['a'])):
        team_hist[(g['season'], tm)].append((dt, {p: (mn, val) for p, (t, mn, val) in g['pl'].items() if t == tm}))
R = pd.DataFrame(rows)
H = R[R.side == 'h'].drop(columns='side').set_index('id').add_prefix('h_'); A = R[R.side == 'a'].drop(columns='side').set_index('id').add_prefix('a_')
L = pd.read_parquet('nba_lines.parquet').set_index('id').join(H, how='inner').join(A, how='inner').reset_index()
L = L[(L.h_n_hist >= 10) & (L.a_n_hist >= 10) & L.h_gap_ok & L.a_gap_ok & L.sp_o.notna() & L.sp_c.notna()]
L = L[(L.sp_o - L.sp_c).abs() <= 10]
print('games', len(L), L.season.value_counts().sort_index().to_dict())
pay = lambda o: np.where(np.isnan(o), 100 / 110, np.where(o < 0, 100 / -o, o / 100))
margin = L.hs - L.as_
def ats(name, sel, bet_home):
    x = L[sel]; mg = margin[sel]
    for w, sp, ph, pa_ in (('open ', 'sp_o', 'spo_o', 'spo_oa'), ('close', 'sp_c', 'spo_c', 'spo_ca')):
        cover = mg + x[sp]   # home margin + home spread
        y = cover != 0
        win = (cover > 0) if bet_home else (cover < 0)
        price = (x[ph] if bet_home else x[pa_]).values
        u = np.where(win, pay(price), -1.0)[y.values]
        by = pd.Series(u, index=x.season.values[y.values]).groupby(level=0).agg(['size', 'mean']).round(3)
        print(f"  {name:58s} @{w} n={y.sum():4d} cover {win[y].mean():.3f} ROI {u.mean():+.3f} | " + ' '.join(f"{i}:{int(r['size'])} {r['mean']:+.3f}" for i, r in by.iterrows()))
    mv = (x.sp_c - x.sp_o).mean()
    print(f"     avg home spread move open->close {mv:+.2f}; home margin vs close {(mg + x.sp_c).mean():+.2f}, vs open {(mg + x.sp_o).mean():+.2f}")
T = pd.Series(True, index=L.index)
for kind, fh, fa in (('first game missed', L.h_first_miss, L.a_first_miss), ('continuing absence', ~L.h_first_miss, ~L.a_first_miss)):
    ats(f'home star out [{kind}] -> bet road', L.h_star_out & fh & ~L.a_star_out, False)
    ats(f'road star out [{kind}] -> bet home', L.a_star_out & fa & ~L.h_star_out, True)
    ats(f'home BEST player out [{kind}] -> bet road', L.h_top_out & fh & ~L.a_star_out, False)
    ats(f'road BEST player out [{kind}] -> bet home', L.a_top_out & fa & ~L.h_star_out, True)
