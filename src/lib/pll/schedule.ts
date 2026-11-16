/**
 * Where and in which week each PLL game was played, from the schedules the site owner enters from the
 * PLL site (src/data/pll-<season>-schedule.json; 2026 regular season so far). The PLL plays each week's
 * games at one host city ("Week 3 · Baltimore, MD").
 */
import s2026 from "@/data/pll-2026-schedule.json";

export interface PllWeek {
  week: number;
  /** "May 8 - May 9" as the PLL lists it. */
  dates: string;
  city: string;
  allStar: boolean;
}

const BY_ID = new Map<string, PllWeek>();
for (const w of s2026.weeks) {
  const info: PllWeek = { week: w.week, dates: w.dates, city: w.city, allStar: w.allStar };
  for (const g of w.games) if (g.espnId) BY_ID.set(g.espnId, info);
}

/** The week and host city of a game, by ESPN event id (undefined when not entered). */
export const pllWeekOf = (espnId: string): PllWeek | undefined => BY_ID.get(espnId);

/** Every entered week of a season, in order. */
export const pllWeeks = (season: number) =>
  season === 2026
    ? s2026.weeks.map((w) => ({ week: w.week, dates: w.dates, city: w.city, allStar: w.allStar }))
    : [];
