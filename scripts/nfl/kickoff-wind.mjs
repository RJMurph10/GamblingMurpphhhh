#!/usr/bin/env node
/**
 * Kickoff wind for NFL games nflverse didn't record weather for.
 *
 * nflverse's games.csv carries the wind reported at kickoff, and the ★ wind-under best bet (10+ mph,
 * outdoor) is graded on it. In 2026 it stopped filling wind after week 4 (and ~1 in 6 outdoor games
 * 2022-25 have none), so those games could never show a graded wind bet. This fills the gaps from the
 * Open-Meteo hourly record at the stadium: wind at 10 m at the kickoff hour, scaled by 1.09 to read like
 * the reported wind (2000-20: Open-Meteo averages 7.7 mph where nflverse reports 8.4; see the project doc
 * nfl-stadium-wind.md). Also the kickoff temperature when nflverse has none.
 *
 *   node scripts/nfl/kickoff-wind.mjs <out.json> [firstSeason=2022]
 *
 * Only regular-season, finished, outdoor / open-roof games with no nflverse wind. Games older than 6
 * days come from the archive (ERA5); newer ones from Open-Meteo's forecast API, which serves the recent
 * past from its analysis. Existing entries are kept, except recent ones, which are refreshed from the
 * archive once it has them (the "source" field says which).
 */
import { readFile, writeFile } from "node:fs/promises";

const [OUT = "kickoff-wind.json", FIRST = "2022"] = process.argv.slice(2);
const FACTOR = 1.09;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Stadium coordinates by nflverse stadium_id (outdoor and open-roof parks). */
const STADIUMS = {
  ATL97: [33.7556, -84.4], BAL00: [39.2781, -76.6228], BOS00: [42.091, -71.264], BOS99: [42.0927, -71.2674],
  BRG00: [30.4119, -91.1856], BUF00: [42.774, -78.787], CAR00: [35.2258, -80.8528], CHI98: [41.8623, -87.6167],
  CHI99: [40.0992, -88.2358], CIN00: [39.095, -84.516], CLE00: [41.5061, -81.6994], DAL00: [32.7478, -97.0928],
  DAL99: [32.84, -96.911], DEN00: [39.7439, -105.02], DEN99: [39.7461, -105.0217], GNB00: [44.5013, -88.0622],
  HOU00: [29.6847, -95.4108], IND00: [39.7601, -86.1628], JAX00: [30.3239, -81.6375], KAN00: [39.0489, -94.4839],
  LAX97: [33.864, -118.261], LAX99: [34.0142, -118.2878], LON00: [51.5558, -0.2797], LON01: [51.4561, -0.3417],
  LON02: [51.6044, -0.0664], MEX00: [19.3029, -99.1504], MIA00: [25.9581, -80.2389], MIN98: [44.976, -93.225],
  NAS00: [36.1664, -86.7714], NYC00: [40.8122, -74.0769], NYC01: [40.8135, -74.0744], OAK00: [37.7517, -122.2006],
  PHI00: [39.9008, -75.1675], PHI99: [39.9067, -75.1711], PHO00: [33.528, -112.263], PHO99: [33.4264, -111.9325],
  PIT00: [40.4467, -80.0158], PIT99: [40.4467, -80.0128], SDG00: [32.7831, -117.1194], SEA00: [47.5952, -122.3316],
  SEA99: [47.6503, -122.3017], SFO00: [37.7136, -122.3861], SFO01: [37.403, -121.97], TAM00: [27.9758, -82.5033],
  WAS00: [38.9078, -76.8644], FRA00: [50.0686, 8.6455], GER00: [48.2188, 11.6247], SAO00: [-23.5453, -46.4742],
  RIO00: [-22.9122, -43.2302], MAD00: [40.4531, -3.6883], DUB00: [53.3354, -6.2286],
};

async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (r.ok) return await r.json();
      if (r.status === 429) await new Promise((res) => setTimeout(res, 20000 * (i + 1)));
    } catch {
      // retry
    }
    await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
  }
  return null;
}

