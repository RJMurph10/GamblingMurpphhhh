import { writeFileSync } from "node:fs";
const B = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll";
const out = {};
for (let id = 127625; id <= 127645; id++) {
  const r = await fetch(`${B}/teams/${id}`);
  const t = r.ok ? (await r.json()).team : null;
  console.log(id, r.status, t?.displayName, t?.logos?.[0]?.href);
}
for (const id of [122990,122991,122992,122993,122994,122995,122996,122998,122999]) {
  const r = await fetch(`${B}/teams/${id}`);
  const t = r.ok ? (await r.json()).team : null;
  console.log(id, r.status, t?.displayName, t?.logos?.[0]?.href);
}
for (const u of ["https://a.espncdn.com/i/teamlogos/pll/500/127635.png","https://a.espncdn.com/i/teamlogos/pll/500/127633.png"]) {
  const r = await fetch(u, ); console.log(u, r.status, r.headers.get("content-type"), (await r.arrayBuffer()).byteLength);
}
writeFileSync("pll_sample.json", JSON.stringify(out));
