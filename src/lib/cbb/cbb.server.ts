/**
 * Server-only men's college basketball data (Division I):
 *  - finished games with closing lines from the season file the hourly line saver publishes
 *    (props-site branch, cbb/season-YYYY-YY.json, built by scripts/cbb/build-season.mjs);
 *  - live and upcoming games straight from ESPN's scoreboard (yesterday through the next week);
 *  - one game's box score and play-by-play, a team's roster, the AP Top 25.
 * Missing data stays missing: no sample games, scores or lines are ever substituted.
 */
import {
  cbbLogoFor,
  type CbbBoxTeam,
  type CbbConference,
  type CbbGame,
  type CbbGameDetail,
  type CbbOdds,
  type CbbPlay,
  type CbbRosterPlayer,
  type CbbSchedule,
  type CbbStatus,
  type CbbTeamRef,
} from "./cbb";
import { readFinal, writeFinal } from "../shared/final-cache.server";
import { american, lineNum, num, parseEvent, parseOdds, teamRefFrom } from "./cbb-parse";
export { oddsSwapped, parseEvent, parseOdds } from "./cbb-parse";
import { possessionFromSummary } from "../shared/basketball-possession";
import { buildBasketballProbabilities, type BasketballRules } from "../nba/nba-probabilities";

const SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";
const CORE =
  "https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball";
