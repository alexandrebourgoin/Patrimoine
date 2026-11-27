// Symboles de cotation choisis par l'utilisateur : pour un ticker de l'app, le symbole Yahoo (actions, ETF…) ou
// l'identifiant CoinGecko (cryptos) à interroger. Un choix vaut pour TOUTE l'app : toutes les positions de ce ticker,
// tous comptes confondus, la liste de suivi, les historiques (yahooSymbolFor / cgIdFor, js/data/securities.js).
// Stockage : clé « patrimoine-symbols » → sauvegardée et restaurée avec le reste (js/features/backup.js).
// Recherche : proxy des cours (route ?search=, recherche Yahoo) et API publique CoinGecko (/search).
// Partie pure (stockage injecté, analyse des réponses) testée ; recherches réseau en bas.

const SYMBOLS_STORE = 'patrimoine-symbols';   // { [ticker]: { yahoo?: '3CP.F', cg?: 'aave', label?, at } }

let _symbolsCache = null;
function symbolsAll(storage = localStorage) {
  if (_symbolsCache && storage === localStorage) return _symbolsCache;
  let o = {};
  try { o = JSON.parse(storage.getItem(SYMBOLS_STORE) || '{}') || {}; } catch (e) { o = {}; }
  if (typeof o !== 'object' || Array.isArray(o)) o = {};
  if (storage === localStorage) _symbolsCache = o;
  return o;
}
function symbolUser(ticker, storage = localStorage) {
  const e = ticker ? symbolsAll(storage)[ticker] : null;
  return e && (e.yahoo || e.cg) ? e : null;
}
// entry : { yahoo } ou { cg }, avec label facultatif (« 3CP.F · Francfort · EUR ») pour l'affichage
function symbolSet(ticker, entry, storage = localStorage, now = Date.now()) {
  if (!ticker || !entry || !(entry.yahoo || entry.cg)) throw new Error('Symbole invalide');
  const all = { ...symbolsAll(storage) };
  all[ticker] = { ...(entry.yahoo ? { yahoo: String(entry.yahoo) } : { cg: String(entry.cg) }), ...(entry.label ? { label: String(entry.label) } : {}), at: now };
  storage.setItem(SYMBOLS_STORE, JSON.stringify(all));
  if (storage === localStorage) _symbolsCache = all;
}
function symbolClear(ticker, storage = localStorage) {
  const all = { ...symbolsAll(storage) }; delete all[ticker];
  storage.setItem(SYMBOLS_STORE, JSON.stringify(all));
  if (storage === localStorage) _symbolsCache = all;
}
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
// Texte proposé dans la recherche : l'ISIN s'il est connu (le plus fiable), sinon le nom, sinon le ticker
function symbolQuery(h) {
  const t = String(h?.ticker || '').toUpperCase();
  if (h?.type === 'Crypto') return t;
  if (h?.isin && ISIN_RE.test(String(h.isin).toUpperCase())) return String(h.isin).toUpperCase();
  if (ISIN_RE.test(t)) return t;
  return String(h?.name || t).trim();
}

