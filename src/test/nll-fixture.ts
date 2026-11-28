/** Re-exports for the NLL tests, plus a small game builder. */
export * from "@/lib/nll/nll";
import type { NllGame } from "@/lib/nll/nll";

export function mapGameForTest(
  id: string,
  date: string,
  home: string,
  away: string,
  hs: number | null,
  as: number | null,
  status: NllGame["status"],
): NllGame {
  return {
    id,
    date,
    status,
    detail: "",
    phase: "regular",
    home: { teamId: home, score: hs },
    away: { teamId: away, score: as },
    ot: false,
  };
}
