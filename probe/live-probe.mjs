const j = async (u) => { try { const r = await fetch(u); return r.ok ? r.json() : { status: r.status }; } catch (e) { return { err: String(e) }; } };
const K = "https://api.elections.kalshi.com/trade-api/v2";
const at = { "pregame 01:15": "2026-11-16T01:15:00Z", "1Q 01:50": "2026-11-16T01:50:00Z", "halftime 03:00": "2026-11-16T03:00:00Z" };
const mk = [["KXNFLGAME","KXNFLGAME-26NOV15PITCIN-CIN"],["KXNFLGAME","KXNFLGAME-26NOV15PITCIN-PIT"],["KXNFLTOTAL","KXNFLTOTAL-26NOV15PITCIN-49"],["KXNFLSPREAD","KXNFLSPREAD-26NOV15PITCIN-CIN5"]];
for (const [lab, iso] of Object.entries(at)) {
  const t = Date.parse(iso) / 1000;
  const row = [];
  for (const [s, m] of mk) {
    const c = await j(`${K}/series/${s}/markets/${m}/candlesticks?start_ts=${t - 60}&end_ts=${t}&period_interval=1`);
    const x = (c.candlesticks ?? []).at(-1);
    row.push(`${m.split("-").at(-1)} bid ${x?.yes_bid?.close_dollars} ask ${x?.yes_ask?.close_dollars}`);
  }
  console.log("KAL", lab, row.join(" | "));
}
