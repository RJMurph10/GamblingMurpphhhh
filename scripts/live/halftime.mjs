#!/usr/bin/env node
/**
 * Halftime lines for NFL and NBA games: every book's live moneyline, spread, total, 2nd-half lines and
 * player props at halftime, plus ESPN's halftime box score (score, team stats, every player's 1st-half
 * stats). The data to test in-game angles against (e.g. trailing teams' running backs), saved one file per
 * game to the props-site branch, by ESPN event id (the game pages read it during the game):
 *   halftime/<league>/<espnId>.json
 *   { league, espnId, at, kickoff, home, away, espn: { status, score, linescores, teams, players },
 *     sgo: { eventID, status, players, odds: [...] } }
 * (odds: one row per SportsGameOdds oddID with the main books' current prices, plus the consensus
 * fair / book odds; full-game lines here are live in-game lines, not the pregame close).
 *
 * Polls ESPN's scoreboard (free) once a minute; a game is captured once, HALF_WAIT minutes after ESPN first
 * shows halftime (books often pause markets right at the break). Each capture costs one SportsGameOdds event
 * (free plan: 2,500 a month, shared with the other pulls); stops when fewer than --keep are left.
 * Exits when no game of these leagues is before or at halftime within the look-ahead, or at --minutes.
 *
 *   SPORTSGAMEODDS_API_KEY=... node scripts/live/halftime.mjs --site site-repo [--leagues NFL,NBA]
 *     [--minutes 345] [--keep 30] [--dry]   (--dry: ESPN only, no SportsGameOdds calls)
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const SITE = opt("site", "site-repo");
const LEAGUES = opt("leagues", "NFL,NBA").split(",").filter(Boolean);
const MINUTES = Number(opt("minutes", "345"));
const KEEP = Number(opt("keep", "30"));
const LOOKAHEAD_MIN = Number(opt("lookahead", "100"));
const HALF_WAIT_MS = Number(opt("wait", "5")) * 60_000;
const DRY = args.includes("--dry");
const KEY = process.env.SPORTSGAMEODDS_API_KEY;
const SGO = "https://api.sportsgameodds.com/v2";

const ESPN_PATH = { NFL: "football/nfl", NBA: "basketball/nba" };
/** Main US books kept per odd (others are dropped to keep files small). */
const BOOKS = [
  "draftkings",
  "fanduel",
  "betmgm",
  "caesars",
  "espnbet",
  "fanatics",
  "hardrockbet",
  "bet365",
  "pinnacle",
];
/** ESPN display names that differ from SportsGameOdds' long team names. */
const NAME_FIX = { "LA Clippers": "Los Angeles Clippers" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const sgoTeamId = (name, league) =>
  `${(NAME_FIX[name] ?? name).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${league}`;

async function json(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
const sgo = (path) => json(`${SGO}${path}`, { "X-Api-Key": KEY });

async function monthLeft() {
  const lim = (await sgo("/account/usage/"))?.data?.rateLimits ?? {};
  const m = Object.entries(lim).find(([k]) => /month/i.test(k))?.[1] ?? {};
  const used = Number(m["current-entities"]);
  const max = Number(m["max-entities"]);
  return Number.isFinite(used) && Number.isFinite(max) ? max - used : null;
}

/** Today's games for one league from ESPN's scoreboard (ESPN's "today", US Eastern). */
async function scoreboard(league) {
  const sb = await json(
    `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[league]}/scoreboard`,
  );
  return (sb.events ?? []).map((e) => {
    const c = e.competitions?.[0] ?? {};
    const side = (h) => c.competitors?.find((x) => x.homeAway === h) ?? {};
    return {
      league,
      id: e.id,
      date: e.date,
      season: e.season?.year ?? new Date(e.date).getUTCFullYear(),
      state: e.status?.type?.state, // pre | in | post
      name: e.status?.type?.name, // STATUS_HALFTIME at the break
      period: e.status?.period ?? 0,
      home: side("home").team?.displayName ?? "",
      away: side("away").team?.displayName ?? "",
    };
  });
}

const fileOf = (g) => join(SITE, "halftime", g.league.toLowerCase(), `${g.id}.json`);

/** ESPN's halftime box score: score, line scores, team stats, every player's 1st-half stats. */
async function espnBox(g) {
  const s = await json(
    `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[g.league]}/summary?event=${g.id}`,
  );
  const comp = s.header?.competitions?.[0] ?? {};
  return {
    status: comp.status?.type?.name ?? null,
    score: Object.fromEntries((comp.competitors ?? []).map((c) => [c.homeAway, Number(c.score)])),
    linescores: Object.fromEntries(
      (comp.competitors ?? []).map((c) => [
        c.homeAway,
        (c.linescores ?? []).map((l) => Number(l.displayValue ?? l.value)),
      ]),
    ),
    teams: (s.boxscore?.teams ?? []).map((t) => ({
      team: t.team?.displayName,
      stats: Object.fromEntries(
        (t.statistics ?? []).map((x) => [x.name ?? x.label, x.displayValue]),
      ),
    })),
    players: (s.boxscore?.players ?? []).map((t) => ({
      team: t.team?.displayName,
      groups: (t.statistics ?? []).map((grp) => ({
        name: grp.name ?? grp.text ?? "",
        labels: grp.labels ?? grp.keys ?? [],
        athletes: (grp.athletes ?? []).map((a) => [
          a.athlete?.displayName,
          a.athlete?.id,
          a.stats ?? [],
        ]),
      })),
    })),
  };
}

/** One SportsGameOdds event trimmed to what's needed: main books' current prices for every odd. */
function trim(e) {
  const odds = [];
  for (const [oddID, m] of Object.entries(e.odds ?? {})) {
    const books = {};
    for (const b of BOOKS) {
      const x = m.byBookmaker?.[b];
      if (!x) continue;
      books[b] = [
        x.odds ?? null,
        x.overUnder ?? x.spread ?? null,
        x.available === false ? 0 : 1,
        x.lastUpdatedAt ?? null,
      ];
    }
    if (!Object.keys(books).length && m.fairOdds == null) continue;
    odds.push({
      oddID,
      stat: m.statID,
      entity: m.statEntityID,
      period: m.periodID,
      bet: m.betTypeID,
      side: m.sideID,
      player: m.playerID ?? null,
      fair: [m.fairOdds ?? null, m.fairOverUnder ?? m.fairSpread ?? null],
      book: [m.bookOdds ?? null, m.bookOverUnder ?? m.bookSpread ?? null],
      books, // book → [price, line, open (1/0), lastUpdatedAt]
    });
  }
  const players = Object.fromEntries(
    Object.entries(e.players ?? {}).map(([id, p]) => [
      id,
      [p.name ?? [p.firstName, p.lastName].filter(Boolean).join(" "), p.teamID ?? null],
    ]),
  );
  return { eventID: e.eventID, status: e.status ?? null, teams: e.teams ?? null, players, odds };
}

/** The live SportsGameOdds event for one game: by home team id first (one event), else all live games. */
async function liveEvent(g) {
  const want = [sgoTeamId(g.home, g.league), sgoTeamId(g.away, g.league)];
  const tries = [
    { leagueID: g.league, live: "true", teamID: want[0], limit: "2" },
    { leagueID: g.league, live: "true", limit: "20" },
  ];
  for (const q of tries) {
    const r = await sgo(`/events/?${new URLSearchParams(q)}`);
    const hit = (r?.data ?? []).find(
      (e) =>
        [e.teams?.home?.teamID, e.teams?.away?.teamID].some((t) => want.includes(t)) ||
        [e.teams?.home?.names?.long, e.teams?.away?.names?.long].includes(
          NAME_FIX[g.home] ?? g.home,
        ),
    );
    console.log(
      `  sgo ${JSON.stringify(q)}: ${(r?.data ?? []).length} event(s), match ${hit ? "yes" : "no"}`,
    );
    if (hit) return hit;
  }
  return null;
}

/** Commit and push one file to the props-site clone (retrying on a moved branch). */
function publish(file, msg) {
  const git = (...a) => execFileSync("git", ["-C", SITE, ...a], { stdio: "pipe" }).toString();
  git("add", file.slice(SITE.length + 1));
  try {
    git("commit", "-q", "-m", msg);
  } catch {
    return; // nothing new
  }
  for (let i = 1; i <= 5; i += 1) {
    try {
      git("pull", "-q", "--rebase", "origin", "props-site");
      git("push", "-q", "origin", "HEAD:props-site");
      return;
    } catch (err) {
      console.log(`  push attempt ${i} failed: ${String(err.message).slice(0, 120)}`);
      execFileSync("sleep", [String(i * 10)]);
    }
  }
}

async function main() {
  if (!KEY && !DRY) {
    console.log("SPORTSGAMEODDS_API_KEY is not set; nothing to do.");
    return;
  }
  const until = Date.now() + MINUTES * 60_000;
  const firstHalf = new Map(); // game id → when ESPN first showed halftime
  const done = new Set();
  let left = DRY ? null : await monthLeft().catch(() => null);
  console.log(`SportsGameOdds events left this month: ${left ?? "?"} (keeping ${KEEP})`);
  while (Date.now() < until) {
    let waiting = 0;
    for (const league of LEAGUES) {
      let games = [];
      try {
        games = await scoreboard(league);
      } catch (err) {
        console.log(`${league} scoreboard failed: ${err.message}`);
        waiting += 1;
        continue;
      }
      for (const g of games) {
        const file = fileOf(g);
        if (done.has(g.id) || existsSync(file)) {
          done.add(g.id);
          continue;
        }
        const soon = g.state === "pre" && Date.parse(g.date) - Date.now() < LOOKAHEAD_MIN * 60_000;
        const firstHalfOn = g.state === "in" && g.name !== "STATUS_HALFTIME" && g.period <= 2;
        if (soon || firstHalfOn) waiting += 1;
        if (g.name !== "STATUS_HALFTIME") continue;
        waiting += 1;
        if (!firstHalf.has(g.id)) {
          firstHalf.set(g.id, Date.now());
          console.log(`${new Date().toISOString()} halftime: ${g.away} at ${g.home}`);
        }
        if (Date.now() - firstHalf.get(g.id) < HALF_WAIT_MS) continue;
        done.add(g.id);
        if (left != null && left <= KEEP) {
          console.log(`  skipped ${g.away} at ${g.home}: ${left} events left`);
          continue;
        }
        try {
          const espn = await espnBox(g);
          const e = DRY ? null : await liveEvent(g);
          if (!DRY && left != null) left -= 1;
          const out = {
            league,
            espnId: g.id,
            at: new Date().toISOString(),
            kickoff: g.date,
            home: g.home,
            away: g.away,
            espn,
            sgo: e ? trim(e) : null,
          };
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, JSON.stringify(out));
          console.log(
            `  saved ${file}: ${espn.score.away}-${espn.score.home}, ${out.sgo?.odds.length ?? 0} odds rows`,
          );
          if (!DRY) publish(file, `Halftime lines ${league} ${g.away} at ${g.home}`);
        } catch (err) {
          console.log(`  capture failed for ${g.away} at ${g.home}: ${err.message}`);
        }
      }
    }
    if (!waiting) {
      console.log("no game before or at halftime in the look-ahead; done");
      return;
    }
    await sleep(60_000);
  }
  console.log("time limit reached");
}

/** --sample NFL:<espnId>: print the ESPN box parse for one game (checks the parser; no SportsGameOdds). */
async function sample(spec) {
  const [league, id] = spec.split(":");
  const box = await espnBox({ league, id });
  console.log(
    JSON.stringify(
      {
        ...box,
        players: box.players.map((t) => ({
          team: t.team,
          groups: t.groups.map((g) => [
            g.name,
            g.labels.join(" "),
            g.athletes.length,
            g.athletes[0],
          ]),
        })),
      },
      null,
      1,
    ).slice(0, 4000),
  );
  const sb = await scoreboard(league);
  console.log(`${league} scoreboard: ${sb.length} games`, sb.slice(0, 3));
}

if (process.argv[1]?.endsWith("halftime.mjs")) {
  const s = opt("sample", "");
  (s ? sample(s) : main()).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
export { trim, sgoTeamId, fileOf };
