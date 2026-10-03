// Live game state drawn on the same Soarin' plan as the published map artifact.
// The base drawing (walls, doors, gates, domes, routes, aerial) comes from planDrawing.js;
// this component only adds the live layer, in the same building frame.

import { useEffect, useRef } from "react";
import { PLAN_CSS, PLAN_SVG, buildInterior } from "./planDrawing.js";

const GK = ["A", "B", "C"];
const GATE_COLORS = { A: "#4da6ff", B: "#ffb347", C: "#5ce0b8" };
const STATUS_COLOR = { empty: "#94a3b8", loading: "#eab308", riding: "#22c55e", unloading: "#60a5fa" };
const RIDE_DURATION = 45;
const DOME_R = 46.4;

// Same placements the plan uses (building frame: translate(590 862) rotate(10), 1 unit = 0.263 m).
// Game theater index → real theater: T1 = A (south), T2 = B (north), T3 = C (west, 2016).
const THEATERS = [
  { real: "A", ox: 76.5, oy: 314, rot: 0, w: 125, depth: 128, rim: 59 },
  { real: "B", ox: 69.3, oy: 29, rot: 180, w: 110, depth: 126, rim: 59 },
  { real: "C", ox: -194, oy: 105.5, rot: 90, w: 121, depth: 139, rim: 53 },
];
const EXIT_ROUTES = [
  "M120 296 H128 L133 290 V240 L145 230 V180 L158 170 V-50 L150 -90",
  "M118 46 H124 L158 46 V-50 L150 -90",
  "M-176 50 V38 H-80 L-31 -18 H120 L140 -45 L150 -90",
];
const STANDBY_PATH = [[143, -50], [143, -6], [138, 0], [150, 0], [138, 16], [150, 16], [138, 32], [150, 32], [138, 48], [150, 48], [138, 64], [150, 64], [138, 80], [150, 80], [138, 96], [150, 96], [138, 112], [150, 112], [138, 128], [150, 128], [144, 150]];
const LL_PATH = [[130, -50], [130, 150]];

const along = (poly, f) => {
  const seg = []; let L = 0;
  for (let i = 1; i < poly.length; i++) { const d = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); seg.push(d); L += d; }
  let t = f * L;
  for (let i = 0; i < seg.length; i++) { if (t <= seg[i]) { const k = t / seg[i]; return [poly[i][0] + (poly[i + 1][0] - poly[i][0]) * k, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * k]; } t -= seg[i]; }
  return poly[poly.length - 1];
};

