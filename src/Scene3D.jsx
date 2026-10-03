// 3D model of the real Soarin' building at EPCOT, driven by live game state.
//
// The model is extruded from the same plan drawing as the 2D map (planDrawing.js, generated from the
// published plan): every room becomes a floor, room outlines become walls with door openings cut out,
// the building outline becomes the exterior wall. Ride vehicles and domes follow US 6,354,954 / 6,727,971.
//
// Units: everything is built in plan units (1 unit = 0.263 m) and the world group is scaled to meters.
// Plan → three.js: x → X, y → Z; an SVG rotate(a) becomes rotation.y = −a.

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLAN_SVG, buildInterior } from './planDrawing.js';

const GK = ['A', 'B', 'C'];
const GATE_COLORS = { A: 0x4da6ff, B: 0xffb347, C: 0x5ce0b8 };
const STATUS_HEX = { empty: '#94a3b8', loading: '#eab308', riding: '#22c55e', unloading: '#60a5fa' };
const RIDE_DUR = 45;
const UNIT = 0.2627;              // meters per plan unit
const M = 1 / UNIT;               // plan units per meter
const DOME_R = 46.4;              // 40 ft
const ROW_LIFT_M = [12.2, 9.1, 6.1]; // rows 1–3 lift ≈ 40 / 30 / 20 ft
const DEG = Math.PI / 180;

// Same placements as the plan (building frame = translate(590 862) rotate(10)).
// Game theater index → real theater: T1 = A (south), T2 = B (north), T3 = C (west, 2016).
const THEATERS = [
  { real: 'A', ox: 76.5, oy: 314, rot: 0, w: 125, depth: 128, rim: 59 },
  { real: 'B', ox: 69.3, oy: 29, rot: 180, w: 110, depth: 126, rim: 59 },
  { real: 'C', ox: -194, oy: 105.5, rot: 90, w: 121, depth: 139, rim: 53 },
];
const EXIT_ROUTES = [
  [[120, 296], [128, 296], [133, 290], [133, 240], [145, 230], [145, 180], [158, 170], [158, -50], [150, -90]],
  [[118, 46], [124, 46], [158, 46], [158, -50], [150, -90]],
  [[-176, 50], [-176, 38], [-80, 38], [-31, -18], [120, -18], [140, -45], [150, -90]],
];
const STANDBY_PATH = [[143, -50], [143, -6], [138, 0], [150, 0], [138, 16], [150, 16], [138, 32], [150, 32], [138, 48], [150, 48], [138, 64], [150, 64], [138, 80], [150, 80], [138, 96], [150, 96], [138, 112], [150, 112], [138, 128], [150, 128], [144, 150]];
const LL_PATH = [[130, -50], [130, 150]];

const along = (poly, f) => {
  const seg = []; let L = 0;
  for (let i = 1; i < poly.length; i++) { const d = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); seg.push(d); L += d; }
  let t = Math.max(0, Math.min(1, f)) * L;
  for (let i = 0; i < seg.length; i++) { if (t <= seg[i]) { const k = seg[i] ? t / seg[i] : 0; return [poly[i][0] + (poly[i + 1][0] - poly[i][0]) * k, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * k]; } t -= seg[i]; }
  return poly[poly.length - 1];
};

// ─── Read the plan drawing ───────────────────────

