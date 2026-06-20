// ═══════════════════════════════════════════════════════════════
// SHOW-CONTROL TIMING LAYER
// ───────────────────────────────────────────────────────────────
// Single source of truth for the synchronized-show cadence. Both the
// game (SoarinOps.jsx) and the Show Clock UI (ShowClock.jsx) import from
// here so the timing model lives in exactly one place. The only real
// tuning knob is PHASE_DURATIONS.load — everything else derives from it.
// Do NOT hardcode 28 or 84 anywhere; reference the derived constants.
// ═══════════════════════════════════════════════════════════════

// Show-control timing (all seconds)
export const PHASE_DURATIONS = {
  load: 29,   // load window — the one tunable that sets the whole rhythm
  lift: 6,
  fly: 45,    // = existing RIDE_DURATION
  unload: 4,  // = existing unload time
};
export const PHASE_ORDER = ["load", "lift", "fly", "unload"];
export const CYCLE = PHASE_ORDER.reduce((s, p) => s + PHASE_DURATIONS[p], 0); // 84s
export const THEATER_COUNT = 3;
export const DISPATCH_INTERVAL = CYCLE / THEATER_COUNT; // 28.0s — global cadence
export const THEATER_OFFSET = Array.from({ length: THEATER_COUNT }, (_, i) => i * DISPATCH_INTERVAL); // [0, 28, 56]

// Phase presentation (colors drawn from the existing app palette)
export const PHASE_COLORS = {
  load: "#eab308",      // amber — loading window
  lift: "#a78bfa",      // violet — vehicle lifting
  fly: "#22c55e",       // green — in flight
  unload: "#60a5fa",    // blue — clearing
  preshow: "rgba(255,255,255,.18)",
};
export const PHASE_LABELS = {
  load: "LOAD",
  lift: "LIFT",
  fly: "FLY",
  unload: "UNLOAD",
  preshow: "STANDBY",
};

// ───────────────────────────────────────────────────────────────
// Deterministic heart: derive a theater's phase from the global clock.
// Given a single global elapsed time `now` (seconds) and a theater index
// `i`, return its current phase and progress.
// ───────────────────────────────────────────────────────────────
export function theaterShowState(now, i) {
  const local = (((now - THEATER_OFFSET[i]) % CYCLE) + CYCLE) % CYCLE;
  let t = local;
  for (const phase of PHASE_ORDER) {
    const dur = PHASE_DURATIONS[phase];
    if (t < dur) {
      return {
        phase,                    // 'load' | 'lift' | 'fly' | 'unload'
        progress: t / dur,        // 0..1 within current phase
        phaseRemaining: dur - t,  // seconds left in phase
        localTime: local,         // 0..CYCLE position
      };
    }
    t -= dur;
  }
  // Unreachable (modulo keeps local in [0, CYCLE)), but stay defensive.
  return { phase: "unload", progress: 1, phaseRemaining: 0, localTime: local };
}

// ───────────────────────────────────────────────────────────────
// Staggered startup wrapper. The theaters come online one at a time
// (theater i opens at THEATER_OFFSET[i]); before that it is in "preshow".
// Once now >= THEATER_OFFSET[i] this is exactly theaterShowState. This is
// the same semantics implied by the next-dispatch schedule below (k >= 0),
// so the very first dispatch of each theater gets a full load window
// instead of a phantom mid-cycle dispatch at t≈0.
// ───────────────────────────────────────────────────────────────
export function theaterPhase(now, i) {
  if (now < THEATER_OFFSET[i]) {
    const span = THEATER_OFFSET[i] || 1;
    return {
      phase: "preshow",
      progress: now / span,
      phaseRemaining: THEATER_OFFSET[i] - now,
      localTime: 0,
      preshow: true,
    };
  }
  return theaterShowState(now, i);
}

// The dispatch moment for theater i is its load→lift transition, i.e.
// global time === THEATER_OFFSET[i] + PHASE_DURATIONS.load + k * CYCLE.
export function dispatchTimeFor(i, k = 0) {
  return THEATER_OFFSET[i] + PHASE_DURATIONS.load + k * CYCLE;
}

// Global "next dispatch": the soonest load→lift transition strictly after
// `now`, across all theaters. Returns { theater, inSeconds }.
export function nextDispatch(now) {
  let best = Infinity;
  let bestTheater = 0;
  for (let i = 0; i < THEATER_COUNT; i++) {
    const base = dispatchTimeFor(i);
    let t = base + Math.max(0, Math.ceil((now - base) / CYCLE)) * CYCLE;
    while (t <= now) t += CYCLE;
    if (t - now < best) {
      best = t - now;
      bestTheater = i;
    }
  }
  return { theater: bestTheater, inSeconds: best };
}

// Proportional segment layout for one full CYCLE, for the Show Clock bar.
// Returns [{ phase, frac, leftFrac }] where frac/leftFrac are 0..1.
export function cycleSegments() {
  let acc = 0;
  return PHASE_ORDER.map((phase) => {
    const frac = PHASE_DURATIONS[phase] / CYCLE;
    const seg = { phase, frac, leftFrac: acc };
    acc += frac;
    return seg;
  });
}
