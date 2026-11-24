/**
 * What the site's assistant knows about each league's rules: the ★ best bets and the watch list, in plain
 * words. NFL and college football read the site's own rule lists, so they stay in step with the model pages.
 */
import { MODEL_SETTINGS } from "@/lib/shared/game-model";
import { WATCH_ANGLES } from "@/lib/nfl/watch-angles";
import { CFB_RULES, CFB_WATCH } from "@/lib/cfb/cfb-model";

export const ASSISTANT_LEAGUES = ["nfl", "cfb", "nba", "cbb"] as const;
export type AssistantLeague = (typeof ASSISTANT_LEAGUES)[number];

export const LEAGUE_NAME: Record<AssistantLeague, string> = {
  nfl: "NFL",
  cfb: "college football",
  nba: "NBA",
  cbb: "men's college basketball",
};

/** Plain-text rules for one league (★ best bets, then the watch list), for the assistant's get_rules tool. */
export function rulesText(league: AssistantLeague): string {
  if (league === "nfl")
    return [
      "NFL ★ best bets (flat 1 unit at -110):",
      "- underdog: home team getting 7+ points, against the spread.",
      "- bounce: road team against the spread after losing its previous game by 28+.",
      `- wind: the under in outdoor games with ${MODEL_SETTINGS.windUnderMph}+ mph wind at kickoff (forecast before the game; the stadium's weather record after). Best bet early: the total drops as the forecast firms.`,
      "- qb-style (scrambler vs pocket passer): turned OFF in November 2026. QB styles were too subjective and it went 7-18-1 in 2026. Older recorded picks may still carry this tag.",
      "Every game also gets a spread and total lean from the model; those are not best bets. The model's totals currently sit about 1 point over the market on every game, so a total lean alone means little.",
      "NFL watch list (tracked live, not best bets):",
      ...WATCH_ANGLES.map((a) => `- ${a.id}: ${a.title}. Bet: ${a.bet}.`),
    ].join("\n");
  if (league === "cfb")
    return [
      "College football ★ best bets (flat 1 unit at -110; FBS vs FBS):",
      ...CFB_RULES.map((r) => `- ${r.id}: ${r.title}. Bet: ${r.bet}.`),
      "College football watch list (tracked live, not best bets):",
      ...CFB_WATCH.map((r) => `- ${r.id}: ${r.title}. Bet: ${r.bet}.`),
    ].join("\n");
  if (league === "nba")
    return [
      "NBA picks (flat 1 unit at -110):",
      "- Totals: a pick when the model is 5+ points off the opening total, ★ (tag star) at 8+. Graded at the opening total: the edge is in betting early (2023-25 these hit 54-58% at the open, about 50% at the close).",
      "- Spreads: ★ (tag star) when the model is 3+ points off the line; smaller edges are leans (tag lean).",
    ].join("\n");
  return [
    "Men's college basketball ★ best bets (flat 1 unit at -110):",
    "- Totals: ★ when the model is 6+ points off the opening total, graded at the opener (bet early; the model spots where the total will move). Picks 4-6 points off are tracked only.",
    "- 2023-26 ★ by conference tier: power 6 65%, mid-major 60%, low-major 57.5%, non-conference mix 54%.",
  ].join("\n");
}
