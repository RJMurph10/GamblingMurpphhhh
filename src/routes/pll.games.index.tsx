import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, Panel, PanelHeader } from "@/components/shared/booth";
import { PllGamesTable, PllSeasonPicker, PllSourceNote } from "@/components/pll/PllBits";
import { PHASE_LABEL, type PllPhase } from "@/lib/pll/pll";
import { currentPllSeason, usePllSeason } from "@/lib/pll/use-pll";

export const Route = createFileRoute("/pll/games/")({
  head: () => ({ meta: [{ title: "Games — GamblingPLL" }] }),
  component: PllGamesPage,
});

const ORDER: PllPhase[] = ["playoffs", "allstar", "regular", "champ"];

function PllGamesPage() {
  const [season, setSeason] = useState(currentPllSeason());
  const q = usePllSeason(season);
  const groups = useMemo(
    () =>
      ORDER.map((phase) => ({
        phase,
        games: [...(q.data?.games ?? [])].filter((g) => g.phase === phase).reverse(),
      })).filter((g) => g.games.length),
    [q.data],
  );
  return (
    <>
      <PageTitle
        eyebrow="Premier Lacrosse League"
        title={`${season} games`}
        aside={<PllSeasonPicker season={season} onChange={setSeason} />}
      />
      <div className="space-y-6">
        {groups.map(({ phase, games }) => (
          <Panel key={phase} padded={false}>
            <PanelHeader
              title={PHASE_LABEL[phase]}
              aside={<span className="label-mono">{games.length} games</span>}
            />
            <PllGamesTable games={games} season={q.data} empty="" />
          </Panel>
        ))}
        <PllSourceNote season={season} />
        {!groups.length ? (
          <Panel>
            <p className="py-8 text-center font-mono text-xs text-mute">
              {q.isLoading ? "Loading games…" : "No games for this season."}
            </p>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
