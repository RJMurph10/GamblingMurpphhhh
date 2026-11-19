/**
 * Where and in which week each PLL game was played, from the schedules the site owner enters from the
 * PLL site (src/data/pll-<season>-schedule.json; 2021 regular season; 2022-2026 regular season and playoffs). The PLL plays each week's
 * games at one host city ("Week 3 · Baltimore, MD").
 */
import s2021 from "@/data/pll-2021-schedule.json";
import s2022 from "@/data/pll-2022-schedule.json";
import s2023 from "@/data/pll-2023-schedule.json";
import s2024 from "@/data/pll-2024-schedule.json";
import s2025 from "@/data/pll-2025-schedule.json";
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
const TV = new Map<string, string[]>();
const toWeek = (w: (typeof s2026.weeks)[number]): PllWeek => ({
  week: w.week,
  round: w.round,
  label: w.round === "Regular season" ? `Week ${w.week}` : w.round,
  dates: w.dates,
  city: w.city,
  allStar: w.allStar,
});
const SEASONS: Record<number, (typeof s2026.weeks)[number][]> = {
  // 2024 has an All-Star week with no games (ESPN never recorded the game)
  2021: s2021.weeks as unknown as (typeof s2026.weeks)[number][],
  2022: s2022.weeks as unknown as (typeof s2026.weeks)[number][],
  2023: s2023.weeks as unknown as (typeof s2026.weeks)[number][],
  2024: s2024.weeks as unknown as (typeof s2026.weeks)[number][],
  2025: s2025.weeks,
  2026: s2026.weeks,
};
for (const weeks of Object.values(SEASONS))
  for (const w of weeks) {
    const info = toWeek(w);
    for (const g of w.games) {
      if (!g.espnId) continue;
      BY_ID.set(g.espnId, info);
      const tv = (g as { tv?: string[] }).tv;
      if (tv?.length) TV.set(g.espnId, tv);
    }
  }

/** The week and host city of a game, by ESPN event id (undefined when not entered). */
export const pllWeekOf = (espnId: string): PllWeek | undefined => BY_ID.get(espnId);

/** Where a game aired ("ABC", "ESPN+"), by ESPN event id, when the owner's schedule lists it. */
export const pllTvOf = (espnId: string): string[] | undefined => TV.get(espnId);

/** Every entered week of a season, in order. */
export const pllWeeks = (season: number): PllWeek[] => (SEASONS[season] ?? []).map(toWeek);
