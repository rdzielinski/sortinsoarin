// ═══════════════════════════════════════
// AUDIO ENGINE — Web Audio SFX + mp3 ambient/ride manager
// ═══════════════════════════════════════
let _ctx = null;
export const getCtx = () => {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
};

export const playTone = (f, d, t = "sine", v = 0.1) => {
  try {
    const c = getCtx(), o = c.createOscillator(), g = c.createGain();
    o.type = t; o.frequency.value = f;
    g.gain.setValueAtTime(v, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + d);
  } catch {}
};

export const SFX = {
  select: () => playTone(880, .08, "sine", .07),
  place: () => playTone(660, .12, "triangle", .09),
  rowFull: () => { playTone(880, .15, "sine", .09); setTimeout(() => playTone(1100, .2, "sine", .09), 100) },
  error: () => playTone(220, .2, "sawtooth", .05),
  split: () => { playTone(600, .08, "triangle", .07); setTimeout(() => playTone(800, .08, "triangle", .07), 80) },
  depart: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, .3, "sine", .09), i * 150)) },
  achieve: () => { [784, 988, 1175, 1318].forEach((f, i) => setTimeout(() => playTone(f, .25, "triangle", .08), i * 120)) },
  merge: () => playTone(520, .1, "triangle", .06),
  route: () => { playTone(440, .08, "sine", .06); setTimeout(() => playTone(660, .1, "sine", .07), 70) },
  tabSwitch: () => playTone(1000, .05, "sine", .04),
  // Light single dispatch cue — used for the every-28s show-clock dispatch so
  // it doesn't fire the full departure fanfare each cycle.
  cue: () => { playTone(784, .1, "sine", .05); setTimeout(() => playTone(1175, .14, "sine", .045), 90) },
  hold: () => { playTone(330, .18, "sawtooth", .05); setTimeout(() => playTone(247, .22, "sawtooth", .05), 110) },
};

// ═══════════════════════════════════════
// AMBIENT / RIDE AUDIO MANAGER
// ═══════════════════════════════════════
class AudioManager {
  constructor() {
    this.ambient = null;
    this.ride = null;
    this.check = null;
    this.open = null;
    this.preshow = null;
    this.muted = false;
    this.ambientVol = 0.3;
    this.rideVol = 0.5;
    this.sfxVol = 0.4;
  }

  init() {
    if (this.ambient) return;
    this.ambient = new Audio("/ambient.mp3");
    this.ambient.loop = true;
    this.ambient.volume = this.ambientVol;

    this.ride = new Audio("/ride.mp3");
    this.ride.loop = false;
    this.ride.volume = this.rideVol;

    this.check = new Audio("/check.mp3");
    this.check.volume = this.sfxVol;

    this.open = new Audio("/open.mp3");
    this.open.volume = this.sfxVol;

    this.preshow = new Audio("/preshow.mp3");
    this.preshow.loop = true;
    this.preshow.volume = 0.15;
  }

  playAmbient() {
    this.init();
    if (this.muted) return;
    this.ambient.play().catch(() => {});
  }

  stopAmbient() {
    if (this.ambient) { this.ambient.pause(); this.ambient.currentTime = 0; }
  }

  fadeAmbient(targetVol, duration = 1000) {
    if (!this.ambient) return;
    const startVol = this.ambient.volume;
    const diff = targetVol - startVol;
    const steps = 20;
    const stepTime = duration / steps;
    let step = 0;
    const iv = setInterval(() => {
      step++;
      this.ambient.volume = Math.max(0, Math.min(1, startVol + (diff * step / steps)));
      if (step >= steps) clearInterval(iv);
    }, stepTime);
  }

  playCheck() {
    this.init();
    if (this.muted) return;
    this.check.currentTime = 0;
    this.check.play().catch(() => {});
  }

  playOpen() {
    this.init();
    if (this.muted) return;
    this.open.currentTime = 0;
    this.open.play().catch(() => {});
  }

  playRide() {
    this.init();
    if (this.muted) return;
    if (!this.ride.paused && this.ride.currentTime > 0) return;
    this.ride.currentTime = 0;
    this.fadeAmbient(0.08, 800);
    this.ride.play().catch(() => {});
  }

  stopRide() {
    if (this.ride) { this.ride.pause(); this.ride.currentTime = 0; }
    this.fadeAmbient(this.ambientVol, 800);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ambient) this.ambient.volume = this.muted ? 0 : this.ambientVol;
    if (this.ride) this.ride.volume = this.muted ? 0 : this.rideVol;
    if (this.check) this.check.volume = this.muted ? 0 : this.sfxVol;
    if (this.open) this.open.volume = this.muted ? 0 : this.sfxVol;
    if (this.preshow) this.preshow.volume = this.muted ? 0 : 0.15;
    return this.muted;
  }

  cleanup() {
    this.stopAmbient();
    this.stopRide();
    if (this.preshow) { this.preshow.pause(); this.preshow.currentTime = 0; }
  }
}

export const audioMgr = new AudioManager();
