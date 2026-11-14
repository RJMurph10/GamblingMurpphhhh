import { writeFileSync } from "node:fs";
const B = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll";
const j = async (u) => { const r = await fetch(u); return r.ok ? r.json() : { status: r.status }; };
const out = {};
out.teams = await j(`${B}/teams`);
out.weeks = [];
for (const [a, b] of [["20260601", "20260607"], ["20260613", "20260619"], ["20260718", "20260724"], ["20260815", "20260821"], ["20260905", "20260911"], ["20260912", "20260920"]])
  out.weeks.push(await j(`${B}/scoreboard?dates=${a}-${b}`));
const ev = out.weeks.flatMap((w) => w.events ?? []);
console.log("events", ev.length, ev.slice(0, 3).map((e) => e.name + " " + e.date));
if (ev[0]) out.summary = await j(`${B}/summary?event=${ev[0].id}`);
out.standings = await j(`https://site.api.espn.com/apis/v2/sports/lacrosse/pll/standings`);
writeFileSync("pll_sample.json", JSON.stringify(out));
