const r = await (await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries")).json();
const t = (r.injuries ?? []).find((x) => /Ravens/.test(x.displayName));
console.log("DBG team keys", Object.keys(t ?? {}), t?.displayName);
for (const i of t?.injuries ?? []) console.log("DBG", i.athlete?.displayName, "|", i.status, "|", i.athlete?.position?.abbreviation, "|", JSON.stringify(i.athlete?.team ?? null).slice(0, 80));
const d = await (await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/33/depthcharts")).json();
for (const c of d.depthchart ?? []) for (const [k, p] of Object.entries(c.positions ?? {})) if (k === "qb") console.log("DBG depth", p.athletes.map((a) => a.displayName).join(", "));
