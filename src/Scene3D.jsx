import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GK = ['A', 'B', 'C'];
const GATE_COLORS = { A: 0x4da6ff, B: 0xffb347, C: 0x5ce0b8 };
const GATE_ROWS   = { A: [10, 10, 7], B: [11, 11, 11], C: [10, 10, 7] };
const TOTAL = 87;
const RIDE_DUR = 45;
const ROW_LIFTS = [2.5, 5, 8];

const T_POS = [
  { x: -22, z: 16 },
  { x:  22, z: 16 },
  { x:   0, z: -22 },
];
const GATE_X_OFF = [-5, 0, 5];
const ROW_Z_OFF  = [-4, -1, 2];
const SCREEN_Z_OFF = -7;
const BAR_W = 4;

const QUEUE_POINTS = [
  {x:28,z:26},{x:14,z:26},{x:14,z:24},{x:26,z:24},
  {x:26,z:22},{x:14,z:22},{x:14,z:20},{x:26,z:20},
  {x:26,z:18},{x:14,z:18},{x:14,z:16},{x:10,z:14},
  {x:6,z:10},{x:2,z:4},{x:0,z:0},
];

const GATE_ROUTE = {
  A: [{x:0,z:0},{x:-8,z:-1},{x:-16,z:0},{x:-22,z:4}],
  B: [{x:0,z:0},{x:8,z:-1},{x:16,z:0},{x:22,z:4}],
  C: [{x:0,z:0},{x:0,z:-6},{x:0,z:-12},{x:0,z:-16}],
};

// ─── Geometry helpers ────────────────────────────

function mkWall(x1, z1, x2, z2, h = 3.5, thick = 0.3, mat) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.01) return null;
  const geo = new THREE.BoxGeometry(thick, h, len);
  const m = new THREE.Mesh(geo, mat);
  m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
  m.rotation.y = Math.atan2(dx, dz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function mkFloor(x, z, w, d, mat, y = 0.01) {
  const geo = new THREE.PlaneGeometry(w, d);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

function mkLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = color;
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(7, 1.75, 1);
  return s;
}

function mkTube(scene, points, color, opacity = 0.3) {
  if (points.length < 2) return;
  const vecs = points.map(p => new THREE.Vector3(p.x, 0.06, p.z));
  const curve = new THREE.CatmullRomCurve3(vecs);
  const geo = new THREE.TubeGeometry(curve, 24, 0.1, 5, false);
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.5,
    transparent: true, opacity, roughness: 0.6,
  });
  scene.add(new THREE.Mesh(geo, mat));
}

// ─── Materials ───────────────────────────────────

function createMaterials() {
  return {
    ground:   new THREE.MeshStandardMaterial({ color: 0x181830, roughness: 0.9 }),
    queue:    new THREE.MeshStandardMaterial({ color: 0x222258, roughness: 0.85 }),
    corridor: new THREE.MeshStandardMaterial({ color: 0x262660, roughness: 0.85 }),
    preflight:new THREE.MeshStandardMaterial({ color: 0x2a2a6a, roughness: 0.8 }),
    wall:     new THREE.MeshStandardMaterial({ color: 0x3e4270, roughness: 0.7, metalness: 0.2 }),
    wallLow:  new THREE.MeshStandardMaterial({ color: 0x4e5182, roughness: 0.6, metalness: 0.15 }),
    tFloor:   new THREE.MeshStandardMaterial({ color: 0x202e48, roughness: 0.7 }),
    rowBg:    new THREE.MeshStandardMaterial({ color: 0x2a2a50, roughness: 0.9 }),
    ceiling:  new THREE.MeshStandardMaterial({ color: 0x181830, roughness: 0.95, side: THREE.DoubleSide }),
    pillar:   new THREE.MeshStandardMaterial({ color: 0x363968, roughness: 0.5, metalness: 0.3 }),
    hub:      new THREE.MeshStandardMaterial({ color: 0x4a50a0, emissive: 0x5a60cc, emissiveIntensity: 0.5, roughness: 0.4 }),
  };
}

// ─── Build the full layout ───────────────────────

