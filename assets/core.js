// st0kz core: helpers, data, wallet, the terminal shell, the router and the command line
(() => {
  'use strict';
  const Z = window.Z = { views: {} };
  const $ = Z.$ = (s, r = document) => r.querySelector(s), $$ = Z.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = Z.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RM = Z.RM = matchMedia('(prefers-reduced-motion: reduce)').matches, LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  Z.SOL = 'So11111111111111111111111111111111111111112'; Z.JUP = LOCAL ? '/jup' : 'https://lite-api.jup.ag';
  // ---------------------------------------------------------------- formatting
  const num = Z.num = (x, d = 2) => x == null || !isFinite(x) ? '—' : (+x).toLocaleString('en-US', { maximumFractionDigits: d });
  const usd = Z.usd = (x, d) => x == null || !isFinite(x) ? '—' : '$' + (+x).toLocaleString('en-US', { minimumFractionDigits: d ?? (Math.abs(x) >= 1 ? 2 : 4), maximumFractionDigits: d ?? (Math.abs(x) >= 1 ? 2 : 8) });
  const big = Z.big = x => x == null || !isFinite(x) ? '—' : x >= 1e9 ? '$' + (x / 1e9).toFixed(2) + 'B' : x >= 1e6 ? '$' + (x / 1e6).toFixed(2) + 'M' : x >= 1e3 ? '$' + (x / 1e3).toFixed(1) + 'K' : usd(x, x < 10 ? 2 : 0);
  const kf = Z.kf = x => x == null || !isFinite(x) ? '—' : x >= 1e9 ? (x / 1e9).toFixed(2) + 'B' : x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : x >= 1e4 ? (x / 1e3).toFixed(1) + 'K' : num(x, 4);
  const pct = Z.pct = (x, d = 2) => x == null || !isFinite(x) ? '—' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d) + '%', cls = Z.cls = x => x == null ? 'mu' : x < 0 ? 'dn' : 'up';
  const short = Z.short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
  const ago = Z.ago = t => { const s = Date.now() / 1000 - (t > 1e12 ? t / 1000 : t); return s < 60 ? 'now' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd'; };
  const logo = Z.logo = (src, sym, s = 30, sq) => `<span class="lg${sq ? ' sq' : ''}" style="width:${s}px;height:${s}px">${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('${esc(String(sym || '?').slice(0, 4))}'))">` : esc(String(sym || '?').slice(0, 4))}</span>`;
  Z.tsx = sig => `<a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">${short(sig)} ↗</a>`; Z.acc = w => `<a href="https://solscan.io/account/${w}" target="_blank" rel="noopener">${short(w)}</a>`;
  // a small line chart from closes
  Z.spark = c => { if (!c || c.length < 2) return '<svg></svg>'; const lo = Math.min(...c), hi = Math.max(...c), r = hi - lo || 1, up = c[c.length - 1] >= c[0]; return `<svg viewBox="0 0 54 22" preserveAspectRatio="none"><polyline points="${c.map((v, i) => (i / (c.length - 1) * 54).toFixed(1) + ',' + (20 - (v - lo) / r * 18).toFixed(1)).join(' ')}" fill="none" stroke="${up ? '#4ade80' : '#fb7185'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`; };
  Z.heat = p => p == null ? 'transparent' : p >= 0 ? `rgba(52,211,153,${Math.min(.5, .06 + p / 60).toFixed(3)})` : `rgba(251,113,133,${Math.min(.45, .06 + -p / 50).toFixed(3)})`;
  // ---------------------------------------------------------------- api
  async function api(a, qs = '') { const r = await fetch('/api/st0kz?a=' + a + qs); const j = await r.json().catch(() => ({ error: 'bad response' })); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j; }
  async function post(a, b) { const r = await fetch('/api/st0kz?a=' + a, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({ error: 'bad response' })); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j; }
  Z.api = api; Z.post = post;
  const S = Z.S = { status: null, board: null, coins: null, lane: null, sort: 'new', seen: new Set() };
  Z.stock = sym => S.board && S.board.stocks.find(s => s.sym === sym); Z.coin = mint => S.coins && S.coins.coins.find(c => c.mint === mint);
  function toast(m) { const t = $('#toast'); t.innerHTML = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 4200); } Z.toast = toast;
  Z.modal = html => { $('#mcard').innerHTML = html; $('#modal').classList.add('on'); }; Z.closeModal = () => $('#modal').classList.remove('on');
  Z.copy = (text, what) => { const done = () => toast((what || 'Copied') + ' copied'); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => toast(esc(text))); else toast(esc(text)); };
  Z.stat = sel => (m, c = '') => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) { el.className = 'stat ' + c; el.innerHTML = m; } };
  // ---------------------------------------------------------------- wallet
  const WL = Z.WL = { pk: null, p: null, view: null };
  const WALLETS = [['Phantom', () => window.phantom && window.phantom.solana, '#ab9ff2', 'https://phantom.com/download'], ['Solflare', () => window.solflare && window.solflare.isSolflare && window.solflare, '#fc7227', 'https://solflare.com/download'], ['Backpack', () => window.backpack, '#e33e3f', 'https://backpack.app/download']];
  Z.login = () => { Z.modal(`<h3>Log in to st0kz</h3><p>Connect a Solana wallet. It only shares your address. st0kz never asks for a seed phrase or a private key.</p><div class="wl">${WALLETS.map(([n, get, col]) => `<button data-w="${n}"><i style="background:${col}">${n[0]}</i><span>${n}</span><em class="${get() ? 'up' : 'mu2'}">${get() ? 'detected' : 'install ↗'}</em></button>`).join('')}</div>`);
    $('#mcard').onclick = async e => { const b = e.target.closest('[data-w]'); if (!b) return; const w = WALLETS.find(x => x[0] === b.dataset.w), p = w[1](); if (!p) { window.open(w[3], '_blank', 'noopener'); return; } try { const r = await p.connect(); onConnect(((r && r.publicKey) || p.publicKey).toString(), p); Z.closeModal(); } catch (x) { toast('Connection cancelled'); } }; };
  function onConnect(pk, p) { WL.pk = pk; WL.p = p; if (p.on && !p._z) { p._z = 1; p.on('accountChanged', k => k ? onConnect(k.toString(), p) : disconnect()); } paintAcct(); refreshWallet(); Z.rerender(); }
  async function disconnect() { try { await WL.p.disconnect(); } catch (e) { } WL.pk = null; WL.view = null; paintAcct(); Z.rerender(); } Z.disconnect = disconnect;
  async function refreshWallet() { if (!WL.pk) return; try { const v = await api('wallet', '&addr=' + WL.pk); if (v.wallet !== WL.pk) return; WL.view = v; paintAcct(); document.dispatchEvent(new Event('z-wallet')); } catch (e) { } } Z.refreshWallet = refreshWallet;
  let w3 = null; const web3 = () => w3 || (w3 = new Promise((ok, no) => { if (window.solanaWeb3) return ok(window.solanaWeb3); const s = document.createElement('script'); s.src = '/assets/web3.min.js'; s.onload = () => ok(window.solanaWeb3); s.onerror = () => no(new Error('could not load the signer')); document.head.append(s); }));
  const b64 = u => { let s = ''; u.forEach(c => s += String.fromCharCode(c)); return btoa(s); }, unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  // legacy transactions built by the st0kz API; versioned ones built by Jupiter. Both are signed here, in the visitor's wallet
  Z.signSend = async (list, st) => { const W = await web3(); st('check your wallet…'); const txs = list.map(t => W.Transaction.from(unb64(t))); const signed = WL.p.signAllTransactions && txs.length > 1 ? await WL.p.signAllTransactions(txs) : [await WL.p.signTransaction(txs[0])];
    const sigs = []; for (let i = 0; i < signed.length; i++) { st(signed.length > 1 ? `sending ${i + 1} of ${signed.length}…` : 'sending…'); const r = await post('send', { txs: [b64(signed[i].serialize({ requireAllSignatures: false, verifySignatures: false }))] }); sigs.push(r.sigs[0]); } setTimeout(refreshWallet, 1500); return sigs; };
  Z.signSendV = async (swapTx, st) => { const W = await web3(); st('check your wallet…'); const tx = W.VersionedTransaction.deserialize(unb64(swapTx)), s = await WL.p.signTransaction(tx); st('sending…'); const r = await post('send', { txs: [b64(s.serialize())] }); setTimeout(refreshWallet, 1500); return r.sigs[0]; };
  // ---------------------------------------------------------------- the shell
  const NAV = [['feed', 'FEED'], ['board', 'BOARD'], ['launch', 'LAUNCH'], ['me', 'PORTFOLIO'], ['man', 'MANUAL'], ['ops', 'OPS']];
  function shell() { $('#os').innerHTML = `<header class="tb"><a class="brand" href="#/" title="home"><img src="/mark.png" alt=""><b>st0kz</b></a>
      <div class="cmd"><span class="pr">&gt;</span><input id="cmd" placeholder="type a stock, a coin or a command" autocomplete="off" spellcheck="false" aria-label="command line"><kbd>/</kbd><div class="sug" id="sug"></div></div>
      <div class="tb-r"><span class="clock" id="clock"></span><span class="solp" id="solp"></span><span id="acct"></span></div></header>
    <div class="tape" id="tape"><div class="tape-in"></div></div>
    <div class="ws" id="ws"><aside class="pane rail" id="rail"><div class="ph"><b>the board</b><i id="railN"></i></div><div class="pb" id="railB"></div></aside><main class="pane view" id="view"></main><aside class="pane side" id="side"></aside></div>
    <footer class="fk" id="fk">${NAV.map(([k, l], i) => `<a href="#/${k}" data-k="${k}"><kbd>${i + 1}</kbd>${l}</a>`).join('')}<span class="st" id="stl"><i></i><span>connecting…</span></span></footer>`;
    paintAcct(); clock(); setInterval(clock, 1000); cmdInit(); }
  function paintAcct() { const el = $('#acct'); if (!el) return; el.innerHTML = WL.pk ? `<a class="wbtn" href="#/me"><i></i>${WL.view ? '<span class="wsol">' + num(WL.view.sol, 2) + ' SOL · </span>' : ''}${short(WL.pk)}</a>` : `<button class="btn sm pri" id="login">Log in</button>`; const b = $('#login'); if (b) b.onclick = Z.login; }
  function clock() { const el = $('#clock'); if (!el) return; try { el.innerHTML = 'NYC <b>' + new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()) + '</b>'; } catch (e) { } }
  function paintTape() { const B = S.board, el = $('#tape .tape-in'); if (!B || !el) return; const sig = B.stocks.map(s => s.sym + s.usd).join(); if (el.dataset.s === sig) return; el.dataset.s = sig;
    const L = B.stocks.map(s => `<a href="#/s/${s.sym}">${logo(s.icon, s.sym, 18)}<b>${esc(s.sym)}</b><span>${usd(s.usd)}</span><span class="${cls(s.ch24)}">${pct(s.ch24)}</span></a>`).join(''); el.innerHTML = L + L; const sp = $('#solp'); if (sp) sp.innerHTML = 'SOL <b>' + usd(B.sol) + '</b>'; }
  function paintRail() { const B = S.board, el = $('#railB'); if (!el) return; if (!B) { el.innerHTML = `<div class="empty" style="padding:24px 12px">${Z.wait('board')}</div>`; return; } $('#railN').textContent = `${B.stocks.length}/${B.size} · ${B.basis}`; const perf = s => B.basis === '30d' ? s.perf30 : s.ch24;
    el.innerHTML = B.stocks.map(s => `<a class="rk${S.lane === s.sym ? ' on' : ''}" href="#/s/${s.sym}" data-sym="${s.sym}"><i>${String(s.rank).padStart(2, '0')}</i>${logo(s.icon, s.sym, 26)}<span><b>${esc(s.sym)}</b><small>${esc(s.name)}</small></span>${Z.spark(s.closes)}<em class="${cls(perf(s))}">${pct(perf(s), 1)}</em></a>`).join(''); }
  function paintStatus() { const el = $('#stl span'), dot = $('#stl i'); if (!el) return; const T = S.status, B = S.board, err = S.err || S.coinsErr; if (dot) dot.style.background = err ? 'var(--dn)' : ''; el.textContent = err && !B ? 'can’t reach st0kz right now (' + err + ') · retrying' : err ? 'some data is stale (' + err + ') · retrying' : B ? `live · board ranked by ${B.basis === '30d' ? '30-day' : '24-hour'} performance · ${B.stocks.length} stocks · ${S.coins ? S.coins.coins.length : 0} coins${T && !T.payoutsLive ? ' · stock payouts not live yet' : ''}` : 'connecting…'; }
  // ---------------------------------------------------------------- router
  let cur = null, view = 'feed', arg = '';
  function render(force) { const h = location.hash || '#/feed', [path, qstr] = h.slice(2).split('?'), parts = path.split('/'), qs = new URLSearchParams(qstr || ''); let v = parts[0] || 'feed'; if (!Z.views[v]) v = 'feed'; const key = h + '|' + (WL.pk || ''); if (key === cur && !force) return; cur = key; view = v; arg = parts[1] || '';
    const V = Z.views[v], ws = $('#ws'); ws.dataset.l = V.layout || 'std'; const o = V.render(arg, qs) || {}; const vw = $('#view'), sd = $('#side'); vw.innerHTML = o.view || ''; sd.innerHTML = o.side || ''; vw.scrollTop = 0; const pb = $('.pb', vw); if (pb) pb.scrollTop = 0;
    [vw, sd].forEach(e => { e.classList.remove('vin'); void e.offsetWidth; e.classList.add('vin'); }); $$('#fk a').forEach(a => a.classList.toggle('on', a.dataset.k === (V.nav || v))); Z._ws = null; if (V.init) V.init(arg, qs); if (innerWidth <= 900) scrollTo({ top: 0 }); }
  // coins launched in this tab that the chain index hasn't picked up yet
  Z.wait = what => (what === 'board' ? S.err : S.coinsErr) ? `<span class="dn">can’t reach st0kz right now · retrying</span>` : what === 'board' ? 'reading live prices…' : 'reading the chain…';
  Z.pending = m => { try { const P = JSON.parse(sessionStorage.getItem('st0kz-pend') || '{}'), x = P[m]; return x && Date.now() - x.at < 15 * 60e3 ? x : null; } catch (e) { return null; } };
  Z.pend = (m, x) => { try { const P = JSON.parse(sessionStorage.getItem('st0kz-pend') || '{}'); P[m] = Object.assign({ at: Date.now() }, x); sessionStorage.setItem('st0kz-pend', JSON.stringify(P)); } catch (e) { } };
  Z.rerender = () => render(true); Z.go = h => { if (h[0] === '/') { location.href = h; return; } if (location.hash === h) render(true); else location.hash = h; }; Z.view = () => view;
  function refresh() { paintTape(); paintRail(); paintStatus(); const V = Z.views[view]; if (V && V.refresh) V.refresh(arg); }
  addEventListener('hashchange', () => render());
  // one page-scroll hook for the open view (phones scroll the page, desktops scroll the pane)
  Z.winScroll = fn => { Z._ws = fn; }; addEventListener('scroll', () => { if (Z._ws) Z._ws(); }, { passive: true });
  // ---------------------------------------------------------------- command line
  function cmdInit() { const inp = $('#cmd'), sug = $('#sug'); let items = [], at = 0;
    const CMDS = [['feed', 'the launch feed', '#/feed'], ['board', 'the top stocks', '#/board'], ['launch', 'launch a coin', '#/launch'], ['me', 'your portfolio', '#/me'], ['manual', 'how st0kz works', '#/man'], ['ops', 'operator console', '#/ops'], ['home', 'the home window', '#/']];
    const build = q => { q = q.trim().toLowerCase(); if (!q) return []; const out = []; for (const c of CMDS) if (c[0].startsWith(q)) out.push({ k: c[0], d: c[1], h: c[2], t: 'cmd' });
      for (const s of (S.board ? S.board.stocks : [])) if ((s.sym + ' ' + s.name).toLowerCase().includes(q)) out.push({ k: s.sym, d: s.name, h: '#/s/' + s.sym, t: '#' + s.rank, ic: s.icon });
      for (const c of (S.coins ? S.coins.coins : [])) if ((c.symbol + ' ' + c.name + ' ' + c.mint).toLowerCase().includes(q)) out.push({ k: c.symbol, d: c.name, h: '#/c/' + c.mint, t: 'coin · ' + c.stock, ic: c.image });
      return out.slice(0, 8); };
    const paint = () => { sug.innerHTML = items.map((x, i) => `<a href="${x.h}" class="${i === at ? 'on' : ''}">${x.ic ? logo(x.ic, x.k, 20) : '<span class="mono mu2">&gt;</span>'}<b>${esc(x.k)}</b><span class="mu">${esc(x.d)}</span><small>${esc(x.t)}</small></a>`).join(''); sug.classList.toggle('on', !!items.length); };
    inp.oninput = () => { items = build(inp.value); at = 0; paint(); };
    inp.onkeydown = e => { if (e.key === 'ArrowDown') { at = Math.min(items.length - 1, at + 1); paint(); e.preventDefault(); } else if (e.key === 'ArrowUp') { at = Math.max(0, at - 1); paint(); e.preventDefault(); } else if (e.key === 'Enter') { const x = items[at]; if (x) { Z.go(x.h); inp.value = ''; items = []; paint(); inp.blur(); } else if (inp.value.trim()) toast('Nothing matches “' + esc(inp.value.trim()) + '”. Try a stock like NVDA, or: feed, board, launch'); } else if (e.key === 'Escape') { inp.value = ''; items = []; paint(); inp.blur(); } };
    sug.onclick = () => { inp.value = ''; items = []; setTimeout(paint, 0); }; inp.onblur = () => setTimeout(() => sug.classList.remove('on'), 160); inp.onfocus = () => { if (items.length) sug.classList.add('on'); };
    addEventListener('keydown', e => { const typing = /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')); if (e.key === '/' && !typing) { e.preventDefault(); inp.focus(); } else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && /^[1-6]$/.test(e.key)) Z.go('#/' + NAV[+e.key - 1][0]); else if (e.key === 'Escape') Z.closeModal(); }); $('#modal').onclick = e => { if (e.target.id === 'modal') Z.closeModal(); }; }
  // ---------------------------------------------------------------- data + start
  const why = e => /fetch|network|load failed/i.test(e.message || '') ? 'no connection' : (e.message || 'error').slice(0, 60);
  async function loadBoard() { try { S.board = await api('board'); S.err = null; } catch (e) { S.err = why(e); } }
  async function loadCoins() { try { const first = !S.coins; S.coins = await api('coins'); S.fresh = first ? new Set() : new Set(S.coins.coins.filter(c => !S.seen.has(c.mint)).map(c => c.mint)); S.coins.coins.forEach(c => S.seen.add(c.mint)); S.coinsErr = null; } catch (e) { S.coinsErr = why(e); } }
  async function loadStatus() { try { S.status = await api('status'); S.statusErr = null; } catch (e) { S.statusErr = why(e); } }
  Z.reload = async () => { await Promise.all([loadBoard(), loadCoins(), loadStatus()]); refresh(); };
  Z.start = async () => { shell(); render(); await Z.reload(); render(true); setInterval(async () => { await loadCoins(); refresh(); }, 20000); setInterval(async () => { await loadBoard(); refresh(); }, 45000); setInterval(loadStatus, 60000); setInterval(refreshWallet, 15000);
    const ph = window.phantom && window.phantom.solana; if (ph && ph.connect) { try { const r = await ph.connect({ onlyIfTrusted: true }); if (r && r.publicKey) onConnect(r.publicKey.toString(), ph); } catch (e) { } } };
  // the screen switches on, pane by pane (after the intro, or at once when there is none)
  Z.boot = () => { const h = document.documentElement; h.classList.remove('pre'); const os = $('#os'); if (RM) return; os.classList.add('boot'); setTimeout(() => os.classList.remove('boot'), 1500); };
})();
