import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cached } from "@/lib/shared/espn-core.server";
import { fetchNllSeason } from "./nll.server";
import { nllSeasonLabel, type NllLinesFile } from "./nll";

/** An NLL season's games, scores and teams, from ESPN. */
export const getNllSeason = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ season: z.number().int().min(2019).max(2100) }).parse(data))
  .handler(async ({ data }) => fetchNllSeason(data.season));

/** The owner's saved sportsbook lines for a season (props-site nll/lines-<season>.json); null before any. */
export const getNllLines = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ season: z.number().int().min(2019).max(2100) }).parse(data))
  .handler(async ({ data }) =>
    cached(
      `nll-lines-${data.season}`,
      async (): Promise<NllLinesFile | null> => {
        try {
          const res = await fetch(
            `https://raw.githubusercontent.com/RJMurph10/GamblingMurpphhhh/props-site/nll/lines-${nllSeasonLabel(data.season)}.json`,
            { signal: AbortSignal.timeout(8_000) },
          );
          return res.ok ? ((await res.json()) as NllLinesFile) : null;
        } catch {
          return null;
        }
      },
      5 * 60_000,
    ),
  );
