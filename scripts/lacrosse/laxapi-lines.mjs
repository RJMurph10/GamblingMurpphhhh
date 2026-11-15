#!/usr/bin/env node
/**
 * PLL game lines from the Lacrosse API odds history (saved by lacrosseapi-pull.mjs) into the site's lines
 * file (props-site/lines/pll.json, the same shape merge-pll-lines.mjs writes):
 *   games[laxapi-<start>-<teams>] = { home, away, commence, open, latest, books, source }
 *
 * Providers: bet365 (sportsbook prices), pll_reference (the league's reference odds, quoted as no-vig
 * probabilities) and polymarket (prediction-market moneylines). For each market, the opening price is its
 * first pre-game observation and the closing price its last one before the start; post-game settlement
 * prices (1 / 0) are ignored. The game's line (open and close) takes each number from bet365 first, then
 * the PLL reference, then Polymarket (moneyline only); every provider's close is kept under books.
 *
 * Odds events carry no team ids: the teams come from the moneyline / spread outcomes, and an event with
 * only a total (Over / Under) joins the game with the same provider and start time. A spread market lists
 * one line for both sides; the favorite (lower moneyline) gets the minus side.
 *
 *   node scripts/lacrosse/laxapi-lines.mjs <lacrosse-api data dir> <lines file to update>
 */
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const PRIORITY = ["bet365", "pll_reference", "polymarket"];
// the odds feed files some WLL games under the PLL: keep games between PLL clubs only
const PLL_CLUBS = [
  "archers",
  "atlas",
  "cannons",
  "chaos",
  "chrome",
  "outlaws",
  "redwoods",
  "waterdogs",
  "whipsnakes",
];
const isPll = (name) => PLL_CLUBS.some((c) => name.toLowerCase().endsWith(c));

/** Decimal odds to American (rounded). */
export const american = (d) => {
  const x = Number(d);
  if (!Number.isFinite(x) || x <= 1) return null;
  return x >= 2 ? Math.round((x - 1) * 100) : Math.round(-100 / (x - 1));
};

async function readJson(f) {
  try {
    return JSON.parse(await readFile(f, "utf8"));
  } catch {
    return null;
  }
}

/** First and last pre-game observation per outcome. */
function openClose(history, startsAt) {
  // a probability quote of exactly 50/50 is a placeholder before the price is set, not an opener
  const placeholder = new Set(
    history
      .filter((o) => o.original_format === "probability" && Number(o.original_price) === 0.5)
      .map((o) => o.observed_at),
  );
  const pre = history
    .filter(
      (o) =>
        !o.is_live &&
        !o.suspended &&
        o.observed_at < startsAt &&
        Number(o.decimal_odds) > 1 &&
        !placeholder.has(o.observed_at),
    )
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at) || a.sequence - b.sequence);
  if (!pre.length) return null;
  const first = {};
  const last = {};
  for (const o of pre) {
    first[o.outcome] ??= o;
    last[o.outcome] = o;
  }
  return { first, last, at: pre[pre.length - 1].observed_at, from: pre[0].observed_at };
}

