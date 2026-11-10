// st0kz terminal extras: a watchlist, a live log of what changes on the board and the chain, 30-day stats, a payout calculator, a key map
(() => {
  'use strict';
  const Z = window.Z, { $, $$, esc, usd, big, pct, cls, logo, num, kf, S } = Z;

  // ---------------------------------------------------------------- watchlist (this browser only)
  let W = []; try { W = JSON.parse(localStorage.getItem('st0kz-watch') || '[]'); } catch (e) { W = []; }
  const save = () => { try { localStorage.setItem('st0kz-watch', JSON.stringify(W)); } catch (e) { } };
  Z.watch = { has: k => W.includes(k), list: () => W.slice(), toggle(k) { W = W.includes(k) ? W.filter(x => x !== k) : [k, ...W].slice(0, 40); save(); document.dispatchEvent(new Event('z-watch')); } };
  Z.star = (k, big) => `<button class="star${W.includes(k) ? ' on' : ''}${big ? ' lg' : ''}" data-star="${esc(k)}" type="button" aria-label="watch" title="${W.includes(k) ? 'remove from your watchlist' : 'add to your watchlist'}"><svg viewBox="0 0 24 24"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg></button>`;
  document.addEventListener('click', e => { const b = e.target.closest('[data-star]'); if (!b) return; e.preventDefault(); e.stopPropagation(); const k = b.dataset.star; Z.watch.toggle(k); const on = Z.watch.has(k); $$(`[data-star="${CSS.escape(k)}"]`).forEach(x => { x.classList.toggle('on', on); x.title = on ? 'remove from your watchlist' : 'add to your watchlist'; }); Z.toast(on ? 'Added to your watchlist' : 'Removed from your watchlist'); }, true);

  // ---------------------------------------------------------------- the live log: only what this browser saw change
  const LOG = []; let prev = null, prevCoins = null, prevSol = null, prevMkt = null;
  const hhmm = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
  const add = (kind, html) => { LOG.unshift({ t: hhmm(), kind, html }); if (LOG.length > 80) LOG.pop(); Z.flash && Z.flash(html); document.dispatchEvent(new Event('z-log')); };
  Z.logTick = () => { const B = S.board, C = S.coins;
    if (B && !prev) add('sys', `board loaded · <b>${B.stocks.length}</b> stocks · ranked by ${B.basis === '30d' ? '30 days' : '24 hours'}`);
    if (B && prev && prev.at !== B.at) { const pr = Object.fromEntries(prev.stocks.map(s => [s.sym, s.rank])), now = Object.fromEntries(B.stocks.map(s => [s.sym, s.rank])); let n = 0;
      B.stocks.forEach(s => { if (!(s.sym in pr)) add('in', `<a href="#/s/${s.sym}">${esc(s.sym)}</a> joined the board at <b>#${s.rank}</b>`); else if (pr[s.sym] !== s.rank && n < 5) { n++; add(s.rank < pr[s.sym] ? 'up' : 'dn', `<a href="#/s/${s.sym}">${esc(s.sym)}</a> <b>#${pr[s.sym]} → #${s.rank}</b>`); } });
      prev.stocks.forEach(s => { if (!(s.sym in now)) add('out', `${esc(s.sym)} left the board`); });
      if (B.sol && prevSol && Math.abs(B.sol / prevSol - 1) >= .004) { add(B.sol > prevSol ? 'up' : 'dn', `SOL <b>${usd(prevSol, 2)} → ${usd(B.sol, 2)}</b>`); prevSol = B.sol; } }
    if (B && !prevSol) prevSol = B.sol; if (B) prev = { at: B.at, stocks: B.stocks.map(s => ({ sym: s.sym, rank: s.rank })) };
    if (C && !prevCoins) add('sys', `chain index · <b>${C.coins.length}</b> coin${C.coins.length === 1 ? '' : 's'} launched on st0kz`);
    if (C && prevCoins) { C.coins.forEach(c => { const p = prevCoins[c.mint]; if (!p) add('new', `new coin <a href="#/c/${c.mint}">$${esc(c.symbol)}</a> paired with <b>${esc(c.stock)}</b>`); else for (const m of [25, 50, 75, 100]) if (p.curve < m && c.curve >= m) add('up', `<a href="#/c/${c.mint}">$${esc(c.symbol)}</a> ${m === 100 ? '<b>graduated</b>' : `is <b>${m}%</b> of the way to graduation`}`); if (p && c.rounds > p.rounds) add('new', `payout round for <a href="#/c/${c.mint}">$${esc(c.symbol)}</a> holders, paid in <b>${esc(c.stock)}</b>`); }); }
    if (C) prevCoins = Object.fromEntries(C.coins.map(c => [c.mint, { curve: c.curve || 0, rounds: c.rounds || 0 }]));
    try { const m = Z.market(); if (prevMkt != null && m.open !== prevMkt) add(m.open ? 'up' : 'sys', `NYSE <b>${m.open ? 'opened' : 'closed'}</b>`); prevMkt = m.open; } catch (e) { } };
  Z.logHtml = (n = 40) => LOG.length ? LOG.slice(0, n).map(l => `<div class="lg-l ${l.kind}"><time>${l.t}</time><i></i><span>${l.html}</span></div>`).join('') : '<div class="empty" style="padding:16px">listening…</div>';
  document.addEventListener('z-log', () => { const b = $('#logBox'); if (b) b.innerHTML = Z.logHtml(); });

  // ---------------------------------------------------------------- 30 days, in numbers, from the daily closes
  Z.statsHtml = s => { const c = (s.closes || []).filter(x => x > 0); if (c.length < 5) return ''; const r = c.slice(1).map((v, i) => v / c[i] - 1), hi = Math.max(...c), lo = Math.min(...c), last = c[c.length - 1], mean = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length), best = Math.max(...r), worst = Math.min(...r), ups = r.filter(x => x > 0).length;
    const cell = (k, v, c2) => `<div><span class="lab">${k}</span><b class="${c2 || ''}">${v}</b></div>`;
    return `<div class="sec"><h3>${c.length - 1} days in numbers</h3><div class="kv" style="grid-template-columns:repeat(4,minmax(0,1fr))">${cell('high', usd(hi, 2))}${cell('low', usd(lo, 2))}${cell('from the high', pct((last / hi - 1) * 100, 1), cls(last / hi - 1))}${cell('from the low', pct((last / lo - 1) * 100, 1), cls(last / lo - 1))}${cell('daily swing', (sd * 100).toFixed(2) + '%')}${cell('best day', pct(best * 100, 2), 'up')}${cell('worst day', pct(worst * 100, 2), 'dn')}${cell('up days', `${ups} of ${r.length}`)}</div></div>`; };

  // ---------------------------------------------------------------- payout calculator: what 1% of curve volume buys in the paired stock
  const STEPS = [1e3, 5e3, 1e4, 5e4, 1e5, 2.5e5, 5e5, 1e6];
  Z.calcHtml = (st, coinSym) => { if (!st || !st.usd) return ''; const fee = (S.status && S.status.feePct) || 1;
    return `<div class="sec calc" data-sym="${esc(st.sym)}"><h3>Payout math <span class="mu2 mono" style="font-size:11px;font-weight:500">at today’s ${esc(st.sym)} price</span></h3>
      <div class="calc-r"><span class="lab">curve volume</span><input type="range" min="0" max="${STEPS.length - 1}" step="1" value="2" id="clV" aria-label="curve volume"><b id="clVv"></b></div>
      <div class="calc-r"><span class="lab">${coinSym ? 'your share of $' + esc(coinSym) : 'your share of a coin'}</span><input type="range" min="0" max="5" step="1" value="1" id="clS" aria-label="your share"><b id="clSv"></b></div>
      <div class="calc-o"><div><span class="lab">${fee}% fee</span><b id="clF"></b></div><div><span class="lab">buys</span><b id="clB"></b></div><div><span class="lab">your payout</span><b id="clY" class="up"></b></div></div>
      <p class="mu2" style="margin:10px 0 0;font-size:11.5px">Only coins on the st0kz launchpad pay this, while they trade on their curve. Holders are paid pro rata; pools and vaults are left out.</p></div>`; };
  const SHARES = [.1, 1, 2, 5, 10, 25];
  Z.calcInit = () => { const root = $('.calc'); if (!root) return; const st = Z.stock(root.dataset.sym); if (!st) return; const fee = ((S.status && S.status.feePct) || 1) / 100;
    const upd = () => { const v = STEPS[+$('#clV').value], sh = SHARES[+$('#clS').value] / 100, f = v * fee, n = f / st.usd; $('#clVv').textContent = big(v); $('#clSv').textContent = SHARES[+$('#clS').value] + '%'; $('#clF').textContent = usd(f, 2); $('#clB').textContent = `${kf(n)} ${st.sym}`; $('#clY').textContent = `${n * sh >= .01 ? kf(n * sh) : (n * sh).toPrecision(2)} ${st.sym} · ${usd(f * sh, 2)}`; };
    $('#clV').oninput = upd; $('#clS').oninput = upd; upd(); };

  // ---------------------------------------------------------------- the key map
  Z.keys = () => Z.modal(`<h3>Keys</h3><div class="keys">${[['1 – 7', 'feed, pulse, board, launch, portfolio, manual, ops'], ['/', 'the command line'], ['↑ ↓ Enter', 'pick from the command line'], ['launch NVDA', 'type it to launch a coin on a stock'], ['?', 'this list'], ['Esc', 'close']].map(([k, d]) => `<div><kbd>${esc(k)}</kbd><span>${esc(d)}</span></div>`).join('')}</div><button class="btn wide" style="margin-top:14px" onclick="Z.closeModal()">Close</button>`);
  addEventListener('keydown', e => { if (e.key === '?' && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) { e.preventDefault(); Z.keys(); } });
})();
