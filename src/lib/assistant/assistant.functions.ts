import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ask } from "./provider.server";

/** One question to the site's assistant, with the conversation so far (newest last; kept short). */
export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        turns: z
          .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
          .min(1)
          .max(20),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    return ask(data.turns.slice(-12), today);
  });
