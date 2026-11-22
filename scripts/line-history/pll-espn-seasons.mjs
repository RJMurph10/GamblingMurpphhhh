// One-off: the ESPN PLL feeds in full, to see the international (country) games and their teams.
import { mkdir, writeFile } from "node:fs/promises";
const out = process.argv[process.argv.indexOf("--out") + 1];
await mkdir(out, { recursive: true });
const B = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll";
const urls = {
  "pll-espn-2026": `${B}/scoreboard?dates=2026&limit=1000`,
  "pll-espn-2027": `${B}/scoreboard?dates=2027&limit=1000`,
  "pll-espn-now": `${B}/scoreboard`,
  "pll-espn-teams": `${B}/teams`,
};
for (const [name, u] of Object.entries(urls)) {
  try {
    const r = await fetch(u, { headers: { "User-Agent": "GamblingNFL/1.0" }, signal: AbortSignal.timeout(20000) });
    await writeFile(`${out}/${name}.json`, await r.text());
  } catch (e) { await writeFile(`${out}/${name}.json`, JSON.stringify({ err: String(e) })); }
}
