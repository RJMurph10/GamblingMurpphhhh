import { useState } from "react";
import type { NllTeam } from "@/lib/nll/nll";

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
