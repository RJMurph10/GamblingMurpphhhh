import { writeFileSync } from "node:fs";
const out = {};
const UA = { headers: { "User-Agent": "GamblingNFL research (github.com/RJMurph10/gamblingnfl)" } };
const grab = async (k, u) => {
  try { const r = await fetch(u, UA); const b = Buffer.from(await r.arrayBuffer());
    console.log("IMG", k, u, r.status, r.headers.get("content-type"), b.length);
    if (r.ok && /image/.test(r.headers.get("content-type") ?? "")) out[k] = { u, b64: b.toString("base64") };
  } catch (e) { console.log("IMG", k, u, "ERR", e.message); }
};
const t = await (await fetch("https://www.thesportsdb.com/api/v1/json/3/lookupteam.php?id=146833")).json();
const team = t.teams?.[0] ?? {};
console.log("TSDB", JSON.stringify({ badge: team.strBadge, logo: team.strLogo, colours: [team.strColour1, team.strColour2, team.strColour3] }));
if (team.strBadge) await grab("tsdb-badge", team.strBadge);
if (team.strLogo) await grab("tsdb-logo", team.strLogo);
const w = await (await fetch("https://en.wikipedia.org/w/api.php?action=query&titles=Maryland_Whipsnakes&prop=pageimages|revisions&rvprop=content&rvslots=main&rvsection=0&piprop=original&format=json&formatversion=2", UA)).json();
const pg = w.query?.pages?.[0];
console.log("WIKI", pg?.original?.source, (pg?.revisions?.[0]?.slots?.main?.content ?? "").match(/logo\s*=.*|image\s*=.*/g));
if (pg?.original?.source) await grab("wiki", pg.original.source);
// history of the Wikipedia infobox logo file
const fi = await (await fetch("https://en.wikipedia.org/w/api.php?action=query&titles=File:Maryland_Whipsnakes_logo.png|File:Maryland_Whipsnakes.png|File:Maryland_Whipsnakes_logo.svg&prop=imageinfo&iiprop=url|timestamp|comment&iilimit=10&format=json&formatversion=2", UA)).json();
console.log("FILES", JSON.stringify(fi.query?.pages?.map((p) => [p.title, p.missing, p.imageinfo?.map((i) => [i.timestamp, i.url, i.comment])])));
writeFileSync("pll_sample.json", JSON.stringify(out));
