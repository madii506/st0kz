// st0kz API: launch a coin on Raydium LaunchLab, paired with one stock from the board (the best-performing tokenized stocks, 64 at most).
// GET  a=status · a=board · a=coins · a=coin&mint= · a=wallet&addr= · a=pad&admin= · a=rounds · a=holders&mint= · a=candles&mint=
// POST a=img · a=buildLaunch · a=buildPad · a=claim · a=buildPayout · a=send      (every transaction is signed in the visitor's own wallet)
const { Connection, PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction } = require('@solana/web3.js');
const SPL = require('@solana/spl-token');
const BN = require('bn.js');
const R = require('@raydium-io/raydium-sdk-v2');
const crypto = require('crypto');
const CFG = require('./st0kz-config.json');

// ---------------------------------------------------------------- plumbing
const RPCS = [process.env.RPC_URL, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean);
async function rpcFetch(url, opts) { let last = null; for (let round = 0; round < 2; round++) { for (const u of RPCS) { try { const r = await fetch(u, { ...opts, signal: AbortSignal.timeout(12000) }); if (r.status === 429 || r.status === 401 || r.status === 403 || r.status >= 500) { last = r; continue; } return r; } catch (e) { last = e; } } await new Promise(r => setTimeout(r, 700)); } if (last instanceof Error) throw last; return last; }
const conn = new Connection(RPCS[0], { commitment: 'confirmed', fetch: rpcFetch, disableRetryOnRateLimit: true });

const SOL = 'So11111111111111111111111111111111111111112', WSOL = new PublicKey(SOL);
const PROGRAM = R.LAUNCHPAD_PROGRAM, RAYDIUM_PLATFORM = R.LAUNCHPAD_PLATFORM, CONFIG = R.getPdaLaunchpadConfigId(PROGRAM, WSOL, 0, 0).publicKey;
const TAG = new PublicKey(process.env.ST0KZ_TAG || CFG.tag);               // every st0kz launch and payout sends 0 SOL here with a memo, so the chain is the index
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const PIN = { pad: process.env.ST0KZ_PAD || CFG.pad || null };               // the st0kz launchpad (a LaunchLab platform config). Until it exists, coins launch on Raydium's own platform
const SUPPLY = new BN('1000000000000000'), PPM = 1e6, RUN = +CFG.run || 7, THIN = +CFG.minLiquidityUsd || 5000, BOARD = Math.min(64, +CFG.boardSize || 64);
const JUP = 'https://lite-api.jup.ag', HISTORY_API = 'https://launch-history-v1.raydium.io', PFX = 'st0kz/';

