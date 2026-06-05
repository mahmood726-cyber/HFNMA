// ============================================================================
// tests.js — pure Node test harness for engine.js (NMA-Synth HF tool).
// Run: node tests.js   ->  prints checks, exits 0 if all pass, 1 otherwise.
// Every expected value is hand-derived independently (see comments).
// ============================================================================

const E = require('./engine.js');

let passed = 0, failed = 0;
function ok(name, cond, extra) {
    if (cond) { passed++; console.log('  PASS  ' + name + (extra ? '  (' + extra + ')' : '')); }
    else { failed++; console.log('  FAIL  ' + name + (extra ? '  (' + extra + ')' : '')); }
}
function near(a, b, tol) { return Math.abs(a - b) < (tol === undefined ? 1e-9 : tol); }

// Default "all active" state matching the app's initial state.
const allActive = () => ({
    activeIds: ['PLA', 'SGLT2', 'ARNI', 'MRA', 'ARB', 'DIG'],
    endpoint: 'composite', view: 'topology',
    includeBadTopcat: false, interactionPenalty: 0.8
});

console.log('=== Dataset integrity ===');
(() => {
    ok('6 treatments, 5 trials', E.TREATMENTS.length === 6 && E.TRIALS.length === 5,
        `${E.TREATMENTS.length} tx / ${E.TRIALS.length} trials`);
    // SGLT2 events are the sum 1122+850 = 1972 (verbatim expression in dataset).
    const sg = E.TRIALS.find(t => t.name === 'Pooled SGLT2');
    ok('SGLT2 pooled events == 1972 (1122+850)', sg.events === 1972, String(sg.events));
    // Every trial endpoint is a ratio (HR) > 0 — ratio measures, pooled on log scale.
    ok('all HRs positive ratio measures', E.TRIALS.every(t => t.hr_c > 0 && t.hr_m > 0));
})();

console.log('=== getEdgeWeight (log-event precision proxy) ===');
(() => {
    const st = allActive();
    const sg = E.TRIALS.find(t => t.name === 'Pooled SGLT2');   // events 1972, no MRA
    const topcat = E.TRIALS.find(t => t.name === 'TOPCAT');      // events 600, MRA edge

    // Non-MRA edge: weight = log(events) exactly, regardless of TOPCAT toggle.
    ok('w(SGLT2) == log(1972) == 7.587 (hand-derived)',
        near(E.getEdgeWeight(sg, st), Math.log(1972), 1e-12),
        E.getEdgeWeight(sg, st).toFixed(6));

    // MRA edge, TOPCAT OFF: 45% down-weight -> log(600*0.55) = log(330).
    ok('w(TOPCAT) penalised == log(330) == 5.799 (hand-derived)',
        near(E.getEdgeWeight(topcat, st), Math.log(330), 1e-12),
        E.getEdgeWeight(topcat, st).toFixed(6));

    // MRA edge, TOPCAT ON: full weight log(600). Toggling ON must INCREASE the weight.
    const stOn = allActive(); stOn.includeBadTopcat = true;
    ok('w(TOPCAT) full == log(600) == 6.397 (hand-derived)',
        near(E.getEdgeWeight(topcat, stOn), Math.log(600), 1e-12),
        E.getEdgeWeight(topcat, stOn).toFixed(6));
    ok('TOPCAT-ON weight > TOPCAT-OFF weight (penalty removed)',
        E.getEdgeWeight(topcat, stOn) > E.getEdgeWeight(topcat, st));
})();

