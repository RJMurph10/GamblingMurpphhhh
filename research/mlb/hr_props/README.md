# MLB home-run props: matchup filters (Nov 2026)

Data: `props-history` mlb/2024-2026 (ESPN BET 2024-25 "Total Home Runs Hit" over 0.5 openers; DraftKings 2026
"Home Runs Milestones" 1+), 110,056 priced batter-games, graded with the same file's box scores.
- `build.py`: one row per batter-game with pre-game season AVG / ERA (from the previous box), HR/AB, SP HR/9.
- `filters.py`: the owner's filters (AVG >= .250 vs SP ERA >= 5, etc.) at the opening price.
- `model.py`: walk-forward logistic (market price + batter / pitcher / park), fit 2024 -> test 2025, 2024-25 -> 2026.
Batter-vs-pitcher history was tested on Retrosheet 2014-2025 plate appearances (see the project doc).
Result: no edge. Project doc `claude/mlb-hr-props.md`.