function buildLayout(scene, mats) {
  // Ground
  scene.add(mkFloor(0, 0, 120, 100, mats.ground, 0));
  const grid = new THREE.GridHelper(100, 50, 0x252548, 0x1a1a3a);
  grid.position.y = 0.015;
  scene.add(grid);

  // Queue area floor + rails
  scene.add(mkFloor(20, 22, 20, 16, mats.queue, 0.02));
  [[10,15,10,27],[30,15,30,27],[10,15,30,15],[10,27,24,27],[28,27,30,27]]
    .forEach(([a,b,c,d]) => { const w = mkWall(a,b,c,d,1.5,0.3,mats.wall); if(w) scene.add(w); });
  [[12,25,28,25],[12,23,28,23],[12,21,28,21],[12,19,28,19],[12,17,28,17]]
    .forEach(([a,b,c,d], i) => {
      const gap = 2;
      const [sx, ex] = i % 2 === 0 ? [a+gap, c] : [a, c-gap];
      const w = mkWall(sx,b,ex,d,0.8,0.15,mats.wallLow);
      if(w) scene.add(w);
    });

  // Corridors floor
  scene.add(mkFloor(6, 8, 14, 10, mats.corridor, 0.025));
  scene.add(mkFloor(-11, 0, 18, 4, mats.corridor, 0.025));
  scene.add(mkFloor(11, 0, 18, 4, mats.corridor, 0.025));
  scene.add(mkFloor(0, -7, 4, 16, mats.corridor, 0.025));

  // Pre-flight floors
  scene.add(mkFloor(-22, 2, 6, 8, mats.preflight, 0.03));
  scene.add(mkFloor(22, 2, 6, 8, mats.preflight, 0.03));
  scene.add(mkFloor(0, -14, 8, 6, mats.preflight, 0.03));

  // Corridor walls
  [[-2,-2,-2,14,1.8],[2,-2,2,8,1.8],[-2,-2,-20,-2,1.8],[2,-2,20,-2,1.8],[-2,-2,-2,-16,1.8],[2,-2,2,-16,1.8]]
    .forEach(([a,b,c,d,h]) => { const w = mkWall(a,b,c,d,h,0.3,mats.wall); if(w) scene.add(w); });

  // Hub marker
  const hubGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.12, 32);
  const hubMesh = new THREE.Mesh(hubGeo, mats.hub);
  hubMesh.position.set(0, 0.07, 0);
  scene.add(hubMesh);

  // Path lines from hub to theaters
  mkTube(scene, GATE_ROUTE.A, 0x4da6ff, 0.45);
  mkTube(scene, GATE_ROUTE.B, 0xffb347, 0.45);
  mkTube(scene, GATE_ROUTE.C, 0x5ce0b8, 0.45);
  mkTube(scene, QUEUE_POINTS.slice(10), 0x6060aa, 0.3);

  // Labels
  const labels = [
    ['HUB', '#8888cc', 0, 3.5, 0],
    ['QUEUE', '#6a6a9a', 28, 3, 28],
    ['EXIT', '#4a4a7a', -24, 3, 32],
    ['EXIT', '#4a4a7a', 24, 3, 32],
    ['EXIT', '#4a4a7a', 16, 3, -26],
  ];
  labels.forEach(([t, col, x, y, z]) => {
    const l = mkLabel(t, col);
    l.position.set(x, y, z);
    scene.add(l);
  });
}

// ─── Build one theater ───────────────────────────

