// ESPN NBA summaries -> officials + team fouls / free-throw attempts per game.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const ids = readFileSync("probe/nba_ids.txt", "utf8").trim().split("\n");
const out = {};
let i = 0;
async function one(id) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${id}`);
      if (!r.ok) { await new Promise((s) => setTimeout(s, 1000)); continue; }
      const j = await r.json();
      const off = (j.gameInfo?.officials ?? []).map((o) => [o.displayName ?? o.fullName, o.position?.name ?? o.order ?? null]);
      const teams = (j.boxscore?.teams ?? []).map((t) => ({
        abbr: t.team?.abbreviation,
        stats: Object.fromEntries((t.statistics ?? []).map((s) => [s.name ?? s.label, s.displayValue])),
      }));
      return { off, teams, date: j.header?.competitions?.[0]?.date };
    } catch { await new Promise((s) => setTimeout(s, 1000)); }
  }
  return null;
}
const N = 8;
for (let k = 0; k < ids.length; k += N) {
  const batch = ids.slice(k, k + N);
  const res = await Promise.all(batch.map(one));
  batch.forEach((id, j) => { if (res[j]) out[id] = res[j]; });
  if ((k / N) % 50 === 0) console.log(k, Object.keys(out).length);
}
mkdirSync("out", { recursive: true });
writeFileSync("out/nba-officials.json", JSON.stringify(out));
console.log("done", Object.keys(out).length, "of", ids.length);
