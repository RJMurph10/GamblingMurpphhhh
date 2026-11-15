import { writeFileSync } from "node:fs";
const UA = { headers: { "User-Agent": "GamblingNFL research (github.com/RJMurph10/gamblingnfl)" } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pages = ["Utah_Archers", "Atlas_Lacrosse_Club", "Boston_Cannons", "Cannons_Lacrosse_Club", "Carolina_Chaos", "Chrome_Lacrosse_Club",
  "Denver_Outlaws", "Redwoods_Lacrosse_Club", "Philadelphia_Waterdogs", "Maryland_Whipsnakes"];
// end of each season (2020's Championship Series ended in August)
const ends = { "2020b": "2020-12-31", "2020c": "2020-07-31", "2022b": "2022-12-31", "2023b": "2023-04-01", "2024a": "2024-07-15", "2024b": "2024-12-31", "2025a": "2025-03-15" };
const out = {};
for (const p of pages) {
  for (const [y, d] of Object.entries(ends)) {
    await sleep(3000);
    try {
      let j;
      for (let a = 0; a < 6; a++) {
        const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${p}&prop=revisions&rvprop=ids|timestamp|content&rvslots=main&rvlimit=1&rvdir=older&rvstart=${d}T00:00:00Z&format=json&formatversion=2&redirects=1`, UA);
        const txt = await r.text();
        try { j = JSON.parse(txt); break; } catch { console.log("WAIT", p, y, a); await sleep(20000 * (a + 1)); }
      }
      const pg = j.query?.pages?.[0]; const rev = pg?.revisions?.[0];
      const w = rev?.slots?.main?.content ?? "";
      const i = w.search(/\n==+\s*(Current )?[Rr]oster\s*==+/);
      const sec = i < 0 ? "" : w.slice(i, i + 40000).replace(/\n==[^=][\s\S]*$/, (m) => m.slice(0, m.search(/\n==[^=]/) + 1 || m.length));
      const k = `${p}|${y}`;
      out[k] = { title: pg?.title, revid: rev?.revid, ts: rev?.timestamp, roster: i < 0 ? "" : w.slice(i, (w.slice(i + 10).search(/\n==[^=]/) + i + 10) || undefined) };
      console.log("REV", k, pg?.title, rev?.timestamp, "rosterLen", out[k].roster.length, "header", (out[k].roster.match(/'''(\d{4}[^']*)'''/) ?? [])[1]);
    } catch (e) { console.log("ERR", p, y, e.message); }
  }
}
writeFileSync("pll_sample.json", JSON.stringify(out));
