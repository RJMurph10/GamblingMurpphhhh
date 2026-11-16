#!/usr/bin/env node
/**
 * Historical halftime game lines from The Odds API (paid plan; one month): each snapshot in a list of
 * halftime times returns every game on the board at that moment, live games included if the snapshots
 * carry in-play odds (check with --test first). Cost per snapshot: 10 × markets × 1 region (spreads +
 * totals = 20 credits; + moneyline = 30).
 *
 * The list (scripts/line-history/halftime/*.json) comes from nflverse play-by-play wall-clock times:
 * each time falls 8+ minutes after a game's last 2nd-quarter play (the API returns the snapshot at or
 * before the time, up to 5 minutes earlier) and 1+ minute before its 3rd quarter, and one time covers
 * every game at halftime then (570 snapshots for 855 NFL games, 2023-2025).
 *
 * Saved raw, one file per snapshot: <out>/<sport>/<YYYY-MM-DDTHH-MM>.json, with the games it was taken
 * for. Files already there are skipped (reruns never pay twice). Stops under --reserve credits left.
 *
 *   node scripts/line-history/odds-api-halftime.mjs --list scripts/line-history/halftime/nfl-halftime-snapshots-2023-2025.json --dry
 *   ODDS_API_KEY=... node scripts/line-history/odds-api-halftime.mjs --list <file> --out store/data --test 1
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const LIST = opt("list", "scripts/line-history/halftime/nfl-halftime-snapshots-2023-2025.json");
const SPORT = opt("sport", "americanfootball_nfl");
const MARKETS = opt("markets", "spreads,totals");
const OUT = opt("out", "data");
const RESERVE = Number(opt("reserve", "300"));
const TEST = Number(opt("test", "0"));
const DRY = args.includes("--dry");
const KEY = process.env.ODDS_API_KEY;
const COST = 10 * MARKETS.split(",").length;

const fileOf = (at) => join(OUT, SPORT, `${at.slice(0, 16).replace(":", "-")}.json`);

async function main() {
  const { snapshots } = JSON.parse(await readFile(LIST, "utf8"));
  let todo = snapshots.filter((s) => !existsSync(fileOf(s.at)));
  // the test takes a mid-season Sunday snapshot covering the most games
  if (TEST) todo = [...todo].sort((a, b) => b.games.length - a.games.length).slice(0, TEST);
  console.log(
    `${snapshots.length} snapshots, ${todo.length} to pull, ~${todo.length * COST} credits (${COST} each)`,
  );
  if (DRY) return;
  if (!KEY) throw new Error("ODDS_API_KEY is not set");
  let left = null;
  for (const s of todo) {
    if (left != null && left - COST < RESERVE) {
      console.log(`stopping: ${left} credits left (reserve ${RESERVE})`);
      break;
    }
    const url =
      `https://api.the-odds-api.com/v4/historical/sports/${SPORT}/odds?apiKey=${KEY}` +
      `&regions=us&markets=${MARKETS}&oddsFormat=american&date=${s.at}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    left = Number(r.headers.get("x-requests-remaining"));
    if (!r.ok) {
      console.log(`${s.at}: ${r.status} ${(await r.text()).slice(0, 200)}`);
      if (r.status === 401 || r.status === 429) break;
      continue;
    }
    const body = await r.json();
    const snapAt = Date.parse(body.timestamp ?? s.at);
    const events = body.data ?? [];
    const started = events.filter((e) => Date.parse(e.commence_time) < snapAt);
    const priced = started.filter((e) => (e.bookmakers ?? []).some((b) => b.markets?.length));
    console.log(
      `${s.at} → snapshot ${body.timestamp}: ${events.length} games, ${started.length} already started, ` +
        `${priced.length} of them with live lines · ${left} credits left`,
    );
    if (TEST) {
      for (const e of priced.slice(0, 3)) {
        const b = e.bookmakers[0];
        console.log(
          `  ${e.away_team} at ${e.home_team} (${e.commence_time}) ${b.title} ${b.last_update}:`,
          JSON.stringify(
            b.markets.map((m) => [m.key, m.outcomes.map((o) => [o.name, o.point, o.price])]),
          ),
        );
      }
    }
    await mkdir(join(OUT, SPORT), { recursive: true });
    await writeFile(fileOf(s.at), JSON.stringify({ requested: s.at, games: s.games, ...body }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