// ── Analyse des réponses ──
// Type de position de l'app selon le type de cotation Yahoo (fonds → ETF, le plus proche)
const YAHOO_TYPES = { EQUITY: 'Action', ETF: 'ETF', MUTUALFUND: 'ETF', INDEX: 'ETF', BOND: 'Obligation' };
// Recherche Yahoo (v1 search) + cours (v7 quote) → candidats
// { kind:'yahoo', id, ticker (sans la place : 3CP.F → 3CP), type, name, place, currency, price, quoteAt }
function yahooCandidates(search, quotes) {
  const q = new Map(((quotes?.quoteResponse?.result) || []).map(r => [r.symbol, r]));
  return ((search?.quotes) || [])
    .filter(x => x.symbol && ['EQUITY', 'ETF', 'MUTUALFUND', 'INDEX', 'BOND'].includes(x.quoteType))
    .map(x => {
      const r = q.get(x.symbol) || {};
      return { kind: 'yahoo', id: x.symbol, ticker: x.symbol.split('.')[0].toUpperCase(), type: YAHOO_TYPES[x.quoteType] || 'Action',
        name: r.longName || r.shortName || x.longname || x.shortname || x.symbol,
        place: r.fullExchangeName || x.exchDisp || x.exchange || '', currency: (r.currency || '').toUpperCase(),
        price: typeof r.regularMarketPrice === 'number' ? r.regularMarketPrice : null,
        quoteAt: typeof r.regularMarketTime === 'number' ? r.regularMarketTime * 1000 : null };
    });
}
// Recherche CoinGecko + cours → candidats { kind:'cg', id, ticker, type:'Crypto', name, place:'Crypto · rang N', currency:'USD', price, quoteAt }
// Le symbole exact (AAVE) passe en tête, puis par capitalisation.
function cgCandidates(search, prices, symbol) {
  const want = String(symbol || '').toLowerCase();
  return ((search?.coins) || []).slice()
    .sort((a, b) => ((b.symbol || '').toLowerCase() === want) - ((a.symbol || '').toLowerCase() === want)
      || (a.market_cap_rank ?? 1e9) - (b.market_cap_rank ?? 1e9))
    .slice(0, 6)
    .map(c => ({ kind: 'cg', id: c.id, ticker: String(c.symbol || '').toUpperCase(), type: 'Crypto', name: `${c.name} (${String(c.symbol || '').toUpperCase()})`,
      place: c.market_cap_rank ? `Crypto · rang ${c.market_cap_rank}` : 'Crypto', currency: 'USD',
      price: typeof prices?.[c.id]?.usd === 'number' ? prices[c.id].usd : null,
      quoteAt: typeof prices?.[c.id]?.last_updated_at === 'number' ? prices[c.id].last_updated_at * 1000 : null }));
}

// ── Recherches réseau (dépend, À L'APPEL, de PROXY_URL) ──
async function symbolSearch(query, crypto) {
  query = String(query || '').trim();
  if (!query) return [];
  if (crypto) {
    const r = await fetch('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(query), { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('CoinGecko indisponible (' + r.status + ')');
    const s = await r.json();
    const ids = ((s.coins) || []).slice(0, 12).map(c => c.id);
    let p = {};
    if (ids.length) {
      try {
        const r2 = await fetch('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&include_last_updated_at=true&ids=' + ids.map(encodeURIComponent).join(','), { signal: AbortSignal.timeout(10000) });
        if (r2.ok) p = await r2.json();
      } catch (e) {}
    }
    return cgCandidates(s, p, query);
  }
  const r = await fetch(PROXY_URL + '?search=' + encodeURIComponent(query), { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('Recherche indisponible (' + r.status + ')');
  const s = await r.json();
  const syms = ((s.quotes) || []).map(x => x.symbol).filter(Boolean);
  let qs = null;
  if (syms.length) {
    try {
      const r2 = await fetch(PROXY_URL + '?symbols=' + syms.map(encodeURIComponent).join(','), { signal: AbortSignal.timeout(12000) });
      if (r2.ok) qs = await r2.json();
    } catch (e) {}
  }
  return yahooCandidates(s, qs);
}
// Ajout d'une position : bourse et cryptos interrogées ensemble (une source en panne n'empêche pas l'autre)
async function symbolSearchAll(query) {
  const [y, c] = await Promise.allSettled([symbolSearch(query, false), symbolSearch(query, true)]);
  const ok = [y, c].filter(r => r.status === 'fulfilled').flatMap(r => r.value);
  if (!ok.length && y.status === 'rejected' && c.status === 'rejected') throw y.reason;
  return ok;
}
// Entrée mémorisée pour un candidat choisi (symbolSet)
function symbolEntry(c) {
  return c.kind === 'cg' ? { cg: c.id, label: c.name } : { yahoo: c.id, label: [c.id, c.place, c.currency].filter(Boolean).join(' · ') };
}
