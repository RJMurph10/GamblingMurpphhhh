// Check ESPN's 2026 NFL week scoreboards: score vs linescores, status, odds; and the core odds / summary for a sample.
import { writeFileSync, mkdirSync } from "node:fs";
const SB = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const out = { weeks: [], bad: [] };
for (let w = 1; w <= 18; w++) {
  const r = await fetch(`${SB}?dates=2026&seasontype=2&week=${w}&limit=100`);
  const j = await r.json();
  const evs = j.events ?? [];
  let n = 0, final = 0, noLs = 0, mismatch = 0, noOdds = 0;
  for (const e of evs) {
    const c = e.competitions?.[0]; n++;
    const done = c?.status?.type?.completed === true; if (done) final++;
    for (const t of c?.competitors ?? []) {
      const ls = (t.linescores ?? []).map((x) => Number(x.value ?? 0));
      const sum = ls.reduce((a, b) => a + b, 0);
      if (done && !ls.length) noLs++;
      if (done && ls.length && sum !== Number(t.score)) mismatch++;
    }
    if (!c?.odds?.[0]?.details) noOdds++;
    const bad = done && (c.competitors ?? []).some((t) => !(t.linescores ?? []).length || (t.linescores ?? []).reduce((a, x) => a + Number(x.value ?? 0), 0) !== Number(t.score));
    if (bad || (done && !c?.odds?.[0]?.details && w <= 2))
      out.bad.push({ w, id: e.id, name: e.shortName, status: c?.status?.type?.name, scores: (c.competitors ?? []).map((t) => [t.team?.abbreviation, t.score, (t.linescores ?? []).map((x) => x.value)]), odds: c?.odds?.[0] ? { details: c.odds[0].details, ou: c.odds[0].overUnder } : null });
  }
  out.weeks.push({ w, n, final, noLs, mismatch, noOdds });
}
// sample core odds + summary pickcenter for the first bad game
const s = out.bad[0];
if (s) {
  const core = await (await fetch(`https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${s.id}/competitions/${s.id}/odds`)).json().catch(() => null);
  const sum = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${s.id}`)).json().catch(() => null);
  out.sample = {
    id: s.id,
    core: (core?.items ?? []).map((o) => ({ provider: o.provider?.name, details: o.details, ou: o.overUnder })),
    pickcenter: (sum?.pickcenter ?? []).map((p) => ({ provider: p.provider?.name, details: p.details, ou: p.overUnder })),
    header: (sum?.header?.competitions?.[0]?.competitors ?? []).map((t) => [t.team?.abbreviation, t.score, (t.linescores ?? []).map((x) => x.displayValue)]),
  };
}
mkdirSync("out", { recursive: true });
writeFileSync("out/nfl-scoreboard.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.weeks));
console.log(JSON.stringify(out.bad.slice(0, 10), null, 1));
console.log(JSON.stringify(out.sample, null, 1));
