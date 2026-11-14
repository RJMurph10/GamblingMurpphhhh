import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchPllSeason } from "./pll.server";

/** A PLL year's games (with scores by quarter) and teams, from ESPN. */
export const getPllSeason = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ season: z.number().int().min(2019).max(2100) }).parse(data))
  .handler(async ({ data }) => fetchPllSeason(data.season));