const FILES = "https://raw.githubusercontent.com/RJMurph10/gamblingnfl/props-site/cbb";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = load()
    .then((value) => {
      cache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function fetchJson(url: string, timeoutMs = 15_000): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "GamblingNFL/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`ESPN college basketball feed failed [${res.status}] for ${url}`);
  return res.json();
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

/** The college basketball season shown: it starts in November, so until July it's last year's. */
export function cbbSeasonLabel(now = new Date()): string {
  const y = now.getUTCMonth() + 1 <= 7 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  return `${y}-${String(y + 1).slice(2)}`;
}

/* ---------- teams and conferences (from the season file) ---------- */

interface SeasonFile {
  updated?: string;
  season?: string;
  conferences?: Record<string, [string, string]>;
  teams?: Record<string, [string, string, string, string, string, string, string]>;
  /** …, line, note ("" when none), location ("City, ST"). */
  games?: [
    string,
    string,
    string,
    number,
    string,
    number,
    number,
    number,
    number,
    (number | null)[] | null,
    string?,
    string?,
    (number | null)?,
    ((number | null)[] | null)?,
  ][];
  /** Opening [homeSpread, total] of live and upcoming games. */
  opens?: Record<string, (number | null)[]>;
  /** Pregame lines of live and upcoming games, by game id (same layout as a game's line). */
  lines?: Record<string, (number | null)[]>;
}

function teamFromFile(
  id: string,
  t: SeasonFile["teams"] extends Record<string, infer V> | undefined ? V : never,
): CbbTeamRef {
  const color = String(t[4] ?? "").replace("#", "");
  return {
    id,
    abbr: t[0] || "---",
    name: t[1] || t[0],
    short: t[2] || t[1] || t[0],
    nickname: t[3] || "",
    color: /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : "#8899aa",
    logo: t[5] || cbbLogoFor(id),
    confId: t[6] ?? "",
  };
}

function loadSeasonFile(label: string): Promise<SeasonFile | null> {
  return cached(`season-file-${label}`, 5 * MINUTE, async () => {
    try {
      const res = await fetch(`${FILES}/season-${label}.json`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return null;
      return (await res.json()) as SeasonFile;
    } catch {
      return null;
    }
  });
}

function fetchDay(day: Date): Promise<CbbGame[]> {
  const today = ymd(new Date());
  const key = ymd(day);
  const ttl = key === today ? 15_000 : key < today ? 2 * MINUTE : 10 * MINUTE;
  return cached(`day-${key}`, ttl, async () => {
    const json = await fetchJson(`${SITE}/scoreboard?dates=${key}&groups=50&limit=1000`);
    return (Array.isArray(json?.events) ? json.events : [])
      .map((ev: any) => {
        try {
          return parseEvent(ev);
        } catch {
          return null;
        }
      })
      .filter((g: CbbGame | null): g is CbbGame => g !== null)
      .map((g: CbbGame) => {
        // ESPN drops the line at tip-off: remember the last pregame line and keep showing it
        if (g.status === "scheduled" && g.odds) pregame.set(g.id, g.odds);
        else if (!g.odds?.spread && pregame.has(g.id))
          return { ...g, odds: mergeOdds(g.odds, pregame.get(g.id)) };
        return g;
      });
  });
}

/** Each game's last pregame line seen on the scoreboard (this server's memory). */
const pregame = new Map<string, CbbOdds>();

/* ---------- the schedule ---------- */

function gameFromRow(
  row: NonNullable<SeasonFile["games"]>[number],
  teams: Map<string, CbbTeamRef>,
): CbbGame {
  const [
    id,
    date,
    hId,
    hScore,
    aId,
    aScore,
    neutral,
    conf,
    type,
    line,
    note,
    location,
    possessions,
    open,
  ] = row;
  const team = (tid: string) =>
    teams.get(tid) ?? {
      id: tid,
      abbr: "---",
      name: "Unknown",
      short: "Unknown",
      nickname: "",
      color: "#8899aa",
      logo: cbbLogoFor(tid),
      confId: "",
    };
  const odds: CbbOdds | undefined = line
    ? {
        spread: line[0] ?? null,
        total: line[1] ?? null,
        mlHome: line[2] ?? null,
        mlAway: line[3] ?? null,
        spreadOddsHome: line[4] ?? null,
        spreadOddsAway: line[5] ?? null,
        overOdds: line[6] ?? null,
        underOdds: line[7] ?? null,
      }
    : undefined;
  return {
    id,
    date,
    status: "final",
    statusDetail: "Final",
    period: 2,
    clock: "0:00",
    part: type === 3 ? "post" : "reg",
    neutral: Boolean(neutral),
    conference: Boolean(conf),
    ...(note ? { note } : {}),
    ...(location ? { location } : {}),
    ...(possessions ? { possessions } : {}),
    ...(open && (open[0] != null || open[1] != null)
      ? { open: { spread: open[0] ?? null, total: open[1] ?? null } }
      : {}),
    away: { team: team(aId), score: aScore, periods: [] },
    home: { team: team(hId), score: hScore, periods: [] },
    ...(odds ? { odds } : {}),
  };
}

/** Lines ESPN still shows win; the stored closing line fills what's missing. */
function mergeOdds(live: CbbOdds | undefined, stored: CbbOdds | undefined): CbbOdds | undefined {
  if (!stored) return live;
  if (!live) return stored;
  const out: CbbOdds = { ...stored };
  for (const [k, v] of Object.entries(live))
    if (v != null) (out as unknown as Record<string, unknown>)[k] = v;
  return out;
}

/**
 * Division I conferences ESPN's conference list leaves out: since November 2026 /groups stops after 25
 * conferences (alphabetically at the SEC), so these seven are added by ESPN's numeric id, which is what the
 * scoreboard tags their teams with. Without them their teams look like non-Division I schools.
 */
const MISSING_D1: CbbConference[] = [
  { id: "24", name: "Southern Conference", short: "SoCon" },
  { id: "25", name: "Southland Conference", short: "Southland" },
  { id: "26", name: "Southwestern Athletic Conference", short: "SWAC" },
  { id: "49", name: "Summit League", short: "Summit" },
  { id: "27", name: "Sun Belt Conference", short: "Sun Belt" },
  { id: "29", name: "West Coast Conference", short: "WCC" },
  { id: "30", name: "Western Athletic Conference", short: "WAC" },
];

/** Division I conferences and their teams, straight from ESPN (cached for 12 hours). */
function loadConferences(): Promise<{ conferences: CbbConference[]; teams: CbbTeamRef[] }> {
  return cached("conferences", 12 * HOUR, async () => {
    const json = await fetchJson(`${SITE}/groups`);
    const conferences: CbbConference[] = [];
    const teams: CbbTeamRef[] = [];
    for (const conf of json?.groups?.[0]?.children ?? []) {
      const id = String(conf?.id ?? conf?.uid?.split("~g:")[1] ?? conf?.abbreviation ?? "");
      if (!id) continue;
      const name = String(conf.name ?? "");
      conferences.push({
        id,
        name,
        short: String(conf.shortName ?? name.replace(/\s+Conference$/i, "")),
      });
      for (const t of conf.teams ?? []) teams.push(teamRefFrom(t, id));
    }
    return { conferences, teams };
  });
}

async function loadSchedule(): Promise<CbbSchedule> {
  const season = cbbSeasonLabel();
  const now = new Date();
  const days: Date[] = [];
  for (let d = -1; d <= 7; d++) days.push(new Date(now.getTime() + d * DAY));
  const [file, groups, ...live] = await Promise.all([
    loadSeasonFile(season),
    loadConferences().catch(() => ({
      conferences: [] as CbbConference[],
      teams: [] as CbbTeamRef[],
    })),
    ...days.map((d) => fetchDay(d).catch(() => [] as CbbGame[])),
  ]);
  const teams = new Map<string, CbbTeamRef>();
  // ESPN's conference list first (every D-I team, even before it plays), then the season file
  for (const t of groups.teams) teams.set(t.id, t);
  for (const [id, t] of Object.entries(file?.teams ?? {})) {
    const known = teams.get(id);
    const fromFile = teamFromFile(id, t);
    teams.set(
      id,
      known ? { ...fromFile, ...known, confId: known.confId || fromFile.confId } : fromFile,
    );
  }
  const listed: CbbConference[] = groups.conferences.length
    ? groups.conferences
    : Object.entries(file?.conferences ?? {}).map(([id, [name, short]]) => ({ id, name, short }));
  const conferences: CbbConference[] = [
    ...listed,
    ...MISSING_D1.filter((c) => !listed.some((l) => l.id === c.id)),
  ];

  const byId = new Map<string, CbbGame>();
  for (const row of file?.games ?? []) byId.set(row[0], gameFromRow(row, teams));
  const liveGames = live.flat();
  if (!file && !liveGames.length) throw new Error("ESPN college basketball schedule unavailable");
  for (const g of liveGames) {
    // the season file's team details (conference, colors) win; ESPN's live data fills the rest
    for (const side of [g.home, g.away]) {
      const known = teams.get(side.team.id);
      if (known)
        side.team = {
          ...side.team,
          confId: known.confId || side.team.confId,
          color: known.color,
          logo: known.logo || side.team.logo,
        };
      else teams.set(side.team.id, side.team);
    }
    const stored = byId.get(g.id);
    byId.set(g.id, {
      ...g,
      odds: mergeOdds(g.odds, stored?.odds),
      ...(stored?.possessions ? { possessions: stored.possessions } : {}),
      ...(stored?.open ? { open: stored.open } : {}),
    });
  }
  // Live and just-finished games: ESPN's scoreboard drops the line at tip-off, so use the hourly line
  // saver's last pregame line (one file, no per-game requests).
  for (const [id, g] of byId) {
    const o = file?.opens?.[id];
    if (o && !g.open) byId.set(id, { ...g, open: { spread: o[0] ?? null, total: o[1] ?? null } });
  }
  for (const [id, g] of byId) {
    const line = file?.lines?.[id];
    if (!line || (g.odds?.spread != null && g.odds?.total != null)) continue;
    const saved: CbbOdds = {
      spread: line[0] ?? null,
      total: line[1] ?? null,
      mlHome: line[2] ?? null,
      mlAway: line[3] ?? null,
      spreadOddsHome: line[4] ?? null,
      spreadOddsAway: line[5] ?? null,
      overOdds: line[6] ?? null,
      underOdds: line[7] ?? null,
    };
    byId.set(id, { ...g, odds: mergeOdds(g.odds, saved) });
  }
  // only the recent days: older games without a line in the season file never had one
  const recent = [...byId.values()].filter((g) => Date.parse(g.date) > now.getTime() - 3 * DAY);
  await withClosingOdds(recent);
  // Who has the ball: live games read it from the game summary (cached and shared with the game page).
  await Promise.all(
    [...byId.values()]
      .filter((g) => g.status === "live" && !g.possessionTeamId)
      .slice(0, 30)
      .map(async (g) => {
        try {
          const detail = await fetchCbbGameDetail(g.id);
          if (detail.game.possessionTeamId)
            byId.set(g.id, { ...byId.get(g.id)!, possessionTeamId: detail.game.possessionTeamId });
        } catch {
          // no ball icon for this game
        }
      }),
  );
  // Games against schools outside Division I (D-II, D-III, NAIA): kept and labeled, but the dashboard
  // leaves them out and the model gives them little weight. A team is D-I when it's in a D-I conference.
  const d1 = new Set(
    [...teams.values()]
      .filter((t) => t.confId && conferences.some((c) => c.id === t.confId))
      .map((t) => t.id),
  );
  if (d1.size) {
    for (const [id, g] of byId) {
      if (!d1.has(g.home.team.id) || !d1.has(g.away.team.id))
        byId.set(id, { ...g, nonDivisionI: true });
    }
  }
  return {
    season,
    games: [...byId.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    ),
    teams: [...teams.values()],
    conferences,
    updated: file?.updated ?? null,
  };
}

/* ---------- closing lines for started games ---------- */

// ESPN's scoreboard drops the lines once a game tips off, and the season file only has games the
// hourly line saver has finished with. Started games missing a line get it from ESPN's core odds
// feed (DraftKings first, then ESPN BET, then any book; never a live in-game line), a bounded
// number per load, newest first.
const oddsLookups = new Map<string, { at: number; odds: CbbOdds | null }>();
const LOOKUPS_PER_LOAD = 12;

async function loadClosingOdds(
  id: string,
  home: { id: string; abbr: string },
): Promise<CbbOdds | null> {
  const list = await fetchJson(`${CORE}/events/${id}/competitions/${id}/odds?limit=50`);
  const items: any[] = await Promise.all(
    (Array.isArray(list?.items) ? list.items : []).map((it: any) =>
      it?.$ref && Object.keys(it).length === 1 ? fetchJson(it.$ref).catch(() => null) : it,
    ),
  );
  const rank = (b: any) => {
    const pid = String(b?.provider?.id ?? "");
    return ["100", "40"].includes(pid) ? 0 : pid === "58" ? 1 : 2;
  };
  const books = items
    .filter(Boolean)
    .filter((b) => !/live|accuscore|numberfire|teamrankings/i.test(String(b?.provider?.name ?? "")))
    .sort((a, b) => rank(a) - rank(b));
  let fallback: CbbOdds | null = null;
  for (const b of books) {
    const o = parseOdds(b, home);
    if (!o) continue;
    if (o.spread !== null && o.total !== null) return o;
    fallback ??= o;
  }
  return fallback;
}

async function closingOdds(g: CbbGame): Promise<CbbOdds | null> {
  const hit = oddsLookups.get(g.id);
  const ttl = hit?.odds ? 12 * HOUR : g.status === "live" ? 2 * MINUTE : 10 * MINUTE;
  if (hit && Date.now() - hit.at < ttl) return hit.odds;
  const odds = await loadClosingOdds(g.id, { id: g.home.team.id, abbr: g.home.team.abbr }).catch(
    () => null,
  );
  oddsLookups.set(g.id, { at: Date.now(), odds });
  return odds;
}

async function withClosingOdds(games: CbbGame[]): Promise<void> {
  const missing = games
    .filter(
      (g) =>
        (g.status === "live" || g.status === "final") &&
        (g.odds?.spread == null || g.odds?.total == null),
    )
    .sort(
      (a, b) =>
        (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) ||
        b.date.localeCompare(a.date),
    );
  const known = missing.filter((g) => oddsLookups.has(g.id));
  const todo = [
    ...known,
    ...missing.filter((g) => !oddsLookups.has(g.id)).slice(0, LOOKUPS_PER_LOAD),
  ];
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < todo.length) {
        const g = todo[next++];
        const o = await closingOdds(g);
        if (o) g.odds = mergeOdds(g.odds, o);
      }
    }),
  );
}

