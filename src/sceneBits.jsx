import { useMemo } from "react";

// ═══════════════════════════════════════
// FLOATING CLOUDS
// ═══════════════════════════════════════
export function FloatingClouds({ count = 6, opacity = 0.06, inFlight = false }) {
  const clouds = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      top: `${10 + (i * 67 + 23) % 80}%`,
      size: 60 + (i * 37) % 120,
      duration: 35 + (i * 13) % 30,
      delay: -(i * 7) % 40,
      flipY: i % 2 === 0,
    })), [count]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      {clouds.map(c => (
        <img
          key={c.id}
          src="/cloud.png"
          alt=""
          style={{
            position: "absolute",
            top: c.top,
            width: c.size,
            height: "auto",
            "--cloud-op": inFlight ? opacity * 4 : opacity,
            "--cloud-scale": c.flipY ? -1 : 1,
            animation: `cloudDrift ${c.duration}s linear ${c.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// ANIMATED GUEST DOTS (inspired by Sim.js peeps)
// ═══════════════════════════════════════
export function GuestDots({ guests = [], gateColor = "#fff" }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {guests.map((g, i) => (
        <div
          key={g.id || i}
          style={{
            position: "absolute",
            left: `${g.x}%`,
            top: `${g.y}%`,
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: gateColor,
            boxShadow: `0 0 4px ${gateColor}80`,
            opacity: 0.8,
            transition: "left 0.6s ease-out, top 0.6s ease-out, opacity 0.4s",
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// RIDE VEHICLE SVG
// ═══════════════════════════════════════
export function RideVehicle({ phase = "docked", progress = 0, pct = 0 }) {
  const liftAngle = phase === "flying" ? -15 + Math.sin(progress * Math.PI * 2) * 3 : 0;
  const liftY = phase === "flying" ? -20 : phase === "lifting" ? -10 * progress : 0;

  return (
    <svg viewBox="0 0 200 80" width="100%" style={{ maxWidth: 280, display: "block", margin: "0 auto" }}>
      <defs>
        <linearGradient id="vg" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4da6ff" stopOpacity=".3" />
          <stop offset="50%" stopColor="#ffb347" stopOpacity=".5" />
          <stop offset="100%" stopColor="#5ce0b8" stopOpacity=".3" />
        </linearGradient>
        <linearGradient id="screenGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={phase === "flying" ? "#87ceeb" : "#1a1a3a"} />
          <stop offset="100%" stopColor={phase === "flying" ? "#3a7fcf" : "#0a0a20"} />
        </linearGradient>
      </defs>

      {/* Screen dome */}
      <path d="M10 65 Q100 -10 190 65" fill="url(#screenGlow)" opacity={phase === "flying" ? 0.6 : 0.15} stroke="url(#vg)" strokeWidth="1" />

      {/* Vehicle arm */}
      <g transform={`translate(100, 70) rotate(${liftAngle}) translate(0, ${liftY})`}>
        {/* Arm */}
        <line x1="0" y1="0" x2="0" y2="-25" stroke="rgba(255,255,255,.2)" strokeWidth="2" />
        {/* Row bar */}
        <rect x="-70" y="-30" width="140" height="6" rx="3" fill="rgba(255,255,255,.1)" stroke="url(#vg)" strokeWidth="0.5" />
        {/* Seats */}
        {Array.from({ length: 10 }).map((_, i) => {
          const filled = i < Math.round(pct / 10);
          return (
            <rect
              key={i}
              x={-65 + i * 14}
              y={-28}
              width="10"
              height="3"
              rx="1"
              fill={filled ? (i < 4 ? "#4da6ff" : i < 7 ? "#ffb347" : "#5ce0b8") : "rgba(255,255,255,.06)"}
              opacity={filled ? 0.8 : 0.3}
            />
          );
        })}
        {/* Dangling feet */}
        {phase === "flying" && Array.from({ length: 10 }).map((_, i) => {
          const filled = i < Math.round(pct / 10);
          if (!filled) return null;
          return (
            <g key={`f${i}`}>
              <line
                x1={-60 + i * 14} y1={-24} x2={-60 + i * 14 + Math.sin(progress * 6 + i) * 1.5} y2={-16}
                stroke="rgba(255,255,255,.15)" strokeWidth="1" strokeLinecap="round"
              />
              <line
                x1={-56 + i * 14} y1={-24} x2={-56 + i * 14 + Math.sin(progress * 6 + i + 1) * 1.5} y2={-16}
                stroke="rgba(255,255,255,.15)" strokeWidth="1" strokeLinecap="round"
              />
            </g>
          );
        })}
      </g>

      {/* Floor/base */}
      <line x1="5" y1="72" x2="195" y2="72" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
    </svg>
  );
}