const out = (res, code, b, cache) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', cache || 'no-store'); res.end(JSON.stringify(b)); };
const body = req => new Promise(ok => { if (req.body) return ok(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); let d = ''; req.on('data', c => d += c); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const pk = (s, what) => { try { return new PublicKey(String(s)); } catch { throw new Error(what || 'bad address'); } };
const link = (s, re, what, eg) => { s = clean(s, 200); if (!s) return ''; if (!/^https:\/\/\S+$/.test(s)) throw new Error(`the ${what} must be a https:// link`); if (re && !re.test(s)) throw new Error(`the ${what} must start with ${eg}`); return s; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJ(url, ms = 8000) { const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(r.status + ' ' + url.split('/')[2]); return r.json(); }
const cache = new Map();
async function memo(key, ttl, fn) { const c = cache.get(key); if (c && Date.now() - c.t < ttl) return c.v; if (c && c.p) return c.p; const p = fn().then(v => { cache.set(key, { t: Date.now(), v }); return v; }, e => { if (c) cache.set(key, c); else cache.delete(key); throw e; }); cache.set(key, { ...(c || { t: 0 }), p }); return p; }
const memoIx = text => new TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from(text) });
const tagIx = from => SystemProgram.transfer({ fromPubkey: from, toPubkey: TAG, lamports: 0 });
const padIdOf = admin => R.getPdaPlatformId(PROGRAM, admin).publicKey, vaultOf = id => R.getPdaPlatformVault(PROGRAM, id, WSOL).publicKey;
const str = b => Buffer.from(b).toString('utf8').replace(/\0/g, '').trim(), pct = n => +(+n.toString() / PPM * 100).toFixed(4);

// write-once files (images, metadata, coin cards) and one small overwritten file (the performance sheet)
const blob = () => require('@vercel/blob');
const hasStore = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const blobBase = () => { const id = (process.env.BLOB_STORE_ID || '').replace(/^store_/, '') || String(process.env.BLOB_READ_WRITE_TOKEN || '').split('_')[3] || ''; return id ? `https://${id.toLowerCase()}.public.blob.vercel-storage.com/` : null; };
async function putFile(path, data, type, over) { if (!hasStore()) throw new Error('storage is not switched on yet');
  try { return (await blob().put(PFX + path, data, { access: 'public', addRandomSuffix: false, allowOverwrite: !!over, contentType: type, cacheControlMaxAge: over ? 60 : 31536000 })).url; }
  catch (e) { if (!over && /exist/i.test(e.message || '')) { const h = await blob().head(PFX + path).catch(() => null); if (h) return h.url; } throw e; } }
async function readFile(path, fresh) { const b = blobBase(); if (!b) return null; try { const r = await fetch(b + PFX + path + (fresh ? '?t=' + Date.now() : ''), { signal: AbortSignal.timeout(6000) }); return r.ok ? await r.json() : null; } catch { return null; } }

// ---------------------------------------------------------------- prices
let STOCKS = CFG.stocks.slice(); const BY_SYM = Object.fromEntries(STOCKS.map(s => [s.sym, s])), BY_MINT = Object.fromEntries(STOCKS.map(s => [s.mint, s]));
const logoOf = s => s.icon || `https://xstocks-metadata.backed.fi/logos/tokens/${s.tok}.png`;
const FUNDS = new Set(['SPY', 'QQQ', 'GLD', 'SLV', 'USO', 'TQQQ', 'SQQQ', 'VTI', 'VOO', 'IWM', 'DIA', 'COPX', 'IJR', 'SMH', 'SOXL', 'XOP', 'QYLD', 'EWY', 'TLT', 'IAU', 'GDX', 'URA', 'EEM', 'ARKK', 'IBIT', 'SCHD', 'JEPI', 'XLK', 'XLF', 'XLE']);
// every tokenized stock Jupiter lists as verified (xStocks and Ondo), one per company: the most liquid one wins
const universe = () => memo('uni', 15 * 60e3, async () => { const L = await getJ('https://lite-api.jup.ag/tokens/v2/tag?query=verified', 15000), best = {};
  for (const t of Array.isArray(L) ? L : []) { const m = /^(.*?)\s*\(?\s*(xStock|Ondo Tokenized)\s*\)?$/i.exec(String(t.name || '').trim()); if (!m || !t.id) continue; const cm = CFG.stocks.find(c => c.mint === t.id), sym = cm ? cm.sym : String(t.symbol || '').replace(/(x|on|ON)$/, '').toUpperCase(); if (!/^[A-Z0-9.]{1,8}$/.test(sym)) continue;
    const e = { sym, name: m[1].trim(), mint: t.id, tok: t.symbol, kind: FUNDS.has(sym) ? 'fund' : 'stock', icon: t.icon || null, issuer: /ondo/i.test(m[2]) ? 'Ondo' : 'xStocks', liq: t.liquidity || 0 };
    if (!BY_MINT[t.id]) BY_MINT[t.id] = e; else { BY_MINT[t.id].icon = BY_MINT[t.id].icon || e.icon; BY_MINT[t.id].liq = e.liq; } if (!best[sym] || e.liq > best[sym].liq) best[sym] = e; }
  if (!Object.keys(best).length) throw new Error('no tokenized stocks listed');
  const seen = new Set(); for (const sym in best) { const e = best[sym], cfg = CFG.stocks.find(c => c.sym === sym); if (seen.has(e.mint)) { delete BY_SYM[sym]; continue; } seen.add(e.mint); BY_SYM[sym] = Object.assign({}, e, cfg && { name: cfg.name, kind: cfg.kind }); }
  for (const sym in BY_SYM) if (!best[sym] && seen.has(BY_SYM[sym].mint)) delete BY_SYM[sym];
  STOCKS = Object.values(BY_SYM); return STOCKS; });
async function jupInfo(mints) { const o = {}, L = [...new Set(mints)].filter(Boolean);
  for (let i = 0; i < L.length; i += 90) { try { const j = await getJ(`${JUP}/tokens/v2/search?query=${L.slice(i, i + 90).join(',')}`);
    for (const t of j || []) { const s = t.stats24h || {}; o[t.id] = { symbol: t.symbol, name: t.name, icon: t.icon || null, decimals: t.decimals, usd: t.usdPrice ?? null, ch24: s.priceChange ?? null, mcap: t.mcap ?? t.fdv ?? null, liquidity: t.liquidity ?? null, holders: t.holderCount ?? null, vol24: (s.buyVolume || 0) + (s.sellVolume || 0), traders24: s.numTraders ?? null, curve: t.bondingCurve ?? null, created: t.createdAt || null, program: t.tokenProgram || null }; } } catch { } }
  return o; }
const solUsd = () => memo('sol', 30000, async () => ((await jupInfo([SOL]))[SOL] || {}).usd || null);

// ---------------------------------------------------------------- the board: tokenized stocks that really trade, ranked by their last 30 days
// 30-day performance comes from daily candles (GeckoTerminal). The sheet is refreshed a few stocks per request and kept in a small file, so a cold start has it at once.
let PERF = null, perfSavedAt = 0;
async function perfSheet() { if (!PERF) PERF = (await readFile('perf.json', true)) || {}; return PERF; }
async function refreshPerf(liquid) { const P = await perfSheet(), now = Date.now(), stale = liquid.filter(s => !P[s.mint] || now - P[s.mint].at > 8 * 3600e3).slice(0, 8); if (!stale.length) return;
  let pairs = {}; try { const d = await getJ(`https://api.dexscreener.com/tokens/v1/solana/${stale.map(s => s.mint).join(',')}`, 6000); for (const p of Array.isArray(d) ? d : []) { const m = p.baseToken && p.baseToken.address; if (!BY_MINT[m]) continue; const liq = (p.liquidity || {}).usd || 0; if (!pairs[m] || liq > pairs[m].liq) pairs[m] = { addr: p.pairAddress, liq }; } } catch { }
  await Promise.all(stale.map(async s => { const pr = pairs[s.mint]; if (!pr) { P[s.mint] = { at: now, perf30: null, closes: [] }; return; }
    try { const g = await getJ(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pr.addr}/ohlcv/day?aggregate=1&limit=31&currency=usd&token=${s.mint}`, 7000);
      const rows = ((g.data && g.data.attributes && g.data.attributes.ohlcv_list) || []).map(x => ({ t: x[0], c: +x[4] })).filter(r => r.c > 0).sort((a, b) => a.t - b.t);
      if (rows.length < 8) { P[s.mint] = { at: now, perf30: null, closes: rows.map(r => r.c) }; return; }
      P[s.mint] = { at: now, perf30: (rows[rows.length - 1].c / rows[0].c - 1) * 100, days: rows.length - 1, closes: rows.map(r => +r.c.toPrecision(6)) }; } catch { /* rate limited: try again on a later request */ } }));
  if (hasStore() && now - perfSavedAt > 60000) { perfSavedAt = now; putFile('perf.json', JSON.stringify(P), 'application/json', true).catch(() => { }); } }
async function board() { return memo('board', 45000, async () => { await universe().catch(() => null); const cand = STOCKS.filter(s => s.liq == null || s.liq >= THIN / 3).sort((a, b) => (b.liq || 0) - (a.liq || 0)).slice(0, 160), J = await jupInfo([SOL, ...cand.map(s => s.mint)]);
  const all = cand.map(s => { const j = J[s.mint] || {}; return { sym: s.sym, name: s.name, mint: s.mint, tok: s.tok, kind: s.kind, icon: logoOf(s), usd: j.usd ?? null, ch24: j.ch24 ?? null, liquidity: j.liquidity ?? null, mcap: j.mcap ?? null, holders: j.holders ?? null, vol24: j.vol24 ?? null, decimals: j.decimals ?? 8 }; });
  const liquid = all.filter(s => s.usd && (s.liquidity || 0) >= THIN); await refreshPerf(liquid).catch(() => { }); const P = await perfSheet();
  for (const s of liquid) { const p = P[s.mint]; s.perf30 = p && p.perf30 != null ? p.perf30 : null; s.days = p && p.days || null; s.closes = (p && p.closes) || []; }
  const have30 = liquid.filter(s => s.perf30 != null).length, basis = have30 >= Math.min(8, liquid.length) ? '30d' : '24h', score = s => basis === '30d' ? (s.perf30 ?? -1e9) : (s.ch24 ?? -1e9);
  const ranked = [...liquid].sort((a, b) => score(b) - score(a)).slice(0, BOARD).map((s, i) => ({ ...s, rank: i + 1 }));
  return { at: Date.now(), basis, size: BOARD, sol: (J[SOL] || {}).usd || null, stocks: ranked, waiting: all.filter(s => !ranked.find(r => r.mint === s.mint)).slice(0, 40).map(s => ({ sym: s.sym, name: s.name, icon: s.icon, why: s.usd && (s.liquidity || 0) >= THIN ? 'outside the top ' + BOARD : 'too thin to price' })) }; }); }

// ---------------------------------------------------------------- the chain index: launches and payout rounds, read from the tag address
async function scan() { return memo('scan', 20000, async () => { await universe().catch(() => null); const sigs = (await conn.getSignaturesForAddress(TAG, { limit: 300 })).filter(s => !s.err), launches = [], rounds = [];
  for (let i = 0; i < sigs.length; i += 25) { const txs = await conn.getParsedTransactions(sigs.slice(i, i + 25).map(s => s.signature), { maxSupportedTransactionVersion: 0 }).catch(() => []);
    txs.forEach((t, k) => { if (!t || !t.meta || t.meta.err) return; const by = t.transaction.message.accountKeys[0].pubkey.toBase58(), sig = sigs[i + k].signature, at = t.blockTime;
      for (const ix of t.transaction.message.instructions) { if (ix.program !== 'spl-memo' || typeof ix.parsed !== 'string') continue;
        let m = /^st0kz:launch:([1-9A-HJ-NP-Za-km-z]{32,44}):([A-Z0-9.]{1,8})$/.exec(ix.parsed); if (m && BY_SYM[m[2]]) launches.push({ mint: m[1], stock: m[2], creator: by, sig, at });
        m = /^st0kz:payout:([1-9A-HJ-NP-Za-km-z]{32,44}):([1-9A-HJ-NP-Za-km-z]{32,44}):(\d{1,3}):(\d{1,24})$/.exec(ix.parsed); if (m) rounds.push({ coin: m[1], stockMint: m[2], wallets: +m[3], raw: m[4], by, sig, at }); } }); }
  const seen = new Set(); return { launches: launches.filter(l => !seen.has(l.mint) && seen.add(l.mint)), rounds }; }); }
// a coin counts when its launch memo is on-chain AND st0kz built that launch for the same wallet (the card file is written once, at build time)
async function coins() { return memo('coins', 20000, async () => { const [S, B] = await Promise.all([scan(), board().catch(() => null)]); const cards = await Promise.all(S.launches.slice(0, 120).map(l => memo('card:' + l.mint, 3600e3, () => readFile('coin/' + l.mint + '.json'))));
  const ok = S.launches.slice(0, 120).map((l, i) => ({ l, c: cards[i] })).filter(x => x.c && x.c.creator === x.l.creator && x.c.stock === x.l.stock);
  const J = await jupInfo(ok.map(x => x.l.mint)), su = B && B.sol, stockBy = Object.fromEntries(((B && B.stocks) || []).map(s => [s.sym, s]));
  const paid = {}; for (const r of S.rounds) paid[r.coin] = (paid[r.coin] || 0) + 1;
  return { at: Date.now(), pad: PIN.pad, coins: ok.map(({ l, c }) => { const j = J[l.mint] || {}, st = stockBy[l.stock] || BY_SYM[l.stock] || {};
    return { mint: l.mint, pool: c.pool, name: j.name || c.name, symbol: j.symbol || c.symbol, image: c.image, desc: c.desc || '', links: c.links || {}, creator: l.creator, at: l.at, sig: l.sig, stock: l.stock, stockIcon: st.icon || (BY_SYM[l.stock] ? logoOf(BY_SYM[l.stock]) : null), stockRank: st.rank || null,
      openUsd: c.openUsd, gradUsd: c.gradUsd, raiseSol: c.raiseSol, usd: j.usd ?? null, mcap: j.mcap ?? null, ch24: j.ch24 ?? null, vol24: j.vol24 ?? null, holders: j.holders ?? null, liquidity: j.liquidity ?? null, curve: j.curve ?? (j.mcap && c.gradUsd ? Math.max(0, Math.min(100, (j.mcap - c.openUsd) / (c.gradUsd - c.openUsd) * 100)) : null), onPad: !!c.pad, rounds: paid[l.mint] || 0 }; }) }; }); }
async function candles(mint) { const c = (await coins()).coins.find(x => x.mint === mint); if (!c) throw new Error('not a st0kz coin');
  return memo('k:' + mint, 30000, async () => { let rows = []; try { const j = await getJ(`${HISTORY_API}/kline?poolId=${c.pool}&interval=15m&limit=300`); rows = ((j && j.data && j.data.rows) || []).map(r => ({ t: r.t, o: +r.o, h: +r.h, l: +r.l, c: +r.c })).sort((a, b) => a.t - b.t); } catch { } return { mint, rows, unit: 'SOL per coin', interval: '15m' }; }); }
async function coin(mint) { const C = await coins(), c = C.coins.find(x => x.mint === mint); if (!c) throw new Error('not a st0kz coin');
  const [B, S] = await Promise.all([board(), scan()]); const st = B.stocks.find(s => s.sym === c.stock) || null;
  return { coin: c, stock: st || { sym: c.stock, name: (BY_SYM[c.stock] || {}).name, icon: c.stockIcon, off: true }, stockMint: (BY_SYM[c.stock] || {}).mint, rounds: S.rounds.filter(r => r.coin === mint).slice(0, 30), feePct: CFG.feePct, payoutsLive: !!PIN.pad && c.onPad, sol: B.sol }; }

// ---------------------------------------------------------------- wallets and holders
async function walletView(addr) { const w = pk(addr, 'bad wallet'); await universe().catch(() => null); const [lam, a, b] = await Promise.all([conn.getBalance(w), conn.getParsedTokenAccountsByOwner(w, { programId: SPL.TOKEN_PROGRAM_ID }), conn.getParsedTokenAccountsByOwner(w, { programId: SPL.TOKEN_2022_PROGRAM_ID })]);
  const held = {}; for (const x of [...a.value, ...b.value]) { const i = x.account.data.parsed.info, ui = +i.tokenAmount.uiAmountString; if (ui > 0) held[i.mint] = (held[i.mint] || 0) + ui; }
  const mints = Object.keys(held).slice(0, 180), [J, C, su] = await Promise.all([jupInfo(mints), coins().catch(() => ({ coins: [] })), solUsd()]); const mine = Object.fromEntries(C.coins.map(c => [c.mint, c]));
  const tokens = mints.map(m => { const j = J[m] || {}, st = BY_MINT[m], c = mine[m]; return { mint: m, amount: held[m], symbol: st ? st.sym : (j.symbol || m.slice(0, 4)), name: st ? st.name : (j.name || ''), icon: st ? logoOf(st) : (c ? c.image : j.icon || null), price: j.usd ?? null, usd: j.usd != null ? held[m] * j.usd : null, kind: st ? 'stock' : c ? 'st0kz' : 'coin', stock: c ? c.stock : null }; }).sort((x, y) => (y.usd || 0) - (x.usd || 0));
  return { wallet: w.toBase58(), sol: lam / 1e9, solUsd: su ? lam / 1e9 * su : null, totalUsd: (su ? lam / 1e9 * su : 0) + tokens.reduce((s, t) => s + (t.usd || 0), 0), tokens, launched: C.coins.filter(c => c.creator === w.toBase58()).map(c => c.mint) }; }
async function holdersOf(mintStr) { const mint = pk(mintStr, 'bad mint'), acc = await conn.getAccountInfo(mint); if (!acc) throw new Error('mint not found'); const prog = acc.owner; let rows = [], full = true;
  try { const r = await conn.getParsedProgramAccounts(prog, { filters: [...(prog.equals(SPL.TOKEN_PROGRAM_ID) ? [{ dataSize: 165 }] : []), { memcmp: { offset: 0, bytes: mint.toBase58() } }] }); rows = r.map(x => ({ owner: x.account.data.parsed.info.owner, raw: BigInt(x.account.data.parsed.info.tokenAmount.amount) })); }
  catch (e) { full = false; let top; try { top = await conn.getTokenLargestAccounts(mint); } catch { throw new Error('the public Solana RPC is rate-limiting holder lists right now. try again in a minute'); } const infos = await conn.getMultipleParsedAccounts(top.value.map(x => x.address)); rows = infos.value.map((x, i) => x ? { owner: x.data.parsed.info.owner, raw: BigInt(top.value[i].amount) } : null).filter(Boolean); }
  const by = {}; for (const r of rows) { if (r.raw <= 0n) continue; let on = false; try { on = PublicKey.isOnCurve(new PublicKey(r.owner).toBytes()); } catch { } if (!on) continue; by[r.owner] = (by[r.owner] || 0n) + r.raw; }   // off-curve owners are pools and vaults
  return { full, list: Object.entries(by).map(([owner, raw]) => ({ owner, raw })).sort((a, b) => (b.raw > a.raw ? 1 : -1)) }; }

// ---------------------------------------------------------------- LaunchLab: the curve, a launch, the launchpad, its fees
let chainCache = null;
async function chain() { if (chainCache && Date.now() - chainCache.t < 120000) return chainCache.v; const [ca, pa] = await conn.getMultipleAccountsInfo([CONFIG, RAYDIUM_PLATFORM]); if (!ca) throw new Error('could not read LaunchLab');
  const v = { cfg: R.LaunchpadConfig.decode(ca.data), ray: pa ? R.PlatformConfig.decode(pa.data) : null }; chainCache = { t: Date.now(), v }; return v; }
// LaunchLab's constant-product curve with the graduation price equal to the pool's opening price:
//   run = graduation / start,  sold share = sqrt(run) / (1 + sqrt(run)),  SOL raised = graduation x (1 - sold share)
function curveOf(startSol, run) { const q = Math.sqrt(run), sold = q / (1 + q), gradSol = startSol * run; return { run, sold, raise: gradSol * (1 - sold), startSol, gradSol }; }
async function sdk(owner) { const r = await R.Raydium.load({ connection: conn, owner, cluster: 'mainnet', disableLoadToken: true, disableFeatureCheck: true, blockhashCommitment: 'confirmed' }); if (module.exports._t.onLoad) module.exports._t.onLoad(r); return r; }
const fits = t => { try { return t.serialize({ requireAllSignatures: false, verifySignatures: false }).length <= 1232; } catch { return false; } };
const txsOf = m => m.transactions ? m.transactions : [{ instructions: m.transaction && m.transaction.instructions && m.transaction.instructions.length ? m.transaction.instructions : m.builder.allInstructions }];
async function finish(txs, wallet, signers, extra, simulate) { const { blockhash } = await conn.getLatestBlockhash('confirmed');
  const mk = ixs => { const t = new Transaction(); t.add(...ixs); t.feePayer = wallet; t.recentBlockhash = blockhash; const need = signers.filter(s => t.instructions.some(ix => ix.keys.some(k => k.isSigner && k.pubkey.equals(s.publicKey)))); if (need.length) t.partialSign(...need); return t; };
  let list = txs.map((tx, i) => mk(i === 0 && extra ? [...tx.instructions, ...extra] : tx.instructions)); if (extra && !fits(list[0])) { list = txs.map(tx => mk(tx.instructions)); list.push(mk(extra)); }
  let sim = null; if (simulate) { const r = await conn.simulateTransaction(list[0]); sim = { err: r.value.err, units: r.value.unitsConsumed, logs: (r.value.logs || []).slice(-12) }; }
  return { txs: list.map(t => Buffer.from(t.serialize({ requireAllSignatures: false, verifySignatures: false })).toString('base64')), sim }; }

async function img(req) { const b = await body(req); const m = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data || '')); if (!m) throw new Error('pick a png, jpg, webp or gif image');
  const buf = Buffer.from(m[3], 'base64'); if (buf.length > 1.5e6) throw new Error('that image is too big (1.5 MB max)'); if (buf.length < 100) throw new Error('that image is empty');
  return { url: await putFile(`img/${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 24)}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`, buf, m[1]) }; }

async function buildLaunch(req) { const b = await body(req), wallet = pk(b.wallet, 'connect a wallet first');
  const name = clean(b.name, 32), symbol = clean(b.symbol, 10).toUpperCase().replace(/[^A-Z0-9]/g, ''), desc = clean(b.desc, 400);
  if (name.length < 2) throw new Error('give the coin a name'); if (symbol.length < 2) throw new Error('give the coin a ticker (2 to 10 letters or numbers)');
  const image = link(b.image, null, 'image'); if (!image) throw new Error('add an image');
  const links = { website: link(b.website, null, 'website'), x: link(b.x, /^https:\/\/(x|twitter)\.com\//, 'X link', 'https://x.com/'), telegram: link(b.telegram, /^https:\/\/t\.me\//, 'Telegram link', 'https://t.me/') };
  // one stock per coin, and only a stock that is on the board right now
  const B = await board(), stock = B.stocks.find(s => s.sym === String(b.stock || '').toUpperCase()); if (!stock) throw new Error(`pick one stock from the board (the top ${B.size})`);
  const openUsd = +b.openUsd || CFG.openDefault; if (!CFG.openUsd.includes(openUsd)) throw new Error('the open is $8K, $9K, $10K or $11K'); if (!(B.sol > 0)) throw new Error('could not read the SOL price. try again in a moment');
  const { cfg } = await chain(), c = curveOf(openUsd / B.sol, RUN), minRaise = +cfg.minFundRaisingB.toString() / 1e9, minSold = +cfg.minSellRateA.toString() / PPM, maxSold = 1 - +cfg.minMigrateRateA.toString() / PPM;
  if (c.raise < minRaise) throw new Error(`LaunchLab's minimum raise is ${minRaise} SOL; this curve raises ${c.raise.toFixed(1)}`); if (c.sold < minSold || c.sold > maxSold) throw new Error('that curve sells too little or too much of the supply');
  const sell = new BN(String(Math.floor(c.sold * 1e9) * 1e6)), raise = new BN(String(Math.round(c.raise * 1e9)));
  const buySol = Math.max(0, +b.buySol || 0); if (buySol > Math.min(CFG.maxFirstBuySol, c.raise / 2)) throw new Error(`the first buy can be up to ${Math.min(CFG.maxFirstBuySol, c.raise / 2).toFixed(1)} SOL`);
  const bal = await conn.getBalance(wallet).catch(() => null); if (bal != null && bal < (buySol + 0.03) * 1e9) throw new Error(`your wallet needs about ${(buySol + 0.03).toFixed(2)} SOL for this launch`);
  let padId = RAYDIUM_PLATFORM; if (PIN.pad) { padId = pk(PIN.pad, 'bad launchpad'); const pa = await conn.getAccountInfo(padId); if (!pa || !pa.owner.equals(PROGRAM)) throw new Error('the st0kz launchpad could not be read'); }
  // the metadata every wallet and explorer reads: written once, with the stock in it
  const meta = { name, symbol, description: (desc ? desc + ' ' : '') + `Paired with ${stock.sym} (${stock.name}) on st0kz.`, image, stock: stock.sym, stockMint: stock.mint, ...(links.website && { website: links.website }), ...(links.x && { twitter: links.x }), ...(links.telegram && { telegram: links.telegram }), createdOn: 'st0kz' };
  const js = JSON.stringify(meta), uri = await putFile(`meta/${crypto.createHash('sha256').update(js).digest('hex').slice(0, 24)}.json`, js, 'application/json'); if (uri.length > 200) throw new Error('metadata link too long');
  const mint = Keypair.generate(), raydium = await sdk(wallet);
  const { transactions, extInfo } = await raydium.launchpad.createLaunchpad({ programId: PROGRAM, mintA: mint.publicKey, decimals: 6, name, symbol, uri, migrateType: 'cpmm', configId: CONFIG, configInfo: cfg, mintBDecimals: 9, platformId: padId,
    txVersion: R.TxVersion.LEGACY, slippage: new BN(100), buyAmount: new BN(Math.round(buySol * 1e9)), createOnly: buySol === 0, supply: SUPPLY, totalSellA: sell, totalFundRaisingB: raise, totalLockedAmount: new BN(0), cliffPeriod: new BN(0), unlockPeriod: new BN(0),
    extraSigners: [mint], feePayer: wallet, computeBudgetConfig: { units: 600000, microLamports: 60000 } });
  const r = await finish(transactions, wallet, [mint], [memoIx(`st0kz:launch:${mint.publicKey.toBase58()}:${stock.sym}`), tagIx(wallet)], !!b.simulate);
  const pool = (extInfo && extInfo.address && extInfo.address.poolId && extInfo.address.poolId.toBase58()) || R.getPdaLaunchpadPoolId(PROGRAM, mint.publicKey, WSOL).publicKey.toBase58();
  const card = { mint: mint.publicKey.toBase58(), pool, name, symbol, image, desc, links, stock: stock.sym, creator: wallet.toBase58(), openUsd, gradUsd: openUsd * RUN, raiseSol: +c.raise.toFixed(3), sold: +c.sold.toFixed(4), pad: PIN.pad || null, built: Date.now() };
  if (!b.simulate) await putFile('coin/' + card.mint + '.json', JSON.stringify(card), 'application/json');
  return { mint: card.mint, pool, uri, stock: stock.sym, curve: { openUsd, gradUsd: openUsd * RUN, raiseSol: c.raise, sold: c.sold, startSol: c.startSol }, ...r }; }

function decodePad(id, data) { const p = R.PlatformConfig.decode(data); return { id: id.toBase58(), name: str(p.name), feePct: pct(p.feeRate), lp: { burn: pct(p.burnScale), platform: pct(p.platformScale) }, claimWallet: p.platformClaimFeeWallet.toBase58() }; }
async function pad(q) { const id = q.get('id') ? pk(q.get('id'), 'bad pad id') : padIdOf(pk(q.get('admin'), 'bad wallet')); const [acc, vault] = await conn.getMultipleAccountsInfo([id, vaultOf(id)]);
  if (!acc || !acc.owner.equals(PROGRAM)) return { exists: false, id: id.toBase58(), pinned: PIN.pad };
  return { exists: true, ...decodePad(id, acc.data), vault: vaultOf(id).toBase58(), unclaimedSol: vault && vault.data.length >= 72 ? Number(vault.data.readBigUInt64LE(64)) / 1e9 : 0, pinned: PIN.pad }; }
// the st0kz launchpad: 1% of every curve trade goes to the wallet that created it, which buys each coin's stock for its holders; half the graduation liquidity is burned
async function buildPad(req) { const b = await body(req), wallet = pk(b.wallet, 'connect a wallet first'), id = padIdOf(wallet); if (await conn.getAccountInfo(id)) throw new Error(`this wallet already has a launchpad (${id.toBase58()}). one per wallet.`);
  const { ray } = await chain(); if (!ray) throw new Error('could not read Raydium’s platform settings'); const burn = Math.round(CFG.burnPct * 1e4), host = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'st0kz.vercel.app'), raydium = await sdk(wallet);
  const made = await raydium.launchpad.createPlatformConfig({ programId: PROGRAM, platformAdmin: wallet, platformClaimFeeWallet: wallet, platformLockNftWallet: wallet, platformVestingWallet: wallet, cpConfigId: ray.cpConfigId,
    migrateCpLockNftScale: { platformScale: new BN(PPM - burn), creatorScale: new BN(0), burnScale: new BN(burn) }, transferFeeExtensionAuth: wallet, creatorFeeRate: new BN(0), feeRate: new BN(Math.round(CFG.feePct * 1e4)),
    name: CFG.name, web: host, img: host + '/icon.png', txVersion: R.TxVersion.LEGACY, feePayer: wallet });
  return { pad: id.toBase58(), ...(await finish(txsOf(made), wallet, [], [memoIx('st0kz:pad'), tagIx(wallet)], !!b.simulate)) }; }
async function claim(req) { const b = await body(req), wallet = pk(b.wallet, 'connect a wallet first'), id = padIdOf(wallet); if (!(await conn.getAccountInfo(id))) throw new Error('this wallet has no launchpad');
  const raydium = await sdk(wallet), made = await raydium.launchpad.claimVaultPlatformFee({ programId: PROGRAM, platformId: id, mintB: WSOL, claimFeeWallet: wallet, txVersion: R.TxVersion.LEGACY, feePayer: wallet });
  return finish(txsOf(made), wallet, [], null, !!b.simulate); }
// a payout round: the stock the fee wallet bought goes to a coin's holders, pro rata, straight from that wallet
async function buildPayout(req) { const b = await body(req), w = pk(b.wallet, 'connect the payout wallet'), C = (await coins()).coins.find(c => c.mint === String(b.coin)); if (!C) throw new Error('pick a st0kz coin');
  const coinPk = new PublicKey(C.mint), stock = new PublicKey(BY_SYM[C.stock].mint), total = BigInt(b.amountRaw || '0'); if (total <= 0n) throw new Error('nothing to pay out'); const minRaw = BigInt(b.minRaw || '0'), from = Math.max(0, +b.offset || 0);
  const sacc = await conn.getAccountInfo(stock); if (!sacc) throw new Error('stock mint not found'); const prog = sacc.owner, mi = await SPL.getMint(conn, stock, 'confirmed', prog);
  const { full, list } = await holdersOf(C.mint), sum = list.reduce((a, x) => a + x.raw, 0n); if (!sum) throw new Error('this coin has no holders yet');
  const pays = list.map(x => ({ owner: x.owner, amt: total * x.raw / sum })).filter(x => x.amt > 0n && x.amt >= minRaw && x.owner !== w.toBase58()), slice = pays.slice(from, from + 42);
  const src = SPL.getAssociatedTokenAddressSync(stock, w, false, prog), { blockhash } = await conn.getLatestBlockhash('confirmed'), txs = [];
  for (let i = 0; i < slice.length; i += 7) { const t = new Transaction(), part = slice.slice(i, i + 7); t.feePayer = w; t.recentBlockhash = blockhash;
    for (const p of part) { const o = new PublicKey(p.owner), ata = SPL.getAssociatedTokenAddressSync(stock, o, true, prog); t.add(SPL.createAssociatedTokenAccountIdempotentInstruction(w, ata, o, stock, prog), SPL.createTransferCheckedInstruction(src, stock, ata, w, p.amt, mi.decimals, [], prog)); }
    t.add(memoIx(`st0kz:payout:${coinPk.toBase58()}:${stock.toBase58()}:${part.length}:${part.reduce((a, p) => a + p.amt, 0n)}`), tagIx(w)); txs.push(t.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64')); }
  cache.delete('scan'); return { txs, holders: list.length, paid: pays.length, next: from + slice.length < pays.length ? from + slice.length : null, fullHolderList: full, stock: C.stock, decimals: mi.decimals }; }
async function sendTxs(req) { const b = await body(req); if (!Array.isArray(b.txs) || !b.txs.length || b.txs.length > 6) throw new Error('nothing to send'); const sigs = [];
  for (const t of b.txs) { const sig = await conn.sendRawTransaction(Buffer.from(t, 'base64'), { skipPreflight: false, maxRetries: 3 }); sigs.push(sig);
    for (let k = 0; k < 40; k++) { const s = (await conn.getSignatureStatuses([sig])).value[0]; if (s && s.err) throw new Error('transaction failed: ' + JSON.stringify(s.err)); if (s && /confirmed|finalized/.test(s.confirmationStatus || '')) break; await sleep(700); } }
  cache.delete('scan'); cache.delete('coins'); return { sigs }; }
async function status() { const [B, C, S] = await Promise.all([board().catch(() => null), coins().catch(() => null), scan().catch(() => null)]); let p = null; if (PIN.pad) p = await pad(new URLSearchParams({ id: PIN.pad })).catch(() => null);
  return { name: CFG.name, tag: TAG.toBase58(), pad: PIN.pad, padInfo: p, payoutsLive: !!(p && p.exists), feePct: CFG.feePct, open: CFG.openUsd, openDefault: CFG.openDefault, run: RUN, boardSize: BOARD, storage: hasStore(), sol: B && B.sol, stocks: B ? B.stocks.length : null, basis: B && B.basis, coins: C ? C.coins.length : null, rounds: S ? S.rounds.length : null, maxFirstBuySol: CFG.maxFirstBuySol }; }

module.exports = async (req, res) => { const q = new URL(req.url, 'http://x').searchParams, a = q.get('a'); if (req.method === 'GET') res.setHeader('access-control-allow-origin', '*');
  try {
    if (a === 'status') return out(res, 200, await status(), 's-maxage=15, stale-while-revalidate=60');
    if (a === 'board') return out(res, 200, await board(), 's-maxage=30, stale-while-revalidate=120');
    if (a === 'coins') return out(res, 200, await coins(), 's-maxage=10, stale-while-revalidate=40');
    if (a === 'coin') return out(res, 200, await coin(String(q.get('mint'))), 's-maxage=10, stale-while-revalidate=40');
    if (a === 'candles') return out(res, 200, await candles(String(q.get('mint'))), 's-maxage=20, stale-while-revalidate=60');
    if (a === 'wallet') return out(res, 200, await walletView(q.get('addr')));
    if (a === 'holders') { const h = await holdersOf(q.get('mint')), sum = h.list.reduce((s, x) => s + x.raw, 0n); return out(res, 200, { full: h.full, count: h.list.length, top: h.list.slice(0, 20).map(x => ({ owner: x.owner, pct: sum ? Number(x.raw * 10000n / sum) / 100 : 0 })) }, 's-maxage=30'); }
    if (a === 'rounds') return out(res, 200, { rounds: (await scan()).rounds }, 's-maxage=20');
    if (a === 'pad') return out(res, 200, await pad(q), 's-maxage=10');
    if (req.method === 'POST' && a === 'img') return out(res, 200, await img(req));
    if (req.method === 'POST' && a === 'buildLaunch') return out(res, 200, await buildLaunch(req));
    if (req.method === 'POST' && a === 'buildPad') return out(res, 200, await buildPad(req));
    if (req.method === 'POST' && a === 'claim') return out(res, 200, await claim(req));
    if (req.method === 'POST' && a === 'buildPayout') return out(res, 200, await buildPayout(req));
    if (req.method === 'POST' && a === 'send') return out(res, 200, await sendTxs(req));
    return out(res, 404, { error: 'unknown action' });
  } catch (e) { return out(res, 400, { error: e.message || String(e) }); } };
module.exports._t = { board, coins, coin, scan, curveOf, buildLaunch, buildPad, claim, buildPayout, conn, cache, setChain: v => { chainCache = { t: Date.now() + 1e9, v }; }, setPerf: v => { PERF = v; } };
