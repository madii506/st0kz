// st0kz home: one window with the mark, the name and two ways in, over a slow moving chart field. The terminal waits underneath.
(() => {
  'use strict';
  const Z = window.Z, el = document.getElementById('home'), cv = document.getElementById('hbg'), g = cv.getContext('2d'), RM = Z.RM;
  const atHome = () => location.hash.replace(/^#\/?/, '') === '';
  let booted = false, raf = 0, W = 0, H = 0, dpr = 1;
  const boot = () => { if (!booted) { booted = true; Z.boot(); } };
  const show = () => { el.classList.remove('off', 'out'); if (!raf) raf = requestAnimationFrame(draw); };
  const hide = () => { if (el.classList.contains('off')) return; el.classList.add('out'); boot(); setTimeout(() => { if (!atHome()) { el.classList.add('off'); cancelAnimationFrame(raf); raf = 0; } }, 520); };
  // the background: soft glows, a faint grid, and chart lines that drift slowly to the left
  const h1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }, vn = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i) + (h1(i + 1) - h1(i)) * u; }, fb = x => vn(x) * .62 + vn(x * 2.1 + 7) * .28 + vn(x * 4.3 + 19) * .1;
  const LINES = [[.1, .22, 'rgba(52,211,153,', .1, 1], [.2, .3, 'rgba(52,211,153,', .15, 1.2], [.3, .18, 'rgba(217,249,157,', .08, 1], [.7, .26, 'rgba(52,211,153,', .1, 1.1], [.81, .44, 'rgba(217,249,157,', .18, 1.5], [.91, .24, 'rgba(52,211,153,', .11, 1.1]];
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); };
  const fade = (c, al) => { const l = g.createLinearGradient(0, 0, W, 0); l.addColorStop(0, c + '0)'); l.addColorStop(.18, c + al + ')'); l.addColorStop(.82, c + al + ')'); l.addColorStop(1, c + '0)'); return l; };
  const draw = now => { raf = RM ? 0 : requestAnimationFrame(draw); const t = (now || 0) / 1000; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#04110b'; g.fillRect(0, 0, W, H);
    // one soft light behind the name, drifting a little
    const cx = W * (.5 + .03 * Math.sin(t * .12)), cy = H * (.46 + .03 * Math.cos(t * .1)), r = Math.max(W, H) * .55, gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, 'rgba(22,110,74,.36)'); gr.addColorStop(.5, 'rgba(10,48,33,.18)'); gr.addColorStop(1, 'rgba(4,17,11,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // a wide, faint candle chart across the middle, walking left
    const cw = Math.max(7, W / 150), gap = cw * 1.9, sh = t * 9, k0 = Math.floor(sh / gap), off = sh - k0 * gap, mid = H * .5, amp = H * .15;
    for (let i = -1; i < W / gap + 2; i++) { const k = k0 + i, o = fb(k * .21), c = fb((k + 1) * .21), hi = Math.max(o, c) + .05 * h1(k * 3.3), lo = Math.min(o, c) - .05 * h1(k * 7.7), x = i * gap - off, Y = v => mid + amp - v * amp * 2, edge = Math.min(1, x / (W * .2), (W - x) / (W * .2)); if (edge <= 0) continue;
      g.globalAlpha = .13 * edge; g.fillStyle = c >= o ? '#4ade80' : '#fb7185'; g.fillRect(x + cw / 2 - .6, Y(hi), 1.2, Y(lo) - Y(hi)); g.fillRect(x, Y(Math.max(o, c)), cw, Math.max(1.5, Math.abs(Y(o) - Y(c))));
      g.globalAlpha = .07 * edge; g.fillRect(x, H * .97 - h1(k * 5.1) * H * .06, cw, h1(k * 5.1) * H * .06); }
    g.globalAlpha = 1;
    // chart lines above and below, each with a soft fill under it
    LINES.forEach(([y0, sp, c, al, lw], i) => { const step = 10, sh2 = t * sp * .8 + i * 40, pts = []; for (let x = 0; x <= W + step; x += step) pts.push([x, H * y0 - (fb(x / 140 + sh2) - .5) * H * .11]);
      g.beginPath(); pts.forEach(([x, y], q) => q ? g.lineTo(x, y) : g.moveTo(x, y)); g.strokeStyle = fade(c, al); g.lineWidth = lw; g.lineJoin = 'round'; g.stroke();
      if (i === 1 || i === 4) { g.lineTo(W + step, H * (y0 + .08)); g.lineTo(0, H * (y0 + .08)); g.closePath(); const vf = g.createLinearGradient(0, H * (y0 - .06), 0, H * (y0 + .08)); vf.addColorStop(0, c + (al * .32) + ')'); vf.addColorStop(1, c + '0)'); g.fillStyle = vf; g.fill(); } });
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(4,17,11,0)'); vg.addColorStop(1, 'rgba(2,8,5,.7)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  };
  addEventListener('resize', () => { size(); if (RM) draw(0); });
  addEventListener('hashchange', () => { if (atHome()) show(); else hide(); });
  addEventListener('keydown', e => { if (e.key === 'Enter' && !el.classList.contains('off') && !el.classList.contains('out') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) location.hash = '#/feed'; });
  size();
  if (atHome()) { show(); if (RM) draw(0); } else { el.classList.add('off'); boot(); }
})();