/* Render the plan off-screen and return every shape in absolute plan coordinates. */
function readPlan() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
  svg.innerHTML = PLAN_SVG;
  buildInterior(svg.querySelector('[data-interior]'));
  document.body.appendChild(svg);

  const out = [];
  const xf = (m, x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
  const parsePath = (d) => {
    const polys = []; let cur = null, x = 0, y = 0;
    const tok = d.match(/[MLHVZA]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
    let cmd = null;
    for (let i = 0; i < tok.length;) {
      if (/[A-Za-z]/.test(tok[i])) { cmd = tok[i++].toUpperCase(); if (cmd === 'Z') { if (cur) polys.push(cur); cur = null; continue; } if (cmd === 'A') return null; }
      const n = () => parseFloat(tok[i++]);
      if (cmd === 'M') { if (cur) polys.push(cur); x = n(); y = n(); cur = [[x, y]]; cmd = 'L'; }
      else if (cmd === 'L') { x = n(); y = n(); cur.push([x, y]); }
      else if (cmd === 'H') { x = n(); cur.push([x, y]); }
      else if (cmd === 'V') { y = n(); cur.push([x, y]); }
      else i++;
    }
    if (cur && cur.length > 1) polys.push(cur);
    return polys;
  };

  svg.querySelectorAll('rect, path, circle, line').forEach(node => {
    const cls = node.getAttribute('class') || '';
    if (!cls || /flow|domeinner|swing|spot|hatchline|over/.test(cls)) return;
    const m = node.getCTM(); if (!m) return;
    const zoneEl = node.closest('[data-id]');
    const meta = { cls, zone: zoneEl?.getAttribute('data-id') || null, n: zoneEl?.getAttribute('data-n') || null };
    const tag = node.tagName.toLowerCase();
    if (tag === 'rect') {
      const x = +node.getAttribute('x'), y = +node.getAttribute('y'), w = +node.getAttribute('width'), h = +node.getAttribute('height');
      out.push({ ...meta, polys: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => xf(m, a, b))] });
    } else if (tag === 'path') {
      const polys = parsePath(node.getAttribute('d') || '');
      if (polys) out.push({ ...meta, polys: polys.map(p => p.map(([a, b]) => xf(m, a, b))) });
    } else if (tag === 'circle') {
      const cx = +node.getAttribute('cx'), cy = +node.getAttribute('cy'), r = +node.getAttribute('r');
      const p = []; for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; p.push(xf(m, cx + Math.cos(a) * r, cy + Math.sin(a) * r)); }
      out.push({ ...meta, polys: [p] });
    } else if (tag === 'line') {
      const a = xf(m, +node.getAttribute('x1'), +node.getAttribute('y1')), b = xf(m, +node.getAttribute('x2'), +node.getAttribute('y2'));
      out.push({ ...meta, line: [a, b] });
    }
  });
  svg.remove();
  return out;
}

// ─── Geometry helpers (plan units; Y = height) ───

const inPoly = ([x, y], poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};

function floorGeo(poly, y) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function wallGeo(a, b, h, thick, y0 = 0) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
  if (len < 0.3) return null;
  const g = new THREE.BoxGeometry(len, h, thick);
  g.rotateY(-Math.atan2(dz, dx));
  g.translate((a[0] + b[0]) / 2, y0 + h / 2, (a[1] + b[1]) / 2);
  return g;
}

/* Walls along a polygon's edges, with openings wherever a door gap sits on the edge. */
function wallsFor(poly, gaps, h, thick, seen, y0 = 0) {
  const geos = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const key = [a, b].map(p => p.map(v => Math.round(v)).join(',')).sort().join('|');
    if (seen.has(key)) continue; seen.add(key);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(len / 0.8));
    let runStart = null;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const open = gaps.some(g => inPoly(p, g));
      if (!open && runStart === null) runStart = t;
      if ((open || s === steps) && runStart !== null) {
        const tEnd = open ? Math.max(runStart, (s - 1) / steps) : t;
        const g = wallGeo([a[0] + (b[0] - a[0]) * runStart, a[1] + (b[1] - a[1]) * runStart], [a[0] + (b[0] - a[0]) * tEnd, a[1] + (b[1] - a[1]) * tEnd], h, thick, y0);
        if (g) geos.push(g);
        runStart = null;
      }
    }
  }
  return geos;
}

function mkLabel(lines, color = '#e2e8f0') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.renderOrder = 10;
  s.scale.set(64, 16, 1);
  const draw = (l1, l2, col2) => {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(6,10,18,.78)';
    ctx.beginPath(); ctx.roundRect(16, 14, 480, 100, 22); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.font = '800 40px "Avenir Next", "Segoe UI", system-ui, sans-serif';
    ctx.fillText(l1, 256, l2 ? 46 : 64);
    if (l2) { ctx.fillStyle = col2 || '#94a3b8'; ctx.font = '700 30px "Avenir Next", "Segoe UI", system-ui, sans-serif'; ctx.fillText(l2, 256, 88); }
    tex.needsUpdate = true;
  };
  draw(...[].concat(lines));
  s.userData.draw = draw;
  return s;
}

// ─── Materials ───────────────────────────────────

