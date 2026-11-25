"""Per-game lineup x park handedness tilt, walk-forward (park factors from earlier seasons only)."""
import pandas as pd, numpy as np
pf = pd.read_parquet('parkhand.parquet')
gm = pd.read_parquet('games.parquet')
hands = pd.read_parquet('hands.parquet')
H = {(r.season, r.pid): (r.bats, r.throws) for r in hands.itertuples()}
SLOT_PA = np.array([4.65, 4.55, 4.45, 4.35, 4.25, 4.13, 4.0, 3.9, 3.8])
K = 4000  # shrink: PA of prior evidence toward 0
def prior_factors(season):
    d = pf[(pf.season < season) & (pf.season >= season - 4)]
    g = d.assign(en=d.effect * d.n, hn=(d.hr_ratio - 1) * d.n).groupby(['park', 'eff']).agg(en=('en', 'sum'), hn=('hn', 'sum'), n=('n', 'sum'))
    g['f'] = g.en / (g.n + K); g['fh'] = g.hn / (g.n + K)
    f = g.f.unstack(); fh = g.fh.unstack()
    return f, fh
rows = []
for s in sorted(gm.season.unique()):
    if s < 2012: continue
    f, fh = prior_factors(s)
    for r in gm[gm.season == s].itertuples():
        if r.park not in f.index: continue
        fr, fl = f.loc[r.park, 'R'], f.loc[r.park, 'L']
        hr_, hl = fh.loc[r.park, 'R'], fh.loc[r.park, 'L']
        fall = 0.58 * fr + 0.42 * fl; hall = 0.58 * hr_ + 0.42 * hl
        tilt = 0.0; htilt = 0.0; nR = 0
        for side, lineup, opp_sp in ((0, r.lineup0, r.sp1), (1, r.lineup1, r.sp0)):
            pth = H.get((s, opp_sp), ('?', '?'))[1]
            for i, b in enumerate(lineup):
                bh = H.get((s, b), ('?', '?'))[0]
                eff = bh if bh in ('R', 'L') else ('L' if pth == 'R' else 'R')
                nR += eff == 'R'
                tilt += SLOT_PA[i] * ((fr if eff == 'R' else fl) - fall)
                htilt += SLOT_PA[i] * ((hr_ if eff == 'R' else hl) - hall)
        rows.append((r.game_id, s, r.park, nR, fr - fl, tilt, htilt, fall))
feat = pd.DataFrame(rows, columns=['game_id', 'season', 'park', 'nR', 'park_RminusL', 'tilt', 'htilt', 'park_all'])
feat.to_parquet('feat.parquet')
print(feat.describe().round(4).to_string())
