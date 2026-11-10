// st0kz intro: a trader walks onto an exchange floor, steps up to a booth, the laptop logs in, and the camera dives into its screen.
// Everything is a function of time, so any frame can be rendered on its own: create(canvas).at(seconds).
import * as T from './three.module.min.js';

const PI = Math.PI, TAU = PI * 2, cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); }, eio = k => { k = cl(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }, eo = k => 1 - Math.pow(1 - cl(k), 3);
const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const h1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const vn = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(h1(i), h1(i + 1), u); };
const fb = x => vn(x) * .6 + vn(x * 2.13 + 7.1) * .28 + vn(x * 4.7 + 19.3) * .12;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const GREEN = '#4ade80', LIME = '#d9f99d', MINT = '#34d399', RED = '#fb7185', AMBER = '#fbbf24', DIM = '#1b4d38', INK = '#020a07';

export const DURATION = 15.5;
// the walk: from the lobby to the booth
const Z0 = 13.4, Z1 = -4.3, T0 = .45, T1 = 9.6, RAMP = .9, DIST = Z0 - Z1, VEL = DIST / (T1 - T0 - RAMP);
const walked = t => { const a = cl(t - T0, 0, T1 - T0), L = T1 - T0; if (a <= RAMP) return VEL * a * a / (2 * RAMP); if (a >= L - RAMP) { const b = L - a; return DIST - VEL * b * b / (2 * RAMP); } return VEL * (a - RAMP / 2); };
const pace = t => cl(Math.min((t - T0) / RAMP, (T1 - t) / RAMP));
const WAKE = 9.45; // the laptop wakes
export const LOGIN = { mark: .25, scan: 1.1, code: 2.3, unlock: 2.95, grid: 3.3, build: 4.45 }; // seconds after it wakes
// when things happen, for the sound
export const CUES = (() => { const steps = []; let next = .43, gate = null; for (let t = T0; t <= T1 + .01; t += 1 / 240) { const d = walked(t); if (d >= next) { steps.push(+t.toFixed(3)); next += .86; } if (gate == null && d >= 4.8) gate = +t.toFixed(3); }
  const bell = []; for (let t = 2.392; t < 7.4; t += .3831) bell.push([+t.toFixed(3), ss(2.2, 2.7, t) * (1 - ss(6.4, 7.6, t))]); return { steps, gate, bell, lid: [9.02, 9.46], wake: WAKE, login: LOGIN, dive: [13.6, 15.2], end: DURATION }; })();