function LiveTheater({ t, idx, th, active, onSelect }) {
  const status = th?.status || "empty";
  const flying = status === "riding";
  const progress = flying ? 1 - th.rideTimer / RIDE_DURATION : 0;
  const lift = flying ? Math.min(1, progress / 0.08, (1 - progress) / 0.08) : 0; // swing up, fly, swing down
  const cw = (t.w - 22) / 3;
  const cxs = [0, 1, 2].map(i => -t.w / 2 + 7 + cw / 2 + i * (cw + 4));
  const rim = -t.rim, r = DOME_R;
  const holdCount = (th?.holding || []).reduce((s, g) => s + g.size, 0);
  const up = (x, y) => `rotate(${-t.rot - 10} ${x} ${y})`; // keep text upright on the north-up map
  const label = status === "riding" ? `IN FLIGHT ${Math.ceil(th.rideTimer)}s` : status === "unloading" ? "CLEARING" : status === "loading" ? `LOADING · ${holdCount} waiting` : "EMPTY";

  return (
    <g transform={`translate(${t.ox} ${t.oy}) rotate(${t.rot})`} onClick={() => onSelect?.(idx)} style={{ cursor: "pointer" }}>
      {/* active outline (theater + concourse) */}
      <rect x={-t.w / 2 - 1.5} y={-t.depth - 1.5} width={t.w + 3} height={t.depth + 28} fill="none"
        stroke={active ? "#fbbf24" : "transparent"} strokeWidth="2.2" rx="1.5" />
      {/* dome lights up during the flight */}
      {flying && (
        <path d={`M${-r} ${rim} A${r} ${r} 0 0 1 ${r} ${rim} Z`} fill="#22c55e"
          opacity={0.12 + 0.18 * Math.sin(progress * Math.PI * 14) ** 2} />
      )}
      {/* seat rows: fill per gate/row, sliding from the loading floor up over the screen */}
      {cxs.map((cx, ci) => th?.seats?.[GK[ci]]?.map((row, ri) => {
        const vLoad = -4 - (2 - ri) * 4.6 - 2.6;
        const vFly = rim - 3 - ri * 3.2 - 2.4;
        const v = vLoad + (vFly - vLoad) * lift;
        const frac = row.capacity ? row.filled / row.capacity : 0;
        if (!frac) return null;
        return <rect key={`${ci}-${ri}`} x={cx - cw / 2 + .8} y={v} width={(cw - 1.6) * frac} height={2.6} rx=".5"
          fill={status === "unloading" ? "#60a5fa" : GATE_COLORS[GK[ci]]} opacity={frac >= 1 ? 1 : .85} />;
      }))}
      {/* guests waiting in the holding bays */}
      {Array.from({ length: Math.min(holdCount, 66) }).map((_, k) => {
        const bay = k % 3, n = Math.floor(k / 3);
        return <circle key={k} cx={cxs[bay] - cw / 2 + 2 + (n % 11) * ((cw - 4) / 10)} cy={3 + Math.floor(n / 11) * 2.2} r=".9" fill="#f8fafc" opacity=".9" />;
      })}
      {/* live status */}
      <g transform={up(0, -25)}>
        <rect x={-28} y={-31} width={56} height={9} rx="4.5" fill="rgba(6,10,18,.82)" stroke={STATUS_COLOR[status]} strokeWidth=".7" />
        <text x={0} y={-24.6} textAnchor="middle" fontSize="5.4" fontWeight="800" fill={STATUS_COLOR[status]} letterSpacing=".3">
          T{idx + 1} · {label}
        </text>
      </g>
    </g>
  );
}

export default function PlanMap({ theaters = [], activeT = 0, sbQueue = [], llQueue = [], onSelect }) {
  const baseRef = useRef(null);

  // Draw the base plan once, outside React's reconciliation, exactly as the artifact does.
  useEffect(() => {
    const g = baseRef.current;
    if (!g || g.childNodes.length) return;
    g.innerHTML = PLAN_SVG;
    buildInterior(g.querySelector("[data-interior]"));
  }, []);

  // Clicking a theater, its concourse, gates or dome on the base plan selects that theater.
  const onPlanClick = (e) => {
    const z = e.target.closest?.("[data-n]");
    const idx = z ? THEATERS.findIndex(t => t.real === z.getAttribute("data-n")) : -1;
    if (idx >= 0) onSelect?.(idx);
  };

  return (
    <svg className="plan-map" viewBox="338 612 500 630" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", background: "#131e26" }} role="img" aria-label="Live map of Soarin' on the real building plan">
      <style>{PLAN_CSS}</style>
      <g ref={baseRef} onClick={onPlanClick} />

      {/* live layer, same building frame as the plan */}
      <g transform="translate(590 862) rotate(10)">
        {THEATERS.map((t, i) => <LiveTheater key={t.real} t={t} idx={i} th={theaters[i]} active={i === activeT} onSelect={onSelect} />)}

        {EXIT_ROUTES.map((d, i) => theaters[i]?.status === "unloading" && (
          <g key={i}>
            {Array.from({ length: 6 }).map((_, k) => (
              <circle key={k} r="1.5" fill="#4ade80">
                <animateMotion dur="4s" begin={`${k * 0.45}s`} repeatCount="indefinite" path={d} />
              </circle>
            ))}
          </g>
        ))}

        {sbQueue.slice(0, 40).map((g, k) => {
          const [x, y] = along(STANDBY_PATH, 1 - (k + .5) / 40);
          return <circle key={g.id} cx={x} cy={y} r={0.9 + Math.min(g.size, 10) * 0.12} fill="#e2e8f0" opacity=".9" />;
        })}
        {llQueue.slice(0, 20).map((g, k) => {
          const [x, y] = along(LL_PATH, 1 - (k + .5) / 20);
          return <circle key={g.id} cx={x} cy={y} r={0.9 + Math.min(g.size, 10) * 0.12} fill="#c084fc" opacity=".95" />;
        })}
      </g>
    </svg>
  );
}
