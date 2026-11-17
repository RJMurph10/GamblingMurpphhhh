const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll/scoreboard?dates=2025&limit=1000");
const j = await r.json();
const out = (j.events ?? []).map((ev) => { const c = ev.competitions[0]; return { id: ev.id, date: ev.date, status: ev.status?.type?.name, sides: c.competitors.map((x) => [x.homeAway, x.team.shortDisplayName, x.team.abbreviation, x.score]) }; });
console.log("ESPNJSON " + JSON.stringify(out));
