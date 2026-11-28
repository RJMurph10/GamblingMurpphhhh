"""Match Kalshi and ESPN games by their score sequences; for each score both saw change, ESPN time - Kalshi time."""
import json, collections, statistics as st
L = [json.loads(l) for l in open("probe/log.jsonl")]
K = collections.defaultdict(dict); E = collections.defaultdict(dict); prov = {}; title = {}; ename = {}; elg = {}
for r in L:
    if r["src"] == "kalshi":
        d = r["d"]; s = (d.get("away_points"), d.get("home_points"))
        if None in s: continue
        K[r["id"]].setdefault(s, r["t"]); prov[r["id"]] = d.get("provider"); title[r["id"]] = r["title"]
    else:
        try: s = (int(r["sc"]["away"][1]), int(r["sc"]["home"][1]))
        except Exception: continue
        E[r["id"]].setdefault(s, r["t"]); ename[r["id"]] = r["name"]; elg[r["id"]] = r["lg"]
pairs = []
for k, ks in K.items():
    best = None
    for e, es in E.items():
        ov = len((set(ks) & set(es)) - {(0, 0)})
        if ov >= 4 and (best is None or ov > best[1]): best = (e, ov)
    if best: pairs.append((k, best[0]))
print("kalshi games with changes", len(K), "| espn live games", len(E), "| matched", len(pairs))
by = collections.defaultdict(list)
for k, e in pairs:
    ks, es = K[k], E[e]; k0, e0 = min(ks.values()), min(es.values())
    d = [es[s] - ks[s] for s in set(ks) & set(es) if ks[s] > k0 + 1 and es[s] > e0 + 1]
    if len(d) < 3: continue
    by[(elg[e], prov[k])] += d
    print(f"{title[k][:34]:34s} {elg[e]:5s} {str(prov[k]):12s} n={len(d):3d} median ESPN minus Kalshi {st.median(d):+6.1f}s  Kalshi first {sum(x > 1.5 for x in d)}/{len(d)}  ESPN first {sum(x < -1.5 for x in d)}/{len(d)}")
def summ(lbl, d):
    q = st.quantiles(d, n=4) if len(d) > 3 else [0, 0, 0]
    print(f"{lbl:28s} n={len(d):4d} median {st.median(d):+6.1f}s  p25 {q[0]:+6.1f}  p75 {q[2]:+6.1f}  Kalshi first {100*sum(x>1.5 for x in d)/len(d):3.0f}%  ESPN first {100*sum(x<-1.5 for x in d)/len(d):3.0f}%")
print("--- by league / Kalshi provider")
for g, d in sorted(by.items()): summ(f"{g[0]} {g[1]}", d)
summ("ALL", [x for v in by.values() for x in v])
