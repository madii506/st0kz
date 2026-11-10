// st0kz pulse: the whole market at a glance, built only from the live board and the chain index
(() => {
  'use strict';
  const Z = window.Z, { $, esc, usd, big, pct, cls, logo, num, S } = Z;
  const row = (s, v, w, color, right) => `<a class="pl" href="#/s/${s.sym}">${logo(s.icon, s.sym, 22)}<b>${esc(s.sym)}</b><span class="bar"><i data-w="${Math.max(2, Math.min(100, w)).toFixed(1)}"${color ? ` style="background:${color}"` : ''}></i></span><em class="${right ? '' : cls(v)}">${right || pct(v, 1)}</em></a>`;
  const mover = s => `<a class="mv" href="#/s/${s.sym}">${logo(s.icon, s.sym, 26)}<span><b>${esc(s.sym)}</b><small>${esc(s.name)}</small></span>${Z.spark(s.closes)}<span class="mvr"><b>${usd(s.usd, 2)}</b><small class="${cls(s.ch24)}">${pct(s.ch24, 2)}</small></span></a>`;
  const card = (title, sub, body, wide) => `<section class="pc${wide ? ' w' : ''}"><div class="pch"><h3>${title}</h3>${sub ? `<span class="mu2 mono">${sub}</span>` : ''}</div>${body}</section>`;
  Z.views.pulse = { layout: 'wide',
    render() { const B = S.board, C = S.coins ? S.coins.coins : [], T = S.status;
      if (!B) return { view: `<div class="pb"><div class="empty">${Z.wait('board')}</div></div>` };
      const st = B.stocks, by24 = st.filter(s => s.ch24 != null).sort((a, b) => b.ch24 - a.ch24), up = by24.filter(s => s.ch24 > 0).length, dn = by24.filter(s => s.ch24 < 0).length;
      const p30 = st.filter(s => s.perf30 != null).sort((a, b) => b.perf30 - a.perf30), maxP = Math.max(1, ...p30.map(s => Math.abs(s.perf30)));
      const liq = [...st].sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0)).slice(0, 10), maxL = Math.max(1, ...liq.map(s => s.liquidity || 0));
      const vol = [...st].sort((a, b) => (b.vol24 || 0) - (a.vol24 || 0)).slice(0, 10), maxV = Math.max(1, ...vol.map(s => s.vol24 || 0));
      const lanes = {}; C.forEach(c => { const l = lanes[c.stock] || (lanes[c.stock] = { n: 0, mcap: 0, vol: 0 }); l.n++; l.mcap += c.mcap || 0; l.vol += c.vol24 || 0; }); const L = Object.entries(lanes).map(([sym, v]) => ({ ...v, s: Z.stock(sym) || { sym, name: sym } })).sort((a, b) => b.n - a.n || b.mcap - a.mcap).slice(0, 10), maxN = Math.max(1, ...L.map(x => x.n));
      const now = Date.now() / 1000, hours = Array.from({ length: 24 }, (_, i) => C.filter(c => c.at > now - (24 - i) * 3600 && c.at <= now - (23 - i) * 3600).length), maxH = Math.max(1, ...hours), day = hours.reduce((a, b) => a + b, 0);
      const iss = { xStocks: 0, Ondo: 0 }; st.forEach(s => { iss[s.issuer === 'Ondo' ? 'Ondo' : 'xStocks']++; }); const kinds = {}; st.forEach(s => { const k = s.kind === 'stock' ? 'stocks' : 'funds & metals'; kinds[k] = (kinds[k] || 0) + 1; });
      const mc = C.reduce((a, c) => a + (c.mcap || 0), 0), cv = C.reduce((a, c) => a + (c.vol24 || 0), 0), grads = C.filter(c => c.curve != null && c.curve >= 100).length, breadth = up + dn ? up / (up + dn) * 100 : 50;
      const kv = [['SOL', usd(B.sol, 2)], ['stocks on the board', `${st.length} / ${B.size}`], ['coins launched', num(C.length, 0)], ['coins’ market cap', big(mc)], ['coins’ 24h volume', big(cv)], ['graduated', num(grads, 0)], ['payout rounds', T ? num(T.rounds || 0, 0) : '—'], ['ranked by', B.basis === '30d' ? '30 days' : '24 hours']];
      return { view: `<div class="vh"><h2>Pulse</h2><span class="mu2 mono" style="font-size:11.5px">live · from the board and the chain</span></div><div class="pb"><div class="sec" style="border-top:0"><div class="kv" style="grid-template-columns:repeat(4,minmax(0,1fr))">${kv.map(([k, v]) => `<div><span class="lab">${k}</span><b>${v}</b></div>`).join('')}</div></div>
        <div class="pg">
          ${card('Breadth', `${up} up · ${dn} down today`, `<div class="brd"><i style="width:${breadth.toFixed(1)}%"></i></div><div class="brl"><span class="up">${up} rising</span><span class="dn">${dn} falling</span></div>`, true)}
          ${card('Top movers', 'last 24 hours', `<div>${by24.slice(0, 6).map(mover).join('')}</div>`)}
          ${card('Biggest drops', 'last 24 hours', `<div>${by24.slice(-6).reverse().map(mover).join('')}</div>`)}
          ${card('30-day leaders', p30.length + ' of ' + st.length + ' with 30 days of prices', p30.slice(0, 10).map(s => row(s, s.perf30, Math.abs(s.perf30) / maxP * 100, s.perf30 < 0 ? 'var(--dn)' : '')).join('') || '<div class="empty" style="padding:16px">reading 30-day prices…</div>')}
          ${card('30-day laggards', '', p30.slice(-10).reverse().map(s => row(s, s.perf30, Math.abs(s.perf30) / maxP * 100, s.perf30 < 0 ? 'var(--dn)' : '')).join(''))}
          ${card('Deepest liquidity', 'on Solana', liq.map(s => row(s, 0, (s.liquidity || 0) / maxL * 100, '', big(s.liquidity))).join(''))}
          ${card('Most traded', '24h volume', vol.map(s => row(s, 0, (s.vol24 || 0) / maxV * 100, '', big(s.vol24))).join(''))}
          ${card('Busiest lanes', 'stocks with the most coins', L.length ? L.map(x => row(x.s, 0, x.n / maxN * 100, '', `${x.n} · ${big(x.mcap)}`)).join('') : '<div class="empty" style="padding:16px">No coins paired yet. The first launch opens the first lane.<br><a class="btn sm pri" style="margin-top:12px" href="#/launch">Launch a coin</a></div>')}
          ${card('Launches', `${day} in the last 24 hours`, `<div class="hist">${hours.map((h, i) => `<i style="height:${(h / maxH * 100).toFixed(1)}%" title="${h} launch${h === 1 ? '' : 'es'}, ${24 - i}h ago"></i>`).join('')}</div><div class="brl"><span>24h ago</span><span>now</span></div>`)}
          ${card('The board', 'where its stocks come from', `<div class="mix"><div><span class="lab">issuer</span>${Object.entries(iss).filter(([, n]) => n).map(([k, n]) => `<p><b>${n}</b> ${esc(k)}</p>`).join('')}</div><div><span class="lab">kind</span>${Object.entries(kinds).map(([k, n]) => `<p><b>${n}</b> ${esc(k)}</p>`).join('')}</div><div><span class="lab">open seats</span><p><b>${Math.max(0, B.size - st.length)}</b> of ${B.size}</p></div></div>`)}
        </div></div>` }; },
    init() { Z.growBars($('#view')); },
    refresh() { if (Z.view() === 'pulse' && !$('#view .pg')) Z.rerender(); } };
})();
