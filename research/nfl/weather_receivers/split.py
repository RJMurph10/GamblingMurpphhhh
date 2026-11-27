exec(open('test2.py').read().split("print('--- bad weather")[0])
out = D.roof.isin(['outdoors', 'open'])
base = (D.pos == 'WR') & (D.big >= 0.18) & (D.line >= 40)
for nm, sel in (('rain 1mm+', out & (D.precip >= 1)), ('wind 15+', out & (D.ww >= 15)), ('wind 15+, no rain', out & (D.ww >= 15) & (D.precip < 1)), ('rain, wind <15', out & (D.precip >= 1) & (D.ww < 15)), ('wind 12-15', out & D.ww.between(12, 14.99) & (D.precip < 1))):
    y = D[base & sel]; w = y.actual < y.line; u = np.where(w, 100 / 115, -1)
    print(f"WR big-play 18%+, line 40+, {nm:18s} n={len(y):3d} under {w.mean():.3f} vs line {(y.actual-y.line).mean():+6.1f} {u.sum():+.1f}u @-115 | {y.assign(w=w.values).groupby('season').w.mean().round(2).to_dict()}")
