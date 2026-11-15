import { writeFileSync } from "node:fs";
const KEY = process.env.SPORTSGAMEODDS_API_KEY;
const get = async (path) => { const r = await fetch(`https://api.sportsgameodds.com/v2${path}`, { headers: { "X-Api-Key": KEY } }); return [r.status, await r.json().catch(() => ({}))]; };
const out = {};
const [s1, leagues] = await get("/leagues/");
const lax = (leagues.data ?? []).filter((l) => /lacrosse|LAX|PLL|NLL/i.test(JSON.stringify(l)));
console.log("LEAGUES", s1, (leagues.data ?? []).length, JSON.stringify(lax).slice(0, 1500));
for (const l of lax.filter((x) => /PLL|premier/i.test(JSON.stringify(x)))) {
  const [s2, ev] = await get(`/events/?leagueID=${l.leagueID}&limit=2&finalized=true`);
  const e = ev.data?.[0];
  console.log("EVENTS", l.leagueID, s2, (ev.data ?? []).length, e ? JSON.stringify({ teams: e.teams && Object.keys(e.teams), players: e.players && Object.keys(e.players).length, results: e.results && Object.keys(e.results), statsSample: e.results && JSON.stringify(e.results).slice(0, 800), odds: e.odds && Object.keys(e.odds).length }) : JSON.stringify(ev).slice(0, 400));
  out[l.leagueID] = ev;
}
writeFileSync("pll_sample.json", JSON.stringify(out));
