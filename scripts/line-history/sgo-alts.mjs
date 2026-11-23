/**
 * Alternate game spreads and totals from SportsGameOdds events (each book's whole ladder), for finding
 * edges on alt lines (project doc alt-lines-strategy.md). SportsGameOdds returns the ladders when a pull
 * asks with includeAltLines=true, at no extra cost: one game is one event whatever its markets. Every
 * SportsGameOdds pull calls altLaddersOf(event) and saves the result next to its own snapshot, under
 * props-site/alt-lines/<league>/<YYYY-MM-DDTHH>.json:
 *
 *   { at, source: "sgo", league,
 *     games: [{ id, home, away, commence,
 *               ladders: { <market>: { <book>: [[line, price], ...] } } }] }
 *
 * markets: "home-spread" / "away-spread" (line = that team's spread, e.g. -10.5), "over" / "under" (line =
 * the total), "home-total-over" / "home-total-under" / "away-total-over" / "away-total-under" (team totals).
 * Only full-game markets. A rung is kept only while it's a pregame price: the book's main line plus every
 * alternate whose last update came before the start (finished events keep each rung's last price, which
 * can be an in-game one). Rungs are sorted by line.
 */

const MARKETS = {
  "points-home-game-sp-home": ["home-spread", "spread"],
  "points-away-game-sp-away": ["away-spread", "spread"],
  "points-all-game-ou-over": ["over", "overUnder"],
  "points-all-game-ou-under": ["under", "overUnder"],
  "points-home-game-ou-over": ["home-total-over", "overUnder"],
  "points-home-game-ou-under": ["home-total-under", "overUnder"],
  "points-away-game-ou-over": ["away-total-over", "overUnder"],
  "points-away-game-ou-under": ["away-total-under", "overUnder"],
};

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/^\+/, ""));
  return Number.isFinite(n) ? n : null;
};

/** The event's alt ladders by market and book (empty object when it has none). */
export function altLaddersOf(e) {
  const start = Date.parse(e?.status?.startsAt ?? "") || Infinity;
  const pregame = (x) => !x?.lastUpdatedAt || Date.parse(x.lastUpdatedAt) < start;
  const out = {};
  for (const [oddID, [market, field]] of Object.entries(MARKETS)) {
    const byBook = e?.odds?.[oddID]?.byBookmaker ?? {};
    for (const [book, b] of Object.entries(byBook)) {
      const rungs = new Map();
      for (const x of [b, ...(b?.altLines ?? [])]) {
        if (!pregame(x)) continue;
        const line = num(x?.[field]);
        const price = num(x?.odds);
        if (line === null || price === null) continue;
        rungs.set(line, price);
      }
      // a ladder is only worth saving when the book lists more than its main line
      if (rungs.size < 2) continue;
      (out[market] ??= {})[book] = [...rungs].sort((a, b) => a[0] - b[0]);
    }
  }
  return out;
}

/** One saved game: null when the event has no ladders. */
export function altGameOf(e) {
  const ladders = altLaddersOf(e);
  if (!Object.keys(ladders).length) return null;
  const name = (t) => t?.names?.long ?? t?.names?.medium ?? t?.teamID ?? "";
  return {
    id: e.eventID,
    home: name(e.teams?.home),
    away: name(e.teams?.away),
    commence: e.status?.startsAt,
    ladders,
  };
}

/** Write one snapshot of alt ladders (no file when no game had any). */
export async function saveAltLadders(dir, league, at, games) {
  const list = games.filter(Boolean);
  if (!dir || !list.length) return 0;
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${at.slice(0, 13)}.json`),
    JSON.stringify({ at, source: "sgo", league, games: list }),
  );
  return list.length;
}
