"""Calibrate the NFL player-prop ranges (src/data/nfl/prop-range-calibration.json).

Input: /tmp/propbt.json from src/test/nfl-prop-range-backtest.test.ts (walk-forward replay of the
site's projections on nflverse weekly stats). For each stat, projections are split into size bins
(quantiles of the 2024-25 projections), and each bin gets the narrowest range holding TARGET of
results: as multiples of the projection (yards, completions, attempts, kicking points), or as whole
numbers (touchdowns and small counts). Fitted on 2024-25, checked on 2026.
Usage: python3 research/props/nfl_prop_range_calibrate.py 0.70
"""
import json, math, collections, sys
TARGET=float(sys.argv[1]) if len(sys.argv)>1 else 0.70
p=json.load(open('/tmp/propbt.json')); KIND=json.load(open('/tmp/kind.json'))
INT_KEYS={k for k,v in KIND.items() if v in('touchdowns','count') and k not in('pass_cmp','pass_att','kick_pts')}
fit=[x for x in p if x['season'] in(2024,2025)]; test=[x for x in p if x['season']==2026]
def qbins(vals,n):
  s=sorted(vals); return [s[int(len(s)*i/n)] for i in range(1,n)]
def shortest(vals,cov):
  s=sorted(vals); k=max(1,math.ceil(cov*len(s)))-1
  best=min(range(len(s)-k), key=lambda i:(s[i+k]-s[i], -i))
  return s[best], s[best+k]
cal={}
for key in KIND:
  pts=[x for x in fit if x['key']==key]
  if len(pts)<200: continue
  nb=8 if len(pts)>4000 else 5 if len(pts)>1500 else 3
  edges=qbins([x['projected'] for x in pts],nb)
  bins=[]; lo_e=-1
  for i in range(nb):
    hi_e=edges[i] if i<nb-1 else float('inf')
    b=[x for x in pts if lo_e<x['projected']<=hi_e] if i>0 else [x for x in pts if x['projected']<=hi_e]
    lo_e=hi_e
    if not b: continue
    if key in INT_KEYS:
      L,U=shortest([x['actual'] for x in b],TARGET); bins.append({'upTo':hi_e,'lo':int(L),'hi':int(U)})
    else:
      L,U=shortest([x['actual']/x['projected'] for x in b],TARGET); bins.append({'upTo':hi_e,'lo':round(L,3),'hi':round(U,3)})
  cal[key]={'type':'int' if key in INT_KEYS else 'ratio','bins':bins}
def rng(key,proj):
  c=cal[key]; b=next(b for b in c['bins'] if proj<=b['upTo'])
  if c['type']=='int': return b['lo'],b['hi']
  lo,hi=proj*b['lo'],proj*b['hi']
  if KIND[key]=='count': return math.floor(lo),math.ceil(hi)
  return round(lo),round(hi)
def ev(data):
  by=collections.defaultdict(lambda:[0,0,0.0])
  for x in data:
    if x['key'] not in cal: continue
    lo,hi=rng(x['key'],x['projected']); i=lo<=x['actual']<=hi
    for k in (x['key'],'ALL'): by[k][0]+=i; by[k][1]+=1; by[k][2]+=hi-lo
  return by
bf=ev(fit); bt=ev(test)
print('target',TARGET,'fit ALL %.1f%%'%(100*bf['ALL'][0]/bf['ALL'][1]),'| 2026 ALL %.1f%%'%(100*bt['ALL'][0]/bt['ALL'][1]))
for k in sorted(bt):
  if k=='ALL': continue
  print(f"  {k:14s} 2026 {100*bt[k][0]/bt[k][1]:5.1f}%  avg width {bt[k][2]/bt[k][1]:6.1f}  (n={bt[k][1]})")
json.dump({'target':TARGET,'markets':cal},open('/tmp/cal.json','w'))
