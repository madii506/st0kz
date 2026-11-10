// st0kz intro sound. Everything here is synthesized with the Web Audio API: no recordings, nothing borrowed.
// It runs on the intro's clock, so scrolling ahead or skipping keeps the sound with the picture.
const TAU = Math.PI * 2, cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

// a crowd: many voices babbling vowels (pulse source through two moving formants), panned around the hall
const VOW = [[730, 1090], [270, 2290], [530, 1840], [660, 1720], [300, 870], [570, 840], [440, 1020], [490, 1350], [640, 1190]];
function babble(ctx, sec, voices, seed) {
  const sr = 22050, n = Math.floor(sec * sr), X = Math.floor(.5 * sr), N = n + X, Lc = new Float32Array(N), Rc = new Float32Array(N), r = rng(seed);
  const co = (f, Q) => { const w = TAU * f / sr, al = Math.sin(w) / (2 * Q), a0 = 1 + al; return [al / a0, -2 * Math.cos(w) / a0, (1 - al) / a0]; };
  for (let v = 0; v < voices; v++) {
    const size = .88 + r() * .34, f0 = r() < .35 ? 175 + r() * 70 : 92 + r() * 55, pan = r() * 1.8 - .9, gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4), far = r(), lvl = (.3 + r() * .7) * (1 - far * .55), lpk = lerp(.75, .14, far), seg = [];
    let t = -r() * 1.5; while (t < N / sr) { const end = t + .8 + r() * 2.6; while (t < end) { const d = .08 + r() * .17, V = VOW[Math.floor(r() * VOW.length)]; seg.push([t, t + d, V[0] * size, V[1] * size, 1 + (r() - .5) * .28]); t += d + .012 + r() * .05; } t += .25 + r() * 1.4; }
    let si = 0, ph = 0, lp = 0, env = 0, F1 = 500, F2 = 1500, P = 1, x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, z1 = 0, z2 = 0, A = co(500, 6), B = co(1500, 9);
    for (let i = 0; i < N; i++) { const tt = i / sr; while (si < seg.length - 1 && seg[si][1] < tt) si++; const s = seg[si], inS = tt >= s[0] && tt < s[1];
      env += ((inS ? Math.sin(Math.PI * (tt - s[0]) / (s[1] - s[0])) : 0) - env) * .006;
      if ((i & 63) === 0) { if (inS) { F1 += (s[2] - F1) * .4; F2 += (s[3] - F2) * .4; P = s[4]; } A = co(F1, 6); B = co(F2, 9); }
      ph += f0 * P * (1 + .03 * Math.sin(tt * 5 + v)) / sr; if (ph >= 1) ph -= 1; const src = ((1 - 2 * ph) * .75 + (r() * 2 - 1) * .3) * env;
      const y = A[0] * src - A[0] * x2 - A[1] * y1 - A[2] * y2; x2 = x1; x1 = src; y2 = y1; y1 = y;
      const z = B[0] * src - B[0] * u2 - B[1] * z1 - B[2] * z2; u2 = u1; u1 = src; z2 = z1; z1 = z;
      lp += (y + z * .55 - lp) * lpk; Lc[i] += lp * lvl * gl; Rc[i] += lp * lvl * gr; } }
  const b = ctx.createBuffer(2, n, sr); let pk = 1e-6; for (let i = 0; i < n; i++) { const k = i < X ? i / X : 1; Lc[i] = Lc[i] * k + (i < X ? Lc[n + i] * (1 - k) : 0); Rc[i] = Rc[i] * k + (i < X ? Rc[n + i] * (1 - k) : 0); pk = Math.max(pk, Math.abs(Lc[i]), Math.abs(Rc[i])); }
  const L0 = b.getChannelData(0), R0 = b.getChannelData(1); for (let i = 0; i < n; i++) { L0[i] = Lc[i] / pk * .9; R0[i] = Rc[i] / pk * .9; } return b; }

