// Tests for the show-control timing model. Pure functions, no deps.
// Run with: npm test
import assert from "node:assert/strict";
import {
  PHASE_DURATIONS, CYCLE, DISPATCH_INTERVAL, THEATER_OFFSET, THEATER_COUNT,
  theaterShowState, theaterPhase, nextDispatch, cycleSegments, dispatchTimeFor,
} from "../src/showControl.js";

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ✓", name); };

console.log("show-control timing model");

t("derived constants", () => {
  assert.equal(CYCLE, 84);
  assert.equal(DISPATCH_INTERVAL, 28);
  assert.deepEqual(THEATER_OFFSET, [0, 28, 56]);
});

t("derived constants stay consistent with the load tunable", () => {
  // CYCLE / DISPATCH_INTERVAL / offsets must all derive from PHASE_DURATIONS.
  const sum = PHASE_DURATIONS.load + PHASE_DURATIONS.lift + PHASE_DURATIONS.fly + PHASE_DURATIONS.unload;
  assert.equal(CYCLE, sum);
  assert.equal(DISPATCH_INTERVAL, CYCLE / THEATER_COUNT);
  THEATER_OFFSET.forEach((o, i) => assert.equal(o, i * DISPATCH_INTERVAL));
});

t("phase boundaries for theater 0", () => {
  assert.equal(theaterShowState(0, 0).phase, "load");
  assert.equal(theaterShowState(28.9, 0).phase, "load");
  assert.equal(theaterShowState(29, 0).phase, "lift");   // dispatch moment
  assert.equal(theaterShowState(34.9, 0).phase, "lift");
  assert.equal(theaterShowState(35, 0).phase, "fly");
  assert.equal(theaterShowState(79.9, 0).phase, "fly");
  assert.equal(theaterShowState(80, 0).phase, "unload");
  assert.equal(theaterShowState(83.9, 0).phase, "unload");
  assert.equal(theaterShowState(84, 0).phase, "load");   // wrap
});

t("progress + remaining within a phase", () => {
  const s = theaterShowState(14.5, 0); // mid-load (0..29)
  assert.equal(s.phase, "load");
  assert.ok(Math.abs(s.progress - 14.5 / 29) < 1e-9);
  assert.ok(Math.abs(s.phaseRemaining - (29 - 14.5)) < 1e-9);
});

t("staggered startup (preshow before a theater opens)", () => {
  assert.equal(theaterPhase(0, 1).phase, "preshow");
  assert.equal(theaterPhase(27.9, 1).phase, "preshow");
  assert.equal(theaterPhase(28, 1).phase, "load");   // theater 1 comes online
  assert.equal(theaterPhase(0, 2).phase, "preshow");
  assert.equal(theaterPhase(56, 2).phase, "load");   // theater 2 comes online
});

t("dispatchTimeFor matches the load→lift transition", () => {
  assert.equal(dispatchTimeFor(0), 29);
  assert.equal(dispatchTimeFor(1), 57);
  assert.equal(dispatchTimeFor(2), 85);
  assert.equal(dispatchTimeFor(0, 1), 29 + 84);
});

t("nextDispatch countdown", () => {
  let nd = nextDispatch(0);
  assert.equal(nd.theater, 0); assert.equal(nd.inSeconds, 29);
  nd = nextDispatch(30);
  assert.equal(nd.theater, 1); assert.equal(nd.inSeconds, 27);
  nd = nextDispatch(100);
  assert.equal(nd.theater, 0); assert.equal(nd.inSeconds, 13); // T0 dispatches at 113
});

t("cycle segments cover the whole cycle exactly once", () => {
  const segs = cycleSegments();
  assert.equal(segs.length, 4);
  assert.ok(Math.abs(segs.reduce((s, x) => s + x.frac, 0) - 1) < 1e-9);
  assert.equal(segs[0].leftFrac, 0);
});

t("auto-dispatch cadence: T0@29, T1@57, T2@85, then every 28s", () => {
  const prev = [0, 1, 2].map((i) => theaterPhase(0, i).phase);
  const events = [];
  for (let step = 1; step <= 3000; step++) { // 300s @ 0.1s
    const now = step / 10;
    for (let i = 0; i < THEATER_COUNT; i++) {
      const ph = theaterPhase(now, i).phase;
      if (prev[i] === "load" && ph !== "load") events.push(+now.toFixed(1));
      prev[i] = ph;
    }
  }
  const sorted = [...events].sort((a, b) => a - b);
  for (const want of [29, 57, 85, 113, 141, 169]) assert.ok(sorted.includes(want), `expected a dispatch at ${want}s`);
  for (let k = 1; k < sorted.length; k++) {
    assert.ok(Math.abs((sorted[k] - sorted[k - 1]) - 28) < 0.15, "global cadence must be ~28s apart");
  }
});

t("never all three theaters loading at once (steady state)", () => {
  let maxLoading = 0;
  for (let step = 560; step <= 3000; step++) {
    const now = step / 10;
    const loading = [0, 1, 2].filter((i) => theaterPhase(now, i).phase === "load").length;
    maxLoading = Math.max(maxLoading, loading);
  }
  assert.ok(maxLoading < 3, "three theaters should never load simultaneously");
});

console.log(`\n${passed} tests passed`);
