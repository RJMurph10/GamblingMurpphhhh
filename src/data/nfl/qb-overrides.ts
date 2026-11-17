/**
 * Starting quarterbacks the site owner sets by hand for upcoming games, when nflverse's projected
 * starter is out of date (a trade or injury it hasn't caught up with). Applied to upcoming games only;
 * finished games always use the starter nflverse recorded. Remove an entry once the game is played.
 *
 * qbId: nflverse / GSIS player id (from play-by-play passer ids).
 */
export interface QbOverride {
  /** ESPN event id of the game. */
  espnId: number;
  side: "home" | "away";
  qbId: string;
  qbName: string;
  /** Why, and when it was set. */
  note: string;
}

export const QB_OVERRIDES: QbOverride[] = [
  {
    espnId: 401873065, // Chargers at Ravens, Week 10 (Mon Nov 16, 2026)
    side: "home",
    qbId: "00-0033119",
    qbName: "Jacoby Brissett",
    note: "Owner, Nov 16 2026: Brissett starts (Lamar Jackson and Tyler Huntley on IR; traded from Arizona). nflverse still listed Huntley.",
  },
];
