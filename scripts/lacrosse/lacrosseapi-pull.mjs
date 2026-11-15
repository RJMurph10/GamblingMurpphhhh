#!/usr/bin/env node
/**
 * Saves everything Lacrosse API (lacrosseapi.com) has for the PLL: seasons, teams, rosters, players,
 * fixtures, quarter scores, play-by-play, player and team box scores, season stats, standings,
 * transactions and odds. Their API terms allow caching responses in your own application (section 3) and
 * keeping your own copies (section 7); they forbid redistributing bulk historical data, so the raw files
 * stay on a data branch and the site shows only what each page needs.
 *
 * Every response is saved raw, one file per request path: <out>/<path>.json (query strings folded into
 * the name). Files already there are skipped, so a rerun only fetches what's missing and costs nothing
 * twice. Stops when the plan's remaining calls fall under --reserve (GET /v1/usage).
 *
 *   LACROSSE_API_KEY=lax_live_... node scripts/lacrosse/lacrosseapi-pull.mjs --out store --reserve 500
 *   ... --competitions pll,wll   (default: pll)   --dry (list what would be fetched, no data calls)
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const OUT = opt("out", "store");
const RESERVE = Number(opt("reserve", "500"));
const WANT = opt("competitions", "pll").toLowerCase().split(",");
const DRY = args.includes("--dry");
const KEY = process.env.LACROSSE_API_KEY;
const BASE = "https://lacrosseapi.com";
// plan limit is 120 requests a minute on the trial; stay under it
const GAP_MS = 600;

if (!KEY) {
  console.log("LACROSSE_API_KEY not set; nothing to do.");
  process.exit(0);
}

let calls = 0;
let remaining = Infinity;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fileFor = (path) =>
  join(
    OUT,
    path
      .replace(/^\/v1\//, "")
      .replace(/[?&=]/g, "_")
      .replace(/[^A-Za-z0-9_./-]/g, "") + ".json",
  );
const exists = (f) =>
  access(f).then(
    () => true,
    () => false,
  );

/** One GET, saved raw. Returns the parsed body (from disk if already saved). */
async function get(path, { save = true } = {}) {
  const f = fileFor(path);
  if (save && (await exists(f))) return JSON.parse(await readFile(f, "utf8"));
  if (
    DRY &&
    !path.startsWith("/v1/usage") &&
    !path.startsWith("/v1/competitions") &&
    !path.startsWith("/v1/seasons")
  ) {
    console.log("would fetch", path);
    return null;
  }
  if (remaining - 1 < RESERVE)
    throw new Error(`stopping: ${remaining} calls left (reserve ${RESERVE})`);
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(GAP_MS);
    const r = await fetch(BASE + path, {
      headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    calls++;
    remaining--;
    if (r.status === 429 || r.status >= 500) {
      const wait = Number(r.headers.get("retry-after") ?? 10) * 1000;
      console.log(`  ${r.status} on ${path}; waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${r.status} ${path}: ${(await r.text()).slice(0, 300)}`);
    const body = await r.json();
    if (save) {
      await mkdir(dirname(f), { recursive: true });
      await writeFile(f, JSON.stringify(body));
    }
    return body;
  }
  throw new Error(`gave up on ${path}`);
}

/** Every page of a list (cursor pagination: meta.pagination.next_cursor). */
async function all(path) {
  const out = [];
  let cursor = null;
  for (let page = 0; page < 200; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const body = await get(cursor ? `${path}${sep}cursor=${encodeURIComponent(cursor)}` : path);
    if (!body) break;
    out.push(...(Array.isArray(body.data) ? body.data : []));
    const p = body.meta?.pagination;
    if (!p?.has_more || !p.next_cursor || p.next_cursor === cursor) break;
    cursor = p.next_cursor;
  }
  return out;
}

const idOf = (x) => x?.id ?? x?.fixture_id ?? x?.match_id;

async function usage() {
  const u = await get("/v1/usage", { save: false });
  const d = u?.data ?? u ?? {};
  // find a "remaining" figure wherever the plan reports it
  const flat = JSON.stringify(d);
  const m = flat.match(/"(?:rest_)?(?:calls_)?remaining"\s*:\s*(\d+)/);
  if (m) remaining = Number(m[1]);
  console.log("usage:", flat.slice(0, 400));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await usage();
  const comps = (await all("/v1/competitions")).filter((c) =>
    WANT.some((w) =>
      [c.id, c.code, c.slug, c.short_name, c.abbreviation, c.name]
        .filter(Boolean)
        .some(
          (v) =>
            String(v).toLowerCase() === w ||
            (w === "pll" && /premier lacrosse/i.test(String(v))) ||
            (w === "wll" && /women'?s lacrosse league/i.test(String(v))),
        ),
    ),
  );
  console.log(
    "competitions:",
    comps.map((c) => `${idOf(c)} ${c.name}`).join(" | ") || "none matched",
  );

  // reference data
  await all("/v1/teams");
  await all("/v1/transactions");

  for (const comp of comps) {
    const seasons = await all(`/v1/seasons?competition=${encodeURIComponent(idOf(comp))}`);
    console.log(
      `${comp.name}: ${seasons.length} seasons:`,
      seasons.map((s) => s.year ?? s.name ?? idOf(s)).join(", "),
    );
    for (const s of seasons) {
      const sid = idOf(s);
      await get(`/v1/seasons/${sid}/player-stats`);
      await get(`/v1/seasons/${sid}/team-stats`);
      await get(`/v1/seasons/${sid}/standings/latest`);
      const fixtures = await all(`/v1/fixtures?season=${encodeURIComponent(sid)}`);
      console.log(`  season ${s.year ?? sid}: ${fixtures.length} fixtures`);
      for (const fx of fixtures) {
        const fid = idOf(fx);
        await get(`/v1/fixtures/${fid}`);
        await get(`/v1/fixtures/${fid}/plays`);
        await get(`/v1/fixtures/${fid}/odds`);
        const matches = await get(`/v1/fixtures/${fid}/matches`);
        const ms = Array.isArray(matches?.data)
          ? matches.data
          : matches?.data
            ? [matches.data]
            : [];
        for (const m of ms) {
          const mid = idOf(m);
          if (!mid) continue;
          await get(`/v1/matches/${mid}/participants`);
          await get(`/v1/matches/${mid}/games`);
          await get(`/v1/matches/${mid}/player-stats`);
          await get(`/v1/matches/${mid}/team-stats`);
        }
      }
      // rosters as of this season, for every team that played in it
      const teamIds = new Set();
      for (const fx of fixtures)
        for (const t of [
          fx.home_team_id,
          fx.away_team_id,
          fx.home?.id,
          fx.away?.id,
          ...(fx.teams ?? []).map(idOf),
        ])
          if (t) teamIds.add(t);
      for (const t of teamIds) await get(`/v1/teams/${t}/roster?season=${encodeURIComponent(sid)}`);
    }
  }
  await usage();
  console.log(`done: ${calls} calls this run`);
}

main().catch(async (e) => {
  console.error(String(e.message ?? e));
  console.log(`stopped after ${calls} calls; rerun to continue (saved files are skipped)`);
  process.exit(String(e.message ?? e).startsWith("stopping:") ? 0 : 1);
});