export function fetchCbbSchedule(): Promise<CbbSchedule> {
  return cached("schedule", 15_000, loadSchedule);
}

/** AP Top 25: team id → rank. */
export function fetchCbbRankings(): Promise<Record<string, number>> {
  return cached("rankings", HOUR, async () => {
    const json = await fetchJson(`${SITE}/rankings`);
    const ap =
      (json?.rankings ?? []).find((r: any) => /AP/i.test(String(r?.name ?? ""))) ??
      json?.rankings?.[0];
    const out: Record<string, number> = {};
    for (const r of ap?.ranks ?? []) {
      const id = r?.team?.id;
      const rank = num(r?.current);
      if (id && rank) out[String(id)] = rank;
    }
    return out;
  });
}

/* ---------- one game ---------- */

export async function fetchCbbGameDetail(gameId: string): Promise<CbbGameDetail> {
  const key = `cbb-game-v2-${gameId}`;
  const stored = await readFinal<CbbGameDetail>(key);
  if (stored) return stored;
  const detail = await cached(`game-${gameId}`, 15_000, () => loadGameDetail(gameId));
  if (detail.game.status === "final") await writeFinal(key, detail);
  return detail;
}

async function loadGameDetail(gameId: string): Promise<CbbGameDetail> {
  const json = await fetchJson(`${SITE}/summary?event=${gameId}`);
  const header = json?.header;
  const comp = header?.competitions?.[0];
  const game = parseEvent({
    id: header?.id ?? gameId,
    date: comp?.date,
    status: comp?.status,
    season: header?.season,
    competitions: [
      { ...comp, notes: header?.gameNote ? [{ headline: header.gameNote }] : comp?.notes },
    ],
  });
  if (!game) throw new Error("ESPN returned no game for this id");
  if (!game.venue && json?.gameInfo?.venue?.fullName)
    game.venue = String(json.gameInfo.venue.fullName);
  for (const pick of Array.isArray(json?.pickcenter) ? json.pickcenter : []) {
    const o = parseOdds(pick, { id: game.home.team.id, abbr: game.home.team.abbr });
    if (o) {
      game.odds = mergeOdds(game.odds, o);
      if (game.odds?.spread != null && game.odds?.total != null) break;
    }
  }
  // the season file's closing line, when ESPN no longer shows one
  if (game.status === "final" && (game.odds?.spread == null || game.odds?.total == null)) {
    const file = await loadSeasonFile(cbbSeasonLabel(new Date(game.date)));
    const row = file?.games?.find((r) => r[0] === game.id);
    if (row?.[9]) game.odds = mergeOdds(game.odds, gameFromRow(row, new Map()).odds);
  }

  const teams: any[] = json?.boxscore?.teams ?? [];
  const awayBox = teams.find((t) => String(t?.team?.id) === game.away.team.id) ?? teams[0];
  const homeBox = teams.find((t) => String(t?.team?.id) === game.home.team.id) ?? teams[1];
  const teamStats = (awayBox?.statistics ?? [])
    .map((s: any) => {
      const mate = (homeBox?.statistics ?? []).find((x: any) => x?.name === s?.name) ?? {};
      return {
        label: String(s?.label ?? s?.name ?? ""),
        away: String(s?.displayValue ?? "—"),
        home: String(mate?.displayValue ?? "—"),
      };
    })
    .filter((l: { label: string }) => l.label);

  const box: CbbBoxTeam[] = (json?.boxscore?.players ?? []).map((t: any) => {
    const grp = t?.statistics?.[0] ?? {};
    return {
      teamId: String(t?.team?.id ?? ""),
      abbr: String(t?.team?.abbreviation ?? ""),
      labels: (grp?.labels ?? grp?.names ?? []).map(String),
      players: (grp?.athletes ?? []).map((p: any) => ({
        id: String(p?.athlete?.id ?? ""),
        name: String(p?.athlete?.displayName ?? p?.athlete?.shortName ?? "Unknown"),
        ...(p?.athlete?.jersey ? { jersey: String(p.athlete.jersey) } : {}),
        ...(p?.athlete?.position?.abbreviation
          ? { position: String(p.athlete.position.abbreviation) }
          : {}),
        starter: Boolean(p?.starter),
        ...(p?.didNotPlay ? { dnp: String(p?.reason || "DNP") } : {}),
        stats: (p?.stats ?? []).map(String),
      })),
      totals: (grp?.totals ?? []).map(String),
    };
  });

  const rawPlays: any[] = Array.isArray(json?.plays) ? json.plays : [];
  if (game.status === "live") {
    const ball = possessionFromSummary(json, game, rawPlays);
    if (ball) game.possessionTeamId = ball;
  }
  const plays: CbbPlay[] = rawPlays.map((p: any, i: number) => ({
    id: String(p?.id ?? i),
    period: Number(p?.period?.number ?? 0) || 0,
    clock: String(p?.clock?.displayValue ?? ""),
    text: String(p?.text ?? p?.shortDescription ?? ""),
    ...(p?.team?.id ? { teamId: String(p.team.id) } : {}),
    awayScore: num(p?.awayScore),
    homeScore: num(p?.homeScore),
    scoring: Boolean(p?.scoringPlay),
    scoreValue: Number(p?.scoreValue ?? 0) || 0,
    ...shotSpot(p),
  }));
  const samples = (json?.winprobability ?? [])
    .map((w: any) => ({
      homeWinPercentage: num(w?.homeWinPercentage),
      playId: w?.playId ? String(w.playId) : undefined,
    }))
    .filter((w: { homeWinPercentage: number | null }) => w.homeWinPercentage !== null) as {
    homeWinPercentage: number;
    playId?: string;
  }[];
  const winProb: number[] = samples.map((w) => w.homeWinPercentage);
  // the pregame line (the season file's, when ESPN's summary no longer has one) for the cover / total chart
  if (game.odds?.spread == null || game.odds?.total == null) {
    const file = await loadSeasonFile(cbbSeasonLabel(new Date(game.date))).catch(() => null);
    const line = file?.lines?.[game.id] ?? file?.games?.find((r) => r[0] === game.id)?.[9];
    if (line)
      game.odds = mergeOdds(game.odds, {
        spread: line[0] ?? null,
        total: line[1] ?? null,
        mlHome: line[2] ?? null,
        mlAway: line[3] ?? null,
        spreadOddsHome: line[4] ?? null,
        spreadOddsAway: line[5] ?? null,
        overOdds: line[6] ?? null,
        underOdds: line[7] ?? null,
      });
  }
  const probabilities = buildBasketballProbabilities(samples, plays, game, CBB_RULES);
  const leaders = (json?.leaders ?? []).flatMap((t: any) =>
    (t?.leaders ?? []).map((c: any) => ({
      teamId: String(t?.team?.id ?? ""),
      category: String(c?.displayName ?? c?.name ?? ""),
      name: String(c?.leaders?.[0]?.athlete?.displayName ?? ""),
      value: String(c?.leaders?.[0]?.displayValue ?? ""),
      ...(c?.leaders?.[0]?.athlete?.id ? { playerId: String(c.leaders[0].athlete.id) } : {}),
    })),
  );
  return { game, teamStats, box, plays, winProb, probabilities, leaders };
}