/** "2024-09-08" + "13:00" Eastern → UTC ms (DST by the US rule). */
function kickoffUtc(day, time) {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = (time || "13:00").split(":").map(Number);
  const nthSunday = (month, n) => {
    const first = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + 7 * (n - 1);
  };
  const dstStart = Date.UTC(y, 2, nthSunday(2, 2), 7);
  const dstEnd = Date.UTC(y, 10, nthSunday(10, 1), 6);
  const asEst = Date.UTC(y, m - 1, d, hh + 5, mm);
  return asEst - (asEst >= dstStart && asEst < dstEnd ? HOUR : 0);
}

/** Minimal CSV line split (games.csv quotes only a few empty fields). */
const split = (line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).slice(0, -1).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, ""));

const prev = await readFile(OUT, "utf8").then(JSON.parse).catch(() => ({ games: {} }));
const csv = await (await fetch("https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv")).text();
const [head, ...lines] = csv.trim().split("\n");
const cols = split(head);
const ix = Object.fromEntries(cols.map((c, i) => [c, i]));
const now = Date.now();
const todo = [];
const missingStadiums = new Set();
for (const line of lines) {
  const r = split(line);
  if (r[ix.game_type] !== "REG" || +r[ix.season] < +FIRST || r[ix.home_score] === "") continue;
  if (!["outdoors", "open"].includes(r[ix.roof]) || r[ix.wind] !== "") continue;
  const espn = r[ix.espn];
  const had = prev.games[espn];
  const t = kickoffUtc(r[ix.gameday], r[ix.gametime]);
  if (had && had.source === "archive") continue;
  if (!STADIUMS[r[ix.stadium_id]]) {
    missingStadiums.add(`${r[ix.stadium_id]} ${r[ix.stadium]}`);
    continue;
  }
  todo.push({ id: r[ix.game_id], espn, season: +r[ix.season], stadium: r[ix.stadium_id], t, needTemp: r[ix.temp] === "" });
}
console.log(`${todo.length} games to fill; stadiums without coordinates: ${[...missingStadiums].join("; ") || "none"}`);

const groups = new Map();
for (const g of todo) {
  const recent = now - g.t < 6 * DAY;
  const k = `${g.stadium}|${g.season}|${recent ? "forecast" : "archive"}`;
  groups.set(k, [...(groups.get(k) ?? []), g]);
}
const games = { ...prev.games };
for (const [k, list] of groups) {
  const [sid, , source] = k.split("|");
  const [lat, lon] = STADIUMS[sid];
  const ts = list.map((g) => g.t);
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: new Date(Math.min(...ts) - DAY).toISOString().slice(0, 10),
    end_date: new Date(Math.min(now, Math.max(...ts) + DAY)).toISOString().slice(0, 10),
    hourly: "temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "GMT",
  });
  const base = source === "archive" ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
  const h = (await get(`${base}?${q}`))?.hourly;
  if (!h) {
    console.log("no data", k);
    continue;
  }
  const at = new Map(h.time.map((t, i) => [t.slice(0, 13), i]));
  for (const g of list) {
    const i0 = at.get(new Date(Math.floor(g.t / HOUR) * HOUR).toISOString().slice(0, 13));
    if (i0 === undefined || h.wind_speed_10m[i0] == null) continue;
    const win = [0, 1, 2, 3].map((d) => i0 + d).filter((i) => i < h.time.length);
    games[g.espn] = {
      game: g.id,
      wind: Math.round(h.wind_speed_10m[i0] * FACTOR),
      raw: h.wind_speed_10m[i0],
      gust: Math.max(...win.map((i) => h.wind_gusts_10m[i] ?? 0)),
      precip: Math.round(win.reduce((s, i) => s + (h.precipitation[i] ?? 0), 0) * 1000) / 1000,
      ...(g.needTemp && h.temperature_2m[i0] != null ? { temp: Math.round(h.temperature_2m[i0]) } : {}),
      source,
    };
  }
  await new Promise((res) => setTimeout(res, 700));
}
await writeFile(
  OUT,
  JSON.stringify(
    {
      updated: new Date().toISOString(),
      note: "Kickoff wind (mph, Open-Meteo 10 m wind x 1.09) for finished outdoor NFL games nflverse left without weather; keyed by ESPN game id.",
      factor: FACTOR,
      games,
    },
    null,
    1,
  ),
);
console.log(`wrote ${Object.keys(games).length} games`);
