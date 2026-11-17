const out = [];
const d0 = new Date("2025-01-15T00:00:00Z"), d1 = new Date("2025-10-01T00:00:00Z");
const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
for (let d = new Date(d0); d < d1; d = new Date(d.getTime() + 7 * 864e5)) {
  const e = new Date(d.getTime() + 6 * 864e5);
  const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll/scoreboard?dates=${fmt(d)}-${fmt(e)}&limit=100`);
  if (!r.ok) continue;
  for (const ev of (await r.json()).events ?? []) {
    const c = ev.competitions[0];
    out.push({ id: ev.id, date: ev.date, status: ev.status?.type?.name, sides: c.competitors.map((x) => [x.homeAway, x.team.shortDisplayName, x.team.abbreviation, x.score]) });
  }
}
const uniq = [...new Map(out.map((e) => [e.id, e])).values()];
console.log("ESPNJSON " + JSON.stringify(uniq));