function createMaterials() {
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  return {
    shellFloor: std(0x16222c, { side: THREE.DoubleSide }),
    room:       std(0x1f3040, { side: THREE.DoubleSide }),
    roomAlt:    std(0x284050, { side: THREE.DoubleSide }),
    back:       std(0x111a22, { side: THREE.DoubleSide }),
    open:       std(0x2c3a30, { side: THREE.DoubleSide }),
    ramp:       std(0x3a4e5e, { side: THREE.DoubleSide }),
    land:       std(0x1a2630, { side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
    upper:      std(0x24493a, { side: THREE.DoubleSide }),
    wall:       std(0x9fb4c6, { roughness: 0.7 }),
    exterior:   std(0xc8d6e2, { roughness: 0.6 }),
    landWall:   std(0x8a9aa8, { transparent: true, opacity: 0.55 }),
    rail:       std(0x6b7f90, { metalness: 0.4 }),
    gate:       std(0xf2b51d, { emissive: 0xf2b51d, emissiveIntensity: 0.35 }),
    exitDoor:   std(0x4ade80, { emissive: 0x4ade80, emissiveIntensity: 0.5 }),
    merge:      std(0xf2b51d, { emissive: 0xf2b51d, emissiveIntensity: 0.6 }),
    rowBase:    std(0x3b4a5a, { metalness: 0.3 }),
    canopy:     std(0xdfe7ee, { roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.28, depthWrite: false }),
    truss:      std(0x55687a, { metalness: 0.6, roughness: 0.4 }),
    guest:      std(0xe2e8f0, { emissive: 0x94a3b8, emissiveIntensity: 0.25 }),
    guestLL:    std(0xc084fc, { emissive: 0xa855f7, emissiveIntensity: 0.4 }),
    walker:     std(0x4ade80, { emissive: 0x22c55e, emissiveIntensity: 0.8 }),
  };
}

// ─── Build the building from the plan ────────────

function buildBuilding(world, mats) {
  const shapes = readPlan();
  const gaps = shapes.filter(s => /\bgap\b/.test(s.cls)).flatMap(s => s.polys);
  const buckets = new Map(); // material → geometries
  const add = (mat, g) => { if (!g) return; if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(g); };
  const seenInt = new Set(), seenExt = new Set();
  const pickable = [];

  const area = (p) => Math.abs(p.reduce((a, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return a + x * y2 - x2 * y; }, 0)) / 2;
  shapes.forEach(s => {
    const c = s.cls;
    const outer = s.polys ? s.polys.reduce((bi, p, i, arr) => area(p) > area(arr[bi]) ? i : bi, 0) : 0;
    if (s.line) { if (/\brail\b/.test(c)) add(mats.rail, wallGeo(s.line[0], s.line[1], 1.0 * M, 0.5)); return; }
    s.polys.forEach((poly, pi) => {
      if (c === 'landshell') {
        if (pi === outer) add(mats.land, floorGeo(poly, 0.02 * M));
        wallsFor(poly, [], 2.5 * M, 1.2, seenExt).forEach(g => add(mats.landWall, g));
      } else if (c === 'shell') {
        if (pi === outer) add(mats.shellFloor, floorGeo(poly, 0.03 * M));
        wallsFor(poly, gaps, 5.5 * M, 1.6, seenExt).forEach(g => add(mats.exterior, g));
      } else if (/\broom\b/.test(c)) {
        if (/\bopen\b/.test(c)) { add(mats.open, floorGeo(poly, 0.05 * M)); return; }
        if (/\bupper\b/.test(c)) {           // upper-level exit lane: slab + railings
          add(mats.upper, floorGeo(poly, 4.6 * M));
          wallsFor(poly, [], 1.0 * M, 0.5, new Set(), 4.6 * M).forEach(g => add(mats.rail, g));
          return;
        }
        const geo = floorGeo(poly, (/\balt\b/.test(c) ? 0.07 : 0.06) * M);
        if (s.zone === 'theater' && s.n) {
          const mesh = new THREE.Mesh(geo, mats.room);
          mesh.receiveShadow = true; mesh.userData.real = s.n;
          world.add(mesh); pickable.push(mesh);
        } else add(/\balt\b/.test(c) ? mats.roomAlt : mats.room, geo);
        if (s.zone !== 'atrium') wallsFor(poly, gaps, 3.0 * M, 0.9, seenInt).forEach(g => add(mats.wall, g));
      } else if (/\bback\b/.test(c)) add(mats.back, floorGeo(poly, 0.08 * M));
      else if (/\bramp\b/.test(c)) add(mats.ramp, floorGeo(poly, 0.09 * M));
      else if (/\bgate\b/.test(c)) {
        const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
        const g = new THREE.BoxGeometry(Math.max(...xs) - Math.min(...xs), 0.3 * M, Math.max(...zs) - Math.min(...zs));
        g.translate((Math.max(...xs) + Math.min(...xs)) / 2, 0.15 * M, (Math.max(...zs) + Math.min(...zs)) / 2);
        add(mats.gate, g);
      } else if (/\bdoor\b/.test(c)) add(mats.exitDoor, floorGeo(poly, 0.12 * M));
      else if (/\bmerge\b/.test(c)) add(mats.merge, floorGeo(poly, 0.12 * M));
    });
  });

  buckets.forEach((geos, mat) => {
    const merged = mergeGeometries(geos.map(g => g.index ? g.toNonIndexed() : g), false);
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = mat !== mats.land && mat !== mats.shellFloor;
    mesh.receiveShadow = true;
    world.add(mesh);
  });
  return pickable;
}

// ─── Theaters: dome + ride vehicle (theater space: X = u, Z = v, screen toward −Z) ───

function buildTheater(building, t, mats) {
  const g = new THREE.Group();
  g.position.set(t.ox, 0, t.oy);
  g.rotation.y = -t.rot * DEG;
  building.add(g);

  const rim = -t.rim;
  const cw = (t.w - 22) / 3;
  const cxs = [0, 1, 2].map(i => -t.w / 2 + 7 + cw / 2 + i * (cw + 4));

  // Dome: back half of a 40 ft-radius sphere, centered over the rim, from the crown down past the equator.
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x2a4a66, emissive: 0x0b1a2a, emissiveIntensity: 1,
    side: THREE.DoubleSide, transparent: true, opacity: 0.55, roughness: 0.35, metalness: 0.2, depthWrite: false,
  });
  const domeGeo = new THREE.SphereGeometry(DOME_R, 48, 24, Math.PI, Math.PI, 0, Math.PI * 0.85); // half facing away from the seats, crown to ~2.5 m above the floor
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.position.set(0, 13.5 * M, rim);
  g.add(dome);

  // Ride vehicle: 3 carriers × 3 rows. Each row = base + fill bar + canopy, animated from load to flight.
  const rows = [];
  cxs.forEach((cx, ci) => {
    const color = GATE_COLORS[GK[ci]];
    for (let ri = 0; ri < 3; ri++) {
      const row = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(cw - 1.6, 0.6 * M, 2.6), mats.rowBase);
      base.castShadow = true;
      const fillMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.4 });
      const fillGeo = new THREE.BoxGeometry(1, 0.35 * M, 2.0); fillGeo.translate(0.5, 0, 0);
      const fill = new THREE.Mesh(fillGeo, fillMat);
      fill.position.set(-(cw - 1.6) / 2, 0.45 * M, 0); fill.scale.x = 0.001;
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.12 * M, 3.6), mats.canopy);
      canopy.position.y = 2.2 * M;
      row.add(base, fill, canopy);
      g.add(row);
      rows.push({ row, fill, fillMat, ci, ri, cx, color,
        load: new THREE.Vector3(cx, 0.4 * M, -4 - (2 - ri) * 4.6 - 1.3),
        fly: new THREE.Vector3(cx, ROW_LIFT_M[ri] * M, rim - 3 - ri * 3.2 - 1.2) });
    }
  });
  // Lift truss behind the carriers (the arm that swings the rows up)
  const truss = new THREE.Mesh(new THREE.BoxGeometry(t.w - 12, 1.2, 1.2), mats.truss);
  truss.position.set(0, 9 * M, -4);
  g.add(truss);

  // Lights
  const screenLight = new THREE.PointLight(0x6fb6ff, 0, 160 * M);
  screenLight.position.set(0, 8 * M, rim - 10);
  g.add(screenLight);

  // Holding guests (pool)
  const guestGeo = new THREE.CylinderGeometry(0.36 * M, 0.36 * M, 1.7 * M, 8); guestGeo.translate(0, 0.85 * M, 0);
  const guests = Array.from({ length: 66 }, (_, k) => {
    const bay = k % 3, n = Math.floor(k / 3);
    const m = new THREE.Mesh(guestGeo, mats.guest);
    m.position.set(cxs[bay] - cw / 2 + 2 + (n % 11) * ((cw - 4) / 10), 0, 3 + Math.floor(n / 11) * 2.2);
    m.visible = false; g.add(m); return m;
  });

  // Label over the theater
  const label = mkLabel([`Theater ${t.real}`, 'EMPTY']);
  label.position.set(0, 22 * M, -t.depth * 0.45);
  g.add(label);

  // Active highlight: outline of theater + concourse
  const hl = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([[-t.w / 2 - 2, -t.depth - 2], [t.w / 2 + 2, -t.depth - 2], [t.w / 2 + 2, 27], [-t.w / 2 - 2, 27]].map(([x, z]) => new THREE.Vector3(x, 0.3 * M, z))),
    new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0 }),
  );
  g.add(hl);

  return { g, t, dome, domeMat, rows, screenLight, guests, label, hl, lastLabel: '' };
}

