import { describe, expect, it } from "vitest";
import { conferenceOfNote, titleRace, type ConfGame } from "@/lib/cfb/cfb-title-games";

const g = (away: string, home: string, as?: number, hs?: number): ConfGame =>
  as === undefined ? { away, home } : { away, home, awayScore: as, homeScore: hs };
const conf = (ids: string[]) => ({
  name: "Mountain West Conference",
  pools: [{ teamIds: ids, spots: 2 }],
});

describe("titleRace", () => {
  it("leaves the game open while a deciding game is left, with clinched and alive teams", () => {
    // A 3-0, B 2-1, C 1-2, D 0-3, one game left: B at C
    const games = [
      g("A", "B", 20, 10),
      g("A", "C", 30, 7),
      g("A", "D", 14, 3),
      g("B", "D", 21, 0),
      g("C", "D", 10, 7),
      g("B", "C"),
    ];
    const r = titleRace(conf(["A", "B", "C", "D"]), games);
    expect(r.set).toBeUndefined();
    expect(r.clinched).toEqual(["A"]);
    expect(r.alive).toEqual(["A", "B", "C"]);
  });
  it("sets the matchup once it's final, higher seed first", () => {
    const games = [
      g("A", "B", 20, 10),
      g("A", "C", 30, 7),
      g("A", "D", 14, 3),
      g("B", "D", 21, 0),
      g("C", "D", 10, 7),
      g("B", "C", 24, 17),
    ];
    expect(titleRace(conf(["A", "B", "C", "D"]), games)).toMatchObject({
      set: ["A", "B"],
      seeded: true,
    });
  });
  it("ranks the second spot by conference win percentage", () => {
    // A 3-0; B and C 1-2 after C beat B; D 1-2 too but lost to both -> three-way tie, stays open
    const two = [
      g("A", "B", 1, 0),
      g("A", "C", 1, 0),
      g("C", "B", 2, 1),
      g("B", "D", 3, 0),
      g("D", "A", 0, 9),
    ];
    expect(titleRace(conf(["A", "B", "C", "D"]), two).set).toEqual(["A", "C"]);
  });
  it("won't guess a three-way tie for a spot", () => {
    const three = [
      g("A", "B", 1, 0),
      g("A", "C", 1, 0),
      g("A", "D", 1, 0),
      g("B", "C", 1, 0),
      g("C", "D", 1, 0),
      g("D", "B", 1, 0),
    ];
    expect(titleRace(conf(["A", "B", "C", "D"]), three).set).toBeUndefined();
  });
  it("takes each division's winner and seeds by record", () => {
    const c = {
      name: "Sun Belt Conference",
      pools: [
        { teamIds: ["A", "B"], spots: 1 },
        { teamIds: ["C", "D"], spots: 1 },
      ],
    };
    const games = [g("A", "B", 10, 0), g("C", "D", 10, 0), g("D", "A", 7, 3), g("B", "C", 0, 5)];
    expect(titleRace(c, games)).toMatchObject({ set: ["C", "A"], seeded: true });
  });
});

describe("conferenceOfNote", () => {
  const names = [
    "American Conference",
    "Mid-American Conference",
    "Big 12 Conference",
    "Big Ten Conference",
    "Southeastern Conference",
    "Sun Belt Conference",
    "Mountain West Conference",
  ];
  it("reads ESPN's title-game notes", () => {
    expect(conferenceOfNote("Edward Jones Big 12 Championship", names)).toBe("Big 12 Conference");
    expect(conferenceOfNote("American Championship", names)).toBe("American Conference");
    expect(conferenceOfNote("MAC Championship", names)).toBe("Mid-American Conference");
    expect(conferenceOfNote("SEC Championship", names)).toBe("Southeastern Conference");
    expect(conferenceOfNote("Sun Belt Championship", names)).toBe("Sun Belt Conference");
    expect(conferenceOfNote("Rose Bowl - CFP Quarterfinal", names)).toBeUndefined();
  });
});