/** Where a shot was taken: ESPN's court spot (feet across 0–50, from the baseline). */
function shotSpot(p: any): { shot?: { x: number; y: number } } {
  const x = Number(p?.coordinate?.x);
  const y = Number(p?.coordinate?.y);
  if (!p?.shootingPlay || !Number.isFinite(x) || !Number.isFinite(y)) return {};
  if (x < 0 || x > 50 || y < -6 || y > 94) return {};
  return { shot: { x, y } };
}

/**
 * Two 20-minute halves, 5-minute overtimes. The rest-of-game spreads are a little smaller than the
 * NBA's: closing college lines miss the final margin by about 11 points and the total by about 16.
 */
const CBB_RULES: BasketballRules = {
  periods: 2,
  periodSeconds: 1200,
  otSeconds: 300,
  marginSd: 12.5,
  totalSd: 16,
  lateTotalVar: 30,
  lateMarginVar: 8,
};

/* ---------- a team's roster ---------- */

export function fetchCbbRoster(teamId: string): Promise<CbbRosterPlayer[]> {
  return cached(`roster-${teamId}`, 6 * HOUR, async () => {
    const json = await fetchJson(`${SITE}/teams/${teamId}/roster`);
    const groups: any[] = Array.isArray(json?.athletes) ? json.athletes : [];
    const list = groups.flatMap((g) => (Array.isArray(g?.items) ? g.items : [g]));
    return list
      .filter((a: any) => a?.id)
      .map((a: any) => ({
        id: String(a.id),
        name: String(a.displayName ?? a.fullName ?? ""),
        ...(a.jersey ? { jersey: String(a.jersey) } : {}),
        ...(a.position?.abbreviation ? { position: String(a.position.abbreviation) } : {}),
        ...(a.displayHeight ? { height: String(a.displayHeight) } : {}),
        ...(a.experience?.displayValue ? { year: String(a.experience.displayValue) } : {}),
        ...(a.birthPlace?.city
          ? { hometown: [a.birthPlace.city, a.birthPlace.state].filter(Boolean).join(", ") }
          : {}),
      }));
  });
}