export async function build(dir) {
  const evDir = join(dir, "odds/events");
  const events = [];
  for (const f of await readdir(evDir).catch(() => [])) {
    const e = (await readJson(join(evDir, f)))?.data;
    if (e?.league === "PLL") events.push(e);
  }
  // per provider event: its markets with open/close prices
  const rows = [];
  for (const e of events) {
    const markets = new Map();
    for (const p of e.prices ?? []) {
      if (!markets.has(p.market_id))
        markets.set(p.market_id, {
          key: p.market_key,
          line: p.line == null ? null : Number(p.line),
          provider: p.provider,
        });
    }
    const out = {
      provider: e.prices?.[0]?.provider,
      startsAt: e.starts_at,
      teams: new Set(),
      markets: {},
    };
    for (const [mid, m] of markets) {
      const hist = (await readJson(join(dir, "odds/markets", mid, "prices.json")))?.data ?? [];
      const oc = openClose(hist, e.starts_at);
      if (!oc) continue;
      out.provider = m.provider;
      out.markets[m.key] = { line: m.line, ...oc };
      if (m.key !== "total") for (const o of Object.keys(oc.last)) out.teams.add(o);
    }
    if (Object.keys(out.markets).length) rows.push(out);
  }
  // games: rows with the same two teams starting within 12 hours of each other (each provider lists its
  // own start time); a total-only row joins the game holding the same provider's row at that start time
  const games = [];
  const near = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= 12 * 3_600_000;
  const teamed = rows
    .filter((r) => r.teams.size === 2)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const r of teamed) {
    const teams = [...r.teams].sort();
    let g = games.find(
      (x) => x.teams.join("|") === teams.join("|") && near(x.startsAt, r.startsAt),
    );
    if (!g) games.push((g = { startsAt: r.startsAt, teams, byProvider: {}, slots: new Set() }));
    g.byProvider[r.provider] = { ...(g.byProvider[r.provider] ?? {}), ...r.markets };
    g.slots.add(`${r.provider}|${r.startsAt}`);
  }
  for (const r of rows.filter((r) => r.teams.size === 0 && r.markets.total)) {
    let same = games.filter((g) => g.slots.has(`${r.provider}|${r.startsAt}`));
    if (!same.length)
      same = games.filter((g) => [...g.slots].some((x) => x.endsWith(`|${r.startsAt}`)));
    if (same.length !== 1) continue; // two games at once: can't tell which total it is
    const g = same[0];
    g.byProvider[r.provider] = { ...(g.byProvider[r.provider] ?? {}), total: r.markets.total };
  }

  // the feed sometimes files a weekend's game on the wrong day under one provider (and that copy can carry
  // prices from after the game): when the same two clubs also have a bet365 game within 36 hours, the
  // bet365 one is the real game and the copy without bet365 is dropped
  const misdated = (g) =>
    !g.byProvider.bet365 &&
    games.some(
      (o) =>
        o !== g &&
        o.byProvider.bet365 &&
        o.teams.join("|") === g.teams.join("|") &&
        Math.abs(new Date(o.startsAt).getTime() - new Date(g.startsAt).getTime()) <= 36 * 3_600_000,
    );

  const result = {};
  for (const g of games) {
    if (misdated(g)) continue;
    if (!g.teams.every(isPll)) continue;
    const [home, away] = g.teams; // arbitrary order; the site lines them up with ESPN's home and away
    const side = (when) => {
      const pick = (mk) => {
        for (const p of PRIORITY) {
          const m = g.byProvider[p]?.[mk];
          if (m) return { m, p, obs: when === "open" ? m.first : m.last };
        }
        return null;
      };
      const ml = pick("moneyline");
      const mlHome = ml ? american(ml.obs[home]?.decimal_odds) : null;
      const mlAway = ml ? american(ml.obs[away]?.decimal_odds) : null;
      const sp = pick("spread");
      let spread = null;
      if (sp && sp.m.line != null) {
        // the favorite (lower moneyline, else the shorter spread price) lays the points
        const homeFav =
          mlHome != null && mlAway != null
            ? mlHome < mlAway
            : Number(sp.obs[home]?.decimal_odds) > Number(sp.obs[away]?.decimal_odds);
        spread = homeFav ? -Math.abs(sp.m.line) : Math.abs(sp.m.line);
      }
      const tot = pick("total");
      const total = tot?.m.line ?? null;
      if (mlHome == null && spread == null && total == null) return null;
      const at = [ml, sp, tot]
        .filter(Boolean)
        .map((x) => (when === "open" ? x.m.from : x.m.at))
        .sort()
        .at(-1);
      return { spread, total, mlHome, mlAway, books: Object.keys(g.byProvider).length, at };
    };
    const open = side("open");
    const latest = side("close");
    if (!latest) continue;
    const books = {};
    for (const [p, ms] of Object.entries(g.byProvider)) {
      const ml = ms.moneyline?.last;
      const sp = ms.spread;
      const homeFavP = ml
        ? Number(ml[home]?.decimal_odds) < Number(ml[away]?.decimal_odds)
        : latest.mlHome != null && latest.mlAway != null && latest.mlHome < latest.mlAway;
      books[p] = {
        ml: ml ? [american(ml[home]?.decimal_odds), american(ml[away]?.decimal_odds)] : null,
        spread:
          sp && sp.line != null
            ? [
                homeFavP ? -Math.abs(sp.line) : Math.abs(sp.line),
                american(sp.last[home]?.decimal_odds),
                american(sp.last[away]?.decimal_odds),
              ]
            : null,
        total: ms.total
          ? [
              ms.total.line,
              american(ms.total.last.Over?.decimal_odds),
              american(ms.total.last.Under?.decimal_odds),
            ]
          : null,
        at: [ms.moneyline?.at, sp?.at, ms.total?.at].filter(Boolean).sort().at(-1),
      };
    }
    const id = `laxapi-${g.startsAt.slice(0, 16)}-${g.teams.map((t) => t.split(" ").at(-1).toLowerCase()).join("-")}`;
    result[id] = {
      home,
      away,
      commence: g.startsAt,
      open: open ?? latest,
      latest,
      books,
      source: "lacrosse-api",
    };
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, out] = process.argv.slice(2);
  const games = await build(dir);
  const file = (await readJson(out)) ?? { updated: null, games: {} };
  // replace this source's games, keep The Odds API's
  for (const k of Object.keys(file.games)) if (k.startsWith("laxapi-")) delete file.games[k];
  Object.assign(file.games, games);
  file.updated = new Date().toISOString();
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(file));
  const n = Object.values(games);
  console.log(
    `${n.length} PLL games with Lacrosse API lines: ${n.filter((g) => g.latest.spread != null).length} spreads, ${n.filter((g) => g.latest.total != null).length} totals, ${n.filter((g) => g.latest.mlHome != null).length} moneylines`,
  );
}
