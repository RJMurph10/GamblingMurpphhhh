import { writeFileSync } from "node:fs";
const out = {};
for (const q of ["adelphi", "york college", "york pennsylvania", "hobart", "wesleyan"]) {
  const r = await fetch(`https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(q)}&type=team&limit=20`);
  const j = r.ok ? await r.json() : {};
  const items = (j.items ?? []).map((i) => `${i.id}|${i.displayName}|${i.league ?? i.defaultLeagueSlug ?? ""}|${i.logo?.[0]?.href ?? i.image?.default ?? ""}`);
  console.log("SEARCH", q, r.status, JSON.stringify(items).slice(0, 1500));
}
for (const id of ["174", "336", "2341"]) { const r = await fetch(`https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`); console.log("LOGO", id, r.status, (await r.arrayBuffer()).byteLength); }
writeFileSync("pll_sample.json", JSON.stringify(out));
