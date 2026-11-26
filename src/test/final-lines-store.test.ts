import { describe, expect, it } from "vitest";
import { finalLinesStore } from "@/lib/shared/final-cache.server";

type O = { spread?: string; total?: number };
const noLines = (o: O) => !o.spread && o.total === undefined;

describe("final lines store", () => {
  it("replaces a stored 'no lines' entry once real lines turn up, but never overwrites real lines", async () => {
    const store = finalLinesStore<O>("test-nfl", noLines);
    await store.save([{ id: "espn-1", date: "2026-10-04T17:00Z", odds: {} }]);
    expect((await store.get([{ id: "espn-1", date: "2026-10-04T17:00Z" }])).get("espn-1")).toEqual({});
    await store.save([{ id: "espn-1", date: "2026-10-04T17:00Z", odds: { spread: "BUF -3.5", total: 47.5 } }]);
    expect((await store.get([{ id: "espn-1", date: "2026-10-04T17:00Z" }])).get("espn-1")).toEqual({ spread: "BUF -3.5", total: 47.5 });
    await store.save([{ id: "espn-1", date: "2026-10-04T17:00Z", odds: {} }]);
    await store.save([{ id: "espn-1", date: "2026-10-04T17:00Z", odds: { spread: "KC -1", total: 50 } }]);
    expect((await store.get([{ id: "espn-1", date: "2026-10-04T17:00Z" }])).get("espn-1")).toEqual({ spread: "BUF -3.5", total: 47.5 });
  });
});
