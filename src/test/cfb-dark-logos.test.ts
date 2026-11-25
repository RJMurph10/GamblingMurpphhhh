import { describe, expect, it } from "vitest";
import { darkCollegeLogo, lightCollegeLogo, parseTeamRef, rekeyCollegeTeams } from "@/lib/cfb/cfb";
import { teamLogo, teamLogoFallback, type Team } from "@/data/shared/teams";

const STD = "https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png";
const DARK = "https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2294.png";

describe("college football logos on the dark site", () => {
  it("swaps ESPN's standard logo for the dark-background one, and back", () => {
    expect(darkCollegeLogo(STD)).toBe(DARK);
    expect(darkCollegeLogo(DARK)).toBe(DARK);
    expect(lightCollegeLogo(DARK)).toBe(STD);
    expect(darkCollegeLogo(undefined)).toBeUndefined();
  });

  it("scoreboard and rankings teams get the dark logo (Iowa's gold Tigerhawk)", () => {
    expect(parseTeamRef({ id: "2294", abbreviation: "IOWA", logo: STD }).logo).toBe(DARK);
    expect(parseTeamRef({ id: "2294", abbreviation: "IOWA", logos: [{ href: STD, rel: ["full", "default"] }] }).logo).toBe(DARK);
    const [t] = rekeyCollegeTeams({ team: { id: "2294", abbreviation: "IOWA", location: "Iowa", logo: STD } });
    expect(t.logo).toBe(DARK);
  });

  it("a college logo that fails falls back to the standard one; NFL clubs use ESPN's standard logo", () => {
    expect(teamLogoFallback({ id: "cfb-2294", logo: DARK } as Team)).toBe(STD);
    expect(teamLogo({ id: "rams", abbr: "LAR" } as Team)).toBe("https://a.espncdn.com/i/teamlogos/nfl/500/lar.png");
  });
});
