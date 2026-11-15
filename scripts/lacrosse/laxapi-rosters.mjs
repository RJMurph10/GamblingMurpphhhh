#!/usr/bin/env node
/**
 * Game-day rosters for the PLL from the Lacrosse API pull (saved by lacrosseapi-pull.mjs): every player
 * with a line in a game's box score dressed for it, zeros included, so a game's player box score is the
 * team's roster that week. (The API's own weekly roster route returns nothing.)
 *
 *   src/data/pll-game-rosters.json = { source, games: [{ date, clubs: [short, short], rosters: {
 *     <short>: { complete, players: [{ name, num, pos, college }] } } }] }
 * A roster is "complete" with 15 or more players; the feed's box scores from early August on list only a
 * few players, and the site falls back to the club's last complete roster for those.
 *
 *   node scripts/lacrosse/laxapi-rosters.mjs <lacrosse-api data dir> src/data/pll-game-rosters.json
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CLUBS = [
  "Archers",
  "Atlas",
  "Cannons",
  "Chaos",
  "Chrome",
  "Outlaws",
  "Redwoods",
  "Waterdogs",
  "Whipsnakes",
];
const COMPLETE = 15;

const readJson = async (f) => {
  try {
    return JSON.parse(await readFile(f, "utf8"));
  } catch {
    return null;
  }
};

const [dir, out] = process.argv.slice(2);
const seasonFiles = (await readdir(dir)).filter((f) => f.startsWith("fixtures_season_"));
const fixtures = new Map();
for (const f of seasonFiles)
  for (const fx of (await readJson(join(dir, f)))?.data ?? []) fixtures.set(fx.id, fx);

const games = [];
for (const fx of fixtures.values()) {
  const clubs = (fx.sides ?? []).map((s) => s.team?.name).filter((n) => CLUBS.includes(n));
  if (!clubs.length || fx.status !== "completed") continue;
  const m = (await readJson(join(dir, "fixtures", fx.id, "matches.json")))?.data;
  const mid = (Array.isArray(m) ? m[0] : m)?.id;
  const lines = mid
    ? ((await readJson(join(dir, "matches", mid, "player-stats.json")))?.data ?? [])
    : [];
  const rosters = {};
  for (const l of lines) {
    const club = l.team?.name;
    if (!CLUBS.includes(club)) continue;
    (rosters[club] ??= []).push({
      name: l.player?.display_name,
      num: l.player?.jersey_number ?? null,
      pos: l.player?.position ?? "",
      college: l.player?.college ?? null,
    });
  }
  games.push({
    date: fx.scheduled_at,
    clubs,
    rosters: Object.fromEntries(
      Object.entries(rosters).map(([c, players]) => [
        c,
        {
          complete: players.length >= COMPLETE,
          players: players.sort((a, b) => (a.num ?? 999) - (b.num ?? 999)),
        },
      ]),
    ),
  });
}
games.sort((a, b) => a.date.localeCompare(b.date));
await writeFile(
  out,
  JSON.stringify({ source: "Lacrosse API (lacrosseapi.com) player box scores, 2026", games }),
);
const complete = games.flatMap((g) => Object.values(g.rosters)).filter((r) => r.complete).length;
console.log(`${games.length} PLL games; ${complete} complete game-day rosters`);
