import { afterEach, describe, expect, it, vi } from "vitest";
import { runTool } from "@/lib/assistant/tools.server";
import { ask } from "@/lib/assistant/provider.server";

const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16) + "Z";
const PICKS = {
  picks: [
    {
      id: "a",
      game: "BUF @ NYJ",
      tip: iso(now + 86_400_000),
      market: "spread",
      pick: "NYJ +8.5",
      line: 8.5,
      latest: 9,
      best: true,
      tag: "underdog",
      result: null,
    },
    {
      id: "b",
      game: "LV @ CLE",
      tip: iso(now + 86_400_000),
      market: "total",
      pick: "Under 40.5",
      line: 40.5,
      best: true,
      tag: "wind",
      result: null,
    },
    {
      id: "c",
      game: "KC @ DEN",
      tip: iso(now - 3 * 86_400_000),
      market: "total",
      pick: "Under 44",
      line: 44,
      best: true,
      tag: "wind",
      result: "win",
      score: [17, 13],
    },
    {
      id: "d",
      game: "SF @ SEA",
      tip: iso(now - 3 * 86_400_000),
      market: "spread",
      pick: "SEA +7.5",
      line: 7.5,
      best: true,
      tag: "underdog",
      result: "loss",
    },
    {
      id: "e",
      game: "MIA @ NE",
      tip: iso(now - 2 * 86_400_000),
      market: "total",
      pick: "Over 41",
      line: 41,
      best: false,
      tag: "total-gap",
      result: "win",
    },
    {
      id: "f",
      game: "LV @ CLE",
      tip: iso(now + 86_400_000),
      market: "total",
      pick: "Over 40.5",
      line: 40.5,
      best: false,
      tag: "total-gap",
      dropped: true,
      result: null,
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

function stubFetch(gemini?: (body: { contents: unknown[] }) => unknown) {
  const fn = vi.fn(async (url: string, init?: { body?: string }) => {
    if (String(url).includes("raw.githubusercontent.com"))
      return { ok: true, json: async () => PICKS };
    if (String(url).includes("generativelanguage") && gemini)
      return { ok: true, json: async () => gemini(JSON.parse(init!.body!)) };
    return { ok: false, status: 404, text: async () => "" };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("assistant tools", () => {
  it("lists upcoming picks (dropped ones left out) and filters by team and ★", async () => {
    stubFetch();
    const r = (await runTool("get_picks", { league: "nfl" })) as { picks: { pick: string }[] };
    expect(r.picks.map((p) => p.pick)).toEqual(["NYJ +8.5", "Under 40.5"]);
    const cle = (await runTool("get_picks", { league: "nfl", team: "cle", bestOnly: true })) as {
      picks: { pick: string; rule: string }[];
    };
    expect(cle.picks).toEqual([expect.objectContaining({ pick: "Under 40.5", rule: "wind" })]);
  });

  it("grades the record at 1u -110, ★ only by default, by rule", async () => {
    stubFetch();
    const r = (await runTool("get_record", { league: "nfl" })) as {
      overall: { record: string; units: number };
      byRule: Record<string, { record: string }>;
    };
    expect(r.overall).toMatchObject({ record: "1-1", units: -0.09 });
    expect(r.byRule.wind.record).toBe("1-0");
    const all = (await runTool("get_record", { league: "nfl", bestOnly: false })) as {
      overall: { record: string };
    };
    expect(all.overall.record).toBe("2-1");
  });

  it("explains the rules, with the QB-style rule marked off", async () => {
    const r = (await runTool("get_rules", { league: "nfl" })) as { rules: string };
    expect(r.rules).toMatch(/home team getting 7\+ points/);
    expect(r.rules).toMatch(/qb-style.*turned OFF/);
  });
});

describe("assistant conversation (Gemini)", () => {
  it("says it isn't set up when there's no key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const r = await ask([{ role: "user", text: "best bets?" }], "2026-11-23");
    expect(r.ok).toBe(false);
    vi.unstubAllEnvs();
  });

  it("runs the tool the model asks for, then returns its answer and the sources", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    let round = 0;
    stubFetch((body) => {
      round++;
      if (round === 1)
        return {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  { functionCall: { name: "get_picks", args: { league: "nfl", bestOnly: true } } },
                ],
              },
            },
          ],
        };
      // the second request carries the tool result back
      const last = body.contents.at(-1) as {
        parts: { functionResponse: { response: { result: { picks: unknown[] } } } }[];
      };
      expect(last.parts[0].functionResponse.response.result.picks).toHaveLength(2);
      return {
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: "Two ★ bets: NYJ +8.5 and the Under 40.5." }],
            },
          },
        ],
      };
    });
    const r = await ask([{ role: "user", text: "NFL best bets?" }], "2026-11-23");
    expect(r).toEqual({
      ok: true,
      text: "Two ★ bets: NYJ +8.5 and the Under 40.5.",
      sources: ["picks · NFL"],
    });
    vi.unstubAllEnvs();
  });
});

