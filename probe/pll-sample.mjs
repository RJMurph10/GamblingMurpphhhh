import { writeFileSync } from "node:fs";
const UA = { headers: { "User-Agent": "GamblingNFL research (github.com/RJMurph10/gamblingnfl)" } };
const out = {};
for (const t of ["Premier_Lacrosse_League", "List_of_Premier_Lacrosse_League_awards"]) {
  await new Promise((r) => setTimeout(r, 3000));
  for (let a = 0; a < 5; a++) {
    const txt = await (await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${t}&prop=wikitext&format=json&formatversion=2&redirects=1`, UA)).text();
    try { out[t] = JSON.parse(txt).parse?.wikitext ?? ""; break; } catch { await new Promise((r) => setTimeout(r, 20000)); }
  }
  console.log("PAGE", t, (out[t] ?? "").length);
}
writeFileSync("pll_sample.json", JSON.stringify(out));
