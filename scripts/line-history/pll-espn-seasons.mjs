// One-off: test the exact ESPN PLL requests the site makes (limit=1000, teams list).
import { mkdir, writeFile } from "node:fs/promises";
const out = process.argv[process.argv.indexOf("--out") + 1];
await mkdir(out, { recursive: true });
const B = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll";
const urls = [
  `${B}/scoreboard?dates=2026&limit=1000`, `${B}/scoreboard?dates=2026&limit=500`, `${B}/scoreboard?dates=2026`,
  `${B}/scoreboard?dates=2024&limit=1000`, `${B}/teams`,
];
const res = [];
for (const u of urls) {
  const t0 = Date.now();
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    const txt = await r.text();
    let n = null; try { const j = JSON.parse(txt); n = j.events?.length ?? j.sports?.[0]?.leagues?.[0]?.teams?.length; } catch {}
    res.push({ u, status: r.status, ms: Date.now() - t0, bytes: txt.length, n, head: txt.slice(0, 150) });
  } catch (e) { res.push({ u, err: String(e), ms: Date.now() - t0 }); }
}
console.log(JSON.stringify(res, null, 1));
await writeFile(`${out}/pll-espn-site-test.json`, JSON.stringify(res));
