import { writeFileSync } from "node:fs";
const out = {};
for (const [k, u] of [
  ["lax", "https://site.api.espn.com/apis/site/v2/sports/lacrosse/mens-college-lacrosse/teams?limit=1000"],
  ["mbb", "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=1000"],
  ["cfb", "https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=2000"],
]) {
  const r = await fetch(u); const j = r.ok ? await r.json() : {};
  const teams = (j.sports?.[0]?.leagues?.[0]?.teams ?? []).map(({ team: t }) => ({ id: t.id, loc: t.location, short: t.shortDisplayName, name: t.displayName, abbr: t.abbreviation, logo: t.logos?.[0]?.href }));
  out[k] = teams; console.log("LIST", k, r.status, teams.length);
}
writeFileSync("pll_sample.json", JSON.stringify(out));
