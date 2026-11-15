import { writeFileSync } from "node:fs";
const UA = { headers: { "User-Agent": "GamblingNFL research (github.com/RJMurph10/gamblingnfl)" } };
const titles = ["Utah_Archers", "New_York_Atlas", "Boston_Cannons", "Carolina_Chaos", "Denver_Outlaws", "California_Redwoods", "Philadelphia_Waterdogs", "Maryland_Whipsnakes",
  ...[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => `${y}_Premier_Lacrosse_League_season`)];
const out = {};
for (const t of titles) {
  const j = await (await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${t}&prop=wikitext&format=json&formatversion=2&redirects=1`, UA)).json();
  const w = j.parse?.wikitext ?? ""; out[t] = w;
  const heads = [...w.matchAll(/\n(==+)\s*([^=\n]+?)\s*\1/g)].map((m) => m[2]);
  console.log("PAGE", t, w.length, "|", heads.join(" ; ").slice(0, 600));
  console.log("   tables", (w.match(/\{\|/g) ?? []).length, "rosterRows", (w.match(/\{\{\s*(Ice hockey|Lacrosse)?\s*[Rr]oster|Football squad player|\| *\d+ *\|\| *\[\[/g) ?? []).length);
}
writeFileSync("pll_sample.json", JSON.stringify(out));
