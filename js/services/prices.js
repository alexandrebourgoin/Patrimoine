// Cours en direct, taux de change et historiques (proxy Cloudflare, CoinGecko, FMP).
// Dépend, À L APPEL seulement, de S, FX_RATES, dbgLog, toast, refreshMain… (mon-patrimoine.js).
// Chargé AVANT mon-patrimoine.js : les let globaux (_fetching, _fxUpdatedAt…) doivent exister avant l init.

// ═══════════════════════════════════════════════
// LIVE PRICES  (PWA / HTTPS uniquement)
// ═══════════════════════════════════════════════
const PROXY_URL = 'https://patrimoine-prices.al-the-best.workers.dev';

// Cache session des titres résolus en ligne (hors SECURITIES_DB)
const _tickerMeta = {}; // ticker → {name, currency, type, price}

// Résout un ticker absent de la base via le proxy (route ?symbols= déjà déployée).
// Renvoie {name, currency, type, price} ou null. Best-effort, silencieux.
async function resolveTickerOnline(ticker){
  if(!ticker || SECURITIES_DB[ticker]) return null;
  if(_tickerMeta[ticker]) return _tickerMeta[ticker];
  try{
    const r = await fetch(PROXY_URL + '?symbols=' + encodeURIComponent(yahooSymbolFor(ticker)),
      { signal: AbortSignal.timeout(12000) });  // 12 s : absorbe le cold-start du worker (auth crumb Yahoo)
    if(!r.ok) return null;
    const data = await r.json();
    const q = data?.quoteResponse?.result?.find(x => x.regularMarketPrice);
    if(!q) return null;
    const qt = (q.quoteType||'').toUpperCase();
    const info = {
      name:     q.longName || q.shortName || ticker,
      currency: (q.currency||'EUR').toUpperCase(),
      type:     qt==='ETF' ? 'ETF' : qt==='CRYPTOCURRENCY' ? 'Crypto' : 'Action',
      price:    q.regularMarketPrice,
    };
    _tickerMeta[ticker] = info;
    return info;
  }catch(_){ return null; }
}

// Résout un ISIN absent de ISIN_MAP via le proxy (route ?search=, recherche Yahoo).
// Étape 1 : ISIN → symbole Yahoo (search, ex. "PANX.PA"). Étape 2 : symbole → devise/nom précis (quote, déjà déployée).
// Le ticker AFFICHÉ/stocké est la partie avant le suffixe d'place ("PANX") — cohérent avec le reste de
// l'appli (tickers courts partout : badges 4 caractères, etc.) — le suffixe est renvoyé à part
// dans `yahooSymbol` pour que l'appelant puisse fiabiliser les prochains rafraîchissements de cours.
// Renvoie {ticker, yahooSymbol?, name, currency, type} ou null. Best-effort, silencieux.
async function resolveIsinOnline(isin){
  if(_tickerMeta['ISIN:'+isin]) return _tickerMeta['ISIN:'+isin];
  try{
    const r = await fetch(PROXY_URL + '?search=' + encodeURIComponent(isin),
      { signal: AbortSignal.timeout(12000) });
    if(!r.ok) return null;
    const data = await r.json();
    const q = (data?.quotes||[]).find(x => x.symbol && (x.quoteType==='EQUITY'||x.quoteType==='ETF'));
    if(!q) return null;
    const type = q.quoteType==='ETF' ? 'ETF' : 'Action';
    const fullSymbol = q.symbol;
    const baseTicker = fullSymbol.split('.')[0].toUpperCase();
    const yahooSymbol = fullSymbol.toUpperCase()!==baseTicker ? fullSymbol : undefined;
    let info = { ticker:baseTicker, yahooSymbol, name:q.longname||q.shortname||fullSymbol, currency:'EUR', type };
    // Affine devise/nom via la route quote existante (le search Yahoo ne renvoie pas la devise)
    try{
      const r2 = await fetch(PROXY_URL + '?symbols=' + encodeURIComponent(fullSymbol),
        { signal: AbortSignal.timeout(12000) });
      if(r2.ok){
        const data2 = await r2.json();
        const q2 = data2?.quoteResponse?.result?.find(x => x.regularMarketPrice);
        if(q2) info = { ...info, name:q2.longName||q2.shortName||info.name, currency:(q2.currency||'EUR').toUpperCase() };
      }
    }catch(_){}
    _tickerMeta['ISIN:'+isin] = info;
    return info;
  }catch(_){ return null; }
}

