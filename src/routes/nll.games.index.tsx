import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, Panel } from "@/components/shared/booth";
import { NllSeasonPicker, NllSourceNote } from "@/components/nll/NllBits";
import { NllDashGames } from "@/components/nll/NllDashGames";
import { nllSeasonLabel, nllSeasonOf } from "@/lib/nll/nll";
import { useNllLines, useNllSeason } from "@/lib/nll/use-nll";

export const Route = createFileRoute("/nll/games/")({
  head: () => ({ meta: [{ title: "Games — GamblingNLL" }] }),
  component: NllGamesPage,
});

function NllGamesPage() {
  const [season, setSeason] = useState(nllSeasonOf());
  const q = useNllSeason(season);
  const linesQ = useNllLines(season);
  const groups = useMemo(() => {
    const g = q.data?.games ?? [];
    return [
      { title: "Live", games: g.filter((x) => x.status === "live") },
      { title: "Upcoming", games: g.filter((x) => x.status === "scheduled") },
      {
        title: "Playoffs",
        games: [...g].filter((x) => x.status === "final" && x.phase === "playoffs").reverse(),
      },
      {
        title: "Regular season",
        games: [...g].filter((x) => x.status === "final" && x.phase === "regular").reverse(),
      },
    ].filter((x) => x.games.length);
  }, [q.data]);
  return (
    <>
      <PageTitle
        eyebrow="National Lacrosse League"
        title={`${nllSeasonLabel(season)} games`}
        aside={<NllSeasonPicker season={season} onChange={setSeason} />}
      />
      <div className="space-y-6">
        {groups.map(({ title, games }) => (
          <NllDashGames
            key={title}
            title={title}
            games={games}
            season={q.data}
            lines={linesQ.data}
            emptyText=""
            aside={<span className="label-mono">{games.length} games</span>}
          />
        ))}
        <NllSourceNote />
        {!groups.length ? (
          <Panel>
            <p className="py-8 text-center font-mono text-xs text-mute">
              {q.isLoading
                ? "Loading games…"
                : q.isError
                  ? "Couldn't reach ESPN for this season's games. Try again in a minute."
                  : "No games for this season."}
            </p>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
