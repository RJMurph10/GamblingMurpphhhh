// In-game weather (kickoff to +3h) for every outdoor/open-roof NFL regular-season game 2024-2026 from the
// Open-Meteo archive (forecast API for the last days): precipitation total, max wind (x1.09), mean temp.
import { writeFileSync, mkdirSync } from "node:fs";
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
const csv = await (await fetch("https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv")).text();
const [head, ...lines] = csv.trim().split("\n");
const ix = Object.fromEntries(head.split(",").map((k, i) => [k, i]));
const games = lines.map((l) => l.split(",")).filter((r) => +r[ix.season] >= 2024 && r[ix.game_type] === "REG" && r[ix.result] !== "" && ["outdoors", "open"].includes(r[ix.roof]));
const byStadium = {};
for (const r of games) (byStadium[r[ix.stadium_id]] ??= []).push(r);
const out = {};
for (const [sid, rs] of Object.entries(byStadium)) {
  const c = STADIUMS[sid]; if (!c) { console.log("no coords", sid); continue; }
  const dates = rs.map((r) => r[ix.gameday]).sort();
  const start = dates[0], end = dates[dates.length - 1];
  const recentCut = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const url = (base, s, e) => `${base}?latitude=${c[0]}&longitude=${c[1]}&start_date=${s}&end_date=${e}&hourly=precipitation,rain,snowfall,wind_speed_10m,temperature_2m&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=UTC`;
  const hours = {};
  const add = (j) => { const h = j?.hourly; if (!h) return; h.time.forEach((t, i) => { hours[t] = [h.precipitation[i], h.wind_speed_10m[i], h.temperature_2m[i], h.snowfall?.[i] ?? 0]; }); };
  for (const [base, s, e] of [["https://archive-api.open-meteo.com/v1/archive", start, end < recentCut ? end : recentCut], ["https://api.open-meteo.com/v1/forecast", recentCut > start ? recentCut : start, end]]) {
    if (s > e) continue;
    for (let t = 0; t < 4; t++) { try { const r = await fetch(url(base, s, e)); if (r.ok) { add(await r.json()); break; } } catch {} await new Promise((z) => setTimeout(z, 3000 * (t + 1))); }
    await new Promise((z) => setTimeout(z, 1200));
  }
  for (const r of rs) {
    // kickoff in ET -> UTC hour (approx: ET = UTC-4 until early Nov, then UTC-5)
    const [Y, M, D] = r[ix.gameday].split("-").map(Number); const [hh, mm] = r[ix.gametime].split(":").map(Number);
    const off = (M < 11 || (M === 11 && D < 3)) && M > 3 ? 4 : 5;
    const k = Date.UTC(Y, M - 1, D, hh + off, 0);
    let p = 0, snow = 0, w = 0, temps = [], n = 0;
    for (let i = 0; i < 4; i++) { const key = new Date(k + i * 3600000).toISOString().slice(0, 13) + ":00"; const v = hours[key]; if (!v) continue; n++; p += v[0] || 0; w = Math.max(w, v[1] || 0); temps.push(v[2]); snow += v[3] || 0; }
    if (n) out[r[ix.game_id]] = { precip: Math.round(p * 10) / 10, snow: Math.round(snow * 10) / 10, wind: Math.round(w * 1.09), temp: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length), espn: r[ix.espn] };
  }
  console.log(sid, rs.length, Object.keys(out).length);
}
mkdirSync("out", { recursive: true });
writeFileSync("out/nfl-game-weather.json", JSON.stringify(out));
console.log("done", Object.keys(out).length, "of", games.length);