describe("server secrets", () => {
  it("reads the key from the Worker's env bindings (deployed site), not only process.env", async () => {
    const { rememberServerEnv, serverEnv } = await import("@/lib/server-env");
    vi.stubEnv("GEMINI_API_KEY", "");
    rememberServerEnv({ GEMINI_API_KEY: "from-binding" });
    expect(serverEnv("GEMINI_API_KEY")).toBe("from-binding");
    rememberServerEnv({});
    vi.unstubAllEnvs();
  });
});

describe("server secrets on the Worker (nitro)", () => {
  it("reads nitro's globalThis.__env__ and lists names only when the key is missing", async () => {
    const { serverEnv, serverEnvNames } = await import("@/lib/server-env");
    vi.stubEnv("GEMINI_API_KEY", "");
    (globalThis as Record<string, unknown>).__env__ = { GEMINI_API_KEY: "k", OTHER_SECRET: "x" };
    expect(serverEnv("GEMINI_API_KEY")).toBe("k");
    expect(serverEnvNames().nitro).toEqual(["GEMINI_API_KEY", "OTHER_SECRET"]);
    delete (globalThis as Record<string, unknown>).__env__;
    vi.unstubAllEnvs();
  });
});

describe("busy model", () => {
  it("retries a 503, then falls back to the lighter model", async () => {
    const { setBusyPause } = await import("@/lib/assistant/provider.server");
    setBusyPause(0);
    vi.stubEnv("GEMINI_API_KEY", "k");
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        if (String(url).includes("gemini-flash-latest"))
          return { ok: false, status: 503, text: async () => "busy" };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { role: "model", parts: [{ text: "Hi" }] } }],
          }),
        };
      }),
    );
    const r = await ask([{ role: "user", text: "hi" }], "2026-11-23");
    expect(r).toMatchObject({ ok: true, text: "Hi" });
    expect(urls.filter((u) => u.includes("gemini-flash-latest"))).toHaveLength(2);
    expect(urls.at(-1)).toContain("gemini-flash-lite-latest");
    vi.unstubAllEnvs();
  });
});

describe("thinking level", () => {
  it("asks for low thinking, and drops it if the model rejects the setting", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const bodies: { generationConfig: { thinkingConfig?: unknown } }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const b = JSON.parse(init.body);
        bodies.push(b);
        if (b.generationConfig.thinkingConfig) {
          const text = "Invalid JSON payload: thinking_level is not supported";
          return {
            ok: false,
            status: 400,
            text: async () => text,
            clone: () => ({ text: async () => text }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { role: "model", parts: [{ text: "OK" }] } }],
          }),
        };
      }),
    );
    const r = await ask([{ role: "user", text: "hi" }], "2026-11-23");
    expect(r).toMatchObject({ ok: true, text: "OK" });
    expect(bodies[0].generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(bodies[1].generationConfig.thinkingConfig).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
