/**
 * Where and in which week each PLL game was played, from the schedules the site owner enters from the
 * PLL site (src/data/pll-<season>-schedule.json; 2026 regular season and playoffs). The PLL plays each week's
 * games at one host city ("Week 3 · Baltimore, MD").
 */
import s2026 from "@/data/pll-2026-schedule.json";

export interface PllWeek {
  week: number;
  /** "Regular season", "All-Star", "Quarterfinals", "Semifinals", "Championship". */
  round: string;
  /** What to show: "Week 3", or the round's name in the playoffs ("Semifinals"). */
  label: string;
  /** "May 8 - May 9" as the PLL lists it. */
  dates: string;
  city: string;
  allStar: boolean;
}

const BY_ID = new Map<string, PllWeek>();
const toWeek = (w: (typeof s2026.weeks)[number]): PllWeek => ({
  week: w.week,
  round: w.round,
  label: w.round === "Regular season" ? `Week ${w.week}` : w.round,
  dates: w.dates,
  city: w.city,
  allStar: w.allStar,
});
for (const w of s2026.weeks) {
  const info = toWeek(w);
  for (const g of w.games) if (g.espnId) BY_ID.set(g.espnId, info);
}

/** The week and host city of a game, by ESPN event id (undefined when not entered). */
export const pllWeekOf = (espnId: string): PllWeek | undefined => BY_ID.get(espnId);

/** Every entered week of a season, in order. */
export const pllWeeks = (season: number): PllWeek[] =>
  season === 2026 ? s2026.weeks.map(toWeek) : [];
