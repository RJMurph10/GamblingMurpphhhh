import { writeFileSync } from "node:fs";
const B = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll";
const out = {};
for (const y of [2022, 2025, 2026]) {
  const sb = await (await fetch(`${B}/scoreboard?dates=${y}&limit=1000`)).json();
  const done = (sb.events ?? []).filter((e) => e.status?.type?.completed);
  for (const e of [done[3], done.at(-2)].filter(Boolean)) {
    const r = await fetch(`${B}/summary?event=${e.id}`); const s = await r.json();
    out[e.id] = s;
    const bp = s.boxscore?.players ?? [];
    console.log("SUM", y, e.id, e.name, r.status, "keys", Object.keys(s).join(","));
    console.log("  box.players", bp.length, bp.map((t) => `${t.team?.abbreviation}: ${(t.statistics ?? []).map((g) => `${g.name ?? g.type}[${(g.athletes ?? []).length}] labels=${(g.labels ?? []).join("/")}`).join(" | ")}`).join(" || "));
    console.log("  rosters", JSON.stringify(s.rosters ?? null).slice(0, 300));
    const a = bp[0]?.statistics?.[0]?.athletes?.[0]; console.log("  firstAthlete", JSON.stringify(a ?? null).slice(0, 500));
    for (const p of ["leaders", "gameInfo", "plays", "keyEvents"]) if (s[p]) console.log("  ", p, JSON.stringify(s[p]).slice(0, 300));
  }
}
const ro = await fetch(`https://sports.core.api.espn.com/v2/sports/lacrosse/leagues/pll/seasons/2025/teams/127631/athletes?limit=100`);
console.log("CORE athletes", ro.status, (await ro.text()).slice(0, 400));
const tr = await fetch(`${B}/teams/127631/roster`); console.log("SITE roster", tr.status, (await tr.text()).slice(0, 400));
writeFileSync("pll_sample.json", JSON.stringify(out));
