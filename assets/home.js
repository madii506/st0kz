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
  const LINES = [[.24, .5, 'rgba(52,211,153,.16)', 1.6], [.38, .34, 'rgba(52,211,153,.1)', 1.2], [.55, .62, 'rgba(217,249,157,.2)', 2], [.7, .42, 'rgba(52,211,153,.12)', 1.4], [.84, .28, 'rgba(52,211,153,.08)', 1.1]];
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); };
  const draw = now => { raf = RM ? 0 : requestAnimationFrame(draw); const t = (now || 0) / 1000; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#04110b'; g.fillRect(0, 0, W, H);
    [[.22, .3, 'rgba(52,211,153,.13)'], [.8, .72, 'rgba(217,249,157,.07)'], [.55, .5, 'rgba(14,90,61,.3)']].forEach(([x, y, c], i) => { const cx = W * (x + .05 * Math.sin(t * .11 + i * 2)), cy = H * (y + .05 * Math.cos(t * .09 + i)), r = Math.max(W, H) * (.42 + .05 * Math.sin(t * .13 + i)); const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(4,17,11,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
    g.strokeStyle = 'rgba(120,220,170,.045)'; g.lineWidth = 1; const off = (t * 6) % 48; for (let x = -off; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    LINES.forEach(([y0, sp, c, lw], i) => { g.strokeStyle = c; g.lineWidth = lw; g.lineJoin = 'round'; g.beginPath(); const step = 14, sh = t * sp * 0.9 + i * 40; for (let x = 0; x <= W + step; x += step) { const q = x / 120 + sh, y = H * y0 - (fb(q) - .5) * H * .22 + (x / W) * H * -.03; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
  };
  addEventListener('resize', () => { size(); if (RM) draw(0); });
  addEventListener('hashchange', () => { if (atHome()) show(); else hide(); });
  addEventListener('keydown', e => { if (e.key === 'Enter' && !el.classList.contains('off') && !el.classList.contains('out') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) location.hash = '#/feed'; });
  size();
  if (atHome()) { show(); if (RM) draw(0); } else { el.classList.add('off'); boot(); }
})();
