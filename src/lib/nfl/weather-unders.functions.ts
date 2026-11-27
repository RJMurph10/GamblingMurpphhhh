import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { nflSeasonOf } from "./prop-seasons";
import type { WeatherUndersFile } from "./weather-unders";

/** A season's ★ weather receiving unders and tracked QB wind unders (graded picks + this week's forecast spots); the current season when none is given. Null when there's no file. */
export const getWeatherUnders = createServerFn({ method: "GET" })
  .inputValidator((data?: { season?: number }) =>
    z.object({ season: z.number().int().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<WeatherUndersFile | null> => {
    const season = data.season ?? nflSeasonOf();
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/RJMurph10/gamblingnfl/props-site/nfl/weather-unders-${season}.json`,
      );
      return res.ok ? ((await res.json()) as WeatherUndersFile) : null;
    } catch {
      return null;
    }
  });
