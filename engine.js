// ============================================================================
// NMA-Synth engine.js — pure analytics core for the HF network synthesis tool.
// Runs in Node (for tests) and the browser (loaded before the inline UI script).
//
// This is the SINGLE SOURCE OF TRUTH for the dataset and the pure compute
// functions. The inline <script> in index.html owns only DOM / canvas rendering
// and the mutable `state` object, which it passes into these functions.
//
// SCOPE NOTE (honest): this tool is a *teaching / exploration* synthesis aid.
// Edge "weights" are crude event-count (inverse-variance proxy) values on the
// log scale, NOT a full GLS contrast model with a variance-covariance Laplacian.
// Combination benefit is a multiplicative-HR ("quadruple therapy") assumption
// pushed back toward the null by a non-linear safety penalty. None of this is a
// fitted random-effects NMA; the functions below are extracted verbatim from the
// original app so the numbers the UI shows are exactly the numbers tested here.
// ============================================================================

// === DATASET (extracted verbatim from the original inline script) ===
const TREATMENTS = [
    { id: 'PLA', name: 'Placebo / SoC', era: 2010, type: 'ref', risk_factor: 0 },
    { id: 'SGLT2', name: 'SGLT2i', era: 2021.5, type: 'new', risk_factor: 1, quality: 1.0 },
    { id: 'ARNI', name: 'ARNI', era: 2019, type: 'new', risk_factor: 2, quality: 1.0 }, // Higher side effect risk (Hypotension)
    { id: 'MRA', name: 'MRA (Spirono)', era: 2014, type: 'old', risk_factor: 3, quality: 0.55 }, // TOPCAT Penalty (only ~55% Americas valid)
    { id: 'ARB', name: 'ARB', era: 2005.5, type: 'old', risk_factor: 1, quality: 1.0 },
    { id: 'DIG', name: 'Digoxin', era: 1997, type: 'ancient', risk_factor: 2, quality: 1.0 }
];

// EDGES
// 'events' = approximate events in trial (used for precision weighting)
// 'N' = sample size (for reference)
const TRIALS = [
    { source: 'SGLT2', target: 'PLA', events: 1122 + 850, N: 12263, name: 'Pooled SGLT2', hr_c: 0.80, hr_m: 0.91 }, // High Precision
    { source: 'ARNI', target: 'ARB', events: 894, N: 4822, name: 'PARAGON-HF', hr_c: 0.87, hr_m: 0.95 }, // Active Control Bridge
    { source: 'MRA', target: 'PLA', events: 600, N: 3445, name: 'TOPCAT', hr_c: 0.89, hr_m: 0.90 }, // Precision lowered by regional issue
    { source: 'ARB', target: 'PLA', events: 1500, N: 7150, name: 'CHARM/I-PRES', hr_c: 0.95, hr_m: 0.98 },
    { source: 'DIG', target: 'PLA', events: 221, N: 988, name: 'DIG-Anc', hr_c: 0.82, hr_m: 1.02 }
];

// === ANALYTICS ENGINE (pure functions; `state` is passed in, never read from a global) ===

// Precision proxy for an edge = log(events), with a 45% down-weight on any MRA
// edge unless the user opts to include the regionally-questionable TOPCAT data.
// VERBATIM arithmetic from the original getEdgeWeight().
function getEdgeWeight(edge, state) {
    // Precision = Events (Inverse Variance Proxy)
    let w = edge.events;

    // MRA Specific Penalty (TOPCAT Regional Heterogeneity)
    if ((edge.source === 'MRA' || edge.target === 'MRA') && !state.includeBadTopcat) {
        w = w * 0.55; // Remove ~45% of weight (Russia/Georgia)
    }
    return Math.log(w); // Log scale for drawing thickness
}

