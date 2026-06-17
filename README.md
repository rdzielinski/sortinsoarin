# Sortin' Soarin' — Ride/Show Operations Simulator

A browser-based **ride/show-supervisor (RSS) console** themed on a hang-gliding
flight-theater attraction. You run three theaters at once: route guests from the
Standby and Lightning Lane queues, load each theater's gates and rows, keep the
interlocks green, and dispatch flights — scored on occupancy, throughput, and a
streak/achievement system.

Built with **React 19 + Vite 6** and a **Three.js** 3D viewport. Plain JS/JSX,
no TypeScript, no state-management library.

## Run

```bash
npm install
npm run dev      # dev server
npm run build    # production build → dist/
npm run preview
npm test         # timing-model tests (node, no deps)
```

## Show-control model

The headline feature is a **show-control timing layer** that turns free-play
sorting into a synchronized, clock-driven show. A single **show clock** drives
all three theaters through the same fixed phase cycle — **load → lift → fly →
unload** (29 / 6 / 45 / 4 s, an 84 s cycle) — but the theaters are **staggered by
one dispatch interval** so their cycles never line up. With three theaters on an
84 s cycle the global **dispatch interval is 28 s**: a flight launches like
clockwork every 28 seconds, evenly spaced (Theater 1 at +29 s, Theater 2 at
+57 s, Theater 3 at +85 s, then repeating), so at any instant exactly one theater
is typically mid-load while the others are lifting, flying, or unloading. Each
theater's **dispatch moment** is its `load → lift` transition, and every dispatch
is gated by an **interlock** — a seat check (restraints/rows seated) plus closed
gates (no group mid-placement). Interlocks run in one of two modes (toggle, key
`I`):

- **ADVISORY** (default) — the per-theater status dot reads green (ready) /
  amber (loading) / red (held), but the clock dispatches on cue regardless.
- **STRICT** — dispatch is **gated**. If a theater's interlock isn't clear at
  its cue it is **HELD** (faults, breaks the streak), and it dispatches **late**
  the moment the interlock clears, then resumes its now-shifted cadence. This is
  modelled as a per-theater clock shift, so ADVISORY remains the exact
  deterministic global clock and STRICT layers the hold/recovery on top.

The whole model is deterministic and re-derives from one tunable
(`PHASE_DURATIONS.load`); the staggered cadence, interlocks, cue/fault log, and
the live Show Clock panel are exactly the subsystems an RSS / ride-show
supervisor watches firing on a clock, in sync.

The single tunable is `PHASE_DURATIONS.load` in `src/showControl.js`; `CYCLE`,
`DISPATCH_INTERVAL`, and `THEATER_OFFSET` all derive from it — nothing else is
hardcoded.

### Synchronized Show Mode toggle

A **Synchronized Show Mode** toggle (default **ON**, key `Y`, plus a switch on the
menu and in the header) selects the behavior:

- **ON** — the clock-driven staggered cadence above. The player's job is to
  **load each theater during its load window**; dispatch is automatic on the
  cue. The **Show Clock** panel shows three staggered lanes (proportional
  load/lift/fly/unload segments, a moving playhead, an interlock dot, and
  occupancy %), plus a header with the live dispatch interval, average
  occupancy, throughput, and a "next dispatch in X / Theater N" countdown. A
  **cue/fault log** records timestamped DISPATCH / HELD / ONLINE events, and
  **END SHIFT** opens a report (flights, guests, avg occupancy, throughput vs.
  the theoretical max + efficiency %, interlock holds, star rating).
- **OFF** — the original free-play game: fill theaters and dispatch manually
  (`D`) whenever you like.

Earned achievements and best-shift stats persist across reloads
(`localStorage`). Show-control achievements include **Green Board** (5
consecutive interlock-clean dispatches), **On The Clock** (10 show-mode
dispatches), and **Clean Shift** (a 3 min+ shift with zero holds).

## Controls

`Q` release Standby · `L` release Lightning Lane · `1/2/3` switch theater ·
`4–9`/`0` select group · `S` split · `D` dispatch (free-play) ·
`Y` toggle Synchronized Show Mode · `I` toggle STRICT interlocks ·
`M` mute · `Space` pause · `Esc` deselect.

## Project layout

The shipped app is `index.html` + `src/` + `public/`:

| File | Role |
| --- | --- |
| `src/SoarinOps.jsx` | Main game: queues, theaters, loading, scoring, interlock gating, single game loop |
| `src/showControl.js` | Show-control timing model — constants + `theaterShowState` / `theaterPhase` / `nextDispatch` (single source of truth) |
| `src/ShowClock.jsx` | Show Clock panel — staggered theater lanes, phase segments, playhead, interlock dots |
| `src/gameConfig.js` | Game constants, difficulties, achievements, seat/group helpers |
| `src/audio.js` | Web Audio SFX + ambient/ride `AudioManager` |
| `src/sceneBits.jsx` | Presentational SVG bits (clouds, ride vehicle) |
| `src/Scene3D.jsx` | Three.js 3D viewport (lazy-loaded into its own chunk) |
| `test/showControl.test.mjs` | Timing-model tests (`npm test`) |
| `public/*` | Audio (ambient/ride/preshow/check/open) and image assets |

The clock runs off the **existing 100 ms game loop** (no second timer) by feeding
the accumulated game time into `theaterShowState`, which keeps the visualization
and the auto-dispatch perfectly in sync. The Three.js viewport is lazy-loaded so
the initial bundle stays small.

> Note: the root-level `SoarinLoading.jsx`, `sim3d.html`, `Sim.js`, and `Paths.js`
> are legacy prototypes and are **not** part of the Vite build.
