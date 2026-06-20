import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import {
  PHASE_DURATIONS,
  THEATER_COUNT,
  CYCLE,
  theaterPhase,
  dispatchTimeFor,
} from "./showControl.js";
import ShowClock from "./ShowClock.jsx";
import {
  GATES, TOTAL, GK, ROW_NAMES, RIDE_DURATION, UNLOAD_DURATION,
  DIFFS, ACHIEVEMENTS,
  resetGroupIds, mkGroup, mkSeats, fmt, seatsFilled, getStars,
} from "./gameConfig.js";
import { SFX, getCtx, audioMgr } from "./audio.js";
import { FloatingClouds, RideVehicle } from "./sceneBits.jsx";
import PlanView from "./PlanView.jsx";

// Lazy-load the Three.js viewport so the heavy 3D dependency is split into its
// own chunk and fetched on demand (keeps the initial bundle small).
const Scene3D = lazy(() => import("./Scene3D.jsx"));

// ═══════════════════════════════════════
// INTERLOCKS (show-control safety gate)
// ───────────────────────────────────────
// ADVISORY (default): interlocks are visible but dispatch fires on the clock
// regardless. STRICT (runtime toggle): the dispatch is GATED — an un-ready
// theater is HELD at its dispatch cue, faults, and dispatches LATE once its
// interlock clears, then resumes its (now shifted) cadence.
//
// HOLD_EPS pins a held theater just inside the end of its load window; it must
// be smaller than the tick step (0.1s) so the cue re-fires the moment the
// interlock clears.
const HOLD_EPS = 0.05;
const MAX_THROUGHPUT = Math.round((TOTAL * THEATER_COUNT * 3600) / CYCLE); // guests/hr at 100%

// A theater is interlocked/ready when its restraints have passed seat
// check (every occupied row is seated) and its gates are closed (no group
// mid-placement). Only the active theater can have a group mid-placement.
const checkInterlock = (theater, isActive, sel, splitting) => {
  const filled = seatsFilled(theater.seats);
  const gatesClosed = !(isActive && (sel != null || splitting));
  const seatCheck = filled > 0; // placement is atomic, so any seated row is checked
  return { ready: gatesClosed && seatCheck, gatesClosed, seatCheck, filled };
};

