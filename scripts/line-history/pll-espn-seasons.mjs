// One-off: ESPN PLL scoreboards for past seasons, compact, for checking the owner's box-score sheets.
// Writes <out>/pll-espn-<year>.json in the format of src/test/fixtures/pll-2025-espn.json.
import { mkdir, writeFile } from "node:fs/promises";
const out = process.argv[process.argv.indexOf("--out") + 1];
await mkdir(out, { recursive: true });
for (const y of [2019, 2020, 2021, 2022, 2023, 2024]) {
  const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll/scoreboard?dates=${y}&limit=500`);
  const d = await r.json();
  const games = (d.events ?? []).map((e) => ({
    id: e.id,
    date: e.date,
    status: e.status?.type?.name,
    sides: (e.competitions?.[0]?.competitors ?? []).map((c) => [c.homeAway, c.team?.shortDisplayName ?? c.team?.name, c.team?.abbreviation, c.score]),
  }));
  console.log(y, r.status, games.length, "games");
  await writeFile(`${out}/pll-espn-${y}.json`, JSON.stringify(games));
}
