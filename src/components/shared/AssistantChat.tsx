import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { askAssistant } from "@/lib/assistant/assistant.functions";

type Turn = { role: "user" | "assistant"; text: string; tools?: string[]; error?: boolean };

/** Give up waiting after ms (the free model can stall at busy times). */
function withTimeout<T>(ms: number, p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "No answer after 75 seconds: Google's free model is overloaded. Try again in a minute.",
            ),
          ),
        ms,
      ),
    ),
  ]);
}

const STARTERS = [
  "What are this week's NFL ★ best bets?",
  "How have the college football ★ rules done this season?",
  "Any NBA ★ totals tonight?",
  "Why is the wind under a best bet?",
];

/**
 * The site's assistant: a chat panel (button bottom-right on every page) that answers questions about the
 * picks, ★ best bets, rules and records from the site's own data (src/lib/assistant).
 */
export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    if (!busy) return setWaited(0);
    const t = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [turns, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: "user", text: q }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    try {
      const r = await withTimeout(
        75_000,
        askAssistant({
          data: {
            turns: next.filter((t) => !t.error).map(({ role, text: t }) => ({ role, text: t })),
          },
        }),
      );
      setTurns([
        ...next,
        r.ok
          ? {
              role: "assistant",
              text: r.text,
              tools: r.sources,
            }
          : { role: "assistant", text: r.error, error: true },
      ]);
    } catch (e) {
      setTurns([
        ...next,
        {
          role: "assistant",
          text: e instanceof Error ? e.message : "Something went wrong.",
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed bottom-5 right-5 z-40 rounded-full bg-acc px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-panel2 shadow-lg ring-1 ring-acc/40 transition-transform hover:scale-105"
          aria-label="Ask the assistant about picks and edges"
        >
          Ask
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-panel p-0 sm:max-w-md">
        <SheetHeader className="border-b border-line/10 px-4 py-3">
          <SheetTitle className="font-display text-base">Ask about picks &amp; edges</SheetTitle>
          <p className="font-mono text-[10px] uppercase tracking-wider text-faint">
            Answers from the site&apos;s recorded picks, rules and records · NFL, college football,
            NBA, college basketball
          </p>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {turns.length === 0 ? (
            <div className="space-y-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="block w-full rounded-lg bg-panel2 px-3 py-2 text-left text-sm text-mute ring-1 ring-line/10 hover:text-acc"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
              <div
                className={`max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  t.role === "user"
                    ? "bg-acc/10 text-ink ring-1 ring-acc/20"
                    : t.error
                      ? "bg-panel2 text-loss ring-1 ring-line/10"
                      : "bg-panel2 text-ink ring-1 ring-line/10"
                }`}
              >
                {t.text}
                {t.tools?.length ? (
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
                    From: {t.tools.join(" · ")}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {busy ? (
            <div className="font-mono text-[11px] text-faint">
              Looking it up… {waited}s
              {waited >= 15 ? " · Google's free model is slow right now" : ""}
            </div>
          ) : null}
          <div ref={end} />
        </div>
        <form
          className="flex gap-2 border-t border-line/10 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about a pick, a rule or a record…"
            className="min-w-0 flex-1 rounded-lg bg-panel2 px-3 py-2 text-sm text-ink ring-1 ring-line/10 outline-none focus:ring-acc/40"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="rounded-lg bg-acc/15 px-3 py-2 font-mono text-xs uppercase tracking-wider text-acc ring-1 ring-acc/25 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
