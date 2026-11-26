import { describe, expect, it } from "vitest";
import { darkCollegeLogo, lightCollegeLogo, parseTeamRef, rekeyCollegeTeams } from "@/lib/cfb/cfb";
import { teamLogo, teamLogoFallback, type Team } from "@/data/shared/teams";

const STD = "https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png";
const DARK = "https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2294.png";

describe("college football logos on the dark site", () => {
  it("dark-background logo only for listed teams; Alabama, Michigan State, Tennessee keep their colors", () => {
    expect(darkCollegeLogo(STD)).toBe(DARK); // Iowa
    expect(darkCollegeLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/154.png")).toContain("/500-dark/154"); // Wake Forest
    expect(darkCollegeLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/2132.png")).toContain("/500-dark/2132"); // Cincinnati
    for (const id of ["333", "127", "2633", "197"]) // ... and Oklahoma State (orange)
      expect(darkCollegeLogo(`https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`)).toContain(`/500/${id}`);
    for (const id of ["252", "2649"]) // BYU, Toledo: owner prefers the dark version
      expect(darkCollegeLogo(`https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`)).toContain(`/500-dark/${id}`);
    expect(lightCollegeLogo(DARK)).toBe(STD);
    expect(darkCollegeLogo(undefined)).toBeUndefined();
  });

  it("scoreboard and rankings teams get the dark logo (Iowa's gold Tigerhawk)", () => {
    expect(parseTeamRef({ id: "2294", abbreviation: "IOWA", logo: STD }).logo).toBe(DARK);
    expect(parseTeamRef({ id: "2294", abbreviation: "IOWA", logos: [{ href: STD, rel: ["full", "default"] }] }).logo).toBe(DARK);
    // ESPN's own "dark" entry is not used for a team off the list
    const bama = "https://a.espncdn.com/i/teamlogos/ncaa/500/333.png";
    const bamaDark = "https://a.espncdn.com/i/teamlogos/ncaa/500-dark/333.png";
    const [b] = rekeyCollegeTeams({ team: { id: "333", abbreviation: "ALA", location: "Alabama", logos: [{ href: bama, rel: ["full", "default"] }, { href: bamaDark, rel: ["full", "dark"] }] } });
    expect(b.logo).toBe(bama);
    const [t] = rekeyCollegeTeams({ team: { id: "2294", abbreviation: "IOWA", location: "Iowa", logo: STD } });
    expect(t.logo).toBe(DARK);
  });

  it("a college logo that fails falls back to the standard one; NFL clubs use ESPN's standard logo", () => {
    expect(teamLogoFallback({ id: "cfb-2294", logo: DARK } as Team)).toBe(STD);
    expect(teamLogo({ id: "rams", abbr: "LAR" } as Team)).toBe("/logos/lar.png");
    expect(teamLogo({ id: "bears", abbr: "CHI" } as Team)).toBe("https://a.espncdn.com/i/teamlogos/nfl/500/chi.png");
  });
});
