import {
  PHASE_DURATIONS,
  CYCLE,
  DISPATCH_INTERVAL,
  THEATER_COUNT,
  PHASE_COLORS,
  PHASE_LABELS,
  nextDispatch,
  cycleSegments,
} from "./showControl.js";

const SEGMENTS = cycleSegments();
const fmtNum = (n) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

// Interlock status dot color from the lane's phase + advisory interlock.
function dotColor(lane) {
  if (lane.held) return "#ef4444";                 // HELD / fault
  if (lane.phase === "preshow") return "rgba(255,255,255,.25)";
  if (lane.phase === "load") return lane.ready ? "#22c55e" : "#eab308"; // green ready / amber loading
  return "rgba(34,197,94,.55)";                    // dispatched & cycling — dim green
}

function Lane({ index, lane }) {
  const isPreshow = lane.phase === "preshow";
  const playheadPct = isPreshow ? 0 : (lane.localTime / CYCLE) * 100;
  const dot = dotColor(lane);
  const phaseLabel = lane.held ? "HELD" : PHASE_LABELS[lane.phase] || "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: isPreshow ? 0.55 : 1 }}>
      {/* Left: label + interlock dot */}
      <div style={{ width: 84, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span
          title={lane.held ? "Interlock fault — dispatch held" : "Interlock (seat check + gates closed)"}
          style={{
            width: 8, height: 8, borderRadius: "50%", background: dot,
            boxShadow: `0 0 6px ${dot}`, flexShrink: 0, transition: "background .2s",
          }}
        />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "rgba(255,255,255,.7)" }}>T{index + 1}</span>
        <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.5, color: lane.held ? "#ef4444" : "rgba(255,255,255,.3)" }}>{phaseLabel}</span>
      </div>

      {/* Center: one full cycle as proportional phase segments + playhead */}
      <div style={{
        position: "relative", flex: 1, height: 16, borderRadius: 4, overflow: "hidden",
        background: "rgba(255,255,255,.03)", border: `1px solid ${lane.held ? "rgba(239,68,68,.4)" : "rgba(255,255,255,.05)"}`,
      }}>
        {SEGMENTS.map((seg) => (
          <div
            key={seg.phase}
            title={`${PHASE_LABELS[seg.phase]} · ${PHASE_DURATIONS[seg.phase]}s`}
            style={{
              position: "absolute", top: 0, bottom: 0,
              left: `${seg.leftFrac * 100}%`, width: `${seg.frac * 100}%`,
              background: `${PHASE_COLORS[seg.phase]}${seg.phase === "fly" ? "22" : "33"}`,
              borderRight: "1px solid rgba(4,8,16,.6)",
            }}
          />
        ))}
        {!isPreshow && (
          <div style={{
            position: "absolute", top: -1, bottom: -1, left: `${playheadPct}%`,
            width: 2, background: lane.held ? "#ef4444" : "#fff",
            boxShadow: `0 0 6px ${lane.held ? "#ef4444" : "rgba(255,255,255,.8)"}`,
            transform: "translateX(-1px)", transition: "left .1s linear",
          }} />
        )}
        {isPreshow && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, fontWeight: 700, letterSpacing: 1.5, color: "rgba(255,255,255,.4)",
          }}>
            STANDBY
          </div>
        )}
      </div>

      {/* Right: occupancy of the loading/loaded flight */}
      <div style={{ width: 40, flexShrink: 0, textAlign: "right" }}>
        <span style={{
          fontSize: 11, fontWeight: 800, fontFamily: "monospace",
          color: lane.occPct >= 90 ? "#22c55e" : lane.occPct >= 50 ? "#eab308" : "rgba(255,255,255,.4)",
        }}>{lane.occPct}%</span>
      </div>
    </div>
  );
}

export default function ShowClock({ now = 0, lanes = [], throughput = null, avgOcc = 0, strict = false, paused = false }) {
  const nd = nextDispatch(now);

  return (
    <div style={{
      background: "rgba(255,255,255,.02)", borderRadius: 10,
      border: "1px solid rgba(255,255,255,.06)", padding: "7px 10px 8px",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: paused ? "#ffb347" : "#22c55e",
            boxShadow: `0 0 6px ${paused ? "#ffb347" : "#22c55e"}`,
            animation: paused ? "none" : "breathe 2s ease infinite",
          }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,.7)" }}>SHOW CLOCK</span>
          <span style={{
            fontSize: 7, fontWeight: 700, letterSpacing: 0.5, padding: "1px 5px", borderRadius: 4,
            color: strict ? "#fca5a5" : "rgba(255,255,255,.28)",
            border: `1px solid ${strict ? "rgba(239,68,68,.3)" : "rgba(255,255,255,.08)"}`,
          }}>RSS · {strict ? "STRICT" : "ADVISORY"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,.4)" }}>
            Interval{" "}
            <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#93c5fd" }}>{fmtNum(DISPATCH_INTERVAL)}s</span>
          </span>
          {avgOcc > 0 && (
            <span style={{ fontSize: 9, color: "rgba(255,255,255,.4)" }}>
              Avg occ{" "}
              <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#5ce0b8" }}>{avgOcc}%</span>
            </span>
          )}
          {throughput != null && (
            <span style={{ fontSize: 9, color: "rgba(255,255,255,.4)" }}>
              Throughput{" "}
              <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#5ce0b8" }}>{throughput}/hr</span>
            </span>
          )}
          <span style={{ fontSize: 9, color: "rgba(255,255,255,.4)" }}>
            Next{" "}
            <span style={{ fontWeight: 800, color: "#fff" }}>T{nd.theater + 1}</span>{" in "}
            <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#ffb347" }}>{Math.ceil(nd.inSeconds)}s</span>
          </span>
        </div>
      </div>

      {/* Three staggered theater lanes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {Array.from({ length: THEATER_COUNT }).map((_, i) => (
          <Lane key={i} index={i} lane={lanes[i] || { occPct: 0, ready: false, held: false, phase: "preshow", localTime: 0 }} />
        ))}
      </div>
    </div>
  );
}