function syncTheater(td, th, idx, active, time) {
  const status = th?.status || 'empty';
  const flying = status === 'riding';
  const p = flying ? 1 - th.rideTimer / RIDE_DUR : 0;
  const lift = flying ? Math.min(1, p / 0.08, (1 - p) / 0.08) : 0;
  const ease = lift * lift * (3 - 2 * lift);

  td.rows.forEach(r => {
    r.row.position.lerpVectors(r.load, r.fly, ease);
    r.row.rotation.x = -ease * 0.25; // rows pitch forward toward the screen
    const row = th?.seats?.[GK[r.ci]]?.[r.ri];
    const frac = row?.capacity ? row.filled / row.capacity : 0;
    r.fill.scale.x = Math.max(0.001, frac * (r.fill.parent.children[0].geometry.parameters.width));
    r.fillMat.color.set(status === 'unloading' ? 0x60a5fa : r.color);
    r.fillMat.emissive.set(status === 'unloading' ? 0x60a5fa : r.color);
  });

  // Dome lights up with "film" during flight
  const film = flying ? ease * (0.7 + 0.3 * Math.sin(time * 1.7) ** 2) : 0;
  td.domeMat.emissive.setRGB(0.05 + 0.25 * film, 0.1 + 0.55 * film, 0.16 + 0.75 * film);
  td.domeMat.opacity = 0.5 + 0.35 * film;
  td.screenLight.intensity = film * 2500;

  const holdCount = (th?.holding || []).reduce((s, g) => s + g.size, 0);
  td.guests.forEach((m, k) => { m.visible = k < holdCount; });

  const text = status === 'riding' ? `IN FLIGHT ${Math.ceil(th.rideTimer)}s` : status === 'unloading' ? 'CLEARING' : status === 'loading' ? `LOADING · ${holdCount} waiting` : 'EMPTY';
  const key = `${idx}|${text}`;
  if (key !== td.lastLabel) { td.label.userData.draw(`T${idx + 1} · Theater ${td.t.real}`, text, STATUS_HEX[status]); td.lastLabel = key; }

  td.hl.material.opacity = active ? 0.55 + 0.35 * Math.sin(time * 3) : 0;
}

