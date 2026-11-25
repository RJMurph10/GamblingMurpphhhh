// Download ESPN's standard (500) and dark-background (500-dark) logos for every FBS team.
import { mkdirSync, writeFileSync } from "node:fs";
const out = process.argv[2];
mkdirSync(`${out}/std`, { recursive: true });
mkdirSync(`${out}/dark`, { recursive: true });
const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?groups=80&limit=2000");
const j = await r.json();
const teams = j.sports[0].leagues[0].teams.map(({ team }) => ({
  id: team.id, name: team.displayName,
  logos: (team.logos ?? []).map((l) => ({ href: l.href, rel: l.rel })),
}));
const rows = [];
for (const t of teams) {
  const row = { ...t };
  for (const [kind, dir] of [["500", "std"], ["500-dark", "dark"]]) {
    const res = await fetch(`https://a.espncdn.com/i/teamlogos/ncaa/${kind}/${t.id}.png`);
    row[dir] = res.status;
    if (res.ok) writeFileSync(`${out}/${dir}/${t.id}.png`, Buffer.from(await res.arrayBuffer()));
  }
  rows.push(row);
}
writeFileSync(`${out}/teams.json`, JSON.stringify(rows, null, 1));
console.log(rows.length, "teams;", rows.filter((x) => x.dark !== 200).length, "without a dark logo");
