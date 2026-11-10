// st0kz intro runner: decides whether the floor plays, loads it and its sound, runs the clock, hands over to the terminal.
// It plays once per session on the bare address. Scroll or swipe to walk faster; "skip" in the corner ends it.
(() => {
  'use strict';
  const Z = window.Z, H = document.documentElement, q = new URLSearchParams(location.search), $ = s => document.querySelector(s);
  const force = q.get('intro') === '1' || q.has('t'), off = q.get('intro') === '0', deep = location.hash.replace(/^#\/?/, '') !== '';
  let seen = false; try { seen = sessionStorage.getItem('st0kz-intro') === '1'; } catch (e) { }
  const gl = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();
  if (!(force || (!off && !deep && !seen && !Z.RM)) || !gl) { Z.boot(); return; }

  H.classList.add('intro-on');
  const el = $('#intro'), canvas = $('#ic'), prog = $('#iprog'), flash = $('#iflash'), sb = $('#isnd');
  let done = false, stage = null, sfx = null, muted = false, t = 0, last = 0, raf = 0, frozen = false, T = 15.7, push = 0, slow = 0, frames = 0, scale = 1, hid = false;
  const label = () => { if (!sb) return; sb.textContent = sfx && sfx.running() && !muted ? 'mute' : 'sound on'; };
  // browsers only start sound after a tap or a key, so the first one anywhere turns it on
  const wake = e => { if (!sfx || muted || (e && e.target === sb)) return; sfx.resume().then(label); };
  const finish = () => { if (done) return; done = true; try { sessionStorage.setItem('st0kz-intro', '1'); } catch (e) { } cancelAnimationFrame(raf);
    removeEventListener('wheel', onWheel); removeEventListener('keydown', onKey); removeEventListener('resize', onSize); ['pointerdown', 'keydown', 'touchend'].forEach(k => removeEventListener(k, wake, true)); document.removeEventListener('visibilitychange', onVis);
    if (sfx) { const s = sfx; s.fadeOut(.8); setTimeout(() => s.close(), 1400); }
    if (force && history.replaceState) history.replaceState(null, '', location.pathname + location.hash); Z.boot(); el.classList.add('out');
    setTimeout(() => { H.classList.remove('intro-on'); el.classList.remove('out', 'rdy'); if (stage) { try { stage.dispose(); } catch (e) { } stage = null; } }, 720); };
  const onWheel = e => { push += Math.max(-1.2, Math.min(1.2, e.deltaY * .004)); }, onSize = () => stage && stage.resize();
  const onKey = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') push += .8; else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') push -= .8; };
  const onVis = () => { if (!sfx) return; if (document.hidden) { hid = sfx.running(); if (hid) sfx.ctx.suspend(); } else if (hid && !muted) sfx.resume(); };
  let ty = null; el.addEventListener('touchstart', e => { ty = e.touches[0].clientY; }, { passive: true }); el.addEventListener('touchmove', e => { if (ty == null) return; const y = e.touches[0].clientY; push += (ty - y) * .012; ty = y; }, { passive: true });
  $('#iskip').onclick = finish; addEventListener('wheel', onWheel, { passive: true }); addEventListener('keydown', onKey); addEventListener('resize', onSize); ['pointerdown', 'keydown', 'touchend'].forEach(k => addEventListener(k, wake, true)); document.addEventListener('visibilitychange', onVis);
  if (sb) sb.onclick = () => { if (!sfx) return; if (sfx.running() && !muted) { muted = true; sfx.mute(true); label(); } else { muted = false; sfx.mute(false); sfx.resume().then(label); } };
  const paint = () => { stage.at(t); if (sfx) sfx.update(t); canvas.style.opacity = Math.min(1, t / .7); prog.style.transform = `scaleX(${Math.min(1, t / T)})`; flash.style.opacity = Math.max(0, Math.min(.4, (t - (T - .35)) / .35 * .4)); };

  // on a slow connection, don't keep anyone waiting at the door
  setTimeout(() => { if (!el.classList.contains('rdy')) finish(); }, 9000);
  Promise.all([import('/assets/floor.js?v=3'), q.has('t') ? null : import('/assets/sfx.js?v=2').catch(() => null)]).then(([m, s]) => { if (done) return; const low = innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4 || q.get('low') === '1'; T = m.DURATION;
    stage = m.create(canvas, { low, exact: q.has('t') }); if (s) { try { sfx = s.createSound(m.CUES); } catch (e) { sfx = null; } } return stage.ready.then(() => m); }).then(m => { if (done || !m) return; el.classList.add('rdy');
    if (sfx) { sfx.start(); if (sb) sb.classList.add('on'); label(); sfx.ctx.onstatechange = label; }
    window.__intro = { T, sfx, at: x => { frozen = true; t = x; paint(); }, play: () => { frozen = false; last = performance.now(); } };
    if (q.has('t')) { frozen = true; t = +q.get('t') || 0; paint(); return; }
    const tick = now => { if (done) return; raf = requestAnimationFrame(tick); const dt = Math.min(.05, (now - last) / 1000); last = now; if (frozen) return;
      // a slow machine gets a lighter picture instead of a slow walk
      frames++; if (frames > 12 && frames < 90 && dt > .034) { slow++; if (slow > 16 && scale > .55) { scale *= .75; slow = 0; stage.resize(scale); } }
      const p = push * Math.min(1, dt * 7); push -= p; t = Math.max(0, t + dt + p); if (t >= T) { t = T; paint(); finish(); return; } paint(); };
    last = performance.now(); raf = requestAnimationFrame(tick);
  }).catch(() => finish());
})();