export function createSound(C) {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  const ctx = new AC({ latencyHint: 'interactive' }), SR = ctx.sampleRate, now = () => ctx.currentTime, R = rng(77), L = C.login, W = C.wake;
  const master = ctx.createGain(); master.gain.value = 0; const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = .004; comp.release.value = .22; master.connect(comp); comp.connect(ctx.destination);
  // the hall's reverb, made from decaying noise
  const verb = ctx.createConvolver(); { const n = Math.floor(SR * 2.2), b = ctx.createBuffer(2, n, SR); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6) * (i < SR * .012 ? i / (SR * .012) : 1); } verb.buffer = b; }
  const wet = ctx.createGain(); wet.gain.value = .42; verb.connect(wet); wet.connect(master); const dry = ctx.createGain(); dry.connect(master);
  const bus = (pan = 0, d = 1, w = .35) => { const g = ctx.createGain(), nodes = [g]; let o = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = cl(pan, -1, 1); g.connect(p); o = p; nodes.push(p); } const gd = ctx.createGain(); gd.gain.value = d; o.connect(gd); gd.connect(dry); const gw = ctx.createGain(); gw.gain.value = w; o.connect(gw); gw.connect(verb); nodes.push(gd, gw); g.kill = () => nodes.forEach(x => { try { x.disconnect(); } catch (e) { } }); return g; };
  const noiseBuf = (() => { const b = ctx.createBuffer(1, SR * 2, SR), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const pinkBuf = (() => { const b = ctx.createBuffer(2, SR * 3, SR); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .16; } } return b; })();
  const brownBuf = (() => { const b = ctx.createBuffer(1, SR * 3, SR), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.2; } return b; })();
  const crowdBuf = babble(ctx, 4.5, 18, 4242);

  // one-shots
  const hit = ({ at = 0, dur = .05, f = 3000, f2 = null, q = 1, type = 'bandpass', gain = .2, atk = .002, pan = 0, d = 1, w = .3 }) => { const t0 = now() + at, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = .8 + Math.random() * .4;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur); fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + atk); g.gain.exponentialRampToValueAtTime(.0001, t0 + Math.max(dur, atk + .01)); const o = bus(pan, d, w); s.connect(fl); fl.connect(g); g.connect(o); s.start(t0, Math.random() * 1.4); s.stop(t0 + dur + .05); s.onended = () => { o.kill(); g.disconnect(); fl.disconnect(); }; };
  const tone = ({ at = 0, f = 440, f2 = null, dur = .3, type = 'sine', gain = .1, atk = .005, pan = 0, d = 1, w = .3, lp = null }) => { const t0 = now() + at, os = ctx.createOscillator(); os.type = type; os.frequency.setValueAtTime(f, t0); if (f2) os.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + atk); g.gain.exponentialRampToValueAtTime(.0001, t0 + Math.max(dur, atk + .01)); const o = bus(pan, d, w); let x = os, fl = null; if (lp) { fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; os.connect(fl); x = fl; } x.connect(g); g.connect(o); os.start(t0); os.stop(t0 + dur + .05); os.onended = () => { o.kill(); g.disconnect(); if (fl) fl.disconnect(); }; };
  const step = (k, gain) => { const pan = k % 2 ? .1 : -.1; hit({ dur: .04, f: 3000 + Math.random() * 1200, q: 1.3, gain: gain * .8, pan, w: .45 }); tone({ f: 92 + Math.random() * 18, f2: 50, dur: .1, gain: gain * .85, atk: .002, pan, w: .18 }); hit({ at: .01, dur: .09, f: 850, q: .7, gain: gain * .3, pan, w: .5 }); };
  const bellStrike = a => { [[1, .22, 2.6], [2.0, .12, 1.7], [2.41, .1, 1.5], [3.02, .06, 1.1], [4.17, .045, .75], [5.43, .025, .5], [.5, .07, 3]].forEach(([m, g, dc]) => tone({ f: 640 * m, dur: dc, gain: g * a, atk: .002, d: .5, w: .95 })); hit({ dur: .02, f: 5200, gain: .1 * a, d: .5, w: .6 }); };
  const phone = (pan, gain) => { for (const at of [0, 1.1]) { const t0 = now() + at, g = ctx.createGain(), am = ctx.createGain(), lfo = ctx.createOscillator(), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 1.2;
      o1.type = o2.type = 'triangle'; o1.frequency.value = 1720; o2.frequency.value = 2130; lfo.type = 'square'; lfo.frequency.value = 20; const ld = ctx.createGain(); ld.gain.value = .5; am.gain.value = .5; lfo.connect(ld); ld.connect(am.gain); o1.connect(am); o2.connect(am); am.connect(bp); bp.connect(g);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + .02); g.gain.setValueAtTime(gain, t0 + .72); g.gain.linearRampToValueAtTime(0, t0 + .8); const o = bus(pan, .35, 1); g.connect(o); [lfo, o1, o2].forEach(x => { x.start(t0); x.stop(t0 + .85); }); o1.onended = () => { o.kill(); [g, am, bp, ld, lfo, o1, o2].forEach(x => x.disconnect()); }; } };
  const chord = (notes, { at = 0, dur = 1.4, gain = .06, w = .5 } = {}) => notes.forEach((f, i) => { tone({ at: at + i * .07, f, dur, gain, atk: .012, w }); tone({ at: at + i * .07, f: f * 2.005, dur: dur * .45, gain: gain * .25, atk: .01, w }); });

  // loops: the crowd (two copies at different speeds), a cheer layer for the bell, room tone, and the dive's wind
  const loop = (buf, rate, off) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s._off = off; return s; };
  const cA = loop(crowdBuf, 1, 0), cB = loop(crowdBuf, .93, 2.7), cC = loop(crowdBuf, 1.12, 1.3), room = loop(pinkBuf, 1, 0), wind = loop(noiseBuf, 1, 0), rum = loop(brownBuf, 1, 0);
  const crowdLP = ctx.createBiquadFilter(); crowdLP.type = 'lowpass'; crowdLP.frequency.value = 420; crowdLP.Q.value = .5; const crowdG = ctx.createGain(); crowdG.gain.value = 0; cA.connect(crowdLP); cB.connect(crowdLP); crowdLP.connect(crowdG); crowdG.connect(bus(0, .85, .55));
  const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 1800; shelf.gain.value = 7; const cheerG = ctx.createGain(); cheerG.gain.value = 0; cC.connect(shelf); shelf.connect(cheerG); cheerG.connect(bus(0, .6, .9));
  const roomLP = ctx.createBiquadFilter(); roomLP.type = 'lowpass'; roomLP.frequency.value = 900; const roomG = ctx.createGain(); roomG.gain.value = 0; room.connect(roomLP); roomLP.connect(roomG); roomG.connect(bus(0, .8, .3));
  const windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.Q.value = .9; windF.frequency.value = 300; const windG = ctx.createGain(); windG.gain.value = 0; wind.connect(windF); windF.connect(windG); windG.connect(bus(0, .9, .35));
  const rumLP = ctx.createBiquadFilter(); rumLP.type = 'lowpass'; rumLP.frequency.value = 170; const rumG = ctx.createGain(); rumG.gain.value = 0; rum.connect(rumLP); rumLP.connect(rumG); rumG.connect(bus(0, 1, .2));
  const hum = ctx.createOscillator(), humG = ctx.createGain(); hum.frequency.value = 118; humG.gain.value = 0; hum.connect(humG); humG.connect(bus(0, .7, .1));

  // the score, as events on the intro clock
  const EV = [], at = (t, f) => EV.push({ t, f });
  at(.26, () => { hit({ dur: .02, f: 2600, q: 3, gain: .25, w: .3 }); tone({ f: 74, f2: 44, dur: .26, gain: .3, w: .3 }); tone({ at: .012, f: 2950, dur: .06, gain: .045 }); });
  at(.34, () => { hit({ dur: 1.9, atk: .6, f: 380, f2: 950, type: 'lowpass', q: .5, gain: .2, w: .5 }); tone({ f: 150, f2: 96, dur: 1.1, type: 'sawtooth', gain: .018, atk: .25, lp: 520, w: .4 }); });
  C.steps.forEach((t, k) => at(t, () => step(k, t < 3.7 || t > 6.5 ? .5 : .22)));
  if (C.gate) at(C.gate, () => { tone({ f: 1046.5, dur: .09, type: 'square', gain: .04, lp: 2800 }); tone({ at: .1, f: 1568, dur: .17, type: 'square', gain: .04, lp: 2800 }); hit({ at: .06, dur: .42, f: 1900, f2: 500, q: .8, gain: .11, w: .35 }); });
  C.bell.forEach(([t, a]) => a > .05 && at(t, () => bellStrike(a)));
  at(3.1, () => phone(-.65, .028)); at(7.3, () => phone(.7, .022));
  for (let t = .9; t < 13.5; t += .18 + R() * .55) { const f = [1320, 1480, 1760, 1975, 2217][Math.floor(R() * 5)], p = R() * 1.6 - .8; at(t, () => tone({ f, dur: .07, gain: .022, pan: p, d: .5, w: .7 })); }
  for (let t = 1.6; t < 13; t += 1.1 + R() * 1.6) { const p = R() * 1.6 - .8, n = 5 + Math.floor(R() * 7); at(t, () => { let o = 0; for (let k = 0; k < n; k++) { o += .055 + Math.random() * .08; hit({ at: o, dur: .012, f: 3300, q: 2, gain: .03, pan: p, d: .55, w: .5 }); } }); }
  at(C.lid[0], () => hit({ dur: .015, f: 4600, q: 2, gain: .12, w: .12 })); at(C.lid[1], () => { tone({ f: 330, f2: 180, dur: .06, gain: .13, w: .1 }); hit({ dur: .03, f: 1500, gain: .07, w: .1 }); });
  at(W, () => { tone({ f: 55, dur: .7, gain: .2, atk: .08, w: .1 }); tone({ f: 110, dur: .45, gain: .06, atk: .05, w: .1 }); hit({ dur: .25, f: 9000, type: 'highpass', gain: .03, atk: .01, w: .2 }); });
  at(W + L.mark, () => { tone({ f: 420, f2: 1260, dur: .85, gain: .035, atk: .3, w: .55 }); hit({ dur: .9, atk: .4, f: 2400, f2: 7000, q: 1.5, gain: .05, w: .6 }); });
  at(W + L.mark + .82, () => chord([659.25, 987.77, 1318.5], { dur: 1.2, gain: .05 }));
  at(W + L.scan + .05, () => { tone({ f: 1760, f2: 880, dur: .52, type: 'triangle', gain: .028, atk: .05, w: .3 }); tone({ at: .52, f: 880, f2: 1760, dur: .52, type: 'triangle', gain: .028, atk: .03, w: .3 }); hit({ dur: 1.05, atk: .2, f: 5200, q: 4, gain: .025, w: .3 }); });
  at(W + L.scan + 1.12, () => { tone({ f: 1567.98, dur: .14, gain: .06, w: .3 }); tone({ at: .07, f: 2093, dur: .3, gain: .06, w: .4 }); });
  for (let i = 0; i < 6; i++) at(W + L.code + i * .1, () => { hit({ dur: .014, f: 3800, q: 2, gain: .09, w: .1 }); tone({ f: 990 + i * 110, dur: .06, gain: .035, w: .25 }); });
  at(W + L.unlock, () => { chord([329.63, 493.88, 659.25, 830.61], { dur: 1.9, gain: .06, w: .7 }); hit({ dur: .7, atk: .05, f: 600, f2: 4200, q: .7, gain: .1, w: .6 }); tone({ f: 60, f2: 40, dur: .6, gain: .22, atk: .01, w: .2 }); });
  for (let k = 0; k < 15; k++) at(W + L.grid + k * .028, () => tone({ f: 880 * Math.pow(2, k / 12), dur: .09, gain: .022, w: .45, type: 'triangle' }));
  at(W + L.grid + .97, () => [0, 1, 2].forEach(i => tone({ at: i * .06, f: 2637 - i * 220, dur: .25, gain: .03, w: .5 })));
  for (let i = 0; i < 6; i++) at(W + L.build + i * .08, () => { tone({ f: 210 - i * 12, f2: 120, dur: .08, gain: .08, w: .15 }); hit({ dur: .02, f: 4200, q: 1.5, gain: .03, w: .15 }); });
  at(W + L.build + 1.15, () => tone({ f: 1975.5, dur: .2, gain: .03, w: .4 }));
  at(C.end - .12, () => { tone({ f: 58, f2: 34, dur: 1.1, gain: .34, atk: .02, w: .3 }); hit({ dur: .8, f: 6500, type: 'highpass', q: .5, gain: .05, atk: .06, w: .8 }); chord([164.81, 246.94, 329.63], { dur: 1.6, gain: .045, w: .7 }); });
  EV.sort((a, b) => a.t - b.t);

  let ei = 0, last = -1, started = false, muted = false;
  const set = (p, v, tc = .05) => p.setTargetAtTime(v, now(), tc);
  const api = {
    ctx,
    start() { if (started) return; started = true; [cA, cB, cC, room, wind, rum].forEach(s => s.start(0, s._off || 0)); hum.start(0); set(master.gain, .82, .25); },
    running: () => ctx.state === 'running',
    resume: () => ctx.resume().catch(() => { }),
    mute(m) { muted = m; set(master.gain, m ? 0 : .82, .08); },
    fadeOut(sec = .7) { set(master.gain, 0, sec / 3); },
    close() { try { ctx.close(); } catch (e) { } },
    tap() { const d = ctx.createMediaStreamDestination(); comp.connect(d); return d.stream; },
    update(t) {
      if (t < last) { ei = 0; while (ei < EV.length && EV[ei].t <= t) ei++; } last = t;
      const live = ctx.state === 'running' && started && !muted;
      while (ei < EV.length && EV[ei].t <= t) { const e = EV[ei++]; if (live && t - e.t < .25) { try { e.f(); } catch (x) { } } }
      if (ctx.state !== 'running') return;
      const inside = ss(.3, 2.1, t), be = ss(2.2, 2.7, t) * (1 - ss(6.4, 7.6, t)), dive = ss(C.dive[0] + .2, C.dive[1] + .15, t), near = ss(9.2, 10.4, t), wv = ss(C.dive[0], C.dive[0] + 1, t) * (1 - ss(C.dive[1] - .05, C.end, t));
      set(crowdLP.frequency, (lerp(420, 6500, inside) * lerp(1, .45, near) * lerp(1, .06, dive)) + 120);
      set(crowdG.gain, lerp(.24, .95, inside) * (1 + .35 * be) * lerp(1, .55, near) * (1 - .92 * dive));
      set(cheerG.gain, .5 * be * inside); set(roomG.gain, (.16 + .12 * inside) * (1 - .8 * dive));
      set(windG.gain, .3 * wv); set(windF.frequency, lerp(260, 4300, Math.pow(ss(C.dive[0], C.dive[1] + .1, t), 1.6))); set(rumG.gain, .45 * wv);
      set(humG.gain, .012 * ss(C.wake, C.wake + .4, t) * (1 - dive));
    } };
  return api;
}
