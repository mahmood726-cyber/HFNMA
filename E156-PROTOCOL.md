# E156-PROTOCOL — NMA-Synth (Heart-Failure Network Synthesis Explorer)

- **Project:** HFNMA (GitHub repo `HFNMA`, user `mahmood726-cyber`)
- **Revived:** 2026-06-05 (from a single-file `nmahf.html` dump)
- **Type:** single-file offline browser tool + Node-testable analytics engine
- **Dashboard:** GitHub Pages (`index.html`)

## What changed in the revival

- Made **fully offline**: removed the Google Fonts CDN `<link>`; the page now
  loads no external resource (zero `http(s)://` references remain).
- Extracted the dataset and the pure compute functions into `engine.js` (single
  source of truth); deleted the inline duplicates; `index.html` loads `engine.js`
  before its UI script and keeps only the mutable `state` and rendering.
- Added `tests.js` (25 hand-derived assertions, all passing).
- Added a network-connectivity guard and an empty-active-set guard (avoids a
  `Math.max(...[]) = -Infinity` glitch); existing views unchanged.
- Renamed `nmahf.html` → `index.html`; added `.nojekyll`, `.gitignore`, README.

## Body (E156 draft — CURRENT BODY)

How does a small heart-failure network behave when you down-weight a regionally
questionable trial and penalise combination-therapy optimism? This offline
dashboard encodes six nodes — placebo, SGLT2i, ARNI, MRA, ARB and digoxin —
linked by five illustrative hazard-ratio edges from landmark trials. It renders a
precision-weighted topology, a multiplicative combination model with a non-linear
safety penalty, and a ratio-scale forest from a pure engine that combines hazard
ratios on the log scale. With the TOPCAT correction on the MRA edge regains full
event weight, while ARNI-versus-placebo is an anchored indirect estimate bridged
through ARB with a deliberately wide interval. A revival audit made the tool fully
offline, unified data and statistics behind one tested engine, and added
connectivity and empty-set guards locked by twenty-five hand-derived assertions. The honest read is a teaching scaffold for reasoning about precision weighting,
indirect bridging and polypharmacy optimism. It is explicitly not a fitted
random-effects network meta-analysis or clinical guidance.

SUBMITTED: [ ]
