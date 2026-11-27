exec(open('test2.py').read().split("print('--- bad weather")[0])
for thr in (0.18, 0.22):
    sel = (D.pos == 'WR') & (D.big >= thr) & (D.line >= 40) & D.bad
    x = D[sel]; w = (x.actual < x.line)
    for price in (-110, -115, -125):
        u = np.where(w, 100 / -price, -1.0)
        by = pd.Series(u, index=x.season.values).groupby(level=0).agg(['size', 'sum']).round(1)
        print(f"big-play {thr:.0%}+, line 40+, bad weather @ {price}: {w.sum()}-{(~w).sum()}  {u.sum():+.1f}u  ROI {u.mean():+.1%} | " + ' '.join(f"{s}: {int(r['size'])} bets {r['sum']:+.1f}u" for s, r in by.iterrows()))