// Affecte une valeur à un <select>, en créant l'option si absente (ex: devise CAD/JPY).
function setSelectValue(sel, val, label){
  if(!sel) return;
  if(![...sel.options].some(o => o.value === val)){
    const o = document.createElement('option');
    o.value = val; o.textContent = label || val;
    sel.appendChild(o);
  }
  sel.value = val;
}

let _fetching = false;
let _tdRateLimited = 0;
let _fxUpdatedAt = null;

// Helper partagé : fetch un cours unique via Twelve Data ou Yahoo
async function _fetchSinglePrice(yhSym, cgId) {
  let price = null, change1d = null;
  const sym = yhSym || cgId;
  dbgLog('[INF]', `─── Refresh individuel: ${sym} ───`);

  if (cgId) {
    try {
      dbgLog('[INF]', `CoinGecko → ${cgId}`);
      const r  = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&include_24hr_change=true`,
        { signal: AbortSignal.timeout(8000) }
      );
      dbgLog(r.ok?'[OK]':'[WRN]', `CoinGecko status=${r.status}`);
      if (r.ok) {
        const d = await r.json();
        price    = d[cgId]?.usd             || null;
        change1d = d[cgId]?.usd_24h_change  ?? null;
        dbgLog(price?'[OK]':'[WRN]', `CoinGecko prix=${price} change=${change1d}`);
      }
    } catch(e) { dbgLog('[ERR]', `CoinGecko: ${e?.message||e}`); }
    return { price, change1d };
  }

  // Proxy Cloudflare (Yahoo Finance sans CORS)
  try {
    dbgLog('[INF]', `Proxy → ${yhSym}`);
    const r = await fetch(`${PROXY_URL}?symbols=${encodeURIComponent(yhSym)}`,
      { signal: AbortSignal.timeout(8000) });
    dbgLog(r.ok?'[OK]':'[WRN]', `Proxy status=${r.status}`);
    if (r.ok) {
      const d = await r.json();
      const q = d?.quoteResponse?.result?.[0];
      if (q?.regularMarketPrice) {
        price    = q.regularMarketPrice;
        change1d = q.regularMarketChangePercent || 0;
        dbgLog('[OK]', `Proxy prix=${price} change=${change1d?.toFixed(2)}%`);
      }
    }
  } catch(e) { dbgLog('[ERR]', `Proxy: ${e?.message||e}`); }

  // Fallback FMP (si proxy en panne)
  if (!price && S.fmpApiKey) {
    try {
      dbgLog('[INF]', `FMP fallback → ${yhSym}`);
      const r = await fetch(
        `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(yhSym)}?apikey=${encodeURIComponent(S.fmpApiKey)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      dbgLog(r.ok?'[OK]':'[WRN]', `FMP status=${r.status}`);
      if (r.ok) {
        const d = await r.json();
        const q = Array.isArray(d) ? d[0] : d;
        if (q?.price && !q?.Error) {
          price    = parseFloat(q.price);
          change1d = parseFloat(q.changesPercentage) || 0;
          dbgLog('[OK]', `FMP prix=${price} change=${change1d?.toFixed(2)}%`);
        }
      }
    } catch(e) { dbgLog('[ERR]', `FMP: ${e?.message||e}`); }
  }

  if (!price) dbgLog('[ERR]', `Aucun cours trouvé pour ${sym}`);
  return { price, change1d };
}

