# liminal-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Rzkyarmndho/liminal-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Rzkyarmndho/liminal-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

An offline launch-research terminal covering all 758 protocols in the sealed DefiLlama snapshot, including the full 40-protocol watchlist. Conditional valuations use token-grouped robust regression, honest holdout controls and wide sensitivity bands. Every record has a costed category playbook, with research-only dispositions for inaccessible or unsuitable categories.

## Run it

Requires Node.js 22.18+; no dependencies, build tools, credentials or network access.

```sh
curl -fL https://make.fun/c/token-radar-01/kit -o ../radar-kit.tar.gz
tar -xzf ../radar-kit.tar.gz -C ..
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
python3 -m http.server 8765 --bind 127.0.0.1 --directory out
```

Open `http://127.0.0.1:8765/dashboard/` in a browser. HTTP is only the optional local file server; the dashboard makes no network requests to external services. For a data preview without screenshot packaging, append `--data-only` to the Node command.

## Verification

The runtime needs Node only. The full test suite also uses Python with Playwright and its Chromium browser:

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
RADAR_SNAPSHOT="$PWD/../token-radar-01-kit/input/snapshot.json" npm test
```

The browser tests use explicitly synthetic fixtures for interaction controls, plus the real snapshot's negative-market-cap sentinel for a rendering regression. They never create a wallet, connect to a product, or spend funds.

The competition sandbox invokes `node main.ts` with `/input/snapshot.json` and writable `/output` (or `MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR`). It runs on Node 22, standard library only. The checked-in screenshot files were captured from this dashboard on the sealed snapshot. `vendor/makefun-board.ts` is the competition's unchanged canonical dossier helper, not authored model code.

## Valuation and limitations

- One greatest-TVL record per token identifier, to avoid version/fork duplicates leaking between validation folds.
- Huber-weighted ridge on log TVL, bounded 7-day TVL growth, log tracking age and chain count; category residuals are pooled with an eight-peer prior.
- Leave-one-token-group-out evaluation compares the model to global median circulating-market-cap / TVL. The lower median held-out log error selects the estimator; coefficients and every held-out residual are included in `board.json`.
- Bands use the selected estimator's 80th-percentile held-out absolute log error, with at least a 2x width. These are scenario bands, not statistical confidence intervals or launch forecasts.
- Existing token records show observed market cap where positive. Missing or sentinel market caps are not treated as zero; no token in a record does not prove no existing token.
- Tracking history is not tokenless age. TVL is not revenue, and circulating market cap is not FDV. No launch date, airdrop eligibility, token allocation or value capture is inferred.
- Plans cap principal at $100 for an eligible permissionless pilot, with an initial $20 deposit/exit test, a six-transaction gas budget, $8/hour research cost and 5% annual capital opportunity cost. These are assumptions, not live quotes or instructions to spend blindly.
- A 0.01-basis-point reward allocation is an illustrative sensitivity input, never expected earnings. Principal loss is not included in the displayed scenario net; actual rewards can be zero.
- Eligibility filters are conservative category/name heuristics, with every official watchlist row retained. Exchange, derivative and restricted-access records remain inspectable. Documented points, product terms, minimum deposits and withdrawability must be verified independently.

## Provenance

The sealed snapshot is supplied by the competition kit rather than committed as implementation code. Its own `source` names DefiLlama and the fetch timestamp. Downloading the public kit is a setup step only: once its input is on disk, the program reads only that input, its source dashboard and the supplied screenshot files; it makes no external calls. Outputs are repeatable across two clean output directories.

---

<sub>Entered on [make.fun](https://make.fun/?ref=bpyeaarb&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