// ═══════════════════════════════════════
// PERSISTENCE (achievements + best shift)
// ═══════════════════════════════════════
const STORE_KEY = "soarin-ops-v1";
const loadStore = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
};
const EMPTY_BESTS = { flights: 0, avgOcc: 0, throughput: 0, guests: 0 };

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function SoarinOps() {
  const [diff, setDiff] = useState(null);
  const [sbQueue, setSbQueue] = useState([]);
  const [llQueue, setLlQueue] = useState([]);
  const [theaters, setTheaters] = useState([
    { status: "empty", seats: mkSeats(), holding: [], rideTimer: 0, flightsCompleted: 0, loadStart: 0, lastPct: 0 },
    { status: "empty", seats: mkSeats(), holding: [], rideTimer: 0, flightsCompleted: 0, loadStart: 0, lastPct: 0 },
    { status: "empty", seats: mkSeats(), holding: [], rideTimer: 0, flightsCompleted: 0, loadStart: 0, lastPct: 0 },
  ]);
  const [activeT, setActiveT] = useState(0);
  const [sel, setSel] = useState(null);
  const [splitting, setSplitting] = useState(false);
  const [hover, setHover] = useState(null);
  const [msg, setMsg] = useState(null);
  const [flash, setFlash] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [totalSeated, setTotalSeated] = useState(0);
  const [totalFlights, setTotalFlights] = useState(0);
  const [unlocked, setUnlocked] = useState(() => loadStore().unlocked || []);
  const [bests, setBests] = useState(() => ({ ...EMPTY_BESTS, ...(loadStore().bests || {}) }));
  const [newAch, setNewAch] = useState([]);
  const [usedSplit, setUsedSplit] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showKeys, setShowKeys] = useState(false);
  const [showAch, setShowAch] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rideProgress, setRideProgress] = useState(0);
  const [dispatchFlash, setDispatchFlash] = useState(false);
  const [menuHovered, setMenuHovered] = useState(null);
  // Synchronized Show Mode — clock-driven staggered cadence. Default ON so a
  // reviewer sees the show-control behavior first; OFF = original free-play.
  const [showMode, setShowMode] = useState(true);
  const [strict, setStrict] = useState(false); // STRICT interlocks: gate dispatch on a fault
  const [faults, setFaults] = useState(0);      // interlock holds this shift
  const [occSum, setOccSum] = useState(0);       // Σ occupancy% across dispatches (→ avg)
  const [eventLog, setEventLog] = useState([]);  // RSS cue/fault log
  const [showReport, setShowReport] = useState(false);
  const [viewMode, setViewMode] = useState("plan"); // 'plan' (top-down) | '3d'

  // Refs mirror live state so the single game-loop interval can read fresh
  // values + auto-dispatch without a second clock or stale closures.
  const elapsedRef = useRef(0);
  const theatersRef = useRef([]);
  const totalFlightsRef = useRef(0);
  const streakRef = useRef(0);
  const unlockedRef = useRef([]);
  const totalSeatedRef = useRef(0);
  const usedSplitRef = useRef(false);
  const selRef = useRef(null);
  const splittingRef = useRef(false);
  const activeTRef = useRef(0);
  const prevPhaseRef = useRef(["preshow", "preshow", "preshow"]);
  const heldRef = useRef([false, false, false]);
  const holdShiftRef = useRef([0, 0, 0]);       // per-theater clock shift from holds (s)
  const holdBoundaryRef = useRef([0, 0, 0]);    // dispatch boundary a held theater is pinned to
  const strictRef = useRef(false);
  const greenStreakRef = useRef(0);             // consecutive interlock-clean dispatches
  const showFlightsRef = useRef(0);             // flights dispatched while in Show Mode
  const occSumRef = useRef(0);                  // Σ occupancy% (for best-shift avg)
  const faultsRef = useRef(0);
  const wasRidingRef = useRef(false);

  const mt = useRef(null);
  const toast = useCallback((t, type = "info") => {
    clearTimeout(mt.current);
    setMsg({ text: t, type });
    mt.current = setTimeout(() => setMsg(null), 2200);
  }, []);

  const curTheater = theaters[activeT];
  const curFilled = seatsFilled(curTheater.seats);
  const curPct = Math.round((curFilled / TOTAL) * 100);
  const selGroup = curTheater.holding.find(g => g.id === sel);
  const anyRiding = theaters.some(t => t.status === "riding");

  // ─── SHOW-CONTROL DERIVED VALUES ───
  const showNow = elapsed / 1000; // single global show clock (seconds)
  const curShow = showMode ? theaterPhase(showNow, activeT) : null;
  const curInterlock = checkInterlock(curTheater, true, sel, splitting);
  const throughput = elapsed > 5000 ? Math.round(totalSeated / (elapsed / 3600000)) : null;
  const avgOcc = totalFlights > 0 ? Math.round(occSum / totalFlights) : 0;
  // Lanes read each theater's authoritative clock phase (set by the tick), so
  // held / shifted theaters render correctly under STRICT interlocks.
  const showLanes = theaters.map((th, i) => {
    const il = checkInterlock(th, i === activeT, sel, splitting);
    return {
      occPct: Math.round((seatsFilled(th.seats) / TOTAL) * 100),
      ready: il.ready,
      held: th.status === "held",
      phase: th.showPhase || "preshow",
      localTime: th.showLocal ?? 0,
    };
  });

  // Keep refs in sync with live state for the interval-driven loop.
  useEffect(() => {
    theatersRef.current = theaters;
    totalFlightsRef.current = totalFlights;
    streakRef.current = streak;
    unlockedRef.current = unlocked;
    totalSeatedRef.current = totalSeated;
    usedSplitRef.current = usedSplit;
    selRef.current = sel;
    splittingRef.current = splitting;
    activeTRef.current = activeT;
    strictRef.current = strict;
    occSumRef.current = occSum;
  });

  // Append to the RSS cue/fault log (newest first, capped).
  const logEvent = useCallback((kind, theater, text) => {
    setEventLog(prev => [{ id: `${Date.now()}-${Math.random()}`, t: elapsedRef.current, kind, theater, text }, ...prev].slice(0, 40));
  }, []);

  // Persist achievements + best-shift stats across reloads.
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ unlocked, bests })); } catch {}
  }, [unlocked, bests]);

  // Fold the current shift's stats into the saved bests (max of each).
  const recordBests = useCallback(() => {
    setBests(b => ({
      flights: Math.max(b.flights || 0, totalFlightsRef.current),
      guests: Math.max(b.guests || 0, totalSeatedRef.current),
      avgOcc: Math.max(b.avgOcc || 0, totalFlightsRef.current > 0 ? Math.round(occSumRef.current / totalFlightsRef.current) : 0),
      throughput: Math.max(b.throughput || 0, elapsedRef.current > 5000 ? Math.round(totalSeatedRef.current / (elapsedRef.current / 3600000)) : 0),
    }));
  }, []);

  // Cleanup audio on unmount
  useEffect(() => () => audioMgr.cleanup(), []);

  // Auto-start from URL hash (for testing)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("autostart=")) {
      const d = hash.split("autostart=")[1]?.split("&")[0];
      if (d && DIFFS[d]) setTimeout(() => startGame(d), 300);
    }
  }, []);

  // ─── RIDE PROGRESS ANIMATION ───
  useEffect(() => {
    if (!anyRiding || paused) return;
    const iv = setInterval(() => {
      setRideProgress(p => (p + 0.005) % 1);
    }, 50);
    return () => clearInterval(iv);
  }, [anyRiding, paused]);

  const unlock = useCallback((ids) => {
    const fresh = ids.filter(id => !unlockedRef.current.includes(id));
    if (fresh.length === 0) return;
    SFX.achieve();
    unlockedRef.current = [...unlockedRef.current, ...fresh];
    setUnlocked(unlockedRef.current);
    setNewAch(ACHIEVEMENTS.filter(a => fresh.includes(a.id)));
    setTimeout(() => setNewAch([]), 4000);
  }, []);

  // ─── FLIGHT SCORING (shared by manual + auto/clock dispatch) ───
  // `light` uses a single soft cue instead of the full departure fanfare —
  // used for the every-28s show-clock dispatch so the audio doesn't pile up.
  const applyFlightScore = useCallback((pct, loadTime, allRiding, ready, isShow) => {
    if (isShow) {
      SFX.cue();
      audioMgr.playRide();
      setDispatchFlash(true);
      setTimeout(() => setDispatchFlash(false), 600);
    } else {
      SFX.depart();
      setTimeout(() => audioMgr.playCheck(), 700);
      setTimeout(() => audioMgr.playOpen(), 1500);
      setTimeout(() => audioMgr.playRide(), 2300);
      setDispatchFlash(true);
      setTimeout(() => setDispatchFlash(false), 1200);
    }

    const tf = totalFlightsRef.current + 1;
    totalFlightsRef.current = tf;
    setTotalFlights(tf);
    setOccSum(s => s + pct);

    const ns = pct >= 90 ? streakRef.current + 1 : 0;
    streakRef.current = ns;
    setStreak(ns);

    const gs = ready ? greenStreakRef.current + 1 : 0;
    greenStreakRef.current = gs;
    const sf = isShow ? showFlightsRef.current + 1 : showFlightsRef.current;
    showFlightsRef.current = sf;

    const checks = [
      { id: "perfect", c: pct >= 100 },
      { id: "speed", c: pct >= 80 && loadTime < 25000 },
      { id: "triple", c: allRiding },
      { id: "split", c: usedSplitRef.current },
      { id: "ten", c: tf >= 10 },
      { id: "twenty", c: tf >= 20 },
      { id: "streak", c: ns >= 3 },
      { id: "served500", c: totalSeatedRef.current >= 500 },
      { id: "greenboard", c: gs >= 5 },
      { id: "onclock", c: sf >= 10 },
    ];
    unlock(checks.filter(a => a.c).map(a => a.id));
    if (pct >= 95) { setConfetti(true); setTimeout(() => setConfetti(false), 3500); }
  }, [unlock]);

  // ─── MAIN TICK (single game loop — also drives the show clock) ───
  useEffect(() => {
    if (!running || paused || !diff) return;
    const iv = setInterval(() => {
      elapsedRef.current += 100;
      setElapsed(elapsedRef.current);

      if (!showMode) {
        // ── FREE-PLAY: original behavior, untouched ──
        setTheaters(prev => {
          const next = prev.map(th => {
            if (th.status === "riding") {
              const nt = th.rideTimer - 0.1;
              if (nt <= 0) return { ...th, status: "unloading", rideTimer: UNLOAD_DURATION };
              return { ...th, rideTimer: Math.max(0, +(nt).toFixed(1)) };
            }
            if (th.status === "unloading") {
              const nt = th.rideTimer - 0.1;
              if (nt <= 0) {
                const hasHolding = th.holding && th.holding.length > 0;
                return { ...th, status: hasHolding ? "loading" : "empty", seats: mkSeats(), rideTimer: 0 };
              }
              return { ...th, rideTimer: Math.max(0, +(nt).toFixed(1)) };
            }
            return th;
          });
          if (prev.some(t => t.status === "riding") && !next.some(t => t.status === "riding")) {
            setTimeout(() => audioMgr.stopRide(), 0);
          }
          return next;
        });
        return;
      }

      // ── SYNCHRONIZED SHOW MODE: derive every theater from the global clock ──
      const now = elapsedRef.current / 1000;
      const cur = theatersRef.current;
      const events = [];
      const next = cur.map((th, i) => {
        let nth = th;
        // Effective (hold-shifted) time. holdShift is 0 in ADVISORY mode, so eff
        // == now and behaviour is the deterministic global clock. Under STRICT it
        // grows while a theater is held, shifting its whole timeline.
        let eff = now - holdShiftRef.current[i];
        let ps = theaterPhase(eff, i);
        const prevPhase = prevPhaseRef.current[i];

        // Entering a fresh load window (from preshow or unload): reset seats,
        // carry over still-holding groups, restart the load timer, clear hold.
        if (ps.phase === "load" && prevPhase !== "load") {
          nth = { ...nth, seats: mkSeats(), loadStart: elapsedRef.current };
          heldRef.current[i] = false;
          if (prevPhase === "preshow") events.push({ type: "online", i });
        }

        // Dispatch moment = load→lift transition.
        if (prevPhase === "load" && ps.phase !== "load") {
          const pct = Math.round((seatsFilled(th.seats) / TOTAL) * 100);
          const gatesClosed = !((i === activeTRef.current) && (selRef.current != null || splittingRef.current));
          const ready = gatesClosed && pct > 0;
          if (strictRef.current && !ready) {
            // HOLD: pin just inside the end of the load window. Dispatch fires
            // LATE the moment the interlock clears (next tick once ready).
            if (!heldRef.current[i]) {
              const k = Math.max(0, Math.round((eff - dispatchTimeFor(i, 0)) / CYCLE));
              holdBoundaryRef.current[i] = dispatchTimeFor(i, k);
              heldRef.current[i] = true;
              events.push({ type: "hold", i, reason: gatesClosed ? "seat check" : "gates open" });
            }
            holdShiftRef.current[i] = now - (holdBoundaryRef.current[i] - HOLD_EPS);
            eff = now - holdShiftRef.current[i];
            ps = theaterPhase(eff, i); // pinned back into 'load'
          } else {
            events.push({ type: "dispatch", i, pct, ready, loadTime: elapsedRef.current - th.loadStart });
            nth = { ...nth, lastPct: pct, flightsCompleted: th.flightsCompleted + 1 };
            heldRef.current[i] = false;
          }
        }

        prevPhaseRef.current[i] = ps.phase;

        // Map the (possibly hold-pinned) clock phase onto the status machine.
        const held = heldRef.current[i];
        let status, rideTimer = 0, rideTotal;
        if (held) { status = "held"; }
        else if (ps.phase === "preshow") { status = "standby"; }
        else if (ps.phase === "load") { status = "loading"; }
        else if (ps.phase === "unload") {
          status = "unloading"; rideTimer = ps.phaseRemaining; rideTotal = PHASE_DURATIONS.unload;
        } else { // lift + fly = the dispatched flight
          status = "riding";
          rideTimer = (PHASE_DURATIONS.load + PHASE_DURATIONS.lift + PHASE_DURATIONS.fly) - ps.localTime;
          rideTotal = PHASE_DURATIONS.lift + PHASE_DURATIONS.fly;
        }

        return { ...nth, status, rideTimer, rideTotal, held, showPhase: held ? "held" : ps.phase, showLocal: ps.localTime };
      });

      const ridingCount = next.filter(t => t.status === "riding").length;
      theatersRef.current = next;
      setTheaters(next);

      if (wasRidingRef.current && ridingCount === 0) setTimeout(() => audioMgr.stopRide(), 0);
      wasRidingRef.current = ridingCount > 0;

      events.forEach(ev => {
        if (ev.type === "dispatch") {
          applyFlightScore(ev.pct, ev.loadTime, ridingCount === THEATER_COUNT, ev.ready, true);
          logEvent("dispatch", ev.i, `T${ev.i + 1} DISPATCH · ${ev.pct}% ${"★".repeat(getStars(ev.pct))}`);
        } else if (ev.type === "hold") {
          streakRef.current = 0; setStreak(0);
          greenStreakRef.current = 0;
          faultsRef.current += 1; setFaults(faultsRef.current);
          SFX.hold();
          logEvent("hold", ev.i, `T${ev.i + 1} HELD · ${ev.reason}`);
        } else if (ev.type === "online") {
          logEvent("online", ev.i, `T${ev.i + 1} ONLINE`);
        }
      });
    }, 100);
    return () => clearInterval(iv);
  }, [running, paused, diff, showMode, applyFlightScore, logEvent]);

  // ─── GUEST ARRIVAL ───
  useEffect(() => {
    if (!running || paused || !diff) return;
    const d = DIFFS[diff];
    const sbIv = setInterval(() => { setSbQueue(p => p.length < 25 ? [...p, mkGroup(d.groupMax)] : p); }, d.sbRate);
    const llIv = setInterval(() => { setLlQueue(p => p.length < 15 ? [...p, mkGroup(Math.min(d.groupMax, 6))] : p); }, d.llRate);
    return () => { clearInterval(sbIv); clearInterval(llIv) };
  }, [running, paused, diff]);

  // ─── START GAME ───
  const startGame = (d) => {
    resetGroupIds();
    getCtx(); // unlock audio context on user interaction
    setDiff(d); setRunning(true); setPaused(false); setElapsed(0);
    setSbQueue(Array.from({ length: 8 }, () => mkGroup(DIFFS[d].groupMax)));
    setLlQueue(Array.from({ length: 4 }, () => mkGroup(Math.min(DIFFS[d].groupMax, 6))));
    const initTheaters = [
      { status: "empty", seats: mkSeats(), holding: [], rideTimer: 0, flightsCompleted: 0, loadStart: 0, lastPct: 0 },
      { status: "empty", seats: mkSeats(), holding: [], rideTimer: 0, flightsCompleted: 0, loadStart: 0, lastPct: 0 },
      { status: "empty", seats: mkSeats(), holding: [], rideTimer: 0, flightsCompleted: 0, loadStart: 0, lastPct: 0 },
    ];
    setTheaters(initTheaters);
    setActiveT(0); setSel(null); setSplitting(false);
    setTotalSeated(0); setTotalFlights(0); setUsedSplit(false); setStreak(0);
    setNewAch([]); setFaults(0); setOccSum(0); setEventLog([]); setShowReport(false);
    // Reset the show clock + loop refs to a clean baseline.
    elapsedRef.current = 0;
    theatersRef.current = initTheaters;
    totalFlightsRef.current = 0; streakRef.current = 0;
    totalSeatedRef.current = 0; usedSplitRef.current = false;
    faultsRef.current = 0; wasRidingRef.current = false;
    greenStreakRef.current = 0; showFlightsRef.current = 0;
    heldRef.current = [false, false, false];
    holdShiftRef.current = [0, 0, 0]; holdBoundaryRef.current = [0, 0, 0];
    prevPhaseRef.current = [0, 1, 2].map(i => theaterPhase(0, i).phase);
    audioMgr.playAmbient();
  };

  // ─── END SHIFT (open the shift report) ───
  const endShift = () => {
    // Clean Shift achievement: 3+ minutes with zero interlock holds.
    if (showMode && elapsedRef.current >= 180000 && faultsRef.current === 0 && totalFlightsRef.current > 0) {
      unlock(["nohold"]);
    }
    recordBests();
    setPaused(true);
    setShowReport(true);
  };

  // ─── MERGE ───
  const releaseSB = () => {
    if (paused) return;
    if (showMode && curTheater.status !== "loading") { toast("Theater not in its load window", "error"); return; }
    if (!showMode && (curTheater.status === "riding" || curTheater.status === "unloading")) return;
    if (sbQueue.length === 0) { toast("Standby queue empty", "error"); return; }
    const batch = sbQueue.slice(0, 3);
    setSbQueue(p => p.slice(batch.length));
    if (curTheater.status === "empty") {
      setTheaters(p => p.map((th, i) => i === activeT ? { ...th, status: "loading", holding: [...th.holding, ...batch], loadStart: elapsed } : th));
    } else {
      setTheaters(p => p.map((th, i) => i === activeT ? { ...th, holding: [...th.holding, ...batch] } : th));
    }
    SFX.merge(); toast(`+${batch.length} groups from Standby → Theater ${activeT + 1}`, "success");
  };

  const releaseLL = () => {
    if (paused) return;
    if (showMode && curTheater.status !== "loading") { toast("Theater not in its load window", "error"); return; }
    if (!showMode && (curTheater.status === "riding" || curTheater.status === "unloading")) return;
    if (llQueue.length === 0) { toast("Lightning Lane empty", "error"); return; }
    const batch = llQueue.slice(0, 2);
    setLlQueue(p => p.slice(batch.length));
    if (curTheater.status === "empty") {
      setTheaters(p => p.map((th, i) => i === activeT ? { ...th, status: "loading", holding: [...th.holding, ...batch], loadStart: elapsed } : th));
    } else {
      setTheaters(p => p.map((th, i) => i === activeT ? { ...th, holding: [...th.holding, ...batch] } : th));
    }
    SFX.merge(); toast(`+${batch.length} groups from LL → Theater ${activeT + 1}`, "success");
  };

  // ─── SELECT ───
  const pickGroup = (g) => {
    if (paused || curTheater.status !== "loading") return;
    setSplitting(false);
    setSel(sel === g.id ? null : g.id);
    if (sel !== g.id) SFX.select();
  };

  // ─── PLACE ───
  const placeInRow = (gk, ri) => {
    if (!selGroup || paused || curTheater.status !== "loading") return;
    const row = curTheater.seats[gk][ri];
    const left = row.capacity - row.filled;
    if (selGroup.size > left) { SFX.error(); toast(`Group of ${selGroup.size} doesn't fit! ${left} left.`, "error"); return; }
    setFlash(`${gk}${ri}`); setTimeout(() => setFlash(null), 500);
    const newFilled = row.filled + selGroup.size;
    const rowFull = newFilled === row.capacity;
    setTheaters(p => p.map((th, i) => {
      if (i !== activeT) return th;
      const newSeats = {};
      GK.forEach(k => { newSeats[k] = th.seats[k].map((r, idx) => k === gk && idx === ri ? { ...r, filled: r.filled + selGroup.size } : { ...r }); });
      return { ...th, seats: newSeats, holding: th.holding.filter(g => g.id !== selGroup.id) };
    }));
    setTotalSeated(p => p + selGroup.size);
    if (rowFull) SFX.rowFull(); else SFX.place();
    toast(`+${selGroup.size} → ${GATES[gk].label}${ri + 1}`, "success");
    setSel(null); setSplitting(false);
  };

  // ─── SPLIT ───
  const doSplit = (n) => {
    if (!selGroup || paused) return;
    SFX.split(); setUsedSplit(true);
    setTheaters(p => p.map((th, i) => {
      if (i !== activeT) return th;
      const idx = th.holding.findIndex(g => g.id === selGroup.id);
      const nh = [...th.holding];
      nh.splice(idx, 1, { id: `${Date.now()}-sa`, size: n }, { id: `${Date.now()}-sb`, size: selGroup.size - n });
      return { ...th, holding: nh };
    }));
    setSel(null); setSplitting(false); toast(`Split ${selGroup.size} → ${n}+${selGroup.size - n}`, "info");
  };

  // ─── DISPATCH (manual — free-play only; Show Mode dispatches on the clock) ───
  const dispatch = () => {
    if (showMode) return;
    if (curTheater.status !== "loading" || paused) return;
    const pct = Math.round((seatsFilled(curTheater.seats) / TOTAL) * 100);
    const loadTime = elapsed - curTheater.loadStart;
    const allRiding = theaters.filter(t => t.status === "riding").length === 2;
    const ready = sel == null && !splitting && pct > 0;

    setTheaters(p => p.map((th, i) => i === activeT ? {
      ...th, status: "riding", rideTimer: RIDE_DURATION,
      flightsCompleted: th.flightsCompleted + 1, lastPct: pct,
    } : th));

    applyFlightScore(pct, loadTime, allRiding, ready, false);

    const nextEmpty = theaters.findIndex((t, i) => i !== activeT && (t.status === "empty" || t.status === "loading"));
    if (nextEmpty >= 0) { setActiveT(nextEmpty); SFX.tabSwitch(); }
  };

  // ─── MODE TOGGLE ───
  const toggleShowMode = () => {
    setShowMode(v => {
      const nv = !v;
      heldRef.current = [false, false, false];
      holdShiftRef.current = [0, 0, 0]; holdBoundaryRef.current = [0, 0, 0];
      if (nv) {
        // Re-baseline the clock so enabling mid-game doesn't fire a stray dispatch.
        prevPhaseRef.current = [0, 1, 2].map(i => theaterPhase(elapsedRef.current / 1000, i).phase);
      } else {
        // Leaving Show Mode: normalize clock-only statuses back to free-play ones
        // and drop the clock-derived phase length so timers read normally.
        setTheaters(p => p.map(th => {
          const base = (th.status === "standby" || th.status === "held")
            ? { ...th, status: th.holding.length ? "loading" : "empty", rideTimer: 0 }
            : th;
          return { ...base, rideTotal: undefined };
        }));
      }
      SFX.route();
      return nv;
    });
  };

  const toggleStrict = () => { setStrict(s => !s); SFX.route(); };

  // ─── KEYBOARD ───
  useEffect(() => {
    if (!diff) return;
    const h = (e) => {
      const k = e.key.toLowerCase();
      if (k === " ") { e.preventDefault(); if (running) setPaused(p => !p); return; }
      if (k === "escape") { setSel(null); setSplitting(false); return; }
      if (k === "s" && selGroup && selGroup.size >= 2 && !paused) { setSplitting(p => !p); return; }
      if (k === "q" && !paused) { releaseSB(); return; }
      if (k === "l" && !paused) { releaseLL(); return; }
      if (k === "d" && !paused) { dispatch(); return; }
      if (k === "m") { setMuted(audioMgr.toggleMute()); return; }
      if (k === "y") { toggleShowMode(); return; }
      if (k === "i" && showMode) { toggleStrict(); return; }
      if (["1", "2", "3"].includes(k) && !sel && !splitting) {
        const ti = parseInt(k) - 1;
        if (ti !== activeT) { setActiveT(ti); SFX.tabSwitch(); setSel(null); setSplitting(false); }
        return;
      }
      if (/^[1-9]$/.test(k) && splitting && selGroup) { const n = parseInt(k); if (n >= 1 && n < selGroup.size) doSplit(n); return; }
      if (/^[0-9]$/.test(k) && !splitting && curTheater.status === "loading") {
        const idx = k === "0" ? 9 : parseInt(k) - 1;
        if (idx < curTheater.holding.length && !paused) {
          const g = curTheater.holding[idx];
          setSel(sel === g.id ? null : g.id); if (sel !== g.id) SFX.select(); setSplitting(false);
        }
        return;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const occColor = (p) => p >= 95 ? "#22c55e" : p >= 80 ? "#eab308" : p >= 50 ? "#f97316" : "#ef4444";

  // ═══════════════════════════════════════
  // STYLES (shared)
  // ═══════════════════════════════════════
  const KEYFRAMES = `
    @keyframes fin { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
    @keyframes finUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
    @keyframes spulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,179,71,.4) } 50% { box-shadow: 0 0 0 5px rgba(255,179,71,0) } }
    @keyframes cfall { 0% { transform: translateY(0) rotate(0); opacity: 1 } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0 } }
    @keyframes achIn { from { opacity: 0; transform: scale(.85) } to { opacity: 1; transform: scale(1) } }
    @keyframes rideGlow { 0%,100% { opacity: .6 } 50% { opacity: 1 } }
    @keyframes cloudDrift {
      0% { left: -15%; transform: scale(var(--cloud-scale, 1)); filter: opacity(0) }
      5% { filter: opacity(var(--cloud-op, 0.06)) }
      95% { filter: opacity(var(--cloud-op, 0.06)) }
      100% { left: 110%; transform: scale(var(--cloud-scale, 1)); filter: opacity(0) }
    }
    @keyframes dispatchFlash {
      0% { opacity: 0 }
      15% { opacity: .25 }
      100% { opacity: 0 }
    }
    @keyframes floatGlider {
      0% { transform: translateY(0) rotate(-2deg) }
      50% { transform: translateY(-6px) rotate(2deg) }
      100% { transform: translateY(0) rotate(-2deg) }
    }
    @keyframes pulseRing {
      0% { transform: scale(0.95); opacity: .6 }
      50% { transform: scale(1.05); opacity: 1 }
      100% { transform: scale(0.95); opacity: .6 }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0 }
      100% { background-position: 200% 0 }
    }
    @keyframes breathe {
      0%, 100% { opacity: 0.5 }
      50% { opacity: 0.9 }
    }
    @keyframes slideInRight { from { transform: translateX(30px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
    ::-webkit-scrollbar { width: 3px }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 3px }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent }
    html, body, #root { height: 100%; width: 100%; overflow: hidden; touch-action: manipulation; overscroll-behavior: none }
  `;

  const BG = "linear-gradient(170deg, #040810 0%, #081020 25%, #0a1430 50%, #0d1838 75%, #101d45 100%)";

  // ═══════════════════════════════════════
  // MENU SCREEN
  // ═══════════════════════════════════════
  if (!diff) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BG, color: "#fff", fontFamily: "'Avenir Next','Segoe UI',system-ui,sans-serif", padding: 24, position: "relative", overflow: "hidden" }}>
      <style>{KEYFRAMES}</style>
      <FloatingClouds count={5} opacity={0.04} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", animation: "fin .8s ease" }}>
        {/* Logo */}
        <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img
            src="/logo.png"
            alt="Soarin'"
            style={{
              width: 320, height: "auto",
              filter: "drop-shadow(0 4px 20px rgba(77,166,255,.3))",
              animation: "floatGlider 5s ease-in-out infinite",
            }}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
            <div style={{ height: 1, width: 60, background: "linear-gradient(90deg, transparent, rgba(255,255,255,.15))" }} />
            <span style={{ fontSize: 10, color: "#8cb8e0", letterSpacing: 6, fontWeight: 700 }}>OPERATIONS SIMULATOR</span>
            <div style={{ height: 1, width: 60, background: "linear-gradient(90deg, rgba(255,255,255,.15), transparent)" }} />
          </div>
          <div style={{
            marginTop: 8, padding: "4px 18px", borderRadius: 11,
            background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
          }}>
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(140,184,224,.45)", letterSpacing: 2.5 }}>3-THEATER MODE</span>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,.28)", letterSpacing: 2.5, marginBottom: 18, textAlign: "center", maxWidth: 470, lineHeight: 1.8, fontWeight: 500 }}>
          Ride/show supervisor (RSS) console — run three theaters on one
          <br />show clock: load each gate during its window, hit the staggered
          <br />dispatch cue every 28s, and keep every interlock green.
        </div>

        {/* Synchronized Show Mode toggle */}
        <div onClick={toggleShowMode} style={{
          display: "flex", alignItems: "center", gap: 11, cursor: "pointer", marginBottom: 24,
          padding: "9px 16px", borderRadius: 11,
          border: `1px solid ${showMode ? "rgba(92,224,184,.3)" : "rgba(255,255,255,.08)"}`,
          background: showMode ? "rgba(92,224,184,.05)" : "rgba(255,255,255,.02)", transition: "all .25s",
        }}>
          <div style={{
            width: 34, height: 18, borderRadius: 9, padding: 2, transition: "all .25s",
            background: showMode ? "rgba(92,224,184,.45)" : "rgba(255,255,255,.1)",
            display: "flex", justifyContent: showMode ? "flex-end" : "flex-start", alignItems: "center",
          }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "all .25s" }} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: showMode ? "#5ce0b8" : "rgba(255,255,255,.5)" }}>
              SYNCHRONIZED SHOW MODE · {showMode ? "ON" : "OFF"}
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.3)", marginTop: 1 }}>
              {showMode ? "Clock-driven staggered cadence + interlocks" : "Free-play — load and dispatch manually"}
            </div>
          </div>
        </div>

        {/* Difficulty cards */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginBottom: 28 }}>
          {Object.entries(DIFFS).map(([key, d]) => (
            <div
              key={key}
              onClick={() => startGame(key)}
              onMouseEnter={() => setMenuHovered(key)}
              onMouseLeave={() => setMenuHovered(null)}
              style={{
                width: 180, padding: "22px 16px", borderRadius: 16, cursor: "pointer",
                background: menuHovered === key ? `${d.color}0a` : "rgba(255,255,255,.02)",
                border: `1.5px solid ${menuHovered === key ? d.color : `${d.color}20`}`,
                textAlign: "center", transition: "all .25s ease",
                transform: menuHovered === key ? "translateY(-2px)" : "none",
                boxShadow: menuHovered === key ? `0 8px 30px ${d.color}15` : "none",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900, color: d.color, letterSpacing: 3, marginBottom: 6 }}>{d.label.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", lineHeight: 1.6 }}>{d.desc}</div>
            </div>
          ))}
        </div>

        {bests.flights > 0 && (
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { label: "BEST FLIGHTS", val: bests.flights },
              { label: "BEST AVG OCC", val: `${bests.avgOcc}%` },
              { label: "BEST THRUPUT", val: `${bests.throughput}/hr` },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,.25)", letterSpacing: 1.5 }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", color: "#5ce0b8" }}>{s.val}</div>
              </div>
            ))}
          </div>
        )}

        {unlocked.length > 0 && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.25)", letterSpacing: 2.5, marginBottom: 6 }}>ACHIEVEMENTS</div>
            <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
              {ACHIEVEMENTS.filter(a => unlocked.includes(a.id)).map(a => (
                <span key={a.id} title={a.title} style={{ fontSize: 16, padding: "4px 7px", borderRadius: 6, background: "rgba(255,255,255,.04)" }}>{a.icon}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 10, color: "rgba(255,255,255,.16)", textAlign: "center", lineHeight: 2, letterSpacing: 0.5 }}>
          <span style={{ color: "rgba(255,255,255,.3)" }}>Q</span> release standby
          {" · "}<span style={{ color: "rgba(255,255,255,.3)" }}>L</span> release LL
          {" · "}<span style={{ color: "rgba(255,255,255,.3)" }}>1/2/3</span> switch theater
          {" · "}<span style={{ color: "rgba(255,255,255,.3)" }}>D</span> dispatch
          {" · "}<span style={{ color: "rgba(255,255,255,.3)" }}>S</span> split
          {" · "}<span style={{ color: "rgba(255,255,255,.3)" }}>Y</span> sync mode
          {" · "}<span style={{ color: "rgba(255,255,255,.3)" }}>I</span> interlocks
          {" · "}<span style={{ color: "rgba(255,255,255,.3)" }}>M</span> mute
          {" · "}<span style={{ color: "rgba(255,255,255,.3)" }}>Space</span> pause
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════
  // GAME SCREEN
  // ═══════════════════════════════════════
  const statusColor = { empty: "rgba(255,255,255,.2)", loading: "#eab308", riding: "#22c55e", unloading: "#60a5fa", standby: "rgba(255,255,255,.25)", held: "#ef4444" };
  const statusLabel = { empty: "EMPTY", loading: "LOADING", riding: "IN FLIGHT", unloading: "CLEARING", standby: "STANDBY", held: "HELD" };

  return (
    <div style={{ minHeight: "100vh", height: "100vh", background: BG, color: "#fff", fontFamily: "'Avenir Next','Segoe UI',system-ui,sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{KEYFRAMES}</style>

      <FloatingClouds count={4} opacity={anyRiding ? 0.08 : 0.03} inFlight={anyRiding} />

      {/* Dispatch flash overlay */}
      {dispatchFlash && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 998, pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(255,255,255,.2) 0%, transparent 70%)",
          animation: "dispatchFlash 1.2s ease-out forwards",
        }} />
      )}

      {/* Confetti */}
      {confetti && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999, overflow: "hidden" }}>
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute", left: `${(i * 31 + 7) % 100}%`, top: -20,
              width: 6 + (i % 4) * 2, height: 6 + (i % 3) * 2,
              background: ["#4da6ff", "#ffb347", "#5ce0b8", "#ef4444", "#a78bfa"][i % 5],
              borderRadius: i % 2 ? "50%" : "2px",
              animation: `cfall ${1.8 + (i % 10) * .22}s ease-in forwards`,
              animationDelay: `${(i % 8) * .1}s`,
            }} />
          ))}
        </div>
      )}

      {/* Achievement toast */}
      {newAch.length > 0 && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 998, display: "flex", gap: 8, animation: "achIn .4s ease" }}>
          {newAch.map(a => (
            <div key={a.id} style={{ padding: "10px 16px", borderRadius: 12, background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.25)", textAlign: "center", backdropFilter: "blur(10px)" }}>
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", marginTop: 2 }}>{a.title}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "10px 12px 20px", height: "100vh", display: "flex", flexDirection: "column" }}>

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexShrink: 0 }}>
          <div onClick={() => { if (!running || paused) { recordBests(); setDiff(null); setRunning(false); audioMgr.stopAmbient(); audioMgr.stopRide(); } }}
            style={{ cursor: "pointer", fontSize: 10, color: "rgba(255,255,255,.25)", letterSpacing: 1.5, transition: "color .2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,.5)"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,.25)"}>
            ← MENU
          </div>
          <div style={{
            textAlign: "center", fontSize: 15, fontWeight: 900, letterSpacing: 4,
            background: "linear-gradient(90deg,#c0e0ff,#ffffff,#b0d8ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            SOARIN' OPS
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <div onClick={() => setMuted(audioMgr.toggleMute())}
              style={{ cursor: "pointer", fontSize: 12, border: `1px solid ${muted ? "rgba(239,68,68,.3)" : "rgba(255,255,255,.1)"}`, borderRadius: 6, padding: "2px 7px", color: muted ? "#ef4444" : "rgba(255,255,255,.4)", transition: "all .2s" }}>
              {muted ? "🔇" : "🔊"}
            </div>
            <div onClick={() => setShowKeys(!showKeys)}
              style={{ cursor: "pointer", fontSize: 10, border: "1px solid rgba(255,255,255,.08)", borderRadius: 6, padding: "2px 7px", color: "rgba(255,255,255,.35)" }}>⌨</div>
            <div onClick={() => setShowAch(!showAch)}
              style={{ cursor: "pointer", fontSize: 12, border: "1px solid rgba(255,255,255,.08)", borderRadius: 6, padding: "2px 7px" }}>
              🏆<span style={{ fontSize: 10, color: "rgba(255,255,255,.35)", marginLeft: 2 }}>{unlocked.length}</span>
            </div>
            <div onClick={toggleShowMode} title="Synchronized Show Mode — staggered clock-driven dispatch (Y)"
              style={{
                cursor: "pointer", fontSize: 9, fontWeight: 800, letterSpacing: 1, transition: "all .2s",
                border: `1px solid ${showMode ? "rgba(92,224,184,.35)" : "rgba(255,255,255,.1)"}`,
                borderRadius: 6, padding: "3px 8px",
                color: showMode ? "#5ce0b8" : "rgba(255,255,255,.35)",
                background: showMode ? "rgba(92,224,184,.06)" : "transparent",
              }}>
              SYNC {showMode ? "ON" : "OFF"}
            </div>
            {showMode && (
              <div onClick={toggleStrict} title="Interlocks — STRICT gates dispatch on a fault (HELD); ADVISORY is visual only (I)"
                style={{
                  cursor: "pointer", fontSize: 9, fontWeight: 800, letterSpacing: 1, transition: "all .2s",
                  border: `1px solid ${strict ? "rgba(239,68,68,.4)" : "rgba(255,255,255,.1)"}`,
                  borderRadius: 6, padding: "3px 8px",
                  color: strict ? "#fca5a5" : "rgba(255,255,255,.35)",
                  background: strict ? "rgba(239,68,68,.07)" : "transparent",
                }}>
                {strict ? "STRICT" : "ADVISORY"}
              </div>
            )}
            <div style={{ fontSize: 10, fontWeight: 800, color: DIFFS[diff].color, border: `1px solid ${DIFFS[diff].color}30`, borderRadius: 6, padding: "3px 9px", letterSpacing: 1 }}>{DIFFS[diff].label.toUpperCase()}</div>
          </div>
        </div>

        {/* STATS ROW */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 6, flexShrink: 0 }}>
          {[
            { label: paused ? "PAUSED" : "ELAPSED", val: fmt(elapsed), color: paused ? "#ffb347" : "#60a5fa" },
            { label: "FLIGHTS", val: totalFlights, color: "#fff" },
            { label: "GUESTS", val: totalSeated, color: "#fff" },
            { label: "STANDBY", val: sbQueue.length, color: sbQueue.length > 20 ? "#ef4444" : "#fff" },
            { label: "LL", val: llQueue.length, color: llQueue.length > 12 ? "#ef4444" : "#fff" },
            ...(showMode ? [{ label: "HOLDS", val: faults, color: faults > 0 ? "#ef4444" : "#fff" }] : []),
          ].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,.025)", borderRadius: 8, padding: "3px 12px", border: "1px solid rgba(255,255,255,.04)", textAlign: "center", minWidth: 62 }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: "rgba(255,255,255,.25)", letterSpacing: 1.5 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* TOAST - fixed height to prevent layout jumps */}
        <div style={{ height: 26, marginBottom: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {msg && (
            <span style={{
              display: "inline-block", padding: "4px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: msg.type === "error" ? "rgba(239,68,68,.12)" : msg.type === "success" ? "rgba(34,197,94,.1)" : "rgba(96,165,250,.1)",
              color: msg.type === "error" ? "#fca5a5" : msg.type === "success" ? "#86efac" : "#93c5fd",
              border: `1px solid ${msg.type === "error" ? "rgba(239,68,68,.15)" : msg.type === "success" ? "rgba(34,197,94,.15)" : "rgba(96,165,250,.15)"}`,
              animation: "fin .15s ease",
            }}>{msg.text}</span>
          )}
        </div>

        {/* MAIN LAYOUT */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1, minHeight: 0, overflow: "hidden" }}>

          {/* LEFT: QUEUE PANEL */}
          <div style={{ width: 140, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Standby */}
            <div style={{ background: "rgba(255,255,255,.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,.05)", padding: "7px 7px 6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,.65)", letterSpacing: 1.5 }}>STANDBY</span>
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "monospace", color: sbQueue.length > 20 ? "#ef4444" : "rgba(255,255,255,.8)" }}>{sbQueue.length}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 5, minHeight: 18 }}>
                {sbQueue.slice(0, 12).map((g) => (
                  <div key={g.id} style={{
                    width: 15, height: 15, borderRadius: 3, background: "rgba(255,255,255,.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,.75)", fontFamily: "monospace",
                  }}>{g.size}</div>
                ))}
                {sbQueue.length > 12 && <div style={{ fontSize: 7, color: "rgba(255,255,255,.4)", alignSelf: "center" }}>+{sbQueue.length - 12}</div>}
              </div>
              <button onClick={releaseSB} disabled={paused || curTheater.status === "riding" || curTheater.status === "unloading"}
                style={{
                  width: "100%", padding: "5px 0", borderRadius: 6,
                  border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.03)",
                  color: paused ? "rgba(255,255,255,.12)" : "#fff",
                  fontSize: 10, fontWeight: 700, cursor: paused ? "not-allowed" : "pointer", letterSpacing: 1.5,
                }}>
                RELEASE →
              </button>
            </div>

            {/* Lightning Lane */}
            <div style={{ background: "rgba(255,255,255,.02)", borderRadius: 10, border: "1px solid rgba(96,165,250,.12)", padding: "7px 7px 6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: "#93c5fd", letterSpacing: 1.5 }}>⚡ LIGHTNING</span>
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "monospace", color: llQueue.length > 12 ? "#ef4444" : "#93c5fd" }}>{llQueue.length}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 5, minHeight: 18 }}>
                {llQueue.slice(0, 8).map(g => (
                  <div key={g.id} style={{
                    width: 15, height: 15, borderRadius: 3, background: "rgba(96,165,250,.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 800, color: "#93c5fd", fontFamily: "monospace",
                  }}>{g.size}</div>
                ))}
                {llQueue.length > 8 && <div style={{ fontSize: 7, color: "rgba(96,165,250,.5)", alignSelf: "center" }}>+{llQueue.length - 8}</div>}
              </div>
              <button onClick={releaseLL} disabled={paused || curTheater.status === "riding" || curTheater.status === "unloading"}
                style={{
                  width: "100%", padding: "5px 0", borderRadius: 6,
                  border: "1px solid rgba(96,165,250,.15)", background: "rgba(96,165,250,.04)",
                  color: paused ? "rgba(255,255,255,.12)" : "#60a5fa",
                  fontSize: 10, fontWeight: 700, cursor: paused ? "not-allowed" : "pointer", letterSpacing: 1.5,
                }}>
                RELEASE →
              </button>
            </div>

            {/* Pause */}
            <button onClick={() => setPaused(p => !p)} style={{
              width: "100%", padding: "7px 0", borderRadius: 8,
              border: `1px solid ${paused ? "rgba(255,179,71,.35)" : "rgba(255,255,255,.08)"}`,
              background: paused ? "rgba(255,179,71,.08)" : "rgba(255,255,255,.02)",
              color: paused ? "#ffb347" : "rgba(255,255,255,.4)",
              fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1.5,
            }}>
              {paused ? "▶ RESUME" : "⏸ PAUSE"}
            </button>

            {/* CUE / FAULT LOG (RSS event log) */}
            {showMode && (
              <div style={{ background: "rgba(255,255,255,.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,.05)", padding: "6px 7px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: 1.5 }}>CUE LOG</span>
                  <span style={{ fontSize: 7, fontWeight: 700, color: faults > 0 ? "#ef4444" : "rgba(255,255,255,.25)" }}>{faults} HOLD{faults === 1 ? "" : "S"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 92, overflowY: "auto" }}>
                  {eventLog.length === 0 && <span style={{ fontSize: 8, color: "rgba(255,255,255,.2)", fontStyle: "italic" }}>Awaiting cues…</span>}
                  {eventLog.slice(0, 12).map(ev => {
                    const c = ev.kind === "hold" ? "#fca5a5" : ev.kind === "dispatch" ? "#86efac" : "#93c5fd";
                    return (
                      <div key={ev.id} style={{ display: "flex", gap: 5, alignItems: "baseline", animation: "fin .15s ease" }}>
                        <span style={{ fontSize: 7, fontFamily: "monospace", color: "rgba(255,255,255,.3)", flexShrink: 0 }}>{fmt(ev.t)}</span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: c, lineHeight: 1.3 }}>{ev.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* End shift → report */}
            {showMode && (
              <button onClick={endShift} disabled={totalFlights === 0}
                style={{
                  width: "100%", padding: "6px 0", borderRadius: 8,
                  border: "1px solid rgba(147,197,253,.18)",
                  background: totalFlights === 0 ? "rgba(255,255,255,.02)" : "rgba(147,197,253,.05)",
                  color: totalFlights === 0 ? "rgba(255,255,255,.15)" : "#93c5fd",
                  fontSize: 10, fontWeight: 700, cursor: totalFlights === 0 ? "not-allowed" : "pointer", letterSpacing: 1.5,
                }}>
                ⊟ END SHIFT
              </button>
            )}

            {/* Ride Vehicle Preview */}
            {anyRiding && (
              <div style={{
                background: "rgba(34,197,94,.03)", borderRadius: 10,
                border: "1px solid rgba(34,197,94,.1)", padding: "6px 4px 2px",
                animation: "finUp .4s ease",
              }}>
                <div style={{ fontSize: 7, fontWeight: 700, color: "rgba(34,197,94,.5)", letterSpacing: 1.5, textAlign: "center", marginBottom: 2 }}>RIDE VIEW</div>
                <RideVehicle
                  phase={anyRiding ? "flying" : "docked"}
                  progress={rideProgress}
                  pct={theaters.find(t => t.status === "riding")?.lastPct || 0}
                />
              </div>
            )}
          </div>

          {/* CENTER: ACTIVE THEATER */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "auto", overscrollBehavior: "none", userSelect: "none" }}>
            {/* Viewport — top-down PLAN (sim layout) or 3D */}
            <div style={{
              height: "clamp(140px, 22vh, 220px)", marginBottom: 6, flexShrink: 0,
              borderRadius: 10, overflow: "hidden", position: "relative",
              border: "1px solid rgba(255,255,255,.06)",
              background: "#06060f",
            }}>
              {viewMode === "plan"
                ? <PlanView theaters={theaters} activeT={activeT} sbQueue={sbQueue.length} llQueue={llQueue.length} />
                : (
                  <Suspense fallback={<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, letterSpacing: 2, color: "rgba(255,255,255,.25)" }}>LOADING 3D VIEW…</div>}>
                    <Scene3D theaters={theaters} activeT={activeT} running={running} paused={paused} />
                  </Suspense>
                )}
              {/* PLAN / 3D toggle */}
              <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 2, background: "rgba(6,8,16,.7)", borderRadius: 6, padding: 2, border: "1px solid rgba(255,255,255,.06)" }}>
                {["plan", "3d"].map(m => (
                  <div key={m} onClick={() => { setViewMode(m); SFX.tabSwitch(); }}
                    style={{
                      cursor: "pointer", fontSize: 8, fontWeight: 800, letterSpacing: 1, padding: "2px 7px", borderRadius: 4,
                      background: viewMode === m ? "rgba(255,207,74,.15)" : "transparent",
                      color: viewMode === m ? "#ffcf4a" : "rgba(255,255,255,.4)",
                    }}>{m === "plan" ? "PLAN" : "3D"}</div>
                ))}
              </div>
            </div>
            {/* Theater tabs */}
            <div style={{ display: "flex", gap: 5, marginBottom: 6, flexShrink: 0 }}>
              {theaters.map((th, i) => {
                const f = seatsFilled(th.seats);
                const p = Math.round((f / TOTAL) * 100);
                const isActive = i === activeT;
                return (
                  <div key={i}
                    onClick={() => { if (i !== activeT) { setActiveT(i); setSel(null); setSplitting(false); SFX.tabSwitch(); } }}
                    style={{
                      flex: 1, padding: "7px 9px", borderRadius: 10, cursor: "pointer",
                      background: isActive ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.03)",
                      border: `1.5px solid ${isActive ? statusColor[th.status] : "rgba(255,255,255,.04)"}`,
                      transition: "all .2s", position: "relative", overflow: "hidden",
                    }}>
                    {th.status === "riding" && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg,transparent,${statusColor.riding}08,transparent)`, animation: "rideGlow 2s infinite" }} />}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5 }}>T{i + 1}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, color: statusColor[th.status], letterSpacing: 1 }}>{statusLabel[th.status]}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3, position: "relative" }}>
                      <div style={{ height: 3, flex: 1, background: "rgba(255,255,255,.05)", borderRadius: 2, overflow: "hidden", marginRight: 6 }}>
                        <div style={{
                          height: "100%",
                          width: th.status === "riding" || th.status === "unloading"
                            ? `${100 - ((th.rideTimer / (th.rideTotal || (th.status === "riding" ? RIDE_DURATION : UNLOAD_DURATION))) * 100)}%`
                            : `${p}%`,
                          background: th.status === "riding" ? "#22c55e" : occColor(p),
                          borderRadius: 2, transition: "width .3s",
                        }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "monospace", color: "rgba(255,255,255,.7)" }}>
                        {th.status === "riding" ? `${Math.ceil(th.rideTimer)}s` : th.status === "unloading" ? "CLR" : `${p}%`}
                      </span>
                    </div>
                    {th.status === "loading" && <div style={{ fontSize: 8, color: "rgba(255,255,255,.4)", marginTop: 2 }}>{th.holding.length} in hold · {f}/{TOTAL}</div>}
                  </div>
                );
              })}
            </div>

            {/* Theater content */}
            {curTheater.status === "riding" ? (
              <div style={{
                textAlign: "center", padding: "30px 20px", borderRadius: 14,
                background: "rgba(34,197,94,.03)", border: "1px solid rgba(34,197,94,.12)",
                position: "relative", overflow: "hidden",
              }}>
                <FloatingClouds count={8} opacity={0.12} inFlight />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 40, marginBottom: 6, animation: "floatGlider 3s ease-in-out infinite" }}>✈</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#22c55e", letterSpacing: 3 }}>IN FLIGHT</div>
                  <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "monospace", color: "#22c55e", marginTop: 4, animation: "breathe 2s ease infinite" }}>
                    {Math.ceil(curTheater.rideTimer)}s
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.25)", marginTop: 6 }}>
                    Theater {activeT + 1} · {curTheater.lastPct}% occupancy · {"★".repeat(getStars(curTheater.lastPct))}{"☆".repeat(5 - getStars(curTheater.lastPct))}
                  </div>
                  <RideVehicle phase="flying" progress={rideProgress} pct={curTheater.lastPct} />
                </div>
              </div>
            ) : curTheater.status === "unloading" ? (
              <div style={{ textAlign: "center", padding: "30px 20px", background: "rgba(96,165,250,.03)", borderRadius: 14, border: "1px solid rgba(96,165,250,.1)" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#60a5fa", letterSpacing: 3 }}>CLEARING</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: "#60a5fa", marginTop: 4 }}>{Math.ceil(curTheater.rideTimer)}s</div>
                <RideVehicle phase="docked" progress={0} pct={curTheater.lastPct} />
              </div>
            ) : curTheater.status === "standby" ? (
              <div style={{
                textAlign: "center", padding: "35px 20px", background: "rgba(255,255,255,.015)",
                borderRadius: 14, border: "1px solid rgba(255,255,255,.04)",
              }}>
                <RideVehicle phase="docked" progress={0} pct={0} />
                <div style={{ fontSize: 14, color: "rgba(255,255,255,.25)", letterSpacing: 2.5, fontWeight: 700, marginTop: 8 }}>THEATER {activeT + 1} · STANDBY</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.18)", marginTop: 6 }}>
                  Comes online in {curShow ? Math.ceil(curShow.phaseRemaining) : 0}s — the show clock staggers theater open times
                </div>
              </div>
            ) : curTheater.status === "held" ? (
              <div style={{
                textAlign: "center", padding: "30px 20px", borderRadius: 14,
                background: "rgba(239,68,68,.04)", border: "1px solid rgba(239,68,68,.18)",
              }}>
                <div style={{ fontSize: 34, marginBottom: 6 }}>⛔</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#ef4444", letterSpacing: 3 }}>HELD</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", marginTop: 6 }}>
                  Interlock not satisfied at the dispatch cue — flight faulted
                </div>
              </div>
            ) : curTheater.status === "empty" && curTheater.holding.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "35px 20px", background: "rgba(255,255,255,.015)",
                borderRadius: 14, border: "1px solid rgba(255,255,255,.04)",
              }}>
                <RideVehicle phase="docked" progress={0} pct={0} />
                <div style={{ fontSize: 14, color: "rgba(255,255,255,.2)", letterSpacing: 2.5, fontWeight: 700, marginTop: 8 }}>THEATER {activeT + 1} READY</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.12)", marginTop: 6 }}>Release groups from Standby or Lightning Lane to begin loading</div>
              </div>
            ) : (
              <>
                {/* Holding + selected info */}
                <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "flex-start", flexShrink: 0 }}>
                  <div style={{ flex: 1, background: "rgba(255,255,255,.02)", borderRadius: 8, padding: "5px 7px", border: "1px solid rgba(255,255,255,.04)" }}>
                    <div style={{ fontSize: 7, fontWeight: 700, color: "rgba(255,255,255,.25)", letterSpacing: 1.5, marginBottom: 3 }}>HOLDING — {curTheater.holding.length} GROUPS</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, maxHeight: 52, overflowY: "auto" }}>
                      {curTheater.holding.map((g) => (
                        <div key={g.id} onClick={() => pickGroup(g)} style={{
                          padding: "3px 6px", borderRadius: 5, cursor: paused ? "not-allowed" : "pointer",
                          background: sel === g.id ? "rgba(255,179,71,.12)" : "rgba(255,255,255,.03)",
                          border: sel === g.id ? "1px solid rgba(255,179,71,.45)" : "1px solid rgba(255,255,255,.05)",
                          fontSize: 12, fontWeight: 800, fontFamily: "monospace",
                          color: sel === g.id ? "#ffb347" : "rgba(255,255,255,.55)",
                          animation: sel === g.id ? "spulse 1.5s infinite" : "none", userSelect: "none",
                        }}>{g.size}</div>
                      ))}
                    </div>
                  </div>
                  {selGroup && (
                    <div style={{
                      background: splitting ? "rgba(96,165,250,.06)" : "rgba(255,179,71,.06)",
                      borderRadius: 8, padding: "5px 9px",
                      border: `1px solid ${splitting ? "rgba(96,165,250,.15)" : "rgba(255,179,71,.15)"}`,
                      minWidth: 95, textAlign: "center", animation: "slideInRight .2s ease",
                    }}>
                      {splitting ? (
                        <>
                          <div style={{ fontSize: 8, fontWeight: 700, color: "#93c5fd", marginBottom: 3 }}>SPLIT {selGroup.size}</div>
                          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
                            {Array.from({ length: selGroup.size - 1 }).map((_, i) => {
                              const n = i + 1;
                              return (
                                <div key={n} onClick={() => doSplit(n)} style={{
                                  padding: "2px 5px", borderRadius: 3, cursor: "pointer",
                                  background: "rgba(255,255,255,.05)", fontSize: 9, fontWeight: 800, color: "#93c5fd",
                                }}>{n}+{selGroup.size - n}</div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#ffb347" }}>Group of {selGroup.size}</div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,.25)", marginTop: 2 }}>Tap a row to seat</div>
                          {selGroup.size >= 2 && (
                            <div onClick={() => setSplitting(true)} style={{
                              marginTop: 3, fontSize: 9, color: "#93c5fd", cursor: "pointer", fontWeight: 700,
                            }}>✂ Split</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* DOME SVG */}
                <div style={{ width: "100%", height: 25, marginBottom: -2, opacity: .25, overflow: "hidden", flexShrink: 0 }}>
                  <svg width="100%" height="25" viewBox="0 0 800 25" preserveAspectRatio="none">
                    <path d="M0 25 Q400 -5 800 25" fill="none" stroke="url(#sg2)" strokeWidth="1.5" />
                    <defs><linearGradient id="sg2"><stop offset="0%" stopColor="#4da6ff" /><stop offset="50%" stopColor="#fff8e7" /><stop offset="100%" stopColor="#5ce0b8" /></linearGradient></defs>
                  </svg>
                </div>

                {/* GATES */}
                <div style={{
                  display: "flex", gap: 6, position: "relative",
                  backgroundImage: "url(/floor_concourse.png)",
                  backgroundSize: "cover", backgroundPosition: "center",
                  borderRadius: 12, padding: 4,
                }}>
                  <div style={{ position: "absolute", inset: 0, background: "rgba(4,8,16,.88)", borderRadius: 12 }} />
                  {GK.map(gk => {
                    const cfg = GATES[gk]; const rows = curTheater.seats[gk];
                    const gF = rows.reduce((a, r) => a + r.filled, 0); const gC = rows.reduce((a, r) => a + r.capacity, 0);
                    return (
                      <div key={gk} style={{
                        flex: 1, background: "rgba(255,255,255,.02)", borderRadius: 10,
                        border: `1px solid ${cfg.color}15`, padding: "8px 7px 6px",
                        position: "relative", overflow: "hidden", zIndex: 1,
                      }}>
                        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "50%", height: 2, background: `linear-gradient(90deg,transparent,${cfg.color}50,transparent)` }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, boxShadow: `0 0 6px ${cfg.color}60` }} />
                            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2 }}>SEC {cfg.label}</span>
                          </div>
                          <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,.25)" }}>{gF}/{gC}</span>
                        </div>

                        {rows.map((row, ri) => {
                          const left = row.capacity - row.filled; const full = left === 0;
                          const fits = selGroup && selGroup.size <= left;
                          const active = sel && !full && !paused && !splitting && curTheater.status === "loading";
                          const hov = hover === `${gk}${ri}`; const fl = flash === `${gk}${ri}`;

                          let bdr = "rgba(255,255,255,.04)", bg = "rgba(255,255,255,.01)";
                          if (fl) { bdr = cfg.color; bg = `${cfg.color}12` }
                          else if (active && hov) { bdr = fits ? "#22c55e" : "#ef4444"; bg = fits ? "rgba(34,197,94,.08)" : "rgba(239,68,68,.05)" }
                          else if (active && fits) { bdr = "rgba(255,255,255,.1)"; bg = "rgba(255,255,255,.015)" }

                          return (
                            <div key={ri}
                              onClick={() => placeInRow(gk, ri)}
                              onMouseEnter={() => setHover(`${gk}${ri}`)}
                              onMouseLeave={() => setHover(null)}
                              style={{
                                background: bg, borderRadius: 6, padding: "4px 5px", marginBottom: 5,
                                transition: "all .2s", border: `1.5px solid ${bdr}`,
                                cursor: active ? "pointer" : "default", position: "relative",
                              }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                                <span style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,.3)", letterSpacing: 1 }}>{ROW_NAMES[ri]}</span>
                                <span style={{ fontSize: 10, fontWeight: 800, color: full ? "#22c55e" : "rgba(255,255,255,.6)", fontFamily: "monospace" }}>{row.filled}/{row.capacity}</span>
                              </div>
                              <div style={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
                                {Array.from({ length: row.capacity }).map((_, si) => {
                                  const isFilled = si < row.filled;
                                  const ghost = !isFilled && selGroup && hov && fits && !splitting && si < row.filled + selGroup.size;
                                  return (
                                    <div key={si} style={{
                                      width: 11, height: 8, borderRadius: 2,
                                      background: isFilled ? cfg.color : ghost ? `${cfg.color}40` : "rgba(255,255,255,.04)",
                                      border: isFilled ? `1px solid ${cfg.color}60` : ghost ? `1px dashed ${cfg.color}45` : "1px solid rgba(255,255,255,.06)",
                                      transition: "all .2s",
                                      boxShadow: isFilled ? `0 0 4px ${cfg.color}20` : "none",
                                    }} />
                                  );
                                })}
                              </div>
                              {full && <div style={{ position: "absolute", top: 3, right: 5, fontSize: 7, fontWeight: 800, color: "#22c55e" }}>FULL</div>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Occupancy + Interlock + Dispatch */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, flexShrink: 0, gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ height: 5, width: 90, background: "rgba(255,255,255,.05)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${curPct}%`, background: occColor(curPct), borderRadius: 3, transition: "width .3s" }} />
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: occColor(curPct) }}>{curPct}%</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,.2)" }}>{curFilled}/{TOTAL}</span>
                  </div>

                  {/* Interlock status — seat check (restraints) + gates closed */}
                  <div title="Seat check (interlock) — restraints checked and gates closed before dispatch"
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8,
                      border: `1px solid ${curInterlock.ready ? "rgba(34,197,94,.25)" : "rgba(234,179,8,.25)"}`,
                      background: curInterlock.ready ? "rgba(34,197,94,.06)" : "rgba(234,179,8,.05)",
                    }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: curInterlock.ready ? "#22c55e" : "#eab308",
                      boxShadow: `0 0 6px ${curInterlock.ready ? "#22c55e" : "#eab308"}`,
                    }} />
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: curInterlock.ready ? "#86efac" : "#fde68a" }}>
                      INTERLOCK {curInterlock.ready ? "READY" : "HOLD"}
                    </span>
                  </div>

                  {showMode ? (
                    <div title="Dispatch is automatic on the show clock"
                      style={{
                        padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(147,197,253,.2)",
                        background: "rgba(147,197,253,.05)", color: "#93c5fd",
                        fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase",
                        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                      }}>
                      <span style={{ animation: "breathe 2s ease infinite" }}>▣</span>
                      AUTO-DISPATCH {curShow && curShow.phase === "load" ? `${Math.ceil(curShow.phaseRemaining)}s` : ""}
                    </div>
                  ) : (
                    <button onClick={dispatch} disabled={paused || curTheater.status !== "loading" || curFilled === 0}
                      style={{
                        padding: "7px 18px", borderRadius: 8,
                        border: "1px solid rgba(34,197,94,.25)",
                        background: curFilled === 0 || paused ? "rgba(34,197,94,.03)" : "rgba(34,197,94,.1)",
                        color: curFilled === 0 || paused ? "rgba(255,255,255,.12)" : "#86efac",
                        fontSize: 12, fontWeight: 800, cursor: curFilled === 0 || paused ? "not-allowed" : "pointer",
                        letterSpacing: 2.5, textTransform: "uppercase",
                        transition: "all .2s",
                      }}>
                      DISPATCH ✈
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* SHOW CLOCK — synchronized-show transport (RSS cadence) */}
        {showMode && (
          <div style={{ flexShrink: 0, marginTop: 6 }}>
            <ShowClock now={showNow} lanes={showLanes} throughput={throughput} avgOcc={avgOcc} strict={strict} paused={paused} />
          </div>
        )}

        {/* Keyboard help modal */}
        {showKeys && (
          <div style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
            onClick={() => setShowKeys(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "linear-gradient(135deg, #0d1530, #111d40)", borderRadius: 16, padding: "22px 26px",
              maxWidth: 380, border: "1px solid rgba(255,255,255,.08)", animation: "fin .2s ease",
              boxShadow: "0 20px 60px rgba(0,0,0,.5)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, letterSpacing: 2 }}>KEYBOARD SHORTCUTS</div>
              {[
                ["Q", "Release Standby batch"],
                ["L", "Release Lightning Lane batch"],
                ["1 / 2 / 3", "Switch theater (no group selected)"],
                ["4–9", "Select group from holding"],
                ["S", "Toggle split mode"],
                ["D", "Dispatch current theater (free-play)"],
                ["Y", "Toggle Synchronized Show Mode"],
                ["I", "Toggle STRICT interlocks (Show Mode)"],
                ["M", "Toggle audio mute"],
                ["Space", "Pause / Resume"],
                ["Esc", "Deselect"],
              ].map(([k, d]) => (
                <div key={k} style={{ display: "flex", gap: 10, marginBottom: 5 }}>
                  <code style={{
                    background: "rgba(255,255,255,.06)", padding: "2px 8px", borderRadius: 4,
                    fontSize: 10, fontWeight: 700, color: "#ffb347", minWidth: 60, textAlign: "center",
                  }}>{k}</code>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements modal */}
        {showAch && (
          <div style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
            onClick={() => setShowAch(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "linear-gradient(135deg, #0d1530, #111d40)", borderRadius: 16, padding: "22px 26px",
              maxWidth: 400, border: "1px solid rgba(255,255,255,.08)", animation: "fin .2s ease",
              boxShadow: "0 20px 60px rgba(0,0,0,.5)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, letterSpacing: 2 }}>ACHIEVEMENTS</div>
              {ACHIEVEMENTS.map(a => {
                const earned = unlocked.includes(a.id);
                return (
                  <div key={a.id} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "center", opacity: earned ? 1 : .25 }}>
                    <span style={{ fontSize: 18, width: 26, textAlign: "center" }}>{a.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{a.title}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>{a.desc}</div>
                    </div>
                    {earned && <span style={{ marginLeft: "auto", fontSize: 9, color: "#22c55e", fontWeight: 700 }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Shift report */}
        {showReport && (
          <div style={{ position: "fixed", inset: 0, zIndex: 950, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(5px)" }}>
            <div style={{
              background: "linear-gradient(135deg, #0d1530, #111d40)", borderRadius: 18, padding: "24px 28px",
              width: 380, maxWidth: "90vw", border: "1px solid rgba(255,255,255,.08)", animation: "achIn .3s ease",
              boxShadow: "0 20px 60px rgba(0,0,0,.6)", position: "relative", overflow: "hidden",
            }}>
              <FloatingClouds count={4} opacity={0.05} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 3, fontWeight: 700 }}>RIDE / SHOW SUPERVISOR</div>
                <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2, marginBottom: 2 }}>SHIFT REPORT</div>
                <div style={{ fontSize: 22, marginTop: 6, marginBottom: 12, color: "#fbbf24" }}>
                  {"★".repeat(getStars(avgOcc))}<span style={{ color: "rgba(255,255,255,.15)" }}>{"☆".repeat(5 - getStars(avgOcc))}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {[
                    { label: "SHIFT LENGTH", val: fmt(elapsed), color: "#60a5fa" },
                    { label: "FLIGHTS", val: totalFlights, color: "#fff" },
                    { label: "GUESTS SEATED", val: totalSeated, color: "#fff" },
                    { label: "AVG OCCUPANCY", val: `${avgOcc}%`, color: avgOcc >= 90 ? "#22c55e" : "#eab308" },
                    { label: "THROUGHPUT", val: `${throughput || 0}/hr`, color: "#5ce0b8" },
                    { label: "INTERLOCK HOLDS", val: faults, color: faults > 0 ? "#ef4444" : "#22c55e" },
                  ].map((s, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,.03)", borderRadius: 8, padding: "8px 10px", border: "1px solid rgba(255,255,255,.05)" }}>
                      <div style={{ fontSize: 7, fontWeight: 700, color: "rgba(255,255,255,.3)", letterSpacing: 1.5 }}>{s.label}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, fontFamily: "monospace", color: s.color }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,.3)", marginBottom: 12 }}>
                  Theoretical max at 100% occupancy: <span style={{ color: "#5ce0b8", fontWeight: 700 }}>{MAX_THROUGHPUT.toLocaleString()}/hr</span>
                  {" · "}efficiency <span style={{ color: "#5ce0b8", fontWeight: 700 }}>{throughput ? Math.round((throughput / MAX_THROUGHPUT) * 100) : 0}%</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setShowReport(false); setPaused(false); }} style={{
                    flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid rgba(34,197,94,.25)",
                    background: "rgba(34,197,94,.1)", color: "#86efac", fontSize: 11, fontWeight: 800, letterSpacing: 1.5, cursor: "pointer",
                  }}>▶ RESUME SHIFT</button>
                  <button onClick={() => { recordBests(); setShowReport(false); setDiff(null); setRunning(false); audioMgr.stopAmbient(); audioMgr.stopRide(); }} style={{
                    flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid rgba(255,255,255,.1)",
                    background: "rgba(255,255,255,.03)", color: "rgba(255,255,255,.6)", fontSize: 11, fontWeight: 800, letterSpacing: 1.5, cursor: "pointer",
                  }}>↩ MENU</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