// CNMA "additivity vs reality" model. Multiplicative HR combination across the
// active non-Placebo, non-ARB agents (ARB treated as background), then a
// non-linear safety penalty pushes the realised HR back toward 1.0.
// VERBATIM arithmetic from the original calculateNetBenefit().
function calculateNetBenefit(state, treatments) {
    const TX = treatments || TREATMENTS;
    // Simulates CNMA (Component NMA) logic vs Reality
    const active = TX.filter(t => state.activeIds.includes(t.id) && t.id !== 'PLA' && t.id !== 'ARB'); // ARB is usually background in combo

    // 1. Theoretical Additive Benefit (The "Quadruple Therapy" assumption)
    // Assume multiplicative HRs
    let totalHR = 1.0;
    active.forEach(t => {
        // Very rough HR approx for demo
        if (t.id === 'SGLT2') totalHR *= 0.80;
        if (t.id === 'ARNI') totalHR *= 0.87;
        if (t.id === 'MRA') totalHR *= 0.89;
    });

    // 2. Interaction / Safety Penalty
    // Risk increases non-linearly with number of agents (Hypotension, Hyperkalemia, Renal)
    let safetyScore = 0;
    active.forEach(t => safetyScore += t.risk_factor);

    // Non-linear penalty: (Risk^1.5) * user_setting
    const penalty = Math.pow(safetyScore, 1.5) * (state.interactionPenalty * 0.05);

    // "Real" HR is Theoretical HR pushed back towards 1.0 by adherence/safety issues
    const realHR = Math.min(1.0, totalHR + penalty);

    return { totalHR, realHR, safetyScore };
}

// Era-drift span (proxy for transitivity / incoherence risk) over the active set.
// Extracted from run(); pure. Returns null when no treatments are active.
function eraSpan(state, treatments) {
    const TX = treatments || TREATMENTS;
    const years = TX.filter(t => state.activeIds.includes(t.id)).map(t => t.era);
    if (years.length === 0) return null;
    return Math.max(...years) - Math.min(...years);
}

// Total precision (event count), with the same 45% MRA/TOPCAT down-weight the UI
// applies. Extracted verbatim from run()'s "Calculate Precision" block.
function totalEvents(state, trials) {
    const TR = trials || TRIALS;
    let total = 0;
    TR.forEach(e => {
        if (state.activeIds.includes(e.source) && state.activeIds.includes(e.target)) {
            let ev = e.events;
            if ((e.source === 'MRA' || e.target === 'MRA') && !state.includeBadTopcat) ev *= 0.55;
            total += ev;
        }
    });
    return total;
}

// ARNI's effect against placebo is only available by anchoring through ARB
// (PARAGON-HF is ARNI-vs-ARB). On the log/ratio scale the chained ("bridged")
// HR is the PRODUCT of the two ratios, NOT the sum/average — extracted verbatim
// from drawLoss()'s ARNI branch. Returns the indirect HR for a chosen endpoint.
function bridgedArniHR(endpoint, trials) {
    const TR = trials || TRIALS;
    const trialArni = TR.find(e => e.source === 'ARNI');
    const trialArb = TR.find(e => e.source === 'ARB');
    const rawHr = endpoint === 'composite' ? trialArni.hr_c : trialArni.hr_m;
    const bridgeHr = endpoint === 'composite' ? trialArb.hr_c : trialArb.hr_m;
    return rawHr * bridgeHr; // ratio measures multiply on the natural scale (= add on log scale)
}

// Network connectivity guard: treating each trial as an undirected edge, is the
// active sub-network a single connected component? A disconnected network cannot
// be synthesised. (Not present in the original app — added during revival as a
// correctness guard; pure graph BFS, no behavioural change to existing views.)
function isConnected(state, trials, treatments) {
    const TR = trials || TRIALS;
    const TX = treatments || TREATMENTS;
    const nodes = TX.filter(t => state.activeIds.includes(t.id)).map(t => t.id);
    if (nodes.length <= 1) return true;
    const adj = {};
    nodes.forEach(n => adj[n] = new Set());
    TR.forEach(e => {
        if (adj[e.source] && adj[e.target]) {
            adj[e.source].add(e.target);
            adj[e.target].add(e.source);
        }
    });
    const visited = new Set([nodes[0]]);
    const queue = [nodes[0]];
    while (queue.length) {
        const u = queue.shift();
        adj[u].forEach(v => { if (!visited.has(v)) { visited.add(v); queue.push(v); } });
    }
    return visited.size === nodes.length;
}

// Cosmetic colour map (pure). Kept here so the UI and any future export share one map.
function getColor(id) {
    if (id === 'SGLT2') return '#38bdf8';
    if (id === 'ARNI') return '#f472b6';
    if (id === 'MRA') return '#a78bfa';
    if (id === 'ARB') return '#fbbf24';
    if (id === 'PLA') return '#71717a';
    return '#555';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TREATMENTS, TRIALS,
        getEdgeWeight, calculateNetBenefit, eraSpan, totalEvents,
        bridgedArniHR, isConnected, getColor
    };
}