function buildTheater(scene, ti, mats) {
  const pos = T_POS[ti];
  const cx = pos.x, cz = pos.z;
  const tw = 16, hw = tw / 2;

  // Floor
  scene.add(mkFloor(cx, cz, tw, tw, mats.tFloor, 0.04));

  // Walls (leaving entry gap on south side)
  const wallH = 4.5;
  [
    [cx-hw, cz-hw, cx+hw, cz-hw],
    [cx-hw, cz-hw, cx-hw, cz+hw],
    [cx+hw, cz-hw, cx+hw, cz+hw],
    [cx-hw, cz+hw, cx-3, cz+hw],
    [cx+3, cz+hw, cx+hw, cz+hw],
  ].forEach(([a,b,c,d]) => { const w = mkWall(a,b,c,d,wallH,0.35,mats.wall); if(w) scene.add(w); });

  // Ceiling
  const ceil = mkFloor(cx, cz, tw-0.5, tw-0.5, mats.ceiling, wallH);
  scene.add(ceil);

  // Pillars (corners)
  const pillarGeo = new THREE.CylinderGeometry(0.25, 0.25, wallH, 8);
  [[-hw+0.5,-hw+0.5],[hw-0.5,-hw+0.5],[-hw+0.5,hw-0.5],[hw-0.5,hw-0.5]].forEach(([dx,dz]) => {
    const p = new THREE.Mesh(pillarGeo, mats.pillar);
    p.position.set(cx+dx, wallH/2, cz+dz);
    p.castShadow = true;
    scene.add(p);
  });

  // Screen (half-cylinder dome)
  const screenR = 6.5, screenH = 4.5;
  const screenGeo = new THREE.CylinderGeometry(screenR, screenR, screenH, 32, 1, true, 0, Math.PI);
  const screenColor = [0x4da6ff, 0xffb347, 0x5ce0b8][ti];
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0a1a2a,
    emissive: new THREE.Color(screenColor).multiplyScalar(0.25),
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.2, metalness: 0.6,
  });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.set(cx, screenH / 2 + 0.3, cz + SCREEN_Z_OFF);
  screenMesh.rotation.y = Math.PI;
  scene.add(screenMesh);

  // Theater label
  const tLabel = mkLabel(`Theater ${'ABC'[ti]}`, ['#4da6ff','#ffb347','#5ce0b8'][ti]);
  tLabel.position.set(cx, wallH + 1.5, cz);
  scene.add(tLabel);

  // Gate sections with rows
  const gates = {};
  GK.forEach((gk, gi) => {
    const gx = cx + GATE_X_OFF[gi];
    const gateColor = GATE_COLORS[gk];
    const fills = [];
    const bgs = [];

    // Section floor marker
    const sFloor = mkFloor(gx, cz + 1, BAR_W + 0.5, 11, new THREE.MeshStandardMaterial({
      color: new THREE.Color(gateColor).multiplyScalar(0.12), roughness: 0.9,
    }), 0.045);
    scene.add(sFloor);

    // Small gate label
    const gLabel = mkLabel(`${gk}`, new THREE.Color(gateColor).getStyle());
    gLabel.scale.set(3, 0.75, 1);
    gLabel.position.set(gx, 0.8, cz + 5);
    scene.add(gLabel);

    GATE_ROWS[gk].forEach((cap, ri) => {
      const rz = cz + ROW_Z_OFF[ri];

      // Background bar
      const bgGeo = new THREE.BoxGeometry(BAR_W, 0.2, 0.75);
      const bgMesh = new THREE.Mesh(bgGeo, mats.rowBg);
      bgMesh.position.set(gx, 0.15, rz);
      bgMesh.receiveShadow = true;
      scene.add(bgMesh);
      bgs.push(bgMesh);

      // Fill bar (pivoted at left edge)
      const fillGeo = new THREE.BoxGeometry(1, 0.32, 0.65);
      fillGeo.translate(0.5, 0, 0);
      const fillMat = new THREE.MeshStandardMaterial({
        color: gateColor,
        emissive: new THREE.Color(gateColor),
        emissiveIntensity: 0.9,
        roughness: 0.4,
      });
      const fillMesh = new THREE.Mesh(fillGeo, fillMat);
      fillMesh.position.set(gx - BAR_W / 2, 0.22, rz);
      fillMesh.scale.x = 0.001;
      scene.add(fillMesh);
      fills.push(fillMesh);

      // Seat dots (small cubes for individual seats)
      const seatW = (BAR_W - 0.4) / cap;
      for (let si = 0; si < cap; si++) {
        const sx = gx - BAR_W / 2 + 0.2 + si * seatW + seatW / 2;
        const sGeo = new THREE.BoxGeometry(seatW * 0.65, 0.08, 0.35);
        const sMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(gateColor).multiplyScalar(0.3),
          emissive: new THREE.Color(gateColor),
          emissiveIntensity: 0.15,
          roughness: 0.8,
        });
        const sMesh = new THREE.Mesh(sGeo, sMat);
        sMesh.position.set(sx, 0.35, rz);
        scene.add(sMesh);
      }
    });

    gates[gk] = { fills, bgs };
  });

  // Theater point lights
  const tLight = new THREE.PointLight(screenColor, 2.0, 35);
  tLight.position.set(cx, wallH - 1, cz + SCREEN_Z_OFF + 3);
  scene.add(tLight);
  const tLight2 = new THREE.PointLight(0xffffff, 0.8, 25);
  tLight2.position.set(cx, wallH - 0.5, cz);
  scene.add(tLight2);

  return { gates, screenMesh, screenMat, screenColor, light: tLight };
}

// ─── Sync 3D state from game state ───────────────

