// st0kz intro runner: decides whether the floor plays, loads it, runs the clock, hands over to the terminal.
// It plays once per session on the bare address. Scroll or swipe to walk faster; the corner button skips it.
(() => {
  'use strict';
  const Z = window.Z, H = document.documentElement, q = new URLSearchParams(location.search), $ = s => document.querySelector(s);
  const force = q.get('intro') === '1' || q.has('t'), off = q.get('intro') === '0', deep = location.hash.replace(/^#\/?/, '') !== '';
  let seen = false; try { seen = sessionStorage.getItem('st0kz-intro') === '1'; } catch (e) { }
  const gl = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();
  if (!(force || (!off && !deep && !seen && !Z.RM)) || !gl) { Z.boot(); return; }

  H.classList.add('intro-on');
  const el = $('#intro'), canvas = $('#ic'), prog = $('#iprog'), flash = $('#iflash');
  let done = false, stage = null, t = 0, last = 0, raf = 0, frozen = false, T = 12.6, push = 0, slow = 0, frames = 0, scale = 1;
  const finish = () => { if (done) return; done = true; try { sessionStorage.setItem('st0kz-intro', '1'); } catch (e) { } cancelAnimationFrame(raf); removeEventListener('wheel', onWheel); removeEventListener('keydown', onKey); removeEventListener('resize', onSize);
    if (force && history.replaceState) history.replaceState(null, '', location.pathname + location.hash); Z.boot(); el.classList.add('out'); setTimeout(() => { H.classList.remove('intro-on'); el.classList.remove('out', 'rdy', 'dive'); if (stage) { try { stage.dispose(); } catch (e) { } stage = null; } }, 720); };
  const onWheel = e => { push += Math.max(-1.2, Math.min(1.2, e.deltaY * .004)); }, onKey = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') push += .8; else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') push -= .8; }, onSize = () => stage && stage.resize();
  let ty = null; el.addEventListener('touchstart', e => { ty = e.touches[0].clientY; }, { passive: true }); el.addEventListener('touchmove', e => { if (ty == null) return; const y = e.touches[0].clientY; push += (ty - y) * .012; ty = y; }, { passive: true });
  $('#iskip').onclick = finish; addEventListener('wheel', onWheel, { passive: true }); addEventListener('keydown', onKey); addEventListener('resize', onSize);
  const paint = () => { stage.at(t); canvas.style.opacity = Math.min(1, t / .7); prog.style.transform = `scaleX(${Math.min(1, t / T)})`; el.classList.toggle('dive', t > 10.7); flash.style.opacity = Math.max(0, Math.min(.4, (t - (T - .35)) / .35 * .4)); };

  // on a slow connection, don't keep anyone waiting at the door
  setTimeout(() => { if (!el.classList.contains('rdy')) finish(); }, 9000);
  import('/assets/floor.js?v=1').then(m => { if (done) return; const low = innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4 || q.get('low') === '1'; T = m.DURATION; stage = m.create(canvas, { low, exact: q.has('t') }); return stage.ready.then(() => m); }).then(m => { if (done || !m) return; el.classList.add('rdy');
    window.__intro = { T, at: x => { frozen = true; t = x; paint(); }, play: () => { frozen = false; last = performance.now(); } };
    if (q.has('t')) { frozen = true; t = +q.get('t') || 0; paint(); return; }
    const tick = now => { if (done) return; raf = requestAnimationFrame(tick); const dt = Math.min(.05, (now - last) / 1000); last = now; if (frozen) return;
      // a slow machine gets a lighter picture instead of a slow walk
      frames++; if (frames > 12 && frames < 90 && dt > .034) { slow++; if (slow > 16 && scale > .55) { scale *= .75; slow = 0; stage.resize(scale); } }
      const p = push * Math.min(1, dt * 7); push -= p; t = Math.max(0, t + dt + p); if (t >= T) { t = T; paint(); finish(); return; } paint(); };
    last = performance.now(); raf = requestAnimationFrame(tick);
  }).catch(() => finish());
})();