// Rafraîchit le cours d'un holding (écran stock)
let _tickerFetching = false;
async function fetchTickerPrice(ticker, accId, holdingId) {
  if (_tickerFetching) return;
  _tickerFetching = true;
  const acc = S.accounts.find(a => a.id === accId);
  const h   = acc?.holdings.find(h => h.id === holdingId);
  const yhSym = yahooSymbolFor(ticker, h?.yahooSymbol);
  const cgId  = CG_IDS[ticker];
  if (!yhSym && !cgId) { toast('Ticker non reconnu'); _tickerFetching=false; return; }

  const btn = document.querySelector('#js-ticker-refresh svg');
  if (btn) btn.classList.add('spin');

  const { price } = await _fetchSinglePrice(yhSym, cgId);

  if (btn) btn.classList.remove('spin');
  _tickerFetching = false;

  if (!price) { if (!_tdRateLimited || Date.now()-_tdRateLimited>61000) toast('Cours introuvable'); return; }

  if (h) {
    h.currentPrice = price;
    recalcHolding(h);
    acc.value = accTotal(acc);
    const cached = loadPrices() || { prices: {} };
    cached.prices[ticker] = price;
    savePrices(cached.prices);
    S.lastPriceUpdate = Date.now();
    renderScreen('stock');
    refreshMain();
    toast(`${ticker} · ${fmtNative(price, h.currency||'EUR')} ✓`);
  }
}

// ── Reprise d'historique réel à la demande (écran titre) ──
// Choisit la profondeur Yahoo couvrant la 1ère transaction (capée à 'max')
function _histRange(h) {
  const txMs = h.transactions.map(t => new Date(t.date+'T00:00:00').getTime());
  const first = txMs.length ? Math.min(...txMs) : Date.now() - 365*86400000;
  const yrs = (Date.now() - first) / (365*86400000);
  return yrs <= 1 ? '1y' : yrs <= 2 ? '2y' : yrs <= 5 ? '5y' : yrs <= 10 ? '10y' : 'max';
}

// Normalise un dictionnaire {jour → close} en série ascendante [{d, c}]
function _histSeriesFromByDay(byDay) {
  return Object.keys(byDay).sort().map(d => ({ d, c: byDay[d] }));
}

async function _fetchYahooHistory(yhSym, range) {
  range = range || '5y';
  dbgLog('[INF]', `Proxy chart → ${yhSym} range=${range}`);
  const r = await fetch(`${PROXY_URL}?chart=${encodeURIComponent(yhSym)}&range=${range}&interval=1d`,
    { signal: AbortSignal.timeout(12000) });
  dbgLog(r.ok?'[OK]':'[WRN]', `Proxy chart status=${r.status}`);
  if (!r.ok) return null;
  const d = await r.json();
  const res = d?.chart?.result?.[0];
  const ts  = res?.timestamp;
  if (!ts) return null;
  const vals = res.indicators?.adjclose?.[0]?.adjclose || res.indicators?.quote?.[0]?.close;
  if (!vals) return null;
  const byDay = {};
  for (let i = 0; i < ts.length; i++) {
    if (vals[i] == null) continue;
    byDay[_dayKey(ts[i]*1000)] = +vals[i].toFixed(4); // clé jour locale (toISOString décalait de -1j en UTC+)
  }
  dbgLog('[OK]', `Yahoo history ${Object.keys(byDay).length} jours`);
  return _histSeriesFromByDay(byDay);
}

