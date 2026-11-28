import { useState } from "react";
import type { NllTeam } from "@/lib/nll/nll";
import { NLL_SEASONS } from "@/lib/nll/use-nll";
import { nllSeasonLabel } from "@/lib/nll/nll";

export function NllLogo({ team, className = "size-6" }: { team?: NllTeam; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!team) return null;
  if (!team.logo || failed)
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-line/10 font-mono text-[9px] font-bold ${className}`}
      >
        {team.abbr}
      </span>
    );
  return (
    <img
      src={team.logo}
      alt={team.name}
      title={team.name}
      className={`shrink-0 object-contain ${className}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function NllSeasonPicker({
  season,
  onChange,
}: {
  season: number;
  onChange: (s: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist" aria-label="Season">
      {NLL_SEASONS.map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={s === season}
          onClick={() => onChange(s)}
          className={`rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold ${s === season ? "bg-acc text-black" : "text-mute hover:bg-line/5 hover:text-foreground"}`}
        >
          {nllSeasonLabel(s)}
        </button>
      ))}
    </div>
  );
}

const CAPTURE = {
  none: { label: "No lines yet", cls: "bg-loss/15 text-loss" },
  open: { label: "Opening saved", cls: "bg-acc/15 text-acc" },
  close: { label: "Closing saved", cls: "bg-win/15 text-win" },
} as const;

/** Whether a game's lines still need capturing (opening / closing). */
export function NllCaptureBadge({ status }: { status: keyof typeof CAPTURE }) {
  const c = CAPTURE[status];
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

export function NllSourceNote() {
  return (
    <p className="font-mono text-[10px] text-faint">
      Schedule and scores from ESPN. Lines are saved by hand from sportsbook screenshots (no odds
      feed carries the NLL); the line shown is the median of each book&apos;s latest line.
    </p>
  );
}
