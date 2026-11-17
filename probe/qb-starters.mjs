#!/usr/bin/env node
/**
 * Starting-QB check for the next week of NFL games. nflverse projects each upcoming game's starter, but it
 * lags trades and injuries (Nov 2026: Ravens still Tyler Huntley after he went on IR and Jacoby Brissett
 * arrived; Cardinals still Gardner Minshew after his UCL tear). For each team in a game within --days:
 *   - nflverse's projected QB is replaced when ESPN's injury report has him Out / Doubtful / on IR /
 *     suspended, he's no longer on the team's ESPN depth chart (traded or released), or the depth chart
 *     has him 3rd or lower (Huntley, Nov 2026: 5th behind Brissett and missing from the injury report);
 *   - the replacement is the first QB on the team's ESPN depth chart who isn't ruled out.
 * A healthy projected starter 2nd on the depth chart is kept (depth charts lag too: Caleb Williams was
 * listed behind his backup after returning); those are listed under "disagree" to check by hand.
 * The site applies the corrections to upcoming games (hand-set ones in src/data/nfl/qb-overrides.ts win).
 *
 *   node scripts/nfl/qb-starters.mjs --season 2026 --out site-repo [--days 8]
 *   → <out>/nfl/qb-starters-<season>.json
 *   { updatedAt, games: { "<espnId>": { home?|away?: { qbId, name, was, reason } } },
 *     disagree: [{ espnId, team, nflverse, espnQb1 }] }
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const SEASON = Number(opt("--season", new Date().getUTCFullYear()));
const OUT = opt("--out", "out");
const DAYS = Number(opt("--days", "8"));
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const GAMES_CSV = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";
const PLAYERS_CSV =
  "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv";
const TEAM = { LA: "LAR", WAS: "WSH" }; // nflverse → ESPN abbreviations
const RULED_OUT = /out|injured reserve|doubtful|suspen|physically unable|non-football/i;

async function get(url, json = true) {
  for (let i = 0; i < 3; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) return json ? await res.json() : await res.text();
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
}

/** A CSV line split on commas outside quotes. */
function split(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
function csvRows(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = split(lines[0]);
  return lines.slice(1).map((l) => {
    const f = split(l);
    return Object.fromEntries(head.map((h, i) => [h, f[i] ?? ""]));
  });
}
export const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z]/g, "");

async function main() {
  const [gamesCsv, playersCsv, teamsJson, injJson] = await Promise.all([
    get(GAMES_CSV, false),
    get(PLAYERS_CSV, false),
    get(`${ESPN}/teams`),
    get(`${ESPN}/injuries`),
  ]);
  if (!gamesCsv || !teamsJson) throw new Error("nflverse games or ESPN teams unavailable");
  const now = Date.now();
  const games = csvRows(gamesCsv).filter(
    (g) =>
      Number(g.season) === SEASON &&
      g.home_score === "" &&
      g.espn &&
      Date.parse(`${g.gameday}T23:59:00Z`) >= now - 86_400_000 &&
      Date.parse(`${g.gameday}T00:00:00Z`) <= now + DAYS * 86_400_000,
  );
  // ESPN athlete id → nflverse GSIS id
  const gsisByEspn = new Map();
  for (const p of playersCsv ? csvRows(playersCsv) : [])
    if (p.espn_id && p.gsis_id) gsisByEspn.set(p.espn_id, p.gsis_id);
  const teamId = Object.fromEntries(
    (teamsJson.sports?.[0]?.leagues?.[0]?.teams ?? []).map((t) => [t.team.abbreviation, t.team.id]),
  );
  // injury status by team abbreviation and normalized name
  const status = new Map();
  for (const t of injJson?.injuries ?? []) {
    for (const inj of t.injuries ?? []) {
      const abbr = inj.athlete?.team?.abbreviation ?? t.displayName;
      status.set(`${abbr}|${norm(inj.athlete?.displayName)}`, inj.status ?? "");
      status.set(`*|${norm(inj.athlete?.displayName)}`, inj.status ?? "");
    }
  }
  const depth = new Map(); // ESPN abbr → [{ espnId, name }]
  const qbsOf = async (abbr) => {
    if (depth.has(abbr)) return depth.get(abbr);
    const dc = await get(`${ESPN}/teams/${teamId[abbr]}/depthcharts`);
    const list = [];
    for (const chart of dc?.depthchart ?? [])
      for (const [k, pos] of Object.entries(chart.positions ?? {}))
        if (k === "qb")
          for (const a of pos.athletes ?? [])
            list.push({ espnId: String(a.id), name: a.displayName });
    depth.set(abbr, list);
    return list;
  };
  const out = { updatedAt: new Date().toISOString(), games: {}, disagree: [] };
  for (const g of games) {
    for (const side of ["home", "away"]) {
      const abbr = TEAM[g[`${side}_team`]] ?? g[`${side}_team`];
      const was = g[`${side}_qb_name`];
      if (!was || !teamId[abbr]) continue;
      const qbs = await qbsOf(abbr);
      if (!qbs.length) continue;
      const st = (name) =>
        status.get(`${abbr}|${norm(name)}`) ?? status.get(`*|${norm(name)}`) ?? "";
      const rank = qbs.findIndex((q) => norm(q.name) === norm(was)) + 1; // 0 = not listed
      const wasStatus = st(was);
      let reason = "";
      if (RULED_OUT.test(wasStatus)) reason = `${was}: ${wasStatus}`;
      else if (!rank) reason = `${was} is not on the team's depth chart`;
      else if (rank >= 3) reason = `${was} is QB${rank} on the team's depth chart`;
      if (!reason) {
        if (norm(qbs[0].name) !== norm(was))
          out.disagree.push({
            espnId: Number(g.espn),
            team: abbr,
            nflverse: was,
            espnQb1: qbs[0].name,
          });
        continue;
      }
      const pick = qbs.find((q) => !RULED_OUT.test(st(q.name)));
      if (!pick) continue;
      const qbId = gsisByEspn.get(pick.espnId) ?? null;
      (out.games[g.espn] ??= {})[side] = { qbId, name: pick.name, was, reason };
      console.log(`${g.gameday} ${abbr}: ${was} → ${pick.name} (${reason})`);
    }
  }
  for (const d of out.disagree)
    console.log(`check by hand: ${d.team} nflverse ${d.nflverse}, ESPN QB1 ${d.espnQb1}`);
  const file = join(OUT, "nfl", `qb-starters-${SEASON}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(out, null, 1)}\n`);
  console.log(
    `${games.length} upcoming games checked; ${Object.keys(out.games).length} corrected → ${file}`,
  );
}

if (process.argv[1]?.endsWith("qb-starters.mjs"))
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
