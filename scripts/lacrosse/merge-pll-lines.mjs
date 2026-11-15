#!/usr/bin/env node
/**
 * Folds The Odds API PLL snapshots (odds-api-games.mjs output) into the site's lines file:
 *   { updated, games: { [oddsApiId]: { home, away, commence, open, latest, books } } }
 * open = the first consensus seen for the game, latest = the newest; consensus is the median across the
 * major US books (falling back to every book) of the home spread, total and both moneylines. books keeps
 * each book's newest line, for line shopping.
 *
 *   node scripts/lacrosse/merge-pll-lines.mjs props-site/lines/pll.json pull/oddsapi/pll/*.json
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const MAJOR = new Set([
  "draftkings",
  "fanduel",
  "betmgm",
  "williamhill_us",
  "caesars",
  "espnbet",
  "fanatics",
  "hardrockbet",
  "bet365",
  "betrivers",
  "ballybet",
]);

const median = (xs) => {
  const v = xs.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/** The consensus line across books (major books when any have the game). */
export function consensus(books) {
  const pool = books.some((b) => MAJOR.has(b.key)) ? books.filter((b) => MAJOR.has(b.key)) : books;
  const spread = median(pool.map((b) => b.spread?.[0]));
  const total = median(pool.map((b) => b.total?.[0]));
  const mlHome = median(pool.map((b) => b.ml?.[0]));
  const mlAway = median(pool.map((b) => b.ml?.[1]));
  if (spread == null && total == null && mlHome == null) return null;
  return {
    spread,
    total,
    mlHome: mlHome == null ? null : Math.round(mlHome),
    mlAway: mlAway == null ? null : Math.round(mlAway),
    books: pool.length,
  };
}

export function merge(file, snaps) {
  const games = { ...(file?.games ?? {}) };
  for (const s of [...snaps].sort((a, b) => a.at.localeCompare(b.at))) {
    for (const g of s.games ?? []) {
      if (!g.books?.length) continue;
      const c = consensus(g.books);
      if (!c) continue;
      const prev = games[g.id];
      const line = { ...c, at: s.at };
      games[g.id] = {
        home: g.home,
        away: g.away,
        commence: g.commence,
        open: prev?.open ?? line,
        latest: !prev?.latest || prev.latest.at <= s.at ? line : prev.latest,
        books: Object.fromEntries(
          g.books.map((b) => [b.key, { spread: b.spread, total: b.total, ml: b.ml, at: s.at }]),
        ),
      };
    }
  }
  return { updated: new Date().toISOString(), games };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [out, ...paths] = process.argv.slice(2);
  let file = null;
  try {
    file = JSON.parse(await readFile(out, "utf8"));
  } catch {}
  const snaps = [];
  for (const p of paths) snaps.push(JSON.parse(await readFile(p, "utf8")));
  const merged = merge(file, snaps);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(merged));
  console.log(`${Object.keys(merged.games).length} PLL games with lines`);
}