// ─── React component ─────────────────────────────

export default function Scene3D({ theaters = [], activeT = 0, sbQueue = [], llQueue = [], onSelect }) {
  const containerRef = useRef(null);
  const worldRef = useRef(null);
  const stateRef = useRef({ theaters, activeT, sbQueue, llQueue, onSelect });
  stateRef.current = { theaters, activeT, sbQueue, llQueue, onSelect };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1118);
    scene.fog = new THREE.Fog(0x0a1118, 260, 520);

    const w = el.clientWidth || 600, h = el.clientHeight || 400;
    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    // Lights (meters)
    scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x26303a, 1.3));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    sun.position.set(-60, 120, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 10, far: 400 });
    scene.add(sun);

    // World in plan units, scaled to meters. Center it on the show building.
    const world = new THREE.Group();
    world.scale.setScalar(UNIT);
    world.position.set(-640 * UNIT, 0, -930 * UNIT);
    scene.add(world);

    // Ground: the aerial photo, placed exactly where the plan places it.
    const tex = new THREE.TextureLoader().load('/plan-aerial.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 1000), new THREE.MeshStandardMaterial({ map: tex, color: 0x9aa4ae, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(650, -0.05, 720);
    ground.receiveShadow = true;
    world.add(ground);

    const mats = createMaterials();
    const pickable = buildBuilding(world, mats);

    const building = new THREE.Group();
    building.position.set(590, 0, 862);
    building.rotation.y = -10 * DEG;
    world.add(building);
    const theaterData = THEATERS.map(t => buildTheater(building, t, mats));

    // Queue guests + exit walkers (building frame)
    const guestGeo = new THREE.CylinderGeometry(0.36 * M, 0.36 * M, 1.7 * M, 8); guestGeo.translate(0, 0.85 * M, 0);
    const sbPool = Array.from({ length: 40 }, () => { const m = new THREE.Mesh(guestGeo, mats.guest); m.visible = false; building.add(m); return m; });
    const llPool = Array.from({ length: 20 }, () => { const m = new THREE.Mesh(guestGeo, mats.guestLL); m.visible = false; building.add(m); return m; });
    const walkers = EXIT_ROUTES.map(() => Array.from({ length: 8 }, () => { const m = new THREE.Mesh(guestGeo, mats.walker); m.visible = false; building.add(m); return m; }));

    // Camera + controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 25;
    controls.maxDistance = 420;
    camera.position.set(-40, 150, 150);
    controls.target.set(0, 0, 0);
    controls.update();

    let autoFocus = true, focusTimeout;
    controls.addEventListener('start', () => {
      autoFocus = false;
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => { autoFocus = true; }, 6000);
    });

    // Click a theater to select it
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let downAt = null;
    const onDown = (e) => { downAt = [e.clientX, e.clientY]; };
    const onUp = (e) => {
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickable)[0];
      const idx = hit ? THEATERS.findIndex(t => t.real === hit.object.userData.real) : -1;
      if (idx >= 0) stateRef.current.onSelect?.(idx);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    worldRef.current = { enableAutoFocus: () => { autoFocus = true; } };

    const focusPoint = new THREE.Vector3(), camGoal = new THREE.Vector3();
    let animId;
    const t0 = performance.now();
    function animate() {
      animId = requestAnimationFrame(animate);
      const time = (performance.now() - t0) / 1000;
      const { theaters: ths, activeT: act, sbQueue: sb, llQueue: ll } = stateRef.current;

      theaterData.forEach((td, i) => syncTheater(td, ths[i], i, i === act, time));

      sbPool.forEach((m, k) => {
        const g = sb[k]; m.visible = !!g;
        if (g) { const [x, z] = along(STANDBY_PATH, 1 - (k + .5) / 40); m.position.set(x, 0, z); m.scale.setScalar(0.8 + Math.min(g.size, 10) * 0.04); }
      });
      llPool.forEach((m, k) => {
        const g = ll[k]; m.visible = !!g;
        if (g) { const [x, z] = along(LL_PATH, 1 - (k + .5) / 20); m.position.set(x, 0, z); }
      });
      walkers.forEach((pool, i) => {
        const on = ths[i]?.status === 'unloading';
        pool.forEach((m, k) => {
          m.visible = on;
          if (on) { const [x, z] = along(EXIT_ROUTES[i], ((time * 0.22) + k / pool.length) % 1); m.position.set(x, 0, z); }
        });
      });

      // Follow the active theater
      const td = theaterData[act];
      if (autoFocus && td) {
        td.g.localToWorld(focusPoint.set(0, 0, -td.t.depth * 0.4));
        camGoal.set(focusPoint.x - 35, 95, focusPoint.z + 95);
        camera.position.lerp(camGoal, 0.025);
        controls.target.lerp(focusPoint, 0.04);
      }

      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(([entry]) => {
      const { width: rw, height: rh } = entry.contentRect;
      if (rw < 1 || rh < 1) return;
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
      renderer.setSize(rw, rh);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(focusTimeout);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => { worldRef.current?.enableAutoFocus?.(); }, [activeT]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#0a1118' }} />;
}
