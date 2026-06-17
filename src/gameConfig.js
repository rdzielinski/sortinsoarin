// ═══════════════════════════════════════
// GAME CONFIG + HELPERS
// ═══════════════════════════════════════
export const GATES = {
  A: { rows: [10, 10, 7], label: "A", color: "#4da6ff" },
  B: { rows: [11, 11, 11], label: "B", color: "#ffb347" },
  C: { rows: [10, 10, 7], label: "C", color: "#5ce0b8" },
};
export const TOTAL = 87;
export const GK = ["A", "B", "C"];
export const ROW_NAMES = ["Row 1", "Row 2", "Row 3"];
export const RIDE_DURATION = 45;
export const UNLOAD_DURATION = 4;

export const DIFFS = {
  easy: { label: "Easy", desc: "Slow arrivals · No countdown", groupMax: 6, sbRate: 3500, llRate: 6000, countdown: 0, color: "#22c55e" },
  normal: { label: "Normal", desc: "Steady flow · Standard ops", groupMax: 10, sbRate: 2200, llRate: 4000, countdown: 0, color: "#eab308" },
  hard: { label: "Hard", desc: "Rush hour · Guest patience drains", groupMax: 10, sbRate: 1400, llRate: 2800, countdown: 0, color: "#ef4444" },
};

export const ACHIEVEMENTS = [
  { id: "perfect", icon: "✦", title: "Perfect Flight", desc: "100% occupancy on a theater" },
  { id: "speed", icon: "⚡", title: "Speed Demon", desc: "Dispatch in under 25 seconds" },
  { id: "triple", icon: "🎯", title: "Triple Dispatch", desc: "All 3 theaters riding at once" },
  { id: "split", icon: "✂", title: "Split Decision", desc: "Use the split mechanic" },
  { id: "ten", icon: "👑", title: "CM of the Month", desc: "Dispatch 10 flights total" },
  { id: "twenty", icon: "💎", title: "Veteran Operator", desc: "Dispatch 20 flights total" },
  { id: "streak", icon: "🔥", title: "Hot Streak", desc: "3 flights over 90% in a row" },
  { id: "served500", icon: "🎖", title: "500 Guests Served", desc: "Seat 500 total guests" },
  // Show-control / RSS achievements
  { id: "greenboard", icon: "🟢", title: "Green Board", desc: "5 consecutive interlock-clean dispatches" },
  { id: "onclock", icon: "🕐", title: "On The Clock", desc: "Dispatch 10 flights in Synchronized Show Mode" },
  { id: "nohold", icon: "🛡", title: "Clean Shift", desc: "End a 3-min+ show shift with zero holds" },
];

// Group id counter (reset per game via resetGroupIds()).
let _gid = 0;
export const resetGroupIds = () => { _gid = 0; };
export const mkGroup = (max) => ({ id: `g${++_gid}`, size: Math.floor(Math.random() * max) + 1, ts: Date.now() });
export const mkSeats = () => { const s = {}; GK.forEach(k => { s[k] = GATES[k].rows.map(c => ({ capacity: c, filled: 0 })) }); return s; };
export const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`; };
export const seatsFilled = (seats) => GK.reduce((t, k) => t + seats[k].reduce((a, r) => a + r.filled, 0), 0);
export const getStars = (pct) => pct >= 97 ? 5 : pct >= 93 ? 4 : pct >= 85 ? 3 : pct >= 70 ? 2 : 1;
