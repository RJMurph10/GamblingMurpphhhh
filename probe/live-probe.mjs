// Upcoming-week starting QB check: nflverse projected starter vs ESPN depth chart QB1 and ESPN injury status
const j = async (u) => { try { const r = await fetch(u); return r.ok ? (u.endsWith('.csv') ? r.text() : r.json()) : null; } catch { return null; } };
const csv = await j("https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv");
const split = (l) => { const o = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(cur); cur = ""; } else cur += ch; } o.push(cur); return o; };
const lines = csv.split("\n").filter(Boolean); const h = split(lines[0]);
const c = (n) => h.indexOf(n);
const FIX = { LA: "LAR", WAS: "WSH" };
const rows = lines.slice(1).map(split).filter((f) => f[c("season")] === "2026" && f[c("home_score")] === "" && Number(f[c("week")]) <= 11);
console.log("QB rows", rows.length);
const teams = await j("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
const ids = Object.fromEntries((teams.sports[0].leagues[0].teams).map((t) => [t.team.abbreviation, t.team.id]));
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");
for (const f of rows) {
  for (const side of ["away", "home"]) {
    const team = FIX[f[c(`${side}_team`)]] ?? f[c(`${side}_team`)];
    const proj = f[c(`${side}_qb_name`)];
    const id = ids[team];
    const dc = await j(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/depthcharts`);
    let qb1 = null;
    for (const d of dc?.depthchart ?? []) for (const [k, pos] of Object.entries(d.positions ?? {})) if (k === "qb" && !qb1) qb1 = pos.athletes?.[0]?.displayName;
    const inj = await j(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/injuries`);
    const injured = new Map();
    for (const x of inj?.injuries ?? []) injured.set(norm(x.athlete?.displayName), x.status);
    const projStatus = injured.get(norm(proj)) ?? "active";
    const flag = (qb1 && norm(qb1) !== norm(proj)) || projStatus !== "active" ? "  <<< CHECK" : "";
    console.log(`QB wk${f[c("week")]} ${f[c("gameday")]} ${team.padEnd(4)} nflverse: ${proj.padEnd(18)} ESPN depth QB1: ${String(qb1).padEnd(18)} injury: ${projStatus}${flag}`);
  }
}
