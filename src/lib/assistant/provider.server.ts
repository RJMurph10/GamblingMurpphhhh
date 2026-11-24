/**
 * The AI model behind the site's assistant. One function, ask(), that runs the conversation with tool calls
 * until the model answers in words. The provider is a setting: today Google Gemini (free tier, the key in
 * the GEMINI_API_KEY secret; model in GEMINI_MODEL). Another provider (paid Gemini, Claude, OpenAI) is
 * another branch here with the same inputs and outputs; nothing else in the site changes.
 */
import { runTool, TOOL_DECLARATIONS } from "./tools.server";

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type AskResult =
  /** sources: what was looked up, e.g. "picks · NFL", "record · CFB". */
  { ok: true; text: string; sources: string[] } | { ok: false; error: string };

import { serverEnv, serverEnvNames } from "@/lib/server-env";

export const SYSTEM_PROMPT = `You are the assistant on GamblingNFL, a private sports-betting research site (NFL, college football, NBA, men's college basketball).
Answer questions about the site's picks, ★ best bets, edges, rules and records.
- Get facts with the tools; never invent picks, lines, records or results. If a tool has nothing, say so.
- Say which rule (tag) made a pick, whether it's a ★ best bet or only a lean / watch-list pick, the line it was picked at and the line now when they differ.
- Records are flat 1 unit at -110 and only cover the games since the site started recording picks; say that when you quote one.
- Be short and plain: a sentence or two, then a small list if there are several picks. No hype; these are edges, not locks.
- Today is ${"{today}"} (US Central time).`;

/** Pause before retrying a busy model (tests set it to 0). */
export let BUSY_PAUSE_MS = 1500;
export const setBusyPause = (ms: number) => {
  BUSY_PAUSE_MS = ms;
};

/** Gemini wants upper-case schema types (OBJECT, STRING ...). */
function geminiSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(geminiSchema);
  if (!s || typeof s !== "object") return s;
  return Object.fromEntries(
    Object.entries(s as Record<string, unknown>).map(([k, v]) => [
      k,
      k === "type" && typeof v === "string" ? v.toUpperCase() : geminiSchema(v),
    ]),
  );
}

type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: unknown;
  thought?: boolean;
};
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

async function askGemini(turns: ChatTurn[], today: string): Promise<AskResult> {
  const key = serverEnv("GEMINI_API_KEY");
  if (!key) {
    const seen = serverEnvNames();
    const list = (xs: string[]) => (xs.length ? xs.join(", ") : "none");
    return {
      ok: false,
      error:
        "The assistant isn't set up yet: the server can't see a GEMINI_API_KEY secret. " +
        `Settings it can see (names only): worker: ${list(seen.worker)}; nitro: ${list(seen.nitro)}; process: ${list(seen.process)}.`,
    };
  }
  // Google's free models get busy (503 "high demand"): retry, then fall back to the lighter model
  const models = [
    ...new Set([serverEnv("GEMINI_MODEL") || "gemini-flash-latest", "gemini-flash-lite-latest"]),
  ];
  const urlOf = (m: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
  let modelIx = 0;
  const contents: GeminiContent[] = turns.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.text }],
  }));
  const used = new Set<string>();
  const LABEL: Record<string, string> = {
    get_picks: "picks",
    get_record: "record",
    get_rules: "rules",
  };
  // Gemini 3 models think before answering (slow); these look-ups need little reasoning, so keep it
  // "low". Older models reject thinkingLevel: then the request goes again without it.
  let lowThinking = true;
  for (let round = 0; round < 6; round++) {
    const bodyOf = () =>
      JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT.replace("{today}", today) }] },
        contents,
        tools: [{ functionDeclarations: geminiSchema(TOOL_DECLARATIONS) }],
        generationConfig: {
          temperature: 0.2,
          ...(lowThinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
        },
      });
    let res: Response | undefined;
    // up to 2 tries per model on "busy" answers (500 / 503 / 529), short pauses, then the next model
    for (let attempt = 0; ; attempt++) {
      res = await fetch(urlOf(models[modelIx]), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: bodyOf(),
      });
      if (res.status === 400 && lowThinking) {
        const text = await res
          .clone()
          .text()
          .catch(() => "");
        if (/thinking/i.test(text)) {
          lowThinking = false;
          attempt--;
          continue;
        }
      }
      const busy = res.status === 500 || res.status === 503 || res.status === 529;
      if (!busy) break;
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, BUSY_PAUSE_MS));
        continue;
      }
      if (modelIx < models.length - 1) {
        modelIx++;
        attempt = -1;
        continue;
      }
      return {
        ok: false,
        error: "Google's free AI models are busy right now. Try again in a minute or two.",
      };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429)
        return {
          ok: false,
          error: "The free AI allowance is used up for the moment. Try again in a minute.",
        };
      return { ok: false, error: `The AI service answered ${res.status}. ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { candidates?: { content?: GeminiContent }[] };
    const content = data.candidates?.[0]?.content;
    const parts = content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const text = parts
        .filter((p) => p.text && !p.thought)
        .map((p) => p.text)
        .join("")
        .trim();
      return text
        ? { ok: true, text, sources: [...used] }
        : { ok: false, error: "The AI service returned no answer." };
    }
    // keep the model's turn as sent (it can carry signatures the next request needs), then the tool results
    contents.push({ role: "model", parts });
    const results: GeminiPart[] = [];
    for (const c of calls) {
      const { name, args = {} } = c.functionCall!;
      used.add(`${LABEL[name] ?? name} · ${String(args.league ?? "").toUpperCase()}`);
      let response: unknown;
      try {
        response = await runTool(name, args);
      } catch (e) {
        response = { error: e instanceof Error ? e.message : String(e) };
      }
      results.push({ functionResponse: { name, response: { result: response } } });
    }
    contents.push({ role: "user", parts: results });
  }
  return {
    ok: false,
    error: "The assistant needed too many look-ups for that question; try asking it more narrowly.",
  };
}

/** The current provider. */
export function ask(turns: ChatTurn[], today: string): Promise<AskResult> {
  return askGemini(turns, today);
}
