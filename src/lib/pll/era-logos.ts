/**
 * Logos by era. The clubs used their original "Lacrosse Club" logos through 2023; the league moved to
 * city/state names and new logos in 2024. All owner-supplied, in public/logos (pll-<club>-app.png for
 * 2019-2023, pll-<club>-2024.png from 2024); ESPN's logo is the fallback.
 */
export const ERA_LOGOS: Record<string, [from: number, to: number, logo: string][]> = {
  // From the owner. 2019-2023: the clubs' original PLL logos (the six 2019 clubs, the Waterdogs from 2020,
  // the Cannons from 2021). 2024-2026: the city/state-era logos (the Outlaws replaced Chrome in 2024); the
  // Whipsnakes' 2024-25 logo had gold trim; in 2026 it switched to cyan.
  "127631": [
    [2019, 2023, "/logos/pll-archers-app.png"],
    [2024, 2026, "/logos/pll-archers-2024.png"],
  ],
  "127632": [
    [2019, 2023, "/logos/pll-atlas-app.png"],
    [2024, 2026, "/logos/pll-atlas-2024.png"],
  ],
  "127634": [
    [2019, 2023, "/logos/pll-chaos-app.png"],
    [2024, 2026, "/logos/pll-chaos-2024.png"],
  ],
  "127635": [[2019, 2023, "/logos/pll-chrome-app.png"]],
  "127636": [
    [2019, 2023, "/logos/pll-redwoods-app.png"],
    [2024, 2026, "/logos/pll-redwoods-2024.png"],
  ],
  "127637": [
    [2019, 2023, "/logos/pll-waterdogs-app.png"],
    [2024, 2026, "/logos/pll-waterdogs-2024.png"],
  ],
  "127638": [
    [2019, 2023, "/logos/pll-whipsnakes-app.png"],
    [2024, 2025, "/logos/pll-whipsnakes-2024.png"],
    [2026, 2026, "/logos/pll-whipsnakes-2026.png"],
  ],
  "122896": [[2024, 2026, "/logos/pll-outlaws-2024.png"]],
  "122997": [
    [2019, 2023, "/logos/pll-cannons-app.png"],
    [2024, 2026, "/logos/pll-cannons-2024.png"],
  ],
};

/** A club's logo in a given season (undefined when only ESPN's logo applies). */
export const eraLogo = (teamId: string, season: number): string | undefined =>
  ERA_LOGOS[teamId]?.find(([from, to]) => season >= from && season <= to)?.[2];
