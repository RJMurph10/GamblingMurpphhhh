// One-off: do finished SportsGameOdds events still carry alternate spreads / totals? (3 events)
import { mkdir, writeFile } from "node:fs/promises";
const out = process.argv[2];
await mkdir(out, { recursive: true });
const KEY = process.env.SPORTSGAMEODDS_API_KEY;
const get = async (p) => {
  const r = await fetch(`https://api.sportsgameodds.com/v2${p}`, { headers: { "X-Api-Key": KEY } });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const res = {};
res.usage = await get("/account/usage");
for (const [name, q] of Object.entries({
  nflPast: { leagueID: "NFL", ended: "true", startsAfter: "2026-11-15T00:00:00Z", startsBefore: "2026-11-16T00:00:00Z", limit: "1", includeAltLines: "true" },
  cfbPast: { leagueID: "NCAAF", ended: "true", startsAfter: "2026-11-21T15:00:00Z", startsBefore: "2026-11-22T06:00:00Z", limit: "1", includeAltLines: "true" },
  nflOld: { leagueID: "NFL", ended: "true", startsAfter: "2026-09-13T00:00:00Z", startsBefore: "2026-09-14T06:00:00Z", limit: "1", includeAltLines: "true" },
})) res[name] = await get(`/events/?${new URLSearchParams(q)}`);
await writeFile(`${out}/sgo-alt-probe.json`, JSON.stringify(res));
