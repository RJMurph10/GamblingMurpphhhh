/** ESPN news stories and game highlight videos for the NLL pages. */
import { Panel, PanelHeader } from "@/components/shared/booth";
import type { NllNews, NllVideo } from "@/lib/nll/nll";

const ago = (iso: string) => {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (!Number.isFinite(h)) return "";
  if (h < 1) return "just now";
  if (h < 24) return `${Math.round(h)}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
};
const mmss = (s: number | null) =>
  s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "";

export function NllNewsPanel({
  items,
  title = "NLL news",
  empty,
}: {
  items: NllNews[];
  title?: string;
  empty?: string;
}) {
  return (
    <Panel padded={false}>
      <PanelHeader title={title} aside={<span className="label-mono">ESPN</span>} />
      {items.length ? (
        <div className="divide-y divide-line/5">
          {items.map((a) => (
            <a
              key={a.headline}
              href={a.link ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="flex gap-3 px-4 py-3 hover:bg-line/5"
            >
              {a.image ? (
                <img
                  src={a.image}
                  alt=""
                  loading="lazy"
                  className="h-14 w-20 shrink-0 rounded object-cover"
                />
              ) : null}
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug">{a.headline}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-mute">{a.description}</span>
                <span
                  className="mt-0.5 block font-mono text-[10px] text-faint"
                  suppressHydrationWarning
                >
                  {ago(a.published)}
                </span>
              </span>
            </a>
          ))}
        </div>
      ) : (
        <p className="px-4 py-6 text-center font-mono text-xs text-mute">
          {empty ?? "No stories right now."}
        </p>
      )}
    </Panel>
  );
}

export function NllHighlights({ videos }: { videos: NllVideo[] }) {
  if (!videos.length) return null;
  return (
    <Panel padded={false}>
      <PanelHeader title="Highlights" aside={<span className="label-mono">ESPN</span>} />
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <a
            key={v.headline}
            href={v.link ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="group block"
          >
            {v.thumbnail ? (
              <span className="relative block overflow-hidden rounded-lg">
                <img
                  src={v.thumbnail}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
                {v.duration ? (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 font-mono text-[10px] text-white">
                    {mmss(v.duration)}
                  </span>
                ) : null}
              </span>
            ) : null}
            <span className="mt-1.5 block text-sm leading-snug group-hover:text-acc">
              {v.headline}
            </span>
          </a>
        ))}
      </div>
    </Panel>
  );
}