async function _fetchCryptoHistory(cgId, days) {
  // CoinGecko free tier : daily limité à ~365 jours
  days = Math.min(days || 365, 365);
  dbgLog('[INF]', `CoinGecko chart → ${cgId} days=${days}`);
  const r = await fetch(
    `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    { signal: AbortSignal.timeout(12000) });
  dbgLog(r.ok?'[OK]':'[WRN]', `CoinGecko chart status=${r.status}`);
  if (!r.ok) return null;
  const d = await r.json();
  if (!Array.isArray(d?.prices)) return null;
  const byDay = {};
  d.prices.forEach(([ms, price]) => {
    byDay[_dayKey(ms)] = +price.toFixed(6); // clé jour locale, cohérente avec _dayKey partout
  });
  dbgLog('[OK]', `CoinGecko history ${Object.keys(byDay).length} jours`);
  return _histSeriesFromByDay(byDay);
}

let _histFetching = false;
async function fetchTickerHistory(ticker, accId, holdingId) {
  if (_histFetching) return;
  const acc = S.accounts.find(a => a.id === accId);
  const h   = acc?.holdings.find(h => h.id === holdingId);
  if (!h) return;
  const yhSym = yahooSymbolFor(ticker, h.yahooSymbol);
  const cgId  = CG_IDS[ticker];
  if (!yhSym && !cgId) { toast('Ticker non reconnu'); return; }

  _histFetching = true;
  const btn = document.querySelector('#js-ticker-history svg');
  if (btn) btn.classList.add('spin');

  // Profondeur adaptée à la 1ère transaction du titre (transactions peut manquer sur données importées)
  const txMs = (h.transactions||[]).map(t => new Date(t.date+'T00:00:00').getTime());
  const first = txMs.length ? Math.min(...txMs) : Date.now() - 365*86400000;
  const cryptoDays = Math.ceil((Date.now() - first)/86400000) + 5;

  let series = null;
  try {
    series = cgId ? await _fetchCryptoHistory(cgId, cryptoDays) : await _fetchYahooHistory(yhSym, _histRange(h));
  } catch(e) { dbgLog('[ERR]', `Historique ${ticker}: ${e?.message||e}`); }

  if (btn) btn.classList.remove('spin');
  _histFetching = false;

  if (!series || series.length < 2) { toast('Historique introuvable'); return; }
  saveHistory(ticker, series, h.currency || 'EUR');
  renderScreen('stock');
  toast(`Historique ${ticker} repris · ${series.length} points ✓`);
}

// ── Reprise d'historique réel à la demande (écran watchstock) ──
// Pas de transactions ici → profondeur fixe (Yahoo 2y / crypto 365j) couvrant toutes les périodes (1S→1A, 52 sem.)
let _watchHistFetching = false;
async function fetchWatchHistory(ticker) {
  if (_watchHistFetching) return;
  const w = S.watchlist.find(w => w.ticker === ticker);
  if (!w) return;
  const yhSym = yahooSymbolFor(ticker);
  const cgId  = CG_IDS[ticker];
  if (!yhSym && !cgId) { toast('Ticker non reconnu'); return; }

  _watchHistFetching = true;
  const btn = document.querySelector('#js-watch-ticker-history svg');
  if (btn) btn.classList.add('spin');

  let series = null;
  try {
    series = cgId ? await _fetchCryptoHistory(cgId, 365) : await _fetchYahooHistory(yhSym, '2y');
  } catch(e) { dbgLog('[ERR]', `Historique ${ticker}: ${e?.message||e}`); }

  if (btn) btn.classList.remove('spin');
  _watchHistFetching = false;

  if (!series || series.length < 2) { toast('Historique introuvable'); return; }
  saveHistory(ticker, series, w.currency || SECURITIES_DB[ticker]?.currency || 'EUR');
  renderScreen('watchstock');
  toast(`Historique ${ticker} repris · ${series.length} points ✓`);
}

// Rafraîchit le cours d'un titre suivi (écran watchstock)
let _watchFetching = false;
async function fetchWatchPrice(ticker) {
  if (_watchFetching) return;
  _watchFetching = true;
  const yhSym = yahooSymbolFor(ticker);
  const cgId  = CG_IDS[ticker];
  if (!yhSym && !cgId) { toast('Ticker non reconnu'); _watchFetching=false; return; }

  const btn = document.querySelector('#js-watch-ticker-refresh svg');
  if (btn) btn.classList.add('spin');

  const { price, change1d } = await _fetchSinglePrice(yhSym, cgId);

  if (btn) btn.classList.remove('spin');
  _watchFetching = false;

  if (!price) { if (!_tdRateLimited || Date.now()-_tdRateLimited>61000) toast('Cours introuvable'); return; }

  const w = S.watchlist.find(w => w.ticker === ticker);
  if (w) {
    w.price = price;
    if (change1d !== null) w.change1d = change1d;
    saveAccounts();
    renderScreen('watchstock');
    refreshMain();
    const wCur = w.currency || SECURITIES_DB[ticker]?.currency || 'EUR';
    toast(`${ticker} · ${fmtNative(price, wCur)} ✓`);
  }
}

// FX pairs to fetch: EURUSD=X → regularMarketPrice = USD per EUR = FX_RATES.USD
// Base fixe + toutes les devises réellement présentes (un titre résolu en ligne peut être
// en CAD/AUD/SEK… — sans son taux, toRefCcy retombait silencieusement sur la parité 1:1)
function fxPairsNeeded() {
  const ccys = new Set(['USD','GBP','CHF','JPY']);
  if (S.currency) ccys.add(S.currency);
  S.accounts.forEach(a => {
    if (a.currency) ccys.add(a.currency);
    a.holdings.forEach(h => { if (h.currency) ccys.add(h.currency); });
  });
  S.watchlist.forEach(w => { if (w.currency) ccys.add(w.currency); });
  ccys.delete('EUR');
  return [...ccys].map(c => `EUR${c}=X`);
}

async function fetchFxRates() {
  const FX_PAIRS = fxPairsNeeded();
  dbgLog('[INF]', `FX → ${FX_PAIRS.join(', ')}`);
  try {
    const url = PROXY_URL + '?symbols=' + FX_PAIRS.join(',');
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) { dbgLog('[WRN]', `FX status=${r.status}`); return; }
    const data = await r.json();
    const results = data?.quoteResponse?.result || [];
    let updated = 0;
    results.forEach(q => {
      const m = q.symbol.match(/^EUR(\w+)=X$/);
      if (m && q.regularMarketPrice) {
        FX_RATES[m[1]] = q.regularMarketPrice;
        updated++;
      }
    });
    if (updated) {
      _fxUpdatedAt = Date.now();
      saveFxRates();
      // Recalculer valueRef/pnlRef pour tous les titres avec les nouveaux taux
      S.accounts.forEach(acc => {
        acc.holdings.forEach(h => {
          h.valueRef = +toRefCcy(h.value||0, h.currency).toFixed(2);
          h.pnlRef   = +toRefCcy(h.pnl||0,   h.currency).toFixed(2);
        });
        acc.value = accTotal(acc);
      });
      dbgLog('[OK]', `FX mis à jour: ${Object.entries(FX_RATES).map(([k,v])=>`${k}=${v}`).join(', ')}`);
    } else dbgLog('[WRN]', 'FX: aucun résultat');
  } catch(e) {
    dbgLog('[ERR]', `FX: ${e?.message||e}`);
  }
}

async function fetchLivePrices() {
  if (_fetching) return;
  _fetching = true;

  // Indicateur visuel sur le bouton refresh
  const btnSvg = document.querySelector('#js-refresh-btn svg');
  if (btnSvg) btnSvg.classList.add('spin');

  const allH = S.accounts.flatMap(a => a.holdings);
  // Watchlist seule = toujours rafraîchie (l'ancien return coupait aussi watchlist + FX)
  if (!allH.length && !S.watchlist.length) { _fetching=false; if(btnSvg) btnSvg.classList.remove('spin'); return; }
  try {

  // Taux de change live (avant recalcHolding pour que valueRef soit correct)
  await fetchFxRates();

  // Tickers uniques : comptes + watchlist (sauf crypto).
  // Fallback yahooSymbolFor → titres hors base envoyés avec leur ticker brut.
  const watchSymbols = S.watchlist
    .filter(w => !CG_IDS[w.ticker])           // crypto suivie → gérée par CoinGecko
    .map(w => yahooSymbolFor(w.ticker));
  const yahooSymbols = [...new Set([
    ...allH.filter(h=>h.type!=='Crypto').map(h=>yahooSymbolFor(h.ticker, h.yahooSymbol)),
    ...watchSymbols,
  ])];
  // Cryptos des comptes ET de la watchlist (une crypto suivie sans position n'était jamais rafraîchie)
  const cgIds = [...new Set([
    ...allH.filter(h=>h.type==='Crypto').map(h=>CG_IDS[h.ticker]),
    ...S.watchlist.map(w=>CG_IDS[w.ticker]),
  ].filter(Boolean))];

  // Map inverse : symbole Yahoo → ticker app
  const yahooRev = {};
  Object.entries(YAHOO_MAP).forEach(([app,yh])=>yahooRev[yh]=app);
  allH.forEach(h => { if(h.yahooSymbol) yahooRev[h.yahooSymbol]=h.ticker; }); // override par holding (résolution ISIN)
  // Map inverse : CoinGecko id → ticker app
  const cgRev = {};
  Object.entries(CG_IDS).forEach(([app,cg])=>cgRev[cg]=app);

  let updated = 0;
  const errors = [];
  const prices = {}; // pour savePrices()

  // ── Proxy Cloudflare → Yahoo Finance (+ FMP en fallback) ──
  if (yahooSymbols.length) {
    let yResults = null;
    const parseV7 = data => data?.quoteResponse?.result?.filter(q => q.regularMarketPrice) || [];
    dbgLog('[INF]', `Proxy → ${yahooSymbols.length} symboles: ${yahooSymbols.join(', ')}`);

    // Proxy Cloudflare (Yahoo Finance sans CORS)
    try {
      const url = PROXY_URL + '?symbols=' + yahooSymbols.join(',');
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      dbgLog(r.ok?'[OK]':'[WRN]', `Proxy status=${r.status}`);
      if (r.ok) { yResults = parseV7(await r.json()); dbgLog('[OK]', `Proxy résultats=${yResults.length}`); }
    } catch(e) { dbgLog('[ERR]', `Proxy: ${e?.message||e}`); }

    // Fallback FMP (si proxy en panne)
    if (!yResults?.length && S.fmpApiKey) {
      try {
        dbgLog('[INF]', `FMP fallback → ${yahooSymbols.join(',')}`);
        const r = await fetch(
          `https://financialmodelingprep.com/api/v3/quote/${yahooSymbols.join(',')}?apikey=${encodeURIComponent(S.fmpApiKey)}`,
          { signal: AbortSignal.timeout(10000) }
        );
        dbgLog(r.ok?'[OK]':'[WRN]', `FMP status=${r.status}`);
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length) {
            yResults = data.filter(q => q.price).map(q => ({
              symbol: q.symbol, regularMarketPrice: parseFloat(q.price)
            }));
            dbgLog('[OK]', `FMP résultats=${yResults.length}`);
          }
        }
      } catch(e) { dbgLog('[ERR]', `FMP: ${e?.message||e}`); }
    }

    if (yResults?.length) {
      yResults.forEach(q => {
        const ticker = yahooRev[q.symbol] || q.symbol;
        const price  = q.regularMarketPrice;
        if (!price) return;
        // Titre hors base : la devise Yahoo fait foi (le défaut EUR n'était qu'une supposition)
        const known = !!SECURITIES_DB[ticker];
        const qCur  = q.currency ? q.currency.toUpperCase() : null;
        // Mettre à jour les holdings
        allH.filter(h => h.ticker === ticker).forEach(h => {
          h.currentPrice = price;
          if (!known && qCur) h.currency = qCur;
          recalcHolding(h);
          updated++;
        });
        // Mettre à jour la watchlist
        const wItem = S.watchlist.find(w => w.ticker === ticker);
        if (wItem) {
          wItem.price    = price;
          wItem.change1d = q.regularMarketChangePercent || wItem.change1d;
          if (!known && qCur) wItem.currency = qCur;
        }
        prices[ticker] = price;
      });
    } else {
      errors.push('Proxy Yahoo Finance');
    }
  }

  // ── CoinGecko ──────────────────────────────────
  if (cgIds.length) {
    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids='
        + cgIds.join(',') + '&vs_currencies=usd&include_24hr_change=true';
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      cgIds.forEach(id => {
        const ticker = cgRev[id];
        const price  = data[id]?.usd;  // toujours en USD (devise native des cryptos)
        if (!ticker || !price) return;
        allH.filter(h=>h.ticker===ticker).forEach(h=>{ h.currentPrice=price; recalcHolding(h); updated++; });
        // Mettre à jour la watchlist si présente
        const wItem = S.watchlist.find(w => w.ticker === ticker);
        if (wItem) {
          wItem.price    = price;
          wItem.change1d = data[id]?.usd_24h_change ?? wItem.change1d;
        }
        prices[ticker] = price;
      });
    } catch(e) {
      errors.push('CoinGecko');
      dbgLog('[ERR]', `CoinGecko: ${e?.message||e}`);
    }
  }

  // ── Finalisation ───────────────────────────────
  // Le log est mis à jour en live par dbgLog(), pas besoin de re-render
  if (updated > 0) {
    S.accounts.forEach(a=>{ a.value=accTotal(a); });
    savePrices(prices);
    snapshotWealth(); // fige la valeur totale du jour avec les cours fraîchement mis à jour
    refreshMain();
    // Animation wealth card + montants clés
    requestAnimationFrame(() => {
      const wc = document.querySelector('.wealth-card');
      if (wc) { wc.classList.remove('card-glow'); void wc.offsetWidth; wc.classList.add('card-glow'); }
      document.querySelectorAll('.wealth-amount,.metric-val').forEach(el => {
        el.classList.remove('num-flash'); void el.offsetWidth; el.classList.add('num-flash');
      });
      // Mettre à jour le dot fraîcheur
      const dot = document.getElementById('js-fresh-dot');
      if (dot) dot.style.background = 'var(--gain)';
    });
    const total = allH.filter(h=>h.type!=='Crypto').length
                + allH.filter(h=>h.type==='Crypto').map(h=>CG_IDS[h.ticker]).filter(Boolean).length;
    const partial = updated < total ? ` (${updated}/${total})` : '';
    toast(errors.length
      ? `${updated} cours mis à jour · ⚠ ${errors.join(', ')}`
      : `${updated} cours mis à jour ✓${partial}${partial?' · rafraîchir pour la suite':''}`);
  } else {
    toast(errors.length ? `Erreur : ${errors.join(', ')}` : 'Aucun cours trouvé');
  }

  } finally {
    // Toujours réarmer, même si le rendu lève une exception : sinon _fetching restait
    // bloqué à true et tout refresh ultérieur sortait silencieusement
    _fetching = false;
    if (btnSvg) btnSvg.classList.remove('spin');
  }
}

function applyPrices(priceData) {
  if(!priceData?.prices) return;
  S.accounts.flatMap(a=>a.holdings).forEach(h=>{
    const p=priceData.prices[h.ticker];
    if(p!=null){ h.currentPrice=p; recalcHolding(h); }
  });
  S.accounts.forEach(a=>{ a.value=accTotal(a); });
  S.lastPriceUpdate=priceData.updatedAt;
}
