import { writeFileSync } from "node:fs";
const B = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll";
const j = async (u) => { const r = await fetch(u); return r.ok ? r.json() : { status: r.status }; };
const out = { years: {} };
for (const y of [2019, 2020, 2021, 2022, 2023, 2024, 2025]) {
  const sb = await j(`${B}/scoreboard?dates=${y}&limit=1000`);
  const ev = sb.events ?? [];
  const fin = ev.find((e) => e.status?.type?.completed);
  let box = null;
  if (fin) {
    const s = await j(`${B}/summary?event=${fin.id}`);
    box = { players: (s.boxscore?.players ?? []).length, teams: (s.boxscore?.teams ?? []).map((t) => (t.statistics ?? []).length), keys: Object.keys(s) };
  }
  out.years[y] = { status: sb.status ?? 200, events: ev.length, final: ev.filter((e) => e.status?.type?.completed).length, first: ev[0]?.date, last: ev[ev.length - 1]?.date, sample: ev[0]?.name, box };
  if (y === 2019) out.sb2019 = sb;
}
// rosters / athletes
out.roster = await j(`${B}/teams/127637/roster`);
out.athletes = await j(`https://sports.core.api.espn.com/v2/sports/lacrosse/leagues/pll/athletes?limit=5`);
console.log(JSON.stringify(out.years, null, 1));
console.log("roster", JSON.stringify(out.roster).slice(0, 300));
console.log("athletes", JSON.stringify(out.athletes).slice(0, 300));
writeFileSync("pll_sample.json", JSON.stringify(out));
