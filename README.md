# Fantasy Football Sucks

A Sleeper fantasy football dashboard for settling group chat arguments with numbers. Compare team strength, schedule luck, draft picks, roster moves, and historical manager performance.

**Live site:** [Fantasy Football Sucks](https://bensonhan.github.io/fantasy-football-sucks/)

## Features

- **Power rankings and team reports:** expected wins, all-play records, recent form, consistency, and simulated playoff odds.
- **League awards:** Juggernaut, Heartbreak Kid, Escape Artist, Commitment Issues, Fantasy Futbol, and “D” Whisperer.
- **Weekly scoring heatmap:** scores and league ranks for each week.
- **Schedule swap matrix:** hypothetical records with another team's schedule.
- **Team scoring profiles:** weekly floors, averages, and ceilings against the league average.
- **Draftboard Postmortem:** drafted-player production, position grades, and a team-by-team mobile view.
- **Trade Regret Analyzer:** actual results compared with a legal lineup without a selected roster move.
- **Weekly power movement, median standings, and all-time manager rankings.**

The heatmap and draftboard use red for lower performance and green for higher performance. Scoring profiles use the league average as the neutral point. Dropped or traded draft picks appear gray.

## Run locally

The site uses plain HTML, CSS, and JavaScript. There is no package installation or build step; `dist/` contains the editable site source and deployable assets.

From the repository root, start a static server with Python 3:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Open [the local dashboard](http://127.0.0.1:8765). It connects to the default league on first load. Use **Sync league** or **Switch league** to enter another Sleeper league ID.

An internet connection is needed to fetch Sleeper data and external fonts. League data and preferences are cached in browser local storage. The app checks for stale data on load and refreshes when the last sync is at least 24 hours old.

## How the numbers work

Power scores combine three league-relative percentiles:

| Component | Weight |
| --- | --- |
| Expected wins | 45% |
| Season scoring strength | 35% |
| Recent form | 20% |

Weekly analysis uses completed regular-season weeks. Playoff odds use 3,000 simulations based on past scoring rather than injuries or player projections. Each metric's info button explains its calculation.

Commitment Issues counts completed waiver claims, free-agent transactions, and trades, including preseason and the current week. Each transaction counts once per participating team, regardless of the number of players involved. Pending, failed, and canceled transactions are excluded. Fantasy Futbol and “D” Whisperer count only points from starting kicker and defense slots in completed weeks.

## Checks

Use Node.js 24 to match CI. No npm dependencies are required.

```sh
node --test tests/*.test.js
find dist -name '*.js' -exec node --check {} \;
git diff --check
```

For visual changes, also inspect the affected sections in a browser at desktop and mobile widths.

## Repository layout

```text
dist/
  index.html        Page structure and script loading
  styles.css        Shared styles, chart colors, and responsive layouts
  app.js            Sleeper sync, league analytics, and application state
  regret.js         Transaction hindsight calculations
  charts/           Chart rendering and feature-specific models
  assets/           Images and icons
scripts/            Deployment asset-versioning utility
tests/              Node.js tests
.github/workflows/  Pull request checks and GitHub Pages deployment
```

## Deployment and contributions

GitHub Actions runs syntax checks and tests on pull requests targeting `main`. Pushes to `main` run those checks, version local JavaScript and CSS URLs with the commit SHA, and deploy `dist/` to GitHub Pages. The deployment workflow can also be triggered manually.

Before opening a pull request, use the **Summary** and **Checks** sections in [.github/pull_request_template.md](.github/pull_request_template.md). Describe what changed and why, and list the checks you ran.
