/**
 * ★ NFL best bet: the under on a big-play receiver's receiving yards in rain or wind, plus a tracked
 * QB passing-yards under in wind. Built by scripts/nfl/weather_unders.py (GitHub Actions, daily in season)
 * into props-site/nfl/weather-unders-<season>.json. Research: research/nfl/weather_receivers/ (2024–26,
 * opening lines): WR 79-31, +37.7u at −115; QB wind 46-20, +20.0u. Graded live from November 27, 2026.
 */

/** "wr" = the ★ receiver under; "qb" = the tracked passing-yards under in wind. */
export type WeatherKind = "wr" | "qb";
/** [precip mm, wind mph] from kickoff to three hours after. */
export type WeatherReading = [number, number];
/** [date, game, player, team, kind, line, under price, actual, result, weather, big-play share, live] */
export type WeatherPick = [
  string,
  string,
  string,
  string,
  WeatherKind,
  number,
  number | null,
  number,
  "win" | "loss" | "push",
  WeatherReading | null,
  number | null,
  boolean,
];
/** [date, game, player, team, kind, opening line, under price, current line, forecast, big-play share] */
export type WeatherCandidate = [
  string,
  string,
  string,
  string,
  WeatherKind,
  number,
  number | null,
  number | null,
  WeatherReading,
  number | null,
];
/** wins, losses, pushes, units (1u at the listed price, −115 when none) */
export type WeatherRecord = [number, number, number, number];

export interface WeatherUndersFile {
  season: number;
  updated: string;
  liveFrom: string;
  rule: { bigPlay: number; line: number; rainMm: number; windMph: number };
  record: Record<WeatherKind, { replay: WeatherRecord; live: WeatherRecord }>;
  picks: WeatherPick[];
  upcoming: WeatherCandidate[];
}

/** "rain 2.4 mm · wind 17 mph" — only the parts that triggered the pick, rain first. */
export function weatherText(w: WeatherReading | null, rule?: WeatherUndersFile["rule"]) {
  if (!w) return "";
  const rain = rule?.rainMm ?? 1;
  const wind = rule?.windMph ?? 15;
  const parts = [];
  if (w[0] >= rain) parts.push(`rain ${w[0]} mm`);
  if (w[1] >= wind) parts.push(`wind ${w[1]} mph`);
  return parts.length ? parts.join(" · ") : `rain ${w[0]} mm · wind ${w[1]} mph`;
}
