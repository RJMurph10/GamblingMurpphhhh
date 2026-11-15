import { writeFileSync } from "node:fs";
const UA = { headers: { "User-Agent": "GamblingNFL research (github.com/RJMurph10/gamblingnfl)" } };
const out = {};
for (const t of ["Adelphi_Panthers", "York_Spartans", "York_College_of_Pennsylvania"]) {
  await new Promise((r) => setTimeout(r, 1500));
  const j = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${t}&prop=pageimages|images&piprop=original&imlimit=40&format=json&formatversion=2&redirects=1`, UA)).json();
  const pg = j.query?.pages?.[0];
  console.log("PAGE", t, pg?.title, pg?.original?.source, JSON.stringify((pg?.images ?? []).map((i) => i.title).filter((x) => /logo|wordmark|athletic|spartan|panther/i.test(x))));
  const src = pg?.original?.source;
  if (src) { const r = await fetch(src, UA); const b = Buffer.from(await r.arrayBuffer()); console.log("IMG", t, r.status, r.headers.get("content-type"), b.length); if (r.ok) out[t] = { u: src, b64: b.toString("base64") }; }
}
writeFileSync("pll_sample.json", JSON.stringify(out));
