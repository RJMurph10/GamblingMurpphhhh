# Park dimensions x lineup handedness (Nov 2026)

Question (owner): parks with a short side (e.g. short left field) should favor hitters who pull that way
(righties pull to left). If a team's lineup is heavy on that side, should the total go over more?

Pipeline (data rebuilt from Retrosheet 2010-2025, no 2020; lines: SBR closing 2012-2021 at -110,
DraftKings open + close with prices 2021-2025):
1. `parse.py` -> plate appearances (2.76M) with batter side vs the pitcher, starting lineups, starting pitchers.
2. `parkhand.py` -> each park's effect for righty and lefty hitters per season (wOBA, additive batter + pitcher +
   park x side model) and HR/PA ratio by side.
3. `feature.py` -> per game, walk-forward (prior 4 seasons only): sum over both starting lineups of
   (park's effect for that hitter's side - park's overall effect), weighted by expected PA by lineup slot.
4. `test.py` -> correlation with runs vs the closing / opening total, and over/under bets on the top / bottom
   5% and 10% of games.

Result: no edge. See the project doc `claude/mlb-park-handedness.md`.
