/**
 * Server secrets (API keys) for server-only code. On the deployed site the server runs as a Cloudflare
 * Worker: secrets arrive as the Worker's `env` bindings on each request, not in process.env (Lovable's
 * build turns off the nodejs_compat flag that would copy them there). src/server.ts hands those bindings
 * to rememberServerEnv() on every request; serverEnv() reads them first, then process.env (local dev,
 * tests and other hosts).
 */
let bindings: Record<string, unknown> = {};

export function rememberServerEnv(env: unknown) {
  if (env && typeof env === "object") bindings = env as Record<string, unknown>;
}

export function serverEnv(name: string): string | undefined {
  const fromBinding = bindings[name];
  if (typeof fromBinding === "string" && fromBinding) return fromBinding;
  const proc =
    typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {};
  const fromProcess = proc[name];
  if (fromProcess) return fromProcess;
  const g = (globalThis as Record<string, unknown>)[name];
  return typeof g === "string" && g ? g : undefined;
}
