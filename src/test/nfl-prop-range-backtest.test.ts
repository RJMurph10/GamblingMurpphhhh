/**
 * Builds the replay that calibrates the NFL prop ranges (research/props/nfl_prop_range_calibrate.py).
 * Skipped in normal test runs. To rebuild:
 *   1. Slim nflverse's stats_player_week_<year>.csv files to /tmp/sp<year>s.csv (columns in
 *      scripts/nfl/prop-range-backtest.ts).
 *   2. CALIBRATE=1 npx vitest run src/test/nfl-prop-range-backtest.test.ts  → /tmp/propbt.json
 *   3. python3 research/props/nfl_prop_range_calibrate.py 0.70 → /tmp/cal.json, then copy into
 *      src/data/nfl/prop-range-calibration.json (bump "version").
 */
import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { recordsOf, backtestSeason } from "../../scripts/nfl/prop-range-backtest";

it.skipIf(!process.env.CALIBRATE)(
  "replays the prop projections on nflverse weekly stats",
  () => {
    const rec = (y: number) => recordsOf(readFileSync(`/tmp/sp${y}s.csv`, "utf8"));
    const r = { 2023: rec(2023), 2024: rec(2024), 2025: rec(2025), 2026: rec(2026) };
    const pts = [
      ...backtestSeason(2024, r[2024], r[2023]),
      ...backtestSeason(2025, r[2025], r[2024]),
      ...backtestSeason(2026, r[2026], r[2025]),
    ];
    writeFileSync("/tmp/propbt.json", JSON.stringify(pts));
  },
  900_000,
);