console.log('=== calculateNetBenefit (multiplicative HR + safety penalty) ===');
(() => {
    // Active non-PLA/non-ARB agents: SGLT2(rf 1), ARNI(rf 2), MRA(rf 3), DIG(rf 2).
    // totalHR multiplies only the agents WITH an HR branch (SGLT2/ARNI/MRA; DIG has none):
    //   totalHR = 0.80*0.87*0.89 = 0.619440 (multiplicative on the natural ratio scale).
    // safetyScore sums risk_factor over ALL four active agents = 1+2+3+2 = 8.
    //   penalty = 8^1.5 * (0.8*0.05) = 22.627417 * 0.04 = 0.905097.
    //   realHR = min(1.0, 0.619440+0.905097) = min(1.0, 1.524537) = 1.0 (capped at null).
    const st = allActive();
    const r = E.calculateNetBenefit(st);
    ok('totalHR == 0.80*0.87*0.89 == 0.619440 (hand-derived)',
        near(r.totalHR, 0.80 * 0.87 * 0.89, 1e-12), r.totalHR.toFixed(6));
    ok('safetyScore == 1+2+3+2 == 8 (SGLT2,ARNI,MRA,DIG; hand-derived)', r.safetyScore === 8, String(r.safetyScore));
    ok('realHR capped at 1.0 (penalty exceeds benefit at default settings)',
        near(r.realHR, 1.0, 1e-12), r.realHR.toFixed(6));

    // With NO interaction penalty, realHR == totalHR (nothing pushes it back).
    const st0 = allActive(); st0.interactionPenalty = 0;
    const r0 = E.calculateNetBenefit(st0);
    ok('penalty=0 -> realHR == totalHR == 0.619440 (hand-derived)',
        near(r0.realHR, 0.80 * 0.87 * 0.89, 1e-12), r0.realHR.toFixed(6));

    // Property: realHR is always >= totalHR (penalty only ever moves toward 1.0) and <= 1.0.
    const st5 = allActive(); st5.interactionPenalty = 0.5;
    const r5 = E.calculateNetBenefit(st5);
    ok('totalHR <= realHR <= 1.0 (penalty pushes toward null, capped)',
        r5.realHR >= r5.totalHR - 1e-12 && r5.realHR <= 1.0 + 1e-12,
        `total=${r5.totalHR.toFixed(4)} real=${r5.realHR.toFixed(4)}`);

    // Single agent SGLT2 only: totalHR=0.80, safety=1, penalty=1^1.5*0.04=0.04 -> real=0.84.
    const stS = allActive(); stS.activeIds = ['PLA', 'SGLT2'];
    const rS = E.calculateNetBenefit(stS);
    ok('SGLT2-only totalHR==0.80, realHR==0.84 (hand-derived)',
        near(rS.totalHR, 0.80, 1e-12) && near(rS.realHR, 0.84, 1e-12),
        `total=${rS.totalHR} real=${rS.realHR.toFixed(4)}`);
})();

console.log('=== bridgedArniHR (anchored indirect on ratio scale) ===');
(() => {
    // PARAGON-HF is ARNI-vs-ARB; ARB-vs-PLA bridges to placebo. On the ratio scale
    // the indirect ARNI-vs-PLA HR is the PRODUCT: composite 0.87*0.95 = 0.8265.
    ok('bridged ARNI composite == 0.87*0.95 == 0.8265 (hand-derived)',
        near(E.bridgedArniHR('composite'), 0.8265, 1e-12), E.bridgedArniHR('composite').toFixed(6));
    // mortality: 0.95*0.98 = 0.931.
    ok('bridged ARNI mortality == 0.95*0.98 == 0.931 (hand-derived)',
        near(E.bridgedArniHR('mortality'), 0.931, 1e-12), E.bridgedArniHR('mortality').toFixed(6));
    // log of a product of ratios == sum of logs (the reason ratios must combine multiplicatively).
    ok('log(bridged) == log(0.87)+log(0.95) (log-scale additivity)',
        near(Math.log(E.bridgedArniHR('composite')), Math.log(0.87) + Math.log(0.95), 1e-12));
})();

console.log('=== totalEvents & eraSpan ===');
(() => {
    const st = allActive();
    // 1972 + 894 + (600*0.55=330) + 1500 + 221 = 4917 with TOPCAT OFF.
    ok('totalEvents (TOPCAT off) == 4917 (hand-derived)',
        near(E.totalEvents(st), 4917, 1e-9), String(E.totalEvents(st)));
    // TOPCAT ON: MRA contributes full 600 -> 4917 + 270 = 5187.
    const stOn = allActive(); stOn.includeBadTopcat = true;
    ok('totalEvents (TOPCAT on) == 5187 (hand-derived)',
        near(E.totalEvents(stOn), 5187, 1e-9), String(E.totalEvents(stOn)));
    ok('TOPCAT on > off (penalty restores 270 events)', E.totalEvents(stOn) > E.totalEvents(st));

    // eraSpan all active: 2021.5 (SGLT2) - 1997 (DIG) = 24.5.
    ok('eraSpan all == 24.5 yrs (2021.5-1997, hand-derived)',
        near(E.eraSpan(st), 24.5, 1e-9), String(E.eraSpan(st)));
    // No active treatments -> null (edge case; no Math.max(...[]) = -Infinity bug).
    ok('eraSpan(empty) == null (edge case)', E.eraSpan({ activeIds: [] }) === null);
})();

console.log('=== Connectivity guard ===');
(() => {
    // Full network is connected (every trial links to PLA or to the ARNI-ARB-PLA chain).
    ok('full active network is connected', E.isConnected(allActive()));
    // ARNI only reaches the network via ARB; drop ARB and PLA -> ARNI isolated.
    const dis = allActive(); dis.activeIds = ['PLA', 'SGLT2', 'ARNI'];
    ok('ARNI disconnected when ARB removed (only PARAGON edge is ARNI-ARB)',
        !E.isConnected(dis));
    // Single node / empty are trivially connected.
    ok('single-node network connected', E.isConnected({ activeIds: ['PLA'] }));
})();

console.log('=== getColor (cosmetic, pure) ===');
(() => {
    ok('getColor maps known ids and falls back', E.getColor('SGLT2') === '#38bdf8' && E.getColor('ZZZ') === '#555');
})();

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
