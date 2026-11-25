import pandas as pd, numpy as np
from sklearn.linear_model import LogisticRegression
d=pd.read_parquet('hr.parquet'); d=d[d.p_open.notna()].copy()
imp=lambda o: np.where(o<0, -o/(-o+100), 100/(o+100)); pay=lambda o: np.where(o<0, 100/-o, o/100)
d['imp']=imp(d.p_open.values); d['u']=np.where(d.hr, pay(d.p_open.values), -1.0)
lg_hrab=0.033; lg_hr9=1.15
d['b_hrab_s']=(d.b_hr+lg_hrab*150)/(d.b_ab+150)            # shrunk toward league
d['sp_ip']=d.sp_outs/3
d['sp_hr9_s']=(d.sp_hr*9+lg_hr9*40)/(d.sp_ip+40)
d['era_s']=(d.sp_era.fillna(4.2)*d.sp_ip+4.2*40)/(d.sp_ip+40)
d['avg_s']=(d.avg.fillna(.245)*d.b_ab+.245*150)/(d.b_ab+150)
# park HR factor from the previous season's props data (HR rate at park vs league)
pk={}
for s in (2025,2026):
    p=d[d.season==s-1]; pk[s]=(p.groupby('park').hr.mean()/p.hr.mean()).to_dict()
d['park_f']=[pk.get(s,{}).get(p,1.0) for s,p in zip(d.season,d.park)]
lo=lambda p: np.log(p/(1-p))
X=lambda x: np.column_stack([lo(x.imp), np.log(x.b_hrab_s/lg_hrab), np.log(x.sp_hr9_s/lg_hr9), np.log(x.park_f), x.avg_s, x.era_s, x.is_home])
names=['market','batter HR/AB','SP HR/9','park','AVG','SP ERA','home']
for test,train in ((2025,[2024]),(2026,[2024,2025])):
    tr=d[d.season.isin(train)]; te=d[d.season==test].copy()
    if test==2025: tr=tr  # park_f is 1.0 in 2024 (no prior)
    m=LogisticRegression(C=10,max_iter=2000).fit(X(tr),tr.hr)
    m0=LogisticRegression(C=10,max_iter=2000).fit(X(tr)[:,:1],tr.hr)
    te['p']=m.predict_proba(X(te))[:,1]; te['p0']=m0.predict_proba(X(te)[:,:1])[:,1]
    ll=lambda p: -np.mean(te.hr*np.log(p)+(1-te.hr)*np.log(1-p))
    print(f'test {test}: log loss market-only {ll(te.p0):.5f}  full {ll(te.p):.5f}  coefs', dict(zip(names,np.round(m.coef_[0],2))))
    for edge in (1.0,1.1,1.2,1.3):
        x=te[te.p>=te.imp*edge]
        print(f'   bet when model >= {edge:.1f} x implied: {len(x)} bets, hit {x.hr.mean():.3f} vs implied {x.imp.mean():.3f}, ROI {x.u.mean():+.3f}')
