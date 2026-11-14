import { writeFileSync } from "node:fs";
const out = {};
for (const t of ["2019_Premier_Lacrosse_League_season", "2020_Premier_Lacrosse_League_season", "2021_Premier_Lacrosse_League_season", "2022_Premier_Lacrosse_League_season"]) {
  const r = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${t}&prop=wikitext&format=json&formatversion=2&redirects=1`, { headers: { "User-Agent": "GamblingNFL research (github.com/RJMurph10/gamblingnfl)" } });
  const j = await r.json();
  out[t] = j.parse?.wikitext ?? JSON.stringify(j).slice(0, 300);
  console.log(t, r.status, (out[t] ?? "").length);
}
writeFileSync("pll_sample.json", JSON.stringify(out));
