# Sortin' Soarin'

A browser-based ride operations simulator, built by a former Soarin' cast member, where you sort Standby and Lightning Lane guests into three flight theaters and keep dispatches on time.

## What it does

- Route guest groups from two queues into three concourses, each with gates and rows, and score on occupancy and throughput
- Show-control timing layer: one show clock drives all three concourses through load, lift, fly and unload, staggered so a flight dispatches every 28 seconds
- Interlocks that hold a late concourse in Strict mode, with a cue/fault log and an end-of-shift report
- 3D view of the theaters plus a top-down plan view
- Easy, Normal and Hard difficulty, achievements, and best-shift stats saved in the browser

## Tech

- React 19 and Vite 6, plain JavaScript
- Three.js for the 3D scene (lazy-loaded)
- Deterministic timing model with tests (`npm test`)

## Run

```bash
npm install
npm run dev
```

Fan project. Not affiliated with or endorsed by Disney.
