exec(open('test2.py').read().split("print('--- bad weather")[0])
for thr in (0.16, 0.18, 0.20, 0.22, 0.25):
    for ln in (35, 40, 45):
        b = (D.pos == 'WR') & (D.big >= thr) & (D.line >= ln)
        x, y = D[b & D.bad], D[b & ~D.bad]
        ub = (x.actual < x.line); ug = (y.actual < y.line)
        bys = x.assign(w=ub.values).groupby('season').w.mean().round(2).to_dict()
        print(f"big-play {thr:.2f} line {ln}+: bad {ub.mean():.3f} (n={len(x)}, games {x.game_id.nunique()}) {bys} | normal {ug.mean():.3f} (n={len(y)})")
