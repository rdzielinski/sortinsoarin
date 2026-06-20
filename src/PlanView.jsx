import { GATES, GK, TOTAL, seatsFilled } from "./gameConfig.js";

// Top-down "simulator-style" overview of the three theaters, in the spirit of
// the cast-member sim floor plan: blue domes, light gate carriages with seat
// columns, a central merge apron, switchback queue rails — wired to live state.

const STATUS_STROKE = {
  empty: "#3a4660", loading: "#eab308", riding: "#22c55e",
  unloading: "#60a5fa", standby: "#444f6b", held: "#ef4444",
};
const STATUS_LABEL = {
  empty: "READY", loading: "LOADING", riding: "IN FLIGHT",
  unloading: "CLEARING", standby: "STANDBY", held: "HELD",
};
const occColor = (p) => p >= 95 ? "#22c55e" : p >= 80 ? "#eab308" : p >= 50 ? "#f97316" : "#ef4444";

const REGION_W = 106;
const X0 = 10;
const STEP = 117;

function Theater({ th, i, isActive }) {
  const x = X0 + i * STEP;
  const cx = x + REGION_W / 2;
  const stroke = STATUS_STROKE[th.status] || STATUS_STROKE.empty;
  const filled = seatsFilled(th.seats);
  const pct = Math.round((filled / TOTAL) * 100);
  const dim = th.status === "standby";
  const riding = th.status === "riding";
  const held = th.status === "held";

  // Seat pills for one gate: its three rows laid out left→right with a gap
  // between rows, filled seats in the gate colour.
  const gateRow = (gk, gy) => {
    const rows = th.seats[gk];
    const cap = rows.reduce((a, r) => a + r.capacity, 0);
    const sx = x + 17, sw = REGION_W - 24, gap = 2;
    const unit = (sw - gap * 2) / cap;
    const pillW = Math.max(1.4, unit * 0.78);
    const pills = [];
    let cur = sx;
    rows.forEach((r, ri) => {
      for (let s = 0; s < r.capacity; s++) {
        const on = s < r.filled;
        pills.push(
          <rect key={`${gk}${ri}-${s}`} x={cur} y={gy - 3} width={pillW} height={6} rx={1}
            fill={on ? GATES[gk].color : "#39435c"} opacity={on ? 0.95 : 0.5} />
        );
        cur += unit;
      }
      cur += gap;
    });
    return (
      <g key={gk}>
        <circle cx={x + 9} cy={gy} r={4.6} fill="#11131a" opacity={0.85} stroke={GATES[gk].color} strokeWidth={0.5} />
        <text x={x + 9} y={gy + 1.8} fontSize={5} fontWeight="800" fill={GATES[gk].color} textAnchor="middle">{GATES[gk].label}</text>
        {pills}
        <path d={`M ${x + REGION_W - 5} ${gy - 3} l 3 1.5 l -3 1.5 Z`} fill="#b3392c" />
      </g>
    );
  };

  return (
    <g opacity={dim ? 0.5 : 1}>
      {isActive && (
        <rect x={x - 3} y={5} width={REGION_W + 6} height={102} rx={6} fill="none" stroke="#ffcf4a" strokeWidth={1.4} opacity={0.9} />
      )}
      {/* shell */}
      <rect x={x} y={8} width={REGION_W} height={96} rx={4} fill="#23262e" stroke={stroke} strokeWidth={isActive ? 2 : 1.3} filter="url(#planSh)" />
      {/* dome (screen) */}
      <ellipse cx={cx} cy={26} rx={REGION_W / 2 - 12} ry={11}
        fill="url(#planDome)" stroke={riding ? "#22c55e" : held ? "#ef4444" : "#2c3a7a"} strokeWidth={riding || held ? 1.4 : 1} />
      <ellipse cx={cx - 10} cy={22} rx={9} ry={4.5} fill="#ffffff" opacity={0.18} />
      {/* projector spine marker */}
      <path d={`M ${cx - 3} 36 L ${cx} 32 L ${cx + 3} 36 Z`} fill="#b3392c" />

      {/* theater id + occupancy */}
      <text x={x + 6} y={16} fontSize={6} fontWeight="800" fill="rgba(255,255,255,.75)">T{i + 1}</text>
      <text x={x + REGION_W - 6} y={16} fontSize={6} fontWeight="800" fontFamily="monospace" textAnchor="end" fill={occColor(pct)}>{pct}%</text>

      {/* gate carriages */}
      {gateRow(GK[0], 50)}
      {gateRow(GK[1], 70)}
      {gateRow(GK[2], 90)}

      {/* status caption */}
      <text x={cx} y={101} fontSize={4.6} fontWeight="700" letterSpacing="0.5" textAnchor="middle"
        fill={held ? "#ef4444" : riding ? "#22c55e" : "rgba(255,255,255,.4)"}>
        {STATUS_LABEL[th.status] || ""}
      </text>
    </g>
  );
}

export default function PlanView({ theaters = [], activeT = 0, sbQueue = 0, llQueue = 0 }) {
  return (
    <svg viewBox="0 0 360 130" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
      role="img" aria-label="Top-down plan of the three theaters" style={{ display: "block" }}>
      <defs>
        <radialGradient id="planDome" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#b9c6fb" />
          <stop offset="42%" stopColor="#8597ee" />
          <stop offset="100%" stopColor="#4f66d2" />
        </radialGradient>
        <filter id="planSh" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.1" floodColor="#0a1126" floodOpacity="0.5" />
        </filter>
        <filter id="planSpeck">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.60  0 0 0 0 0.71  0 0 0 0.05 0" />
        </filter>
      </defs>

      {/* floor */}
      <rect x="0" y="0" width="360" height="130" fill="#2b3550" />
      <rect x="0" y="0" width="360" height="130" filter="url(#planSpeck)" />

      {/* far-edge switchback queue rails (yellow) */}
      {[6, 354].map((rx, k) => (
        <g key={k} opacity={0.5}>
          {[0, 1, 2, 3].map(j => (
            <line key={j} x1={rx + (k ? -j * 1.6 : j * 1.6)} y1={14} x2={rx + (k ? -j * 1.6 : j * 1.6)} y2={104} stroke="#e6c34a" strokeWidth={0.7} />
          ))}
        </g>
      ))}

      {theaters.map((th, i) => (
        <Theater key={i} th={th} i={i} isActive={i === activeT} />
      ))}

      {/* entrance / merge apron */}
      <rect x="10" y="112" width="340" height="14" rx="2" fill="#d9cfb8" opacity={0.12} />
      <path d="M178 124 L182 118 L186 124 Z" fill="#b3392c" />
      <text x="120" y="122.5" fontSize="5" fontWeight="700" letterSpacing="0.5" textAnchor="end" fill="rgba(233,225,208,.7)">ENTRANCE / MERGE</text>
      <text x="200" y="122.5" fontSize="5" fontWeight="700" fontFamily="monospace" fill="rgba(255,255,255,.45)">
        STBY {sbQueue} · LL {llQueue}
      </text>
    </svg>
  );
}
