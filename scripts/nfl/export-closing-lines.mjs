#!/usr/bin/env node
/**
 * Writes out/nfl-closing-lines-<season>.json: every finished regular-season NFL game's closing spread,
 * total and prices from ESPN's core odds feed (DraftKings first), keyed by ESPN event id:
 *   { "401872927": { "spread": "MIN -2.5", "total": 46.5, "homeMoneyline": -135, ... } }
 * The site reads it (props-site/nfl/closing-lines-<season>.json) so finished games never show a
 * dash for a line, instead of looking each game up on ESPN from the server. Runs in GitHub Actions
 * (.github/workflows/nfl-closing-lines.yml).
 *
 *   node scripts/nfl/export-closing-lines.mjs 2026
 */
import { mkdir, writeFile } from "node:fs/promises";

const SEASON = Number(process.argv[2] ?? new Date().getUTCFullYear());
const SB = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
const H = { "User-Agent": "Mozilla/5.0 GamblingNFL closing-lines", Accept: "application/json" };
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(20_000) });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch {
      // retry
    }
    await new Promise((res) => setTimeout(res, 700 * (i + 1)));
  }
  return null;
}
const american = (v) => {
  if (v == null || v === "") return undefined;
  if (typeof v === "object") return american(v.american ?? v.alternateDisplayValue ?? v.value);
  const s = String(v).trim().toUpperCase();
  if (s === "EVEN") return 100;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) >= 100 ? Math.round(n) : undefined;
};
async function closing(id) {
  const list = await get(`${CORE}/events/${id}/competitions/${id}/odds?limit=50`);
  const items = [];
  for (const it of list?.items ?? []) items.push(it?.$ref && Object.keys(it).length === 1 ? await get(it.$ref) : it);
  const books = items.filter(Boolean);
  books.sort((x, y) => (String(y?.provider?.id) === "100") - (String(x?.provider?.id) === "100"));
  const b = books.find((o) => typeof o?.details === "string" && o.details.trim() && typeof o?.overUnder === "number")
    ?? books.find((o) => typeof o?.details === "string" && o.details.trim());
  if (!b) return null;
  const h = b.homeTeamOdds ?? {}, a = b.awayTeamOdds ?? {};
  const row = {
    spread: b.details.trim(),
    total: typeof b.overUnder === "number" ? b.overUnder : undefined,
    book: b.provider?.name,
    homeMoneyline: american(h.close?.moneyLine) ?? american(h.moneyLine),
    awayMoneyline: american(a.close?.moneyLine) ?? american(a.moneyLine),
    homeSpreadOdds: american(h.close?.spread) ?? american(h.spreadOdds),
    awaySpreadOdds: american(a.close?.spread) ?? american(a.spreadOdds),
    overOdds: american(b.close?.over) ?? american(b.overOdds),
    underOdds: american(b.close?.under) ?? american(b.underOdds),
  };
  for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
  return row;
}
const out = {};
let finals = 0;
for (let w = 1; w <= 18; w++) {
  const sb = await get(`${SB}?dates=${SEASON}&seasontype=2&week=${w}&limit=100`);
  const done = (sb?.events ?? []).filter((e) => e?.competitions?.[0]?.status?.type?.completed);
  for (let i = 0; i < done.length; i += 6) {
    await Promise.all(done.slice(i, i + 6).map(async (e) => {
      finals += 1;
      const c = await closing(e.id);
      if (c) out[e.id] = c;
    }));
  }
}
await mkdir("out", { recursive: true });
await writeFile(`out/nfl-closing-lines-${SEASON}.json`, JSON.stringify({ season: SEASON, updated: new Date().toISOString(), games: out }));
console.log(`${Object.keys(out).length} of ${finals} finished games have lines`);
if (finals && Object.keys(out).length < finals * 0.9) process.exit(1); // don't publish a half-empty file
