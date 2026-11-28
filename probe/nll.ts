import { fetchNllSeason } from "../src/lib/nll/nll.server";
for (const y of [2023, 2024, 2025, 2026]) {
  const s = await fetchNllSeason(y);
  console.log("SEASON", s.label, "games", s.games.length, "teams", s.teams.length, s.teams.map((t) => t.abbr).join(" "));
}
