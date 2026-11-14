import { writeFileSync } from "node:fs";
const B = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll";
const j = async (u) => { const r = await fetch(u); return r.ok ? r.json() : { status: r.status }; };
const out = {};
out.teams = await j(`${B}/teams`);
out.weeks = [];
for (const span of ["20260501-20260930", "20250501-20250930", "20240501-20240930", "20260201-20260331"])
  out.weeks.push(await j(`${B}/scoreboard?dates=${span}&limit=1000`));
const ev = out.weeks.flatMap((w) => w.events ?? []);
console.log("events", ev.length, ev.slice(0, 3).map((e) => e.name + " " + e.date));
const fin = ev.find((e) => e.status?.type?.completed); if (fin) out.summary = await j(`${B}/summary?event=${fin.id}`);
out.standings = await j(`https://site.api.espn.com/apis/v2/sports/lacrosse/pll/standings`);
writeFileSync("pll_sample.json", JSON.stringify(out));
