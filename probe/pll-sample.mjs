import { writeFileSync } from "node:fs";
const B = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll";
const C = "https://sports.core.api.espn.com/v2/sports/lacrosse/leagues/pll";
const j = async (u) => { const r = await fetch(u); return r.ok ? r.json() : { status: r.status }; };
const out = { tries: {} };
for (const q of ["", "?dates=2026", "?dates=20260705", "?dates=20260705-20260706", "?dates=20260701-20260707&limit=100", "?seasontype=2&dates=2026", "?limit=1000&dates=2026"])
  { const r = await j(`${B}/scoreboard${q}`); out.tries[q] = { status: r.status ?? 200, events: (r.events ?? []).length }; if (q === "?dates=2026") out.year = r; if (q === "?dates=20260705") out.day = r; }
out.core = await j(`${C}/seasons/2026/types/2/events?limit=200`);
out.coreSeason = await j(`${C}/seasons/2026`);
out.teams = await j(`${B}/teams`);
const ev = (out.year?.events ?? out.day?.events ?? []);
const fin = ev.find((e) => e.status?.type?.completed);
if (fin) out.summary = await j(`${B}/summary?event=${fin.id}`);
out.standings = await j(`https://site.api.espn.com/apis/v2/sports/lacrosse/pll/standings`);
console.log(JSON.stringify(out.tries), "core", out.core.count ?? out.core.status);
writeFileSync("pll_sample.json", JSON.stringify(out));
