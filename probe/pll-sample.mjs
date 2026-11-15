import { writeFileSync } from "node:fs";
// free endpoints only (sports list and events cost 0 credits); no odds calls
const out = {};
for (const [name, key] of [["free", process.env.ODDS_API_KEY], ["paid", process.env.ODDS_API_KEY_PAID]]) {
  if (!key) { console.log("KEY", name, "not set"); continue; }
  const r = await fetch(`https://api.the-odds-api.com/v4/sports/?all=true&apiKey=${key}`);
  const sports = r.ok ? await r.json() : [];
  console.log("KEY", name, r.status, "remaining", r.headers.get("x-requests-remaining"), "used", r.headers.get("x-requests-used"));
  console.log("LAX", name, JSON.stringify(sports.filter((s) => /lacrosse/.test(s.key))));
  const e = await fetch(`https://api.the-odds-api.com/v4/sports/lacrosse_pll/events?apiKey=${key}`);
  const ev = e.ok ? await e.json() : await e.text();
  console.log("EVENTS", name, e.status, JSON.stringify(ev).slice(0, 600));
}
writeFileSync("pll_sample.json", JSON.stringify(out));