export function create(canvas, opt = {}) {
  const low = !!opt.low, R = new T.WebGLRenderer({ canvas, antialias: !low, alpha: false, powerPreference: 'high-performance' });
  R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.25;
  const FOGC = new T.Color(0x04110c), FOGD = .0165, scene = new T.Scene(); scene.background = FOGC.clone(); scene.fog = new T.FogExp2(FOGC.getHex(), FOGD);
  const cam = new T.PerspectiveCamera(50, 1, .06, 130); cam.layers.enable(1);
  const tex = (c, rep) => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = low ? 2 : 8; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
  const std = (color, rough = .8, metal = 0, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra)), lam = (color, extra) => new T.MeshLambertMaterial(Object.assign({ color }, extra)), bas = (color, extra) => new T.MeshBasicMaterial(Object.assign({ color }, extra));
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, parent) => mesh(new T.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const dummy = new T.Object3D(); dummy.rotation.order = 'YXZ'; const tmpC = new T.Color();
  // list: [{p:[x,y,z], r:[pitch,yaw,roll], s:[x,y,z], c}]
  const inst = (geo, mat, list, parent = scene) => { const m = new T.InstancedMesh(geo, mat, list.length); list.forEach((it, i) => { dummy.position.set(it.p[0], it.p[1], it.p[2]); const r = it.r || [0, 0, 0]; dummy.rotation.set(r[0], r[1], r[2]); const s = it.s || [1, 1, 1]; dummy.scale.set(s[0], s[1], s[2]); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (it.c != null) m.setColorAt(i, tmpC.set(it.c)); }); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.frustumCulled = false; parent.add(m); return m; };

  // ------------------------------------------------------------ a small room of lights for the brass to reflect
  { const es = new T.Scene(); es.background = new T.Color(0x030d09); const e = (w, h, d, x, y, z, c, k) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(k) })); m.position.set(x, y, z); es.add(m); };
    e(14, .4, 30, 0, 9, 0, 0xfff0cc, 5); e(.4, 5, 26, -12, 3, 0, 0x7df0b8, 1.6); e(.4, 5, 26, 12, 3, 0, 0x7df0b8, 1.6); e(20, 6, .4, 0, 4, -14, 0xd9f99d, 1.2); e(20, 3, .4, 0, 2, 14, 0xffd9a0, 1.5);
    const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(es, .035).texture; scene.environmentIntensity = .55; pm.dispose(); }

  // ------------------------------------------------------------ materials
  const M = { stone: std(0x15362a, .9), stone2: std(0x0f271e, .92), cream: std(0xcabd98, .82), brass: std(0xd0a04a, .32, .95), dark: std(0x08120e, .5, .5), wood: std(0x33200f, .62, .05), wood2: std(0x1c120a, .7), top: std(0x0b1712, .35, .3), bezel: std(0x050a08, .6, .2), glassy: std(0x0a2a1f, .15, .2, { transparent: true, opacity: .55 }) };

  // ------------------------------------------------------------ painted textures
  const radial = (stops, s = 128) => { const c = cv(s, s), g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, s, s); return tex(c); };
  const glowTex = radial([[0, 'rgba(255,255,255,1)'], [.25, 'rgba(255,255,255,.5)'], [.6, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]), blobTex = radial([[0, 'rgba(0,0,0,.75)'], [.6, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']], 64);
  const glow = (x, y, z, size, color, op = .5, parent = scene) => { const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: op, fog: false })); s.position.set(x, y, z); s.scale.set(size, size, 1); parent.add(s); return s; };
  const tickerTex = (seed, w = 2048) => { const c = cv(w, 64), g = c.getContext('2d'), r = rng(seed); g.fillStyle = '#010604'; g.fillRect(0, 0, w, 64); let x = 12;
    while (x < w - 170) { const up = r() > .36; g.fillStyle = r() > .82 ? AMBER : LIME; const w1 = 22 + r() * 44; g.fillRect(x, 20, w1, 24); x += w1 + 10; g.fillStyle = up ? GREEN : RED; g.beginPath(); if (up) { g.moveTo(x, 44); g.lineTo(x + 12, 19); g.lineTo(x + 24, 44); } else { g.moveTo(x, 20); g.lineTo(x + 12, 45); g.lineTo(x + 24, 20); } g.fill(); x += 32; const w2 = 26 + r() * 38; g.fillRect(x, 20, w2, 24); x += w2 + 40; }
    g.fillStyle = 'rgba(0,0,0,.5)'; for (let i = 0; i < w; i += 4) g.fillRect(i, 0, 1.3, 64); for (let j = 0; j < 64; j += 4) g.fillRect(0, j, w, 1.3); const t = tex(c); t.wrapS = T.RepeatWrapping; return t; };
  const tickA = tickerTex(11), tickB = tickerTex(29), tickC = tickerTex(53, 1024);
  const cofferTex = (() => { const c = cv(256, 256), g = c.getContext('2d'); g.fillStyle = '#2a2414'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#b98f3e'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246); let gr = g.createRadialGradient(128, 128, 10, 128, 128, 150); gr.addColorStop(0, '#1d4a37'); gr.addColorStop(1, '#0b2219'); g.fillStyle = gr; g.fillRect(22, 22, 212, 212); g.strokeStyle = '#8a6a2c'; g.lineWidth = 4; g.strokeRect(34, 34, 188, 188); g.strokeRect(60, 60, 136, 136);
    gr = g.createRadialGradient(128, 128, 0, 128, 128, 44); gr.addColorStop(0, '#fff3cf'); gr.addColorStop(.35, '#e9b95a'); gr.addColorStop(1, 'rgba(120,80,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 44, 0, TAU); g.fill(); g.fillStyle = '#c99b46'; for (let i = 0; i < 8; i++) { const a = i * PI / 4; g.beginPath(); g.ellipse(128 + Math.cos(a) * 30, 128 + Math.sin(a) * 30, 10, 5, a, 0, TAU); g.fill(); } return tex(c, [9.5, 15.5]); })();
  const skyTex = (() => { const c = cv(128, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, '#bfe6d2'); gr.addColorStop(.5, '#f4fff4'); gr.addColorStop(1, '#bfe6d2'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256); g.fillStyle = '#12281f'; for (let i = 0; i <= 4; i++) g.fillRect(i * 32 - 2, 0, 4, 256); g.fillRect(0, 0, 128, 5); g.fillRect(0, 126, 128, 4); return tex(c, [1, 14]); })();
  const winTex = (() => { const c = cv(256, 512), g = c.getContext('2d'); g.fillStyle = '#0a1f17'; g.fillRect(0, 0, 256, 512); g.save(); g.beginPath(); g.moveTo(16, 512); g.lineTo(16, 128); g.arc(128, 128, 112, PI, 0); g.lineTo(240, 512); g.closePath(); g.clip(); const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#d9fbe9'); gr.addColorStop(.55, '#8fd9b6'); gr.addColorStop(1, '#2f7a5c'); g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
    g.fillStyle = '#0c2219'; for (let i = 1; i < 4; i++) g.fillRect(16 + i * 56 - 3, 0, 6, 512); for (let j = 0; j < 7; j++) g.fillRect(0, 128 + j * 60, 256, 6); g.restore(); g.strokeStyle = '#b98f3e'; g.lineWidth = 7; g.beginPath(); g.moveTo(16, 512); g.lineTo(16, 128); g.arc(128, 128, 112, PI, 0); g.lineTo(240, 512); g.stroke(); return tex(c); })();
  const shaftTex = (() => { const c = cv(64, 256), g = c.getContext('2d'), a = g.createLinearGradient(0, 0, 0, 256); a.addColorStop(0, 'rgba(255,255,255,.95)'); a.addColorStop(.5, 'rgba(255,255,255,.35)'); a.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = a; g.fillRect(0, 0, 64, 256); g.globalCompositeOperation = 'destination-in'; const b = g.createLinearGradient(0, 0, 64, 0); b.addColorStop(0, 'rgba(0,0,0,0)'); b.addColorStop(.5, 'rgba(0,0,0,1)'); b.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = b; g.fillRect(0, 0, 64, 256); return tex(c); })();
  const carpetTex = (() => { const c = cv(128, 128), g = c.getContext('2d'); g.fillStyle = '#0f3a2a'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#b98f3e'; g.fillRect(6, 0, 5, 128); g.fillRect(117, 0, 5, 128); g.fillStyle = 'rgba(217,249,157,.07)'; for (let y = 0; y < 128; y += 32) { g.beginPath(); g.moveTo(64, y + 4); g.lineTo(84, y + 16); g.lineTo(64, y + 28); g.lineTo(44, y + 16); g.fill(); } return tex(c, [1, 9]); })();

  // ------------------------------------------------------------ live screens: one atlas of 16 charts, redrawn as time moves
  const AS = low ? 512 : 1024, atlas = cv(AS, AS), ag = atlas.getContext('2d'), atlasTex = tex(atlas); atlasTex.generateMipmaps = false; atlasTex.minFilter = T.LinearFilter;
  const PAL = [GREEN, LIME, MINT, AMBER];
  const CELLS = [
    (g, S, t, i) => { const n = 36, c = PAL[i % 4], y = k => S * (.82 - .6 * fb(k * .11 + t * .32 + i * 13.7) - .1 * k / n); g.beginPath(); g.moveTo(S * .06, S * .92); for (let k = 0; k <= n; k++) g.lineTo(S * (.06 + .88 * k / n), y(k)); g.lineTo(S * .94, S * .92); g.closePath(); g.globalAlpha = .16; g.fillStyle = c; g.fill(); g.globalAlpha = 1; g.beginPath(); for (let k = 0; k <= n; k++) g[k ? 'lineTo' : 'moveTo'](S * (.06 + .88 * k / n), y(k)); g.strokeStyle = c; g.lineWidth = S * .022; g.lineJoin = 'round'; g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(S * .94, y(n), S * .03, 0, TAU); g.fill(); },
    (g, S, t, i) => { const n = 15, sh = t * .9 + i * 5, k0 = Math.floor(sh), fr = sh - k0, w = S * .88 / n; for (let k = -1; k < n; k++) { const q = k + k0, o = fb(q * .37 + i * 3.1), c2 = fb((q + 1) * .37 + i * 3.1), hi = Math.max(o, c2) + .06 * h1(q + i), lo = Math.min(o, c2) - .06 * h1(q * 3 + i), x = S * .06 + (k - fr + 1) * w, Y = v => S * (.9 - v * .78); g.fillStyle = c2 >= o ? GREEN : RED; g.fillRect(x + w * .44, Y(hi), w * .12, Y(lo) - Y(hi)); g.fillRect(x + w * .16, Y(Math.max(o, c2)), w * .68, Math.max(2, Math.abs(Y(o) - Y(c2)))); } },
    (g, S, t, i) => { const n = 12, w = S * .88 / n; for (let k = 0; k < n; k++) { const v = .15 + .8 * fb(k * 1.7 + t * .5 + i * 9); g.fillStyle = k % 3 === 0 ? LIME : MINT; g.globalAlpha = .55 + .45 * v; g.fillRect(S * .06 + k * w + w * .14, S * (.92 - v * .78), w * .72, S * v * .78); } g.globalAlpha = 1; },
    (g, S, t, i) => { const nx = 6, ny = 5, w = S * .88 / nx, h = S * .8 / ny; for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) { const v = fb(a * 3.3 + b * 7.7 + i * 2 + t * .22) - .46; g.fillStyle = v > 0 ? `rgba(74,222,128,${cl(.25 + v * 3)})` : `rgba(251,113,133,${cl(.25 - v * 3)})`; g.fillRect(S * .06 + a * w + 2, S * .12 + b * h + 2, w - 4, h - 4); } },
    (g, S, t, i) => { const n = 9, h = S * .8 / n; for (let k = 0; k < n; k++) { const a = .1 + .36 * fb(k * 2.3 + t * .6 + i), b = .1 + .36 * fb(k * 3.1 + t * .5 + i + 40); g.fillStyle = 'rgba(74,222,128,.85)'; g.fillRect(S * (.5 - a), S * .12 + k * h + 2, S * a - 2, h - 5); g.fillStyle = 'rgba(251,113,133,.85)'; g.fillRect(S * .5 + 2, S * .12 + k * h + 2, S * b - 2, h - 5); } },
    (g, S, t, i) => { const n = 30; [[GREEN, 0], [AMBER, 31], [LIME, 67]].forEach(([c, o], j) => { g.beginPath(); for (let k = 0; k <= n; k++) g[k ? 'lineTo' : 'moveTo'](S * (.06 + .88 * k / n), S * (.85 - .6 * fb(k * .14 + t * .28 + o + i * 3) - j * .04)); g.strokeStyle = c; g.lineWidth = S * .016; g.stroke(); }); },
    (g, S, t, i) => { const v = fb(t * .3 + i * 7), a0 = PI * .8, a1 = PI * 2.2; g.lineWidth = S * .075; g.lineCap = 'round'; g.strokeStyle = DIM; g.beginPath(); g.arc(S / 2, S * .56, S * .3, a0, a1); g.stroke(); g.strokeStyle = v > .5 ? GREEN : AMBER; g.beginPath(); g.arc(S / 2, S * .56, S * .3, a0, a0 + (a1 - a0) * v); g.stroke(); g.lineCap = 'butt'; g.fillStyle = LIME; g.beginPath(); g.arc(S / 2, S * .56, S * .06, 0, TAU); g.fill(); },
    (g, S, t, i) => { const n = 7, h = S * .8 / n, sh = (t * .7 + i) % 1; for (let k = -1; k < n; k++) { const q = Math.floor(t * .7 + i) + k, up = h1(q * 1.3 + i) > .4, y = S * .12 + (k + 1 - sh) * h; g.fillStyle = up ? GREEN : RED; g.beginPath(); const x = S * .1; if (up) { g.moveTo(x, y + h * .7); g.lineTo(x + h * .28, y + h * .2); g.lineTo(x + h * .56, y + h * .7); } else { g.moveTo(x, y + h * .2); g.lineTo(x + h * .28, y + h * .7); g.lineTo(x + h * .56, y + h * .2); } g.fill(); g.fillStyle = 'rgba(217,249,157,.8)'; g.fillRect(S * .26, y + h * .22, S * (.14 + .2 * h1(q)), h * .46); g.fillStyle = up ? 'rgba(74,222,128,.7)' : 'rgba(251,113,133,.7)'; g.fillRect(S * .7, y + h * .22, S * .2, h * .46); } }
  ];
  const drawAtlas = t => { const S = AS / 4; ag.fillStyle = INK; ag.fillRect(0, 0, AS, AS); for (let i = 0; i < 16; i++) { const x0 = (i % 4) * S, y0 = (i >> 2) * S; ag.save(); ag.beginPath(); ag.rect(x0, y0, S, S); ag.clip(); ag.translate(x0, y0); ag.fillStyle = 'rgba(52,211,153,.07)'; ag.fillRect(0, 0, S, S * .075); ag.fillStyle = i % 3 ? MINT : AMBER; ag.fillRect(S * .05, S * .022, S * (.12 + .1 * (i % 3)), S * .03); CELLS[i % CELLS.length](ag, S, t, i); ag.restore(); } atlasTex.needsUpdate = true; };

  // the big wall: one long rally, candle by candle
  const wall = cv(1024, 448), wg = wall.getContext('2d'), wallTex = tex(wall); wallTex.generateMipmaps = false; wallTex.minFilter = T.LinearFilter;
  const drawWall = t => { const g = wg, W = 1024, H = 448; g.fillStyle = '#01100a'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(52,211,153,.12)'; g.lineWidth = 1; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(0, i * H / 8); g.lineTo(W, i * H / 8); g.stroke(); } for (let i = 1; i < 16; i++) { g.beginPath(); g.moveTo(i * W / 16, 0); g.lineTo(i * W / 16, H); g.stroke(); }
    const n = 46, show = 18 + t * 2.4, w = (W - 120) / n, val = k => .1 + .62 * (k / n) + .2 * (fb(k * .31) - .5) + (k > 30 ? .05 : 0), Y = v => H * (.9 - v * .8); g.beginPath();
    for (let k = 0; k < Math.min(n, show); k++) { const live = k + 1 > show, o = val(k), c0 = val(k + 1), c2 = live ? lerp(o, c0, show - k) + .02 * Math.sin(t * 9) : c0, x = 40 + k * w; g.fillStyle = c2 >= o ? GREEN : RED; g.fillRect(x + w * .46, Y(Math.max(o, c2) + .03), w * .08, Y(Math.min(o, c2) - .03) - Y(Math.max(o, c2) + .03)); g.fillRect(x + w * .18, Y(Math.max(o, c2)), w * .64, Math.max(3, Math.abs(Y(o) - Y(c2)))); }
    g.beginPath(); for (let k = 0; k <= Math.min(n, show); k++) g[k ? 'lineTo' : 'moveTo'](40 + (k + .5) * w, Y(.07 + .62 * (k / n))); g.strokeStyle = LIME; g.lineWidth = 3; g.stroke();
    const hx = 40 + (Math.min(n, show) + .2) * w; g.fillStyle = `rgba(217,249,157,${.5 + .5 * Math.sin(t * 6)})`; g.beginPath(); g.arc(hx, Y(val(Math.min(n, show))), 8, 0, TAU); g.fill(); g.fillStyle = GREEN; g.beginPath(); g.moveTo(34, 78); g.lineTo(64, 28); g.lineTo(94, 78); g.fill(); g.fillStyle = 'rgba(217,249,157,.85)'; g.fillRect(110, 40, 150, 14); g.fillStyle = 'rgba(52,211,153,.6)'; g.fillRect(110, 62, 96, 10); for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(217,249,157,.5)'; g.fillRect(W - 34, 30 + i * H / 8, 22, 6); } wallTex.needsUpdate = true; };

  // the laptop. Asleep, it wakes, draws the st0kz mark, reads his fingerprint, takes a six-digit code,
  // unlocks into the 64 seats of the board, then builds the terminal you land in. No words anywhere.
  const LK = low ? 1 : 2, LW = 640 * LK, LH = 400 * LK, lap = cv(LW, LH), lg = lap.getContext('2d'), lapTex = tex(lap); lapTex.generateMipmaps = false; lapTex.minFilter = T.LinearFilter;
  const L = LOGIN, rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  const PRINT = (() => { const r = rng(808), out = []; for (let i = 0; i < 10; i++) { const rad = 6 + i * 4.6, a0 = PI * (.78 + i * .012), a1 = PI * (2.22 - i * .012), segs = []; let s = a0; const cuts = 1 + Math.floor(r() * 2); for (let k = 0; k < cuts; k++) { const c = lerp(s + .3, a1 - .3, r()); segs.push([s, c - .08]); s = c + .1; } segs.push([s, a1]); out.push([rad, segs]); } return out; })();
  const drawMark = (g, cx, cy, s, k) => { g.save(); g.translate(cx, cy); g.scale(s, s); const gr = g.createLinearGradient(-60, 0, 60, 0); gr.addColorStop(0, MINT); gr.addColorStop(1, LIME); g.strokeStyle = gr; g.lineWidth = 4.5; g.lineJoin = 'round'; g.lineCap = 'round';
    const seg = (fn, k0, k1) => { const q = cl((k - k0) / (k1 - k0)); if (q <= 0) return; g.setLineDash([q * 420, 420]); g.beginPath(); fn(); g.stroke(); };
    seg(() => g.roundRect(-48, -46, 96, 64, 11), 0, .45); seg(() => { g.moveTo(-56, 24); g.lineTo(56, 24); g.lineTo(70, 42); g.lineTo(-70, 42); g.closePath(); }, .25, .65); g.setLineDash([]);
    const f = ss(.45, .7, k); if (f > 0) { g.fillStyle = `rgba(52,211,153,${.14 * f})`; g.beginPath(); g.roundRect(-40, -38, 80, 48, 7); g.fill(); }
    seg(() => { [[-30, 0], [-17, -8], [-6, -3], [7, -19], [18, -13], [30, -27]].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); }, .55, 1); g.setLineDash([]);
    const d = ss(.9, 1, k); if (d > 0) { g.fillStyle = LIME; g.beginPath(); g.arc(30, -27, 5.5 * d, 0, TAU); g.fill(); } g.restore(); };
  const pane = (g, x, y, w, h, k) => { g.globalAlpha = k; g.fillStyle = 'rgba(7,26,18,.94)'; g.strokeStyle = 'rgba(120,220,170,.28)'; g.lineWidth = 1.2; rr(g, x, y + (1 - k) * 14, w, h, 8); g.fill(); g.stroke(); };
  const drawLap = t => { const g = lg, a = t - WAKE; g.setTransform(LK, 0, 0, LK, 0, 0); g.globalAlpha = 1; g.setLineDash([]); g.shadowBlur = 0; g.fillStyle = '#010503'; g.fillRect(0, 0, 640, 400);
    if (a < 0) { const gr = g.createLinearGradient(0, 0, 640, 400); gr.addColorStop(0, 'rgba(120,220,170,.05)'); gr.addColorStop(.5, 'rgba(120,220,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 640, 400); lapTex.needsUpdate = true; return 0; }
    const on = eo(a / .28); g.save(); g.beginPath(); g.rect(0, 200 - 200 * on, 640, 400 * on); g.clip();
    const bg = g.createRadialGradient(320, 200, 20, 320, 200, 420); bg.addColorStop(0, '#0b2a1e'); bg.addColorStop(1, '#03100a'); g.fillStyle = bg; g.fillRect(0, 0, 640, 400);
    const G = g.createLinearGradient(0, 0, 640, 0); G.addColorStop(0, MINT); G.addColorStop(1, LIME);
    const ui = ss(L.build - .05, L.build + .3, a), login = 1 - ss(L.unlock + .05, L.unlock + .45, a);
    if (ui < 1) { g.globalAlpha = .55 * (1 - ui); g.strokeStyle = 'rgba(52,211,153,.07)'; g.lineWidth = 1; for (let x = 0; x <= 640; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 400); g.stroke(); } for (let y = 0; y <= 400; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(640, y); g.stroke(); } g.globalAlpha = 1; }
    // the fingerprint: brackets close in, a light reads it down and back up
    const fpA = ss(L.scan - .15, L.scan + .12, a) * login, fx = 320, fy = 246;
    if (fpA > 0) { g.globalAlpha = fpA; const bk = eo((a - L.scan + .1) / .3), B = 70 + (1 - bk) * 18; g.strokeStyle = 'rgba(217,249,157,.75)'; g.lineWidth = 2.5; g.lineCap = 'round';
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { g.beginPath(); g.moveTo(fx + sx * B, fy + sy * (B - 18)); g.lineTo(fx + sx * B, fy + sy * B); g.lineTo(fx + sx * (B - 18), fy + sy * B); g.stroke(); });
      const sp = cl((a - L.scan - .05) / 1.05), sy = fy - 62 + 124 * (sp < .5 ? sp * 2 : 2 - sp * 2), print = () => PRINT.forEach(([r, segs]) => segs.forEach(([s0, s1]) => { g.beginPath(); g.ellipse(fx, fy + 7, r * .92, r * 1.15, 0, s0, s1); g.stroke(); }));
      g.lineWidth = 3; g.strokeStyle = 'rgba(120,220,170,.22)'; print();
      if (sp > 0) { g.save(); g.beginPath(); g.rect(fx - 80, fy - 80, 160, sp < .5 ? sy - (fy - 80) : 160); g.clip(); g.strokeStyle = LIME; g.shadowColor = 'rgba(217,249,157,.85)'; g.shadowBlur = 7 + 6 * ss(.5, 1, sp); print(); g.restore(); }
      if (sp > 0 && sp < 1) { const lgr = g.createLinearGradient(fx - 80, 0, fx + 80, 0); lgr.addColorStop(0, 'rgba(217,249,157,0)'); lgr.addColorStop(.5, 'rgba(217,249,157,.95)'); lgr.addColorStop(1, 'rgba(217,249,157,0)'); g.fillStyle = lgr; g.fillRect(fx - 80, sy - 1.5, 160, 3); g.fillStyle = 'rgba(217,249,157,.07)'; g.fillRect(fx - 80, sp < .5 ? sy - 38 : sy, 160, 38); }
      g.globalAlpha = 1; }
    // six digits, typed one by one
    const cdA = ss(L.code - .3, L.code - .05, a) * login;
    if (cdA > 0) { g.globalAlpha = cdA; const typed = a < L.code ? 0 : Math.min(6, Math.floor((a - L.code) / .1) + 1), fl = ss(L.unlock - .05, L.unlock + .08, a);
      for (let i = 0; i < 6; i++) { const x = 320 - 120 + i * 40 + 4, y = 340; g.fillStyle = fl > 0 ? `rgba(217,249,157,${.12 + .55 * fl})` : 'rgba(52,211,153,.08)'; g.strokeStyle = i < typed ? 'rgba(217,249,157,.85)' : 'rgba(120,220,170,.3)'; g.lineWidth = 1.5; rr(g, x, y, 32, 36, 8); g.fill(); g.stroke();
        if (i < typed) { const k = eo((a - L.code - i * .1) / .12); g.fillStyle = fl > .5 ? '#04130b' : LIME; g.beginPath(); g.arc(x + 16, y + 18, 5.2 * k * (1 + .35 * Math.sin(k * PI)), 0, TAU); g.fill(); } else if (i === typed && Math.sin(a * 17) > 0) { g.fillStyle = LIME; g.fillRect(x + 15, y + 10, 2, 16); } } g.globalAlpha = 1; }
    // the terminal builds itself around them: top bar, tape, board, feed, side pane, keys
    if (ui > 0) { const st = i => eo((a - L.build - i * .08) / .42);
      pane(g, 8, 7, 624, 26, st(0)); g.fillStyle = 'rgba(120,220,170,.12)'; rr(g, 84, 12, 372, 16, 5); g.fill(); g.fillStyle = 'rgba(232,246,236,.85)'; g.fillRect(46, 17, 28, 6); g.fillStyle = 'rgba(120,220,170,.5)'; g.fillRect(468, 17, 34, 5); g.fillRect(508, 17, 32, 5);
      g.strokeStyle = 'rgba(217,249,157,.6)'; rr(g, 552, 11, 74, 18, 6); g.stroke(); g.fillStyle = GREEN; g.beginPath(); g.arc(561, 20, 3, 0, TAU); g.fill(); g.fillStyle = 'rgba(232,246,236,.8)'; g.fillRect(568, 18, 50, 4);
      g.globalAlpha = st(1); g.save(); g.beginPath(); g.rect(8, 38, 624, 16); g.clip(); const sh = a * 26, q0 = Math.floor(sh / 96), off = sh - q0 * 96; for (let i = -1; i < 8; i++) { const q = q0 + i, x = 12 + i * 96 - off, up = h1(q * 3.3) > .35; g.fillStyle = `hsl(${(q * 53 % 360 + 360) % 360},60%,55%)`; g.beginPath(); g.arc(x + 6, 46, 5, 0, TAU); g.fill(); g.fillStyle = 'rgba(232,246,236,.8)'; g.fillRect(x + 15, 44, 24, 4); g.fillStyle = up ? GREEN : RED; g.fillRect(x + 44, 44, 20, 4); g.fillStyle = 'rgba(120,220,170,.18)'; g.fillRect(x + 88, 40, 1, 12); } g.restore();
      pane(g, 8, 60, 124, 309, st(2) * .9); g.globalAlpha = st(2); g.fillStyle = 'rgba(232,246,236,.75)'; g.fillRect(16, 68, 42, 4.5);
      pane(g, 138, 60, 330, 309, st(3)); g.fillStyle = 'rgba(232,246,236,.92)'; g.fillRect(150, 71, 74, 9); for (let i = 0; i < 4; i++) { g.fillStyle = i ? 'rgba(120,220,170,.14)' : LIME; rr(g, 336 + i * 32, 69, 28, 13, 4); g.fill(); }
      for (let i = 0; i < 9; i++) { const k = st(5 + i * .55), y = 96 + i * 29.5 + (1 - k) * 8, nw = a > L.build + 1.15 ? ss(L.build + 1.15, L.build + 1.35, a) : 0; g.globalAlpha = k; if (i === 0 && nw > 0) { g.fillStyle = `rgba(217,249,157,${.16 * (1 - ss(L.build + 1.4, L.build + 2.4, a))})`; g.fillRect(140, y - 3, 326, 28); }
        g.fillStyle = `hsl(${(i * 67 + 140) % 360},60%,56%)`; g.beginPath(); g.arc(158, y + 10, 9, 0, TAU); g.fill(); g.fillStyle = `hsl(${(i * 47 + 150) % 360},62%,56%)`; g.beginPath(); g.arc(165, y + 17, 4, 0, TAU); g.fill();
        g.fillStyle = 'rgba(232,246,236,.86)'; g.fillRect(176, y + 4, 52 + (i * 13) % 28, 6); g.fillStyle = 'rgba(120,220,170,.42)'; g.fillRect(176, y + 14, 66, 4); g.fillStyle = 'rgba(232,246,236,.8)'; g.fillRect(288, y + 4, 32, 6); g.fillStyle = h1(i * 2.7) > .25 ? GREEN : RED; g.fillRect(288, y + 14, 22, 4);
        g.fillStyle = 'rgba(120,220,170,.16)'; rr(g, 344, y + 8, 84, 5, 2.5); g.fill(); g.fillStyle = G; rr(g, 344, y + 8, 84 * (.08 + .85 * h1(i * 3.3)) * k, 5, 2.5); g.fill(); g.fillStyle = 'rgba(120,220,170,.5)'; g.fillRect(446, y + 8, 12, 5); }
      pane(g, 474, 60, 158, 309, st(4)); g.fillStyle = 'rgba(232,246,236,.7)'; g.fillRect(484, 68, 50, 4.5); g.fillStyle = 'rgba(232,246,236,.92)'; g.fillRect(486, 96, 88, 8); g.fillStyle = 'rgba(120,220,170,.42)'; g.fillRect(486, 111, 132, 4); g.fillRect(486, 119, 112, 4);
      g.fillStyle = G; rr(g, 486, 132, 134, 21, 6); g.fill(); for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(52,211,153,.22)'; g.beginPath(); g.arc(493, 180 + i * 24, 6, 0, TAU); g.fill(); g.fillStyle = 'rgba(232,246,236,.78)'; g.fillRect(505, 176 + i * 24, 40, 4); g.fillStyle = 'rgba(120,220,170,.4)'; g.fillRect(549, 176 + i * 24, 64, 4); g.fillRect(505, 184 + i * 24, 96, 4); }
      pane(g, 8, 374, 624, 20, st(5)); for (let i = 0; i < 6; i++) { g.fillStyle = i ? 'rgba(120,220,170,.32)' : LIME; rr(g, 16 + i * 58, 379, 10, 10, 2.5); g.fill(); g.fillStyle = 'rgba(232,246,236,.62)'; g.fillRect(30 + i * 58, 382, 28, 4); } g.fillStyle = GREEN; g.beginPath(); g.arc(520, 384, 2.6, 0, TAU); g.fill(); g.fillStyle = 'rgba(120,220,170,.4)'; g.fillRect(528, 382, 94, 4); g.globalAlpha = 1; }
    // the 64 seats flip in, the top three light up, then ten of them become the board on the left
    const gr0 = a - L.grid, toRail = eio((a - L.build - .05) / .55);
    if (gr0 > 0) { for (let i = 0; i < 64; i++) { const r = i >> 3, c = i & 7, k = eo((gr0 - (r + c) * .028) / .3); if (k <= 0) continue; const gx = 158 + c * 41, gy = 66 + r * 34, tw = 38, th = 31; let x = gx, y = gy, w = tw, h = th, al = 1;
        if (toRail > 0) { if (i < 10) { x = lerp(gx, 13, toRail); y = lerp(gy, 79 + i * 28.4, toRail); w = lerp(tw, 114, toRail); h = lerp(th, 25, toRail); } else al = 1 - cl(toRail * 1.7); } if (al <= 0) continue; g.globalAlpha = al;
        const v = 1 - i / 63 + .14 * (h1(i * 7.1) - .5), up = i < 44, rl = i < 10 ? toRail : 0; g.save(); g.translate(x + w / 2, y + h / 2); g.scale(1, k);
        g.fillStyle = up ? `rgba(74,222,128,${lerp(.1 + .32 * v, .05, rl)})` : `rgba(251,113,133,${.1 + .3 * (1 - v)})`; rr(g, -w / 2, -h / 2, w, h, 5); g.fill();
        const top = i < 3 ? ss(L.grid + .95, L.grid + 1.15, a) * (.65 + .35 * Math.sin(a * 9 + i)) * (1 - rl) : 0; g.strokeStyle = top > 0 ? `rgba(217,249,157,${top})` : 'rgba(120,220,170,.16)'; g.lineWidth = top > 0 ? 2 : 1; g.stroke();
        g.fillStyle = `hsl(${(i * 47 + 150) % 360},62%,56%)`; g.beginPath(); g.arc(lerp(0, -w / 2 + 14, rl), lerp(-5, 0, rl), 6.5, 0, TAU); g.fill();
        g.fillStyle = 'rgba(232,246,236,.82)'; g.fillRect(lerp(-8, -w / 2 + 26, rl), lerp(5, -5, rl), lerp(16, 24, rl), 3.5); g.fillStyle = 'rgba(120,220,170,.45)'; if (rl > .5) g.fillRect(-w / 2 + 26, 1, 16, 3);
        g.fillStyle = up ? GREEN : RED; g.fillRect(lerp(-6, w / 2 - 20, rl), lerp(10.5, -2, rl), lerp(12, 13, rl), 3);
        if (rl > .3) { g.globalAlpha = al * ss(.3, 1, rl); g.strokeStyle = GREEN; g.lineWidth = 1.3; g.beginPath(); for (let q = 0; q <= 8; q++) g[q ? 'lineTo' : 'moveTo'](8 + q * 3.2, 4 - q * .9 - 5 * fb(q * .6 + i * 4)); g.stroke(); }
        g.restore(); } g.globalAlpha = 1; }
    // the mark draws itself, then flies to the corner it lives in
    const mk = ss(L.mark, L.mark + .85, a); if (mk > 0) { const fly = eio((a - L.unlock - .05) / .7); drawMark(g, lerp(320, 27, fly), lerp(98, 21, fly), lerp(1.2, .17, fly), mk); }
    const ur = cl((a - L.unlock) / .65); if (ur > 0 && ur < 1) { g.globalAlpha = 1; g.strokeStyle = `rgba(217,249,157,${(1 - ur) * .9})`; g.lineWidth = 3 * (1 - ur) + .6; g.beginPath(); g.arc(fx, fy, 50 + ur * 330, 0, TAU); g.stroke(); g.fillStyle = `rgba(217,249,157,${(1 - ur) * .1})`; g.fillRect(0, 0, 640, 400); }
    const vg = g.createRadialGradient(320, 200, 170, 320, 200, 420); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = vg; g.fillRect(0, 0, 640, 400);
    g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < 400; y += 3) g.fillRect(0, y, 640, .8); g.restore(); lapTex.needsUpdate = true; return on * (.6 + .4 * ss(L.mark, L.mark + .5, a)); };

  // instanced screens: every monitor samples one cell of the atlas
  const screenMat = new T.ShaderMaterial({ uniforms: { atlas: { value: atlasTex }, time: { value: 0 }, fogC: { value: FOGC }, fogD: { value: FOGD } },
    vertexShader: `attribute vec3 cell; varying vec2 vUv; varying vec2 vL; varying float vSeed; varying float vD; void main(){ vL = uv; vUv = (uv * .94 + .03 + cell.xy) * .25; vSeed = cell.z; vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.); vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D atlas; uniform float time; uniform vec3 fogC; uniform float fogD; varying vec2 vUv; varying vec2 vL; varying float vSeed; varying float vD;
      void main(){ vec3 c = texture2D(atlas, vUv).rgb; float fl = .88 + .12 * sin(time * (2. + vSeed * 7.) + vSeed * 40.); vec2 e = smoothstep(vec2(0.), vec2(.05), vL) * smoothstep(vec2(0.), vec2(.05), 1. - vL); c = (c * 1.5 + vec3(.004, .02, .013)) * fl * (.6 + .4 * e.x * e.y); float f = 1. - exp(-fogD * fogD * vD * vD); c = mix(c, fogC, f * .8); gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }` });
  const frames = [], screens = [], cells = [];
  const monitor = (x, y, z, yaw, tilt, w, h) => { const nx = Math.sin(yaw) * Math.cos(tilt), ny = -Math.sin(tilt), nz = Math.cos(yaw) * Math.cos(tilt); frames.push({ p: [x, y, z], r: [tilt, yaw, 0], s: [w + .07, h + .07, .07] }); screens.push({ p: [x + nx * .04, y + ny * .04, z + nz * .04], r: [tilt, yaw, 0], s: [w, h, 1] }); const i = cells.length / 3; cells.push(Math.floor(h1(i * 3.7 + 1) * 4), Math.floor(h1(i * 9.1 + 5) * 4), h1(i * 1.3)); };

  // ------------------------------------------------------------ the hall
  const HW = 19, ZF = -50, ZE = 10, HC = 14;
  box(.6, HC, 62, M.stone, -HW - .3, HC / 2, -20); box(.6, HC, 62, M.stone, HW + .3, HC / 2, -20); box(HW * 2 + 1.2, HC, .6, M.stone2, 0, HC / 2, ZF - .3);
  box(HW - 1.7, HC, .6, M.stone, -(HW + 1.7) / 2, HC / 2, ZE + .3); box(HW - 1.7, HC, .6, M.stone, (HW + 1.7) / 2, HC / 2, ZE + .3); box(3.4, HC - 4.4, .6, M.stone, 0, 4.4 + (HC - 4.4) / 2, ZE + .3);
  box(.18, 4.5, .8, M.brass, -1.72, 2.25, ZE + .3); box(.18, 4.5, .8, M.brass, 1.72, 2.25, ZE + .3); box(3.62, .2, .8, M.brass, 0, 4.48, ZE + .3);
  // lobby
  box(.3, 4.9, 9.4, M.wood2, -2.8, 2.45, 14.9); box(.3, 4.9, 9.4, M.wood2, 2.8, 2.45, 14.9); box(5.9, .3, 9.4, M.wood2, 0, 4.85, 14.9); box(5.9, 4.9, .3, M.wood2, 0, 2.45, 19.6);
  for (const s of [-1, 1]) { box(.06, .1, 9.2, M.brass, s * 2.62, 1.1, 14.9); box(.06, .06, 9.2, M.brass, s * 2.62, 3.5, 14.9); for (const z of [11.6, 14.2]) { box(.04, .34, .2, M.brass, s * 2.63, 2.75, z); box(.05, .2, .12, bas(0xffd29a, { fog: false }), s * 2.6, 2.8, z); glow(s * 2.5, 2.8, z, 1.8, 0xffa850, .42); } }
  const lobbyL = new T.PointLight(0xffc98a, 3, 9, 2); lobbyL.position.set(0, 3.6, 14.4); scene.add(lobbyL);
  // doors
  const doors = [-1, 1].map(s => { const p = new T.Group(); p.position.set(s * 1.62, 0, ZE + .25); scene.add(p); box(1.56, 4.25, .09, M.wood, -s * .8, 2.13, 0, p); box(1.2, 1.5, .11, M.glassy, -s * .8, 2.9, 0, p); box(1.2, 1.1, .11, M.wood2, -s * .8, 1.0, 0, p); box(1.3, .06, .13, M.brass, -s * .8, 2.08, 0, p); box(.07, .9, .2, M.brass, -s * 1.42, 2.0, 0, p); return p; });
  const spill = mesh(new T.PlaneGeometry(1, 1), bas(0xbff5d8, { map: shaftTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }), 0, .03, 13.4); spill.rotation.x = -PI / 2; spill.layers.set(1);
  const doorL = new T.PointLight(0xc8ffe4, 0, 12, 2); doorL.position.set(0, 3.4, 7.4); scene.add(doorL);
  // wainscot, pilasters, windows, wall tickers
  const pil = [], capL = [], winL = [];
  for (const s of [-1, 1]) { box(.25, 2.3, 60, M.wood, s * (HW - .12), 1.15, -20); box(.32, .1, 60, M.brass, s * (HW - .14), 2.34, -20);
    for (let k = 0; k < 8; k++) { const z = 10 - k * 8 - (k === 0 ? .6 : 0); pil.push({ p: [s * (HW - .28), HC / 2, z], s: [.56, HC, 1.1] }); capL.push({ p: [s * (HW - .3), HC - 1.1, z], s: [.7, .5, 1.3] }); capL.push({ p: [s * (HW - .3), 2.6, z], s: [.66, .22, 1.24] }); }
    for (let k = 0; k < 7; k++) winL.push({ p: [s * (HW - .03), 8.5, 6 - k * 8], r: [0, -s * PI / 2, 0], s: [4.4, 7.8, 1] });
    const band = mesh(new T.PlaneGeometry(59, .62), bas(0xffffff, { map: s < 0 ? tickA : tickB }), s * (HW - .27), 3.5, -20); band.rotation.y = -s * PI / 2; band.userData.tick = s; box(.1, .8, 59.2, M.dark, s * (HW - .2), 3.5, -20); }
  inst(new T.BoxGeometry(1, 1, 1), M.cream, pil); inst(new T.BoxGeometry(1, 1, 1), M.brass, capL); inst(new T.PlaneGeometry(1, 1), bas(0xffffff, { map: winTex, fog: true }), winL);
  // columns
  { const col = [], base = [], cap = []; for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const x = s * 11, z = 7 - k * 8; col.push({ p: [x, 6.95, z] }); base.push({ p: [x, .32, z], s: [1.7, .64, 1.7] }); base.push({ p: [x, .8, z], s: [1.42, .32, 1.42] }); cap.push({ p: [x, 13.25, z], s: [1.75, .5, 1.75] }); cap.push({ p: [x, 12.8, z], s: [1.45, .4, 1.45] }); glow(x, 1.6, z, 3.2, 0xffc46a, .16); }
    inst(new T.CylinderGeometry(.56, .64, 12.7, 20), M.cream, col); inst(new T.BoxGeometry(1, 1, 1), M.cream, base); inst(new T.BoxGeometry(1, 1, 1), M.brass, cap); }
  // ceiling, skylight, beams, shafts, pendants
  { const c = mesh(new T.PlaneGeometry(38, 62), std(0xffffff, .9, 0, { map: cofferTex, emissive: 0xffffff, emissiveMap: cofferTex, emissiveIntensity: .5 }), 0, HC, -20); c.rotation.x = PI / 2;
    const sk = mesh(new T.PlaneGeometry(6.6, 56), bas(0xffffff, { map: skyTex, fog: false }), 0, HC - .06, -20); sk.rotation.x = PI / 2; const beams = [];
    for (let k = 0; k < 8; k++) beams.push({ p: [0, HC - .3, 10 - k * 8 - (k === 0 ? .7 : 0)], s: [38, .6, .7] }); for (const s of [-1, 1]) beams.push({ p: [s * 3.5, HC - .25, -20], s: [.5, .5, 60] }); inst(new T.BoxGeometry(1, 1, 1), M.cream, beams); }
  const shafts = []; for (let k = 0; k < 9; k++) { const m = mesh(new T.PlaneGeometry(4.6 + (k % 3) * .8, 13.6), bas(0xd6ffe9, { map: shaftTex, transparent: true, opacity: .1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }), (k % 2 ? .9 : -.9), 7.1, 5 - k * 6.2); m.rotation.z = (k % 2 ? -1 : 1) * .1; m.rotation.y = (k % 3 - 1) * .5; m.layers.set(1); shafts.push(m); }
  { const rods = [], globes = []; for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const x = s * 3.5, z = 6 - k * 8; rods.push({ p: [x, 11.4, z], s: [.05, 5.2, .05] }); globes.push({ p: [x, 8.6, z] }); glow(x, 8.6, z, 4.2, 0xffd08a, .42); rods.push({ p: [x, 8.86, z], s: [.5, .08, .5] }); }
    inst(new T.BoxGeometry(1, 1, 1), M.brass, rods); inst(new T.SphereGeometry(.27, 14, 10), bas(0xffe9c2, { fog: false }), globes); }
  // banners between the columns
  const banners = []; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const p = new T.Group(); p.position.set(s * 11, 11.6, 3 - k * 16); scene.add(p); box(2.5, .08, .08, M.brass, 0, 0, 0, p); const b = box(2.2, 4.6, .03, std(0x0f3a2a, .9, 0, { map: carpetTex }), 0, -2.36, 0, p); b.material.map = carpetTex.clone(); b.material.map.repeat.set(1, 2); b.material.map.needsUpdate = true; banners.push(p); }

  // ------------------------------------------------------------ trading posts
  const POSTS = []; for (const s of [-1, 1]) { for (const z of [5, -3, -11, -19, -27, -35]) POSTS.push([s * 7.5, z]); for (const z of [1, -7, -15, -23, -31]) POSTS.push([s * 14.6, z]); }
  { const cnt = [], tops = [], rails = [], pill = [], trA = [], trB = [], led = [], cables = [], keys = [], spokes = [], stands = [];
    POSTS.forEach(([px, pz], pi) => { cnt.push({ p: [px, .53, pz], r: [0, PI / 8, 0] }); tops.push({ p: [px, 1.07, pz], r: [-PI / 2, 0, PI / 8] }); rails.push({ p: [px, .1, pz], r: [PI / 2, 0, 0] }); pill.push({ p: [px, 2.85, pz] }); trA.push({ p: [px, 3.22, pz], r: [PI / 2, 0, 0] }); trB.push({ p: [px, 4.3, pz], r: [PI / 2, 0, 0], s: [.76, .76, 1] }); led.push({ p: [px, 4.86, pz], r: [0, pi * .7, 0] }); cables.push({ p: [px, 9.85, pz], s: [.07, 8.3, .07] });
      for (let k = 0; k < 12; k++) { const a = k * TAU / 12 + pi; monitor(px + Math.sin(a) * 2.06, 2.74, pz + Math.cos(a) * 2.06, a, .3, .98, .62); }
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + PI / 8 + pi; monitor(px + Math.sin(a) * 1.58, 3.88, pz + Math.cos(a) * 1.58, a, .2, 1.14, .72); spokes.push({ p: [px + Math.sin(a) * 1.03, 3.22, pz + Math.cos(a) * 1.03], r: [0, a, 0], s: [.05, .05, 2.06] }); spokes.push({ p: [px + Math.sin(a) * .78, 4.3, pz + Math.cos(a) * .78], r: [0, a, 0], s: [.05, .05, 1.56] });
        monitor(px + Math.sin(a) * 1.98, 1.44, pz + Math.cos(a) * 1.98, a, -.14, .64, .4); stands.push({ p: [px + Math.sin(a) * 1.94, 1.16, pz + Math.cos(a) * 1.94], s: [.08, .2, .08] }); keys.push({ p: [px + Math.sin(a) * 2.2, 1.095, pz + Math.cos(a) * 2.2], r: [0, a, 0], s: [.44, .03, .16] }); }
      glow(px, 3.2, pz, 8.5, 0x4ade80, .2); glow(px, 5.3, pz, 3, 0xd9f99d, .25); });
    inst(new T.CylinderGeometry(2.34, 2.34, 1.06, 8, 1, true), std(0x2a1a0c, .6, .05, { side: T.DoubleSide }), cnt); inst(new T.RingGeometry(1.72, 2.4, 8), M.top, tops); inst(new T.TorusGeometry(2.36, .05, 6, 8), M.brass, rails); inst(new T.CylinderGeometry(.26, .32, 5.7, 10), M.dark, pill);
    inst(new T.TorusGeometry(2.06, .045, 6, 28), M.dark, trA); inst(new T.TorusGeometry(2.06, .045, 6, 28), M.dark, trB); inst(new T.BoxGeometry(1, 1, 1), M.dark, spokes.concat(cables, stands)); inst(new T.BoxGeometry(1, 1, 1), std(0x1a2620, .5), keys);
    const lm = bas(0xffffff, { map: tickC }); lm.map.repeat.set(1.5, 1); const lr = inst(new T.CylinderGeometry(1.78, 1.78, .44, 28, 1, true), lm, led); lr.userData.tick = 1; inst(new T.CylinderGeometry(1.8, 1.8, .52, 28, 1, true), std(0x050a08, .5, .3, { side: T.BackSide }), led); }

  // ------------------------------------------------------------ far end: balcony, the bell, the wall, the clock
  box(22, .5, 4.6, M.wood, 0, 4.45, -47.6); box(22, .16, .2, M.brass, 0, 4.2, -45.3); box(22, .14, .22, M.brass, 0, 5.66, -45.35);
  { const bal = []; for (let x = -10.8; x <= 10.81; x += .45) bal.push({ p: [x, 5.15, -45.35], s: [.1, .94, .1] }); inst(new T.BoxGeometry(1, 1, 1), M.brass, bal); const sup = []; for (const x of [-9, -3, 3, 9]) sup.push({ p: [x, 2.1, -46.2], s: [.5, 4.2, .5] }); inst(new T.BoxGeometry(1, 1, 1), M.cream, sup); }
  mesh(new T.PlaneGeometry(17, 7.4), bas(0xffffff, { map: wallTex }), 0, 9.9, ZF + .12); box(17.6, 8, .2, M.bezel, 0, 9.9, ZF + .02); box(17.9, .16, .3, M.brass, 0, 13.98, ZF + .1); box(17.9, .16, .3, M.brass, 0, 5.82, ZF + .1); glow(0, 9.9, ZF + 1.2, 26, 0x34d399, .22);
  for (const s of [-1, 1]) for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) monitor(s * (11.2 + a * 3.3), 7.2 + b * 2.3, ZF + .2, 0, 0, 3, 2);
  { const band = mesh(new T.PlaneGeometry(36, .7), bas(0xffffff, { map: tickA }), 0, 3.55, ZF + .16); band.userData.tick = -1; }
  const bell = new T.Group(); bell.position.set(0, 6.9, -45.9); scene.add(bell); { const pts = [[0, .0], [.07, .0], [.1, -.06], [.16, -.28], [.2, -.42], [.3, -.52], [.33, -.56], [.3, -.57]].map(p => new T.Vector2(p[0], p[1])); mesh(new T.LatheGeometry(pts, 20), std(0xe0b050, .25, 1, { side: T.DoubleSide }), 0, 0, 0, bell); mesh(new T.SphereGeometry(.06, 8, 6), M.brass, 0, -.56, 0, bell); }
  box(.08, 1.3, .08, M.brass, -.5, 6.3, -45.9); box(.08, 1.3, .08, M.brass, .5, 6.3, -45.9); box(1.1, .08, .08, M.brass, 0, 6.94, -45.9);
  const rings = [0, 1, 2].map(() => { const m = mesh(new T.RingGeometry(.92, 1, 40), bas(0xffe2a0, { transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }), 0, 6.5, -45.6); m.layers.set(1); return m; });
  const clock = new T.Group(); clock.position.set(-12.6, 5.9, -45.2); scene.add(clock); clock.visible = false;
  // a round clock high on each side wall near the door: a face, twelve marks, two hands
  const hands = []; for (const s of [-1, 1]) { const c = new T.Group(); c.position.set(s * (HW - .3), 11.2, 2); c.rotation.y = -s * PI / 2; scene.add(c); mesh(new T.CylinderGeometry(1.25, 1.25, .12, 32), M.brass, 0, 0, 0, c).rotation.x = PI / 2; mesh(new T.CircleGeometry(1.1, 32), bas(0xf3ecd6), 0, 0, .07, c); for (let i = 0; i < 12; i++) { const m = box(.06, i % 3 ? .14 : .26, .02, bas(0x1a2a20), Math.sin(i * PI / 6) * .92, Math.cos(i * PI / 6) * .92, .08, c); m.rotation.z = -i * PI / 6; }
    const hh = new T.Group(), mh = new T.Group(); c.add(hh, mh); box(.08, .6, .02, bas(0x12201a), 0, .26, .09, hh); box(.05, .92, .02, bas(0x12201a), 0, .42, .1, mh); hands.push([hh, mh]); }

  // ------------------------------------------------------------ the entrance: runner, gates, ropes
  { const r = mesh(new T.PlaneGeometry(2.3, 21), std(0xffffff, .95, 0, { map: carpetTex }), 0, .012, 5.6); r.rotation.x = -PI / 2; }
  const gateLed = []; for (const s of [-1, 1]) { box(.34, 1.2, 1.0, M.dark, s * 1.42, .6, 7.2); box(.36, .05, 1.02, M.brass, s * 1.42, 1.22, 7.2); gateLed.push(box(.06, .9, .7, bas(0xfbbf24, { fog: false }), s * 1.24, .62, 7.2)); }
  const flaps = [-1, 1].map(s => { const p = new T.Group(); p.position.set(s * 1.24, .65, 7.2); scene.add(p); box(1.1, .7, .03, M.glassy, -s * .56, 0, 0, p); return p; });
  const gateGlow = glow(0, .9, 7.2, 4.5, 0xfbbf24, .25);
  { const posts = [], ropes = []; for (const s of [-1, 1]) for (let k = 0; k < 6; k++) { const z = 5.6 - k * 1.9; posts.push({ p: [s * 2.25, .5, z], s: [.07, 1, .07] }); posts.push({ p: [s * 2.25, 1.02, z], s: [.13, .08, .13] }); posts.push({ p: [s * 2.25, .03, z], s: [.3, .06, .3] }); if (k < 5) ropes.push({ p: [s * 2.25, .86, z - .95], s: [.035, .035, 1.9] }); } inst(new T.BoxGeometry(1, 1, 1), M.brass, posts); inst(new T.BoxGeometry(1, 1, 1), std(0x7a1f2c, .8), ropes); }

  // ------------------------------------------------------------ the booth, and the laptop on it
  const BX = .12, BZ = -5.25, booth = new T.Group(); booth.position.set(BX, 0, BZ); scene.add(booth);
  box(1.7, .07, .9, M.wood, 0, 1.03, 0, booth); box(1.76, .03, .96, M.brass, 0, .985, 0, booth); box(1.5, .98, .6, M.wood2, 0, .49, -.05, booth); box(1.3, .7, .02, M.wood, 0, .5, .26, booth); box(1.34, .03, .03, M.brass, 0, .86, .27, booth); box(1.34, .03, .03, M.brass, 0, .14, .27, booth); box(1.8, .08, 1, M.dark, 0, .04, 0, booth);
  { const lampP = new T.Group(); lampP.position.set(-.62, 1.065, -.2); booth.add(lampP); mesh(new T.CylinderGeometry(.09, .1, .025, 16), M.brass, 0, .012, 0, lampP); mesh(new T.CylinderGeometry(.014, .014, .34, 8), M.brass, 0, .18, 0, lampP); const sh = mesh(new T.CylinderGeometry(.075, .075, .34, 14, 1, false, 0, PI), bas(0x2fd08c, { fog: false, side: T.DoubleSide }), .0, .36, .04, lampP); sh.rotation.z = PI / 2; sh.rotation.y = PI / 2; glow(0, .3, .08, .9, 0x5cf0b0, .5, lampP);
    mesh(new T.CylinderGeometry(.045, .038, .1, 14), std(0xf1f5ee, .5), .66, 1.115, .12, booth); mesh(new T.CylinderGeometry(.04, .04, .005, 14), bas(0x2a160a), .66, 1.163, .12, booth); }
  const coneTex = (() => { const c = cv(8, 128), g = c.getContext('2d'), a = g.createLinearGradient(0, 0, 0, 128); a.addColorStop(0, 'rgba(255,255,255,.9)'); a.addColorStop(.6, 'rgba(255,255,255,.3)'); a.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = a; g.fillRect(0, 0, 8, 128); return tex(c); })();
  const cone = mesh(new T.CylinderGeometry(.25, 1.7, 8.2, 24, 1, true), bas(0xeafff3, { map: coneTex, transparent: true, opacity: .13, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }), BX, 5.1, BZ); cone.layers.set(1);
  const spot = new T.SpotLight(0xfff3d6, 70, 16, .36, .8, 1.5); spot.position.set(BX, 9.2, BZ + 1.2); spot.target.position.set(BX, 1, BZ + .1); scene.add(spot, spot.target);
  const LAP = new T.Group(); LAP.position.set(0, 1.066, .02); LAP.scale.setScalar(1.5); booth.add(LAP); const shell = std(0xbfd3bd, .6), keyM = std(0x8fae93, .7);
  box(.62, .05, .44, shell, 0, .025, 0, LAP); box(.52, .006, .2, keyM, 0, .052, -.04, LAP); { const ks = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) ks.push({ p: [-.231 + c * .042, .058, -.115 + r * .048], s: [.034, .008, .038] }); inst(new T.BoxGeometry(1, 1, 1), std(0xb9cfb8, .6), ks, LAP); }
  box(.14, .006, .07, std(0xb4cbb3, .6), 0, .052, .15, LAP); mesh(new T.SphereGeometry(.016, 10, 8), bas(0x34d399, { fog: false }), 0, .058, .15, LAP);
  const lid = new T.Group(); lid.position.set(0, .05, -.215); LAP.add(lid); box(.62, .43, .04, shell, 0, .215, 0, lid); box(.56, .35, .01, std(0x17352a, .5), 0, .235, .021, lid);
  const lapScr = mesh(new T.PlaneGeometry(.51, .32), bas(0xffffff, { map: lapTex, fog: false }), 0, .24, .028, lid); mesh(new T.CircleGeometry(.007, 10), bas(0x34d399, { fog: false }), -.255, .035, .022, lid); const led2 = mesh(new T.CircleGeometry(.007, 10), bas(0x1b4d38, { fog: false }), -.232, .035, .022, lid);
  const lapL = new T.PointLight(0x8dfcc8, 0, 5, 2); lapL.position.set(0, .26, .3); lid.add(lapL); const lapGlow = glow(0, .24, .1, 1.6, 0x6ff7b6, 0, lid);
  const LIDOPEN = -.27, LIDSHUT = 1.02;

  // ------------------------------------------------------------ flush the monitors
  { const fg = new T.BoxGeometry(1, 1, 1); inst(fg, M.bezel, frames); const sg = new T.PlaneGeometry(1, 1); sg.setAttribute('cell', new T.InstancedBufferAttribute(new Float32Array(cells), 3)); inst(sg, screenMat, screens); }

  // ------------------------------------------------------------ people. One posed skeleton, copied into instanced parts.
  const NX = low ? 30 : 58, JACK = [0x1f3f7a, 0x2c5fc0, 0x1f7a4d, 0xa88752, 0x7a2a35, 0x39424e, 0x154a8f, 0x0f5a3e], SKIN = [0xe6b88f, 0xc68a5e, 0x8d5a3b, 0xf0c8a4, 0x6f432b], HAIR = [0x1a120c, 0x3a2414, 0x0a0a0a, 0x6b4a2a, 0x8a8a86];
  const rig = (() => { const root = new T.Object3D(), hip = new T.Object3D(), torso = new T.Object3D(), head = new T.Object3D(), hair = new T.Object3D(), aL = new T.Object3D(), aR = new T.Object3D(), aLm = new T.Object3D(), aRm = new T.Object3D(), lL = new T.Object3D(), lR = new T.Object3D(), lLm = new T.Object3D(), lRm = new T.Object3D();
    root.add(hip); hip.add(torso, lL, lR); torso.add(head, aL, aR); head.add(hair); aL.add(aLm); aR.add(aRm); lL.add(lLm); lR.add(lRm); torso.position.y = .32; head.position.y = .44; hair.position.set(0, .03, -.02); hair.rotation.x = -.45; aL.position.set(.25, .23, 0); aR.position.set(-.25, .23, 0); aLm.position.y = aRm.position.y = -.27; lL.position.x = .095; lR.position.x = -.095; lLm.position.y = lRm.position.y = -.44;
    return { root, hip, torso, head, hair, aL, aR, aLm, aRm, lL, lR, lLm, lRm }; })();
  const part = (geo, mat) => { const m = new T.InstancedMesh(geo, mat, NX); m.frustumCulled = false; scene.add(m); return m; };
  const P = { torso: part(new T.BoxGeometry(.42, .58, .23), lam(0xffffff)), head: part(new T.SphereGeometry(.122, 10, 8), lam(0xffffff)), hair: part(new T.SphereGeometry(.128, 10, 6, 0, TAU, 0, PI * .5), lam(0xffffff)), aL: part(new T.BoxGeometry(.11, .58, .12), lam(0xffffff)), aR: part(new T.BoxGeometry(.11, .58, .12), lam(0xffffff)), lL: part(new T.BoxGeometry(.16, .9, .17), lam(0xffffff)), lR: part(new T.BoxGeometry(.16, .9, .17), lam(0xffffff)) };
  const blobs = new T.InstancedMesh(new T.PlaneGeometry(1.1, 1.1).rotateX(-PI / 2), bas(0x000000, { map: blobTex, transparent: true, depthWrite: false, opacity: .8 }), NX + 1); blobs.frustumCulled = false; blobs.layers.set(1); scene.add(blobs);
  const EX = (() => { const r = rng(4242), out = [];
    POSTS.forEach(([px, pz], pi) => { const n = px > 0 && Math.abs(px) < 8 ? 3 : 2; for (let k = 0; k < n && out.length < NX - 12; k++) { let a = r() * TAU; const x = px + Math.sin(a) * 3.05, z = pz + Math.cos(a) * 3.05; if (Math.abs(x) < 3.6 || Math.abs(x) > 17.6) { a += PI; } out.push({ mode: 'stand', x: px + Math.sin(a) * 3.05, z: pz + Math.cos(a) * 3.05, h: a + PI, s: r() }); } });
    const walkers = [[[-6, -9.5], [6, -9.5], 1.25], [[5.5, -14], [-5.5, -14], 1.4], [[2.7, -8], [2.7, -30], 1.3], [[-2.7, -32], [-2.7, -10], 1.35], [[10, 3.2], [16, -1], 1.2], [[-16.5, -3], [-9.5, 1.2], 1.3], [[-4.2, -22], [4.2, -18], 1.2], [[9.5, -8], [9.5, -30], 1.4]];
    walkers.forEach(([a, b, v]) => out.length < NX - 4 && out.push({ mode: 'walk', a, b, v, s: r() }));
    for (const x of [-2.2, -.9, .9, 2.3]) out.push({ mode: 'stand', x, z: -46.6 + r() * .3, h: 0, s: r(), y: 4.7, bell: x === .9 });
    while (out.length < NX) { const a = r() * TAU, [px, pz] = POSTS[Math.floor(r() * POSTS.length)], x = px + Math.sin(a) * 3.3, z = pz + Math.cos(a) * 3.3; if (Math.abs(x) < 3.7 || Math.abs(x) > 17.5) continue; out.push({ mode: 'stand', x, z, h: a + PI, s: r() }); }
    return out.slice(0, NX); })();
  EX.forEach((e, i) => { const j = JACK[Math.floor(e.s * 97) % JACK.length]; P.torso.setColorAt(i, tmpC.set(j)); P.aL.setColorAt(i, tmpC.set(j)); P.aR.setColorAt(i, tmpC.set(j)); const tr = [0x10161a, 0x1b1f24, 0x2a2622][Math.floor(e.s * 31) % 3]; P.lL.setColorAt(i, tmpC.set(tr)); P.lR.setColorAt(i, tmpC.set(tr)); P.head.setColorAt(i, tmpC.set(SKIN[Math.floor(e.s * 53) % SKIN.length])); P.hair.setColorAt(i, tmpC.set(HAIR[Math.floor(e.s * 71) % HAIR.length])); });
  Object.values(P).forEach(m => { m.instanceColor.needsUpdate = true; });
  const poseExtras = t => { EX.forEach((e, i) => { const g = rig, s = e.s; let x = e.x, z = e.z, h = e.h, w = 0, ph = 0, y = e.y || 0;
      if (e.mode === 'walk') { const dx = e.b[0] - e.a[0], dz = e.b[1] - e.a[1], L = Math.hypot(dx, dz), d = (t * e.v + s * L * 2) % (L * 2), k = d < L ? d / L : 2 - d / L; x = e.a[0] + dx * k; z = e.a[1] + dz * k; h = Math.atan2(dx, dz) + (d < L ? 0 : PI); w = 1; ph = (t * e.v + s * 9) / 1.45 * TAU; }
      g.root.position.set(x, y, z); g.root.rotation.y = h + (w ? 0 : .25 * Math.sin(t * .4 + s * 30)); g.root.scale.setScalar(.94 + s * .14); g.hip.position.y = .9 + (w ? .02 * Math.cos(ph * 2) : .008 * Math.sin(t * 1.3 + s * 20)); g.torso.rotation.set(w ? .06 : .03 * Math.sin(t * .7 + s * 11), w ? .08 * Math.sin(ph) : 0, 0); g.head.rotation.set(-.12 * (w ? 0 : 1) + .05 * Math.sin(t * .9 + s * 5), .5 * Math.sin(t * .5 + s * 40) * (w ? .3 : 1), 0);
      g.lL.rotation.x = -.5 * Math.sin(ph) * w; g.lR.rotation.x = .5 * Math.sin(ph) * w; const gest = w ? 0 : ss(.55, .8, vn(t * .45 + s * 60)), ring = e.bell ? ss(2.2, 2.7, t) * (1 - ss(6.2, 7, t)) : 0;
      g.aL.rotation.set(w ? .45 * Math.sin(ph) : -.5 - .3 * Math.sin(t * 1.1 + s * 9), 0, w ? 0 : .12); g.aR.rotation.set(w ? -.45 * Math.sin(ph) : lerp(-.15, -2.3 - .3 * Math.sin(t * 5 + s * 7), Math.max(gest * (s > .45 ? 1 : 0), ring)), 0, -.1);
      g.root.updateMatrixWorld(true); P.torso.setMatrixAt(i, g.torso.matrixWorld); P.head.setMatrixAt(i, g.head.matrixWorld); P.hair.setMatrixAt(i, g.hair.matrixWorld); P.aL.setMatrixAt(i, g.aLm.matrixWorld); P.aR.setMatrixAt(i, g.aRm.matrixWorld); P.lL.setMatrixAt(i, g.lLm.matrixWorld); P.lR.setMatrixAt(i, g.lRm.matrixWorld);
      dummy.position.set(x, y + .014, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); blobs.setMatrixAt(i, dummy.matrix); });
    Object.values(P).forEach(m => { m.instanceMatrix.needsUpdate = true; }); };

  // ------------------------------------------------------------ the one we follow
  const HERO = (() => { const g = new T.Group(), jacket = std(0x2fca8f, .75), trim = std(0xd9f99d, .7), pants = std(0x121c18, .85), skin = lam(0xe2b48c), hairM = lam(0x1d140d), shoe = std(0xeef3ee, .6), cap = (r, l) => new T.CapsuleGeometry(r, l, 4, 10);
    const hip = new T.Group(); hip.position.y = .93; g.add(hip); const torso = new T.Group(); hip.add(torso);
    const chest = mesh(new T.CylinderGeometry(.215, .18, .56, 12), jacket, 0, .31, 0, torso); chest.scale.set(1.08, 1, .66); mesh(new T.CylinderGeometry(.19, .2, .1, 12), pants, 0, .02, 0, torso).scale.set(1.04, 1, .68); mesh(new T.TorusGeometry(.085, .028, 6, 14), trim, 0, .6, .0, torso).rotation.x = PI / 2;
    const patch = cv(128, 128), pg = patch.getContext('2d'); pg.fillStyle = '#0d3a2a'; pg.fillRect(0, 0, 128, 128); pg.strokeStyle = LIME; pg.lineWidth = 11; pg.lineJoin = 'round'; pg.lineCap = 'round'; pg.beginPath(); [[20, 96], [44, 76], [60, 88], [84, 52], [106, 34]].forEach(([x, y], i) => pg[i ? 'lineTo' : 'moveTo'](x, y)); pg.stroke(); pg.fillStyle = LIME; pg.beginPath(); pg.arc(106, 34, 10, 0, TAU); pg.fill();
    const pm = mesh(new T.PlaneGeometry(.25, .25), bas(0xffffff, { map: tex(patch) }), 0, .36, -.148, torso); pm.rotation.y = PI;
    mesh(new T.CylinderGeometry(.05, .055, .09, 10), skin, 0, .63, 0, torso); const head = new T.Group(); head.position.y = .775; torso.add(head); mesh(new T.SphereGeometry(.125, 16, 12), skin, 0, 0, 0, head).scale.set(.94, 1.06, 1); const hr = mesh(new T.SphereGeometry(.137, 16, 10, 0, TAU, 0, PI * .6), hairM, 0, .022, -.022, head); hr.rotation.x = -.52; for (const e of [-1, 1]) mesh(new T.SphereGeometry(.03, 8, 6), skin, e * .116, -.012, .0, head);
    const arm = s => { const sh = new T.Group(); sh.position.set(s * .262, .545, 0); torso.add(sh); mesh(cap(.058, .2), jacket, 0, -.15, 0, sh); const el = new T.Group(); el.position.y = -.3; sh.add(el); mesh(cap(.052, .18), jacket, 0, -.13, 0, el); mesh(new T.SphereGeometry(.052, 10, 8), skin, 0, -.29, 0, el); mesh(new T.CylinderGeometry(.056, .056, .03, 10), trim, 0, -.235, 0, el); return [sh, el]; };
    const leg = s => { const h = new T.Group(); h.position.set(s * .1, 0, 0); hip.add(h); mesh(cap(.08, .27), pants, 0, -.215, 0, h); const k = new T.Group(); k.position.y = -.43; h.add(k); mesh(cap(.066, .28), pants, 0, -.21, 0, k); box(.105, .075, .27, shoe, 0, -.455, .06, k); return [h, k]; };
    const [sL, eL] = arm(1), [sR, eR] = arm(-1), [hL, kL] = leg(1), [hR, kR] = leg(-1); g.rotation.y = PI; scene.add(g); return { g, hip, torso, head, sL, eL, sR, eR, hL, kL, hR, kR }; })();
  const heroLight = new T.PointLight(0xeafff2, 9, 9, 2); scene.add(heroLight);
  const heroAt = t => { const d = walked(t); return [lerp(0, -.5, ss(7.6, 9.4, t)), Z0 - d]; };
  const poseHero = t => { const H = HERO, d = walked(t), w = pace(t), ph = d / 1.72 * TAU, [x, z] = heroAt(t), s = Math.sin(ph), c = Math.cos(ph), reach = ss(8.95, 9.4, t) * (1 - .9 * ss(WAKE + 3.05, WAKE + 3.7, t)), typing = ss(WAKE + 2.0, WAKE + 2.28, t) * (1 - ss(WAKE + 2.9, WAKE + 3.25, t)), tap = .07 * Math.sin(t * 41) * typing, idle = Math.sin(t * 1.6) * (1 - w);
    H.g.position.set(x, 0, z); H.g.rotation.y = PI - .12 * ss(8.4, 9.5, t); H.hip.position.y = .915 + .022 * Math.cos(ph * 2) * w + .004 * idle; H.hip.rotation.y = -.07 * s * w; H.torso.rotation.set(.075 * w + .1 * reach, .11 * s * w, .02 * s * w);
    H.head.rotation.set(-.2 * ss(2.6, 3.5, t) * (1 - ss(5.2, 6.4, t)) + .2 * ss(9, 9.6, t), .45 * Math.sin((t - 3.3) * 1.15) * ss(3.3, 4.1, t) * (1 - ss(7.4, 8.4, t)) - .1 * ss(8.6, 9.3, t), 0);
    H.hL.rotation.x = -.6 * s * w; H.hR.rotation.x = .6 * s * w; H.kL.rotation.x = w * (.12 + .95 * Math.pow(Math.max(0, c), 1.4)); H.kR.rotation.x = w * (.12 + .95 * Math.pow(Math.max(0, -c), 1.4));
    H.sL.rotation.set(lerp(.5 * s * w, -1.12, typing) + tap, 0, lerp(.06, .36, typing)); H.eL.rotation.x = lerp(-(.18 + .32 * w + .22 * Math.max(0, -s) * w), -.52, typing); H.sR.rotation.set(lerp(-.5 * s * w, -1.18, reach) - tap, 0, lerp(-.06, -.42, reach)); H.eR.rotation.x = lerp(-(.18 + .32 * w + .22 * Math.max(0, s) * w), -.5, reach);
    heroLight.position.set(x + .6, 2.6, z + 1.6); dummy.position.set(x, .014, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1.15); dummy.updateMatrix(); blobs.setMatrixAt(NX, dummy.matrix); blobs.instanceMatrix.needsUpdate = true; };

  // ------------------------------------------------------------ paper on the floor, slips in the air, dust in the light
  { const r = rng(99), list = []; for (let i = 0; i < (low ? 120 : 300); i++) { const [px, pz] = POSTS[Math.floor(r() * POSTS.length)], a = r() * TAU, d = 2.6 + r() * 2.6, x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d; if (Math.abs(x) < 1.3) continue; list.push({ p: [x, .016 + r() * .004, z], r: [-PI / 2, r() * TAU, 0], s: [.1 + r() * .1, .16 + r() * .1, 1], c: [0xe9efe6, 0xf7f3df, 0xcfe7d6, 0xf3d9d9][Math.floor(r() * 4)] }); } const m = inst(new T.PlaneGeometry(1, 1), lam(0xffffff, { side: T.DoubleSide }), list); m.layers.set(1); }
  const NS = low ? 30 : 80, slips = new T.InstancedMesh(new T.PlaneGeometry(.11, .17), lam(0xf4f6ee, { side: T.DoubleSide }), NS); slips.frustumCulled = false; scene.add(slips);
  const poseSlips = t => { for (let i = 0; i < NS; i++) { const a = h1(i * 3.1), b = h1(i * 7.7), c = h1(i * 13.3), [px, pz] = POSTS[i % POSTS.length], fall = (t * (.35 + a * .3) + b * 9) % 1; dummy.position.set(px + (b - .5) * 7 + Math.sin(t * 1.3 + i) * .4, 6.2 * (1 - fall) + .05, pz + (c - .5) * 7 + Math.cos(t * 1.1 + i * 2) * .4); dummy.rotation.set(t * (1.5 + a * 2) + i, t * (1 + b) + i * 2, Math.sin(t * 2 + i)); dummy.scale.setScalar(1); dummy.updateMatrix(); slips.setMatrixAt(i, dummy.matrix); } slips.instanceMatrix.needsUpdate = true; };
  const dust = (() => { const n = low ? 300 : 1100, pos = new Float32Array(n * 3), sd = new Float32Array(n), r = rng(7); for (let i = 0; i < n; i++) { pos[i * 3] = (r() - .5) * 16; pos[i * 3 + 1] = r() * 12; pos[i * 3 + 2] = 10 - r() * 44; sd[i] = r(); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('seed', new T.BufferAttribute(sd, 1));
    const m = new T.ShaderMaterial({ uniforms: { time: { value: 0 }, px: { value: 600 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexShader: `attribute float seed; uniform float time; uniform float px; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y - time * (.04 + seed * .07), 12.) + .2; p.x += sin(time * .3 + seed * 30.) * .5; vec4 mv = modelViewMatrix * vec4(p, 1.); vA = (.25 + .75 * seed) * smoothstep(.3, 2., -mv.z) * (.6 + .4 * sin(time * 2. + seed * 50.)); gl_PointSize = px * (.012 + seed * .02) / -mv.z; gl_Position = projectionMatrix * mv; }`, fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.85, 1., .9) * smoothstep(.5, .0, d) * vA * .55, 1.); }` });
    const p = new T.Points(g, m); p.frustumCulled = false; p.layers.set(1); scene.add(p); return m; })();

  // ------------------------------------------------------------ light
  scene.add(new T.HemisphereLight(0xbfeedb, 0x0a1a12, .78)); const sun = new T.DirectionalLight(0xfff0d2, 1.5); sun.position.set(3, 14, 4); scene.add(sun); const fill = new T.DirectionalLight(0x7fe6b8, .5); fill.position.set(-6, 5, 10); scene.add(fill);
  for (const [x, z] of [[-7.5, 1], [7.5, 1], [-7.5, -15], [7.5, -15]]) { const l = new T.PointLight(0x5cf0a8, 28, 15, 2); l.position.set(x, 3.2, z); scene.add(l); }

  // ------------------------------------------------------------ the floor: polished stone that mirrors the room
  const rt = new T.WebGLRenderTarget(4, 4, { samples: low ? 0 : 2 }); rt.texture.colorSpace = T.SRGBColorSpace; const vcam = new T.PerspectiveCamera(), TM = new T.Matrix4();
  const floorMat = new T.ShaderMaterial({ uniforms: { tR: { value: rt.texture }, tm: { value: TM }, camP: { value: new T.Vector3() }, fogC: { value: FOGC }, fogD: { value: FOGD }, px: { value: new T.Vector2(1, 1) } },
    vertexShader: `uniform mat4 tm; varying vec4 vR; varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vW = wp.xyz; vR = tm * wp; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform sampler2D tR; uniform vec3 camP; uniform vec3 fogC; uniform float fogD; uniform vec2 px; varying vec4 vR; varying vec3 vW;
      float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float ns(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hs(i), hs(i + vec2(1., 0.)), f.x), mix(hs(i + vec2(0., 1.)), hs(i + vec2(1., 1.)), f.x), f.y); }
      void main(){ vec2 g = vW.xz / 1.9; vec2 gi = floor(g), gf = fract(g); vec2 e = abs(gf - .5); float line = smoothstep(.478, .496, max(e.x, e.y)); float chk = mod(gi.x + gi.y, 2.); float vein = ns(vW.xz * 1.3 + ns(vW.xz * .6) * 3.);
        vec3 base = mix(vec3(.010, .030, .022), vec3(.020, .052, .039), chk); base *= .75 + .5 * vein; base = mix(base, vec3(.32, .24, .10), line * .5);
        vec2 uv = vR.xy / vR.w; float rough = (ns(vW.xz * 7.) - .5) * .004 + (hs(gi) - .5) * .003; vec3 r = vec3(0.); float d = distance(camP, vW); vec2 b = px * (1.2 + d * .12);
        r += texture2D(tR, uv + rough).rgb * .28; r += texture2D(tR, uv + rough + vec2(b.x, 0.)).rgb * .14; r += texture2D(tR, uv + rough - vec2(b.x, 0.)).rgb * .14; r += texture2D(tR, uv + rough + vec2(0., b.y * 2.)).rgb * .14; r += texture2D(tR, uv + rough - vec2(0., b.y * 2.)).rgb * .14; r += texture2D(tR, uv + rough + vec2(0., b.y * 4.5)).rgb * .08; r += texture2D(tR, uv + rough - vec2(0., b.y * 4.5)).rgb * .08;
        vec3 V = normalize(camP - vW); float fr = pow(1. - max(V.y, 0.), 2.6); vec3 col = base + r * mix(.34, 1., fr) * (1. - line * .5);
        float f = 1. - exp(-fogD * fogD * d * d); col = mix(col, fogC, f); gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment> }` });
  const floor = mesh(new T.PlaneGeometry(40, 72), floorMat, 0, 0, -16); floor.rotation.x = -PI / 2; floor.layers.set(1);
  const mirror = () => { const p = cam.position; vcam.position.set(p.x, -p.y, p.z); const look = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).add(p); look.y = -look.y; vcam.up.set(0, 1, 0).applyQuaternion(cam.quaternion); vcam.up.y = -vcam.up.y; vcam.lookAt(look); vcam.fov = cam.fov; vcam.aspect = cam.aspect; vcam.near = cam.near; vcam.far = cam.far; vcam.updateProjectionMatrix(); vcam.updateMatrixWorld(); TM.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1); TM.multiply(vcam.projectionMatrix); TM.multiply(vcam.matrixWorldInverse); R.setRenderTarget(rt); R.render(scene, vcam); R.setRenderTarget(null); };

  // ------------------------------------------------------------ camera
  scene.updateMatrixWorld(true); const SC = new T.Vector3(); lid.rotation.x = LIDOPEN; scene.updateMatrixWorld(true); lapScr.getWorldPosition(SC); const SN = new T.Vector3(0, 0, 1).transformDirection(lapScr.matrixWorld), END = SC.clone();
  const K = [[0, [.55, 1.42, 17.3], [0, 1.9, 10], 46], [1.5, [.8, 1.6, 15.5], [0, 2.1, 8], 46], [3.3, [.45, 2.35, 10.5], [-.5, 3.4, -8], 54], [5.1, [3.0, 6.9, 4.4], [-1.5, 1.4, -13], 58], [6.9, [-2.85, 1.65, 2.2], [.5, 1.45, -1.2], 48], [8.3, [1.75, 1.85, -1.3], [-.2, 1.3, -5.1], 46], [9.75, [.95, 1.74, -3.1], [.02, 1.3, -5.15], 42], [10.6, [.55, 1.66, -4.12], [SC.x, SC.y, SC.z], 38], [11.7, [.36, 1.64, -4.6], [SC.x, SC.y, SC.z], 36], [13.3, [.27, 1.64, -4.77], [SC.x, SC.y, SC.z], 35], [15.05, END, [SC.x, SC.y, SC.z], 36], [16.0, END, [SC.x, SC.y, SC.z], 36]];
  // the last stop sits on the screen's normal, just far enough that the screen fills the frame at this aspect
  const endAt = asp => { const v = 36 * (asp < 1 ? 1.32 : 1) * PI / 180, h = 2 * Math.tan(v / 2), d = Math.min(.48 / h, .765 / (h * asp)) * .99; return SC.clone().addScaledVector(SN, d); };
  let cp, ct; const n = K.length; const path = asp => { const E = endAt(asp); K[n - 2][1] = E; K[n - 1][1] = E; cp = new T.CatmullRomCurve3(K.map(k => k[1] instanceof T.Vector3 ? k[1].clone() : new T.Vector3(...k[1])), false, 'centripetal'); ct = new T.CatmullRomCurve3(K.map(k => new T.Vector3(...k[2])), false, 'centripetal'); }; path(16 / 10);
  const uAt = t => { let i = 0; while (i < n - 2 && t > K[i + 1][0]) i++; const t0 = K[i][0], t1 = K[i + 1][0], s = cl((t - t0) / (t1 - t0)), m0 = (i > 0 ? 2 / (t1 - K[i - 1][0]) : 1 / (t1 - t0)) * (t1 - t0), m1 = (i < n - 2 ? 2 / (K[i + 2][0] - t0) : 1 / (t1 - t0)) * (t1 - t0), s2 = s * s, s3 = s2 * s; return (i + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) + (s3 - s2) * m1) / (n - 1); };
  const fovAt = t => { let i = 0; while (i < n - 2 && t > K[i + 1][0]) i++; return lerp(K[i][3], K[i + 1][3], ss(K[i][0], K[i + 1][0], t)); };
  const cpos = new T.Vector3(), ctar = new T.Vector3();
  let W = 2, Hh = 2, lastAtlas = -1;
  const at = t => { t = cl(t, 0, DURATION + .5); const w = pace(t);
    // textures
    if (opt.exact || Math.abs(t - lastAtlas) > (low ? .09 : .045)) { drawAtlas(t); lastAtlas = t; } drawWall(t); const scrOn = drawLap(t); screenMat.uniforms.time.value = t; dust.uniforms.time.value = t;
    scene.traverse(o => { if (o.userData.tick) { const m = o.material.map; m.offset.x = t * .02 * o.userData.tick; } }); tickC.offset.x = t * .05;
    // doors, gates, bell, clocks, banners, shafts
    const open = eio((t - .3) / 1.75) * 1.72; doors[0].rotation.y = -open; doors[1].rotation.y = open; spill.scale.set(.4 + open * 2.4, 7, 1); spill.material.opacity = .26 * ss(.05, 1.2, open); doorL.intensity = 12 * ss(.05, 1.4, open) * (1 - ss(4, 6, t)); lobbyL.intensity = 3 * (1 - ss(3.5, 6, t));
    const gz = heroAt(t)[1], pass = ss(8.9, 7.7, gz), go = ss(8.6, 8.0, gz); flaps[0].rotation.y = -go * 1.45; flaps[1].rotation.y = go * 1.45; gateLed.forEach(m => m.material.color.set(go > .5 ? 0x4ade80 : 0xfbbf24)); gateGlow.material.color.set(go > .5 ? 0x4ade80 : 0xfbbf24); gateGlow.material.opacity = .22 + .3 * Math.sin(pass * PI);
    const be = ss(2.2, 2.7, t) * (1 - ss(6.4, 7.6, t)); bell.rotation.z = .55 * Math.sin((t - 2.2) * 8.2) * be; rings.forEach((m, i) => { const k = ((t - 2.4) * .8 + i / 3) % 1; m.scale.setScalar(.4 + k * 4.6); m.material.opacity = be * (1 - k) * .5; });
    hands.forEach(([hh, mh]) => { hh.rotation.z = -(9.5 / 12) * TAU - t * .0003; mh.rotation.z = -(.5 * TAU) - t * .08; }); banners.forEach((b, i) => { b.rotation.x = .035 * Math.sin(t * .8 + i * 1.7); }); shafts.forEach((m, i) => { m.material.opacity = .075 + .05 * vn(t * .35 + i * 3.3); });
    // the laptop: the lid lifts as he reaches it, then the screen comes on
    lid.rotation.x = lerp(LIDSHUT, LIDOPEN, eio((t - 9.02) / .46)); lapL.intensity = scrOn * 2.6; lapGlow.material.opacity = scrOn * .34; led2.material.color.set(scrOn > 0 ? 0xd9f99d : 0x1b4d38);
    poseExtras(t); poseSlips(t); poseHero(t);
    // camera
    const u = uAt(t); cp.getPoint(u, cpos); ct.getPoint(u, ctar); const shake = (.25 + .75 * w) * (1 - ss(10.4, 11.2, t)); cpos.x += (vn(t * 1.3 + 3) - .5) * .05 * shake; cpos.y += (vn(t * 1.7 + 9) - .5) * .04 * shake + Math.abs(Math.sin(walked(t) / 1.72 * TAU)) * .012 * w * (1 - ss(4.2, 5, t) + ss(6.2, 7, t)); ctar.x += (vn(t * .9 + 20) - .5) * .06 * shake; ctar.y += (vn(t * 1.1 + 30) - .5) * .05 * shake;
    cam.position.copy(cpos); cam.up.set(0, 1, 0); cam.lookAt(ctar); cam.fov = fovAt(t) * (cam.aspect < 1 ? 1.32 : 1); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    floorMat.uniforms.camP.value.copy(cpos); mirror(); R.render(scene, cam); };
  const resize = sc => { if (sc) opt.scale = sc; const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight, pr = Math.min(devicePixelRatio || 1, low ? 1.25 : 1.75) * (opt.scale || 1); W = w; Hh = h; R.setPixelRatio(pr); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); path(w / h); const k = low ? .4 : .55; rt.setSize(Math.max(2, Math.round(w * pr * k)), Math.max(2, Math.round(h * pr * k))); floorMat.uniforms.px.value.set(1 / (w * pr * k), 1 / (h * pr * k)); dust.uniforms.px.value = h * pr; };
  resize();
  const dispose = () => { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }); } }); rt.dispose(); if (scene.environment) scene.environment.dispose(); R.dispose(); };
  // compile every shader before the clock starts, so the first step through the doors doesn't stutter
  const ready = (async () => { try { at(0); if (R.compileAsync) { await R.compileAsync(scene, cam); await R.compileAsync(scene, vcam); } } catch (e) { } at(0); })();
  return { at, resize, dispose, ready, duration: DURATION, renderer: R };
}
