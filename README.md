# NMA-Synth — Heart-Failure Network Synthesis Explorer

A single-file, **fully offline** dashboard that visualises a small heart-failure
treatment network (Placebo/SoC, SGLT2i, ARNI, MRA, ARB, Digoxin) as a
precision-weighted topology, a CNMA "additivity vs. reality" comparison, and a
ratio-scale forest panel — with interactive controls for the TOPCAT regional
heterogeneity correction and a polypharmacy safety penalty.

**Live app:** open `index.html` (or the GitHub Pages link). No build step, no
network, no external CDN.

## Layout

```
index.html   single-file UI (loads engine.js); canvas rendering + UI state
engine.js    pure analytics core + dataset — runs in Node and the browser
tests.js     Node test harness, 25 assertions, all hand-derived
LICENSE      Apache-2.0
```

## What this tool is (and is not)

This is a **teaching / exploration** synthesis aid, not a fitted random-effects
network meta-analysis. To set expectations honestly:

- Edge "precision" is a crude `log(events)` inverse-variance *proxy*, not a GLS
  contrast model with a variance–covariance Laplacian.
- The combination-benefit view multiplies per-agent hazard ratios (a
  "quadruple-therapy" additivity assumption) and then pushes the result back
  toward the null with a non-linear safety penalty.
- The ARNI-vs-placebo effect is an **anchored indirect** estimate (PARAGON-HF is
  ARNI-vs-ARB, bridged through ARB-vs-placebo); the dashboard flags the
  indirectness and widens its interval.

Ratio measures (HRs) are combined **multiplicatively on the natural scale**
(equivalently, additively on the log scale), which is the one piece of genuine
statistical discipline the engine enforces and the tests lock in.

## Statistical / analytics core (`engine.js`)

| Function | What it does |
|---|---|
| `getEdgeWeight(edge, state)` | `log(events)` precision proxy; applies a 45% down-weight to any MRA edge unless the TOPCAT regional data is opted in |
| `calculateNetBenefit(state)` | multiplicative HR combination across active agents + non-linear `safety^1.5` penalty, capped at HR = 1.0 |
| `bridgedArniHR(endpoint)` | anchored indirect ARNI-vs-placebo HR = ARNI/ARB × ARB/placebo (ratios multiply) |
| `totalEvents(state)` | total event count over active edges, with the same MRA/TOPCAT down-weight |
| `eraSpan(state)` | publication-era span over the active set (transitivity/incoherence proxy); `null` when nothing is active |
| `isConnected(state)` | network connectivity guard (BFS); a disconnected network cannot be synthesised |
| `getColor(id)` | shared cosmetic colour map |

## Fixes applied during revival (2026-06-05)

- **Made fully offline:** removed the Google Fonts CDN `<link>` (system fonts
  fall back); the page now loads **no external resource** (verified zero
  `http(s)://` references remain).
- **Single source of truth:** extracted the dataset (`TREATMENTS`, `TRIALS`) and
  the pure compute functions into `engine.js` and deleted the inline duplicates;
  `index.html` now loads `engine.js` before its UI script and owns only the
  mutable `state` and the canvas/DOM rendering.
- **Added `tests.js`** (25 assertions, all hand-derived) covering the log-event
  weighting, the multiplicative-HR + safety-penalty model, the anchored-indirect
  ARNI bridge (verified equal to the sum of logs), event totals under both
  TOPCAT settings, and edge cases.
- **Added a connectivity guard** (`isConnected`) and an empty-set guard in
  `eraSpan` (avoids a `Math.max(...[]) = -Infinity` glitch when no treatments are
  selected). These are additive correctness guards; existing views are unchanged.
- **Renamed** `nmahf.html` → `index.html` and added the Pages scaffold
  (`.nojekyll`, `.gitignore`, README).

The arithmetic of every original view was preserved **verbatim**; the tests
document and pin the exact numbers the UI displays.

## Tests

```
node tests.js
# 25 passed, 0 failed
```

## Caveats

The numbers are illustrative approximations of published HF trials, not a
maintained data extraction. Treat the displayed HRs, weights and rankings as a
teaching scaffold for reasoning about precision weighting, indirect bridging and
combination-therapy assumptions — **not** as clinical guidance. Apache-2.0
licensed.
