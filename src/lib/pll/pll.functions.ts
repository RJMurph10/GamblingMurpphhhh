import { cached } from "@/lib/shared/espn-core.server";
import type { PllLinesFile } from "./lines";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchPllSeason } from "./pll.server";

/** A PLL year's games (with scores by quarter) and teams, from ESPN. */
export const getPllSeason = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ season: z.number().int().min(2019).max(2100) }).parse(data))
  .handler(async ({ data }) => fetchPllSeason(data.season));

/** PLL game lines saved from The Odds API (props-site lines/pll.json); null before any are saved. */
export const getPllLines = createServerFn({ method: "GET" }).handler(async () =>
  cached(
    "pll-lines",
    async (): Promise<PllLinesFile | null> => {
      try {
        const res = await fetch(
          "https://raw.githubusercontent.com/RJMurph10/gamblingnfl/props-site/lines/pll.json",
          { signal: AbortSignal.timeout(8_000) },
        );
        return res.ok ? ((await res.json()) as PllLinesFile) : null;
      } catch {
        return null;
      }
    },
    10 * 60_000,
  ),
);