function syncState(theaterData, theaters, activeT, time) {
  if (!theaterData || !theaters) return;

  theaters.forEach((th, ti) => {
    const td = theaterData[ti];
    if (!td) return;

    const isRiding = th.status === 'riding';
    const rideProgress = isRiding ? 1 - th.rideTimer / RIDE_DUR : 0;
    const liftPhase = isRiding
      ? (rideProgress < 0.08 ? rideProgress / 0.08 : rideProgress > 0.92 ? (1 - rideProgress) / 0.08 : 1)
      : 0;

    GK.forEach(gk => {
      const gateData = td.gates[gk];
      if (!gateData || !th.seats?.[gk]) return;

      th.seats[gk].forEach((row, ri) => {
        const fillMesh = gateData.fills[ri];
        const bgMesh = gateData.bgs[ri];
        if (!fillMesh || !bgMesh) return;

        const ratio = row.capacity > 0 ? row.filled / row.capacity : 0;
        fillMesh.scale.x = Math.max(0.001, ratio * BAR_W);

        const baseY = 0.22;
        const bgBaseY = 0.15;
        const lift = liftPhase * ROW_LIFTS[ri];
        fillMesh.position.y = baseY + lift;
        bgMesh.position.y = bgBaseY + lift;
      });
    });

    // Screen glow during ride
    if (td.screenMat) {
      const base = new THREE.Color(td.screenColor).multiplyScalar(0.25);
      if (isRiding) {
        const bright = new THREE.Color(td.screenColor);
        td.screenMat.emissive.copy(bright);
        td.screenMat.emissiveIntensity = 0.5 + liftPhase * 2.2 + Math.sin(time * 2.5) * 0.2 * liftPhase;
      } else {
        td.screenMat.emissive.copy(base);
        td.screenMat.emissiveIntensity = 0.5;
      }
    }

    // Theater light intensity
    if (td.light) {
      td.light.intensity = isRiding ? 1.2 + liftPhase * 1.8 : 1.0;
    }
  });
}

// ─── React component ─────────────────────────────

export default function Scene3D({ theaters = [], activeT = 0, running = false, paused = false }) {
  const containerRef = useRef(null);
  const worldRef = useRef(null);
  const activeRef = useRef(activeT);
  const theatersRef = useRef(theaters);

  useEffect(() => { activeRef.current = activeT; }, [activeT]);
  useEffect(() => { theatersRef.current = theaters; }, [theaters]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06060f);
    scene.fog = new THREE.FogExp2(0x06060f, 0.004);

    const w = el.clientWidth || 600;
    const h = el.clientHeight || 300;
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.5, 200);
    camera.position.set(0, 42, 38);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 12;
    controls.maxDistance = 100;
    controls.update();

    // Lights
    scene.add(new THREE.AmbientLight(0x5a5a8a, 1.8));
    scene.add(new THREE.HemisphereLight(0x4a5a9a, 0x252540, 1.4));
    const dir = new THREE.DirectionalLight(0x7799cc, 1.8);
    dir.position.set(-20, 40, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -50; dir.shadow.camera.right = 50;
    dir.shadow.camera.top = 50; dir.shadow.camera.bottom = -50;
    scene.add(dir);

    const mats = createMaterials();
    buildLayout(scene, mats);
    const theaterData = T_POS.map((_, ti) => buildTheater(scene, ti, mats));

    // Active-theater highlight ring
    const ringGeo = new THREE.TorusGeometry(9.5, 0.12, 4, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1,
      transparent: true, opacity: 0.55,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(T_POS[0].x, 0.08, T_POS[0].z);
    scene.add(ring);

    let autoFocus = true;
    let focusTimeout;
    controls.addEventListener('start', () => {
      autoFocus = false;
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => { autoFocus = true; }, 4000);
    });

    worldRef.current = { scene, camera, renderer, controls, theaterData, ring, ringMat, enableAutoFocus: () => { autoFocus = true; } };

    let animId;
    const startTime = performance.now();

    function animate() {
      animId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) / 1000;

      // Camera auto-focus
      const tgt = T_POS[activeRef.current];
      if (autoFocus && tgt) {
        const camX = tgt.x * 0.35;
        const camZ = tgt.z + 22;
        const camY = 32;
        camera.position.x += (camX - camera.position.x) * 0.025;
        camera.position.y += (camY - camera.position.y) * 0.025;
        camera.position.z += (camZ - camera.position.z) * 0.025;
        controls.target.x += (tgt.x - controls.target.x) * 0.025;
        controls.target.z += (tgt.z - controls.target.z) * 0.025;
      }

      // Highlight ring follows active theater
      ring.position.x += (tgt.x - ring.position.x) * 0.06;
      ring.position.z += (tgt.z - ring.position.z) * 0.06;
      ringMat.opacity = 0.2 + Math.sin(elapsed * 3) * 0.15;

      syncState(theaterData, theatersRef.current, activeRef.current, elapsed);

      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Resize observer
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
      ro.disconnect();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  // Re-enable auto-focus when active theater changes
  useEffect(() => {
    if (worldRef.current?.enableAutoFocus) {
      worldRef.current.enableAutoFocus();
    }
  }, [activeT]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#06060f',
      }}
    />
  );
}
