// Persistance localStorage : clés STORE_*, sauvegarde/chargement des comptes et réglages (slots démo/réel,
// migration depuis l ancien format), cache de cours, historiques réels par ticker, snapshots quotidiens du patrimoine.
// Dépend, À L APPEL seulement, de S, PU, FX_RATES, accTotal, recalcHolding… (mon-patrimoine.js). Chargé AVANT main :
// les STORE_* doivent exister avant loadData() (appelé à l init).

// ═══════════════════════════════════════════════
// STORAGE KEYS
// ═══════════════════════════════════════════════
const STORE_ACCOUNTS      = 'patrimoine-accounts';      // slot actif (toujours chargé au démarrage)
const STORE_ACCOUNTS_DEMO = 'patrimoine-accounts-demo'; // slot backup mode démo
const STORE_ACCOUNTS_REAL = 'patrimoine-accounts-real'; // slot backup mode réel
const STORE_SETTINGS = 'patrimoine-settings'; // thème, devise, clé API, préférences
const STORE_PRICES   = 'patrimoine-prices';   // cache cours (inchangé)
const STORE_HISTORY  = 'patrimoine-history';  // séries historiques réelles par ticker
const STORE_WEALTH   = 'patrimoine-wealth';   // snapshots quotidiens de la valeur totale du patrimoine
const STORE_LEGACY   = 'patrimoine-data';     // ancien format → migration automatique
const STORE_VERSION  = 'patrimoine-version';  // dernière version vue (popup changelog)

// Écriture refusée (quota plein, stockage bloqué) : sans message, l'utilisateur croit avoir enregistré des données qui
// disparaîtront au prochain lancement. Au plus un message toutes les 10 s (les sauvegardes s'enchaînent).
let _saveWarnAt = 0;
function _saveFailed(what) {
  const now = Date.now();
  if (now - _saveWarnAt < 10000) return false;
  _saveWarnAt = now;
  if (typeof toast === 'function') toast('⚠ ' + what + ' non enregistrés : stockage plein ou bloqué. Faites une sauvegarde (menu ☰) !');
  return false;
}

// ── Sauvegarde données financières ──
function saveAccounts() {
  try {
    localStorage.setItem(STORE_ACCOUNTS, JSON.stringify({
      accounts:  S.accounts,
      isDemo:    S.isDemo,
      watchlist: S.watchlist,
      targets:   S.targets,
      user:      S.user,
    }));
    return true;
  } catch(e) { return _saveFailed('Comptes'); }
}

// ── Sauvegarde préférences ──
function saveSettings() {
  try {
    localStorage.setItem(STORE_SETTINGS, JSON.stringify({
      theme:       S.theme,
      currency:    S.currency,
      privacy:     S.privacy,
      histPeriod:  S.histPeriod,
      sort:        S.sort,
      sortDir:     S.sortDir,
      debug:       S.debug,
      autoRefresh: S.autoRefresh,
      accountsView: S.accountsView,
      assistantEnabled: S.assistantEnabled,
      navItems:    S.navItems,
      bgPrivacy:   S.bgPrivacy,
      bgIdle:      S.bgIdle,
      priceApiKey: S.priceApiKey,
      lockEnabled: S.lockEnabled,
      lockHash:    S.lockHash,
      lockSalt:    S.lockSalt,
      lockBio:     S.lockBio,
      lockBioId:   S.lockBioId,
      lockDelay:   S.lockDelay,
      lockFails:   S.lockFails,
      lockUntil:   S.lockUntil,
      fmpApiKey:   S.fmpApiKey,
    }));
    return true;
  } catch(e) { return _saveFailed('Réglages'); }
}

// ── Sauvegarde tout ──
function saveData() { const a = saveAccounts(), r = saveSettings(); return a && r; }

// ── Chargement avec migration automatique depuis l'ancien format ──
function loadData() {
  try {
    // Migration : si l'ancienne clé existe, ventiler dans les deux nouvelles
    const legacy = localStorage.getItem(STORE_LEGACY);
    if (legacy) {
      const d = JSON.parse(legacy);
      if (!localStorage.getItem(STORE_ACCOUNTS)) {
        localStorage.setItem(STORE_ACCOUNTS, JSON.stringify({
          accounts:  d.accounts  || [],
          isDemo:    d.isDemo    !== undefined ? d.isDemo : true,
          watchlist: d.watchlist || [],
          targets:   d.targets   || {},
          user:      d.user      || { name: 'Moi' },
        }));
      }
      if (!localStorage.getItem(STORE_SETTINGS)) {
        localStorage.setItem(STORE_SETTINGS, JSON.stringify({
          theme:       d.theme       || 'auto',
          currency:    d.currency    || 'EUR',
          privacy:     d.privacy     !== undefined ? d.privacy : false,
          histPeriod:  d.histPeriod  || '1M',
          sort:        d.sort        || 'value',
          sortDir:     d.sortDir     !== undefined ? d.sortDir : -1,
          debug:       d.debug       !== undefined ? d.debug : false,
          autoRefresh: d.autoRefresh !== undefined ? d.autoRefresh : false,
          priceApiKey: d.priceApiKey || '',
        }));
      }
      localStorage.removeItem(STORE_LEGACY); // supprimer l'ancienne clé
    }

    const rawA = localStorage.getItem(STORE_ACCOUNTS);
    const rawS = localStorage.getItem(STORE_SETTINGS);
    if (!rawA && !rawS) return false;

    // Charger les données financières
    if (rawA) {
      const a = JSON.parse(rawA);
      if (a.accounts)             S.accounts  = a.accounts;
      if (a.isDemo !== undefined) S.isDemo    = a.isDemo;
      if (a.watchlist)            S.watchlist = a.watchlist;
      if (a.targets)              S.targets   = a.targets;
      if (a.user)                 S.user      = a.user;
    }
    // Charger les préférences
    if (rawS) {
      const s = JSON.parse(rawS);
      if (s.theme)                  S.theme       = s.theme;
      if (s.currency)               S.currency    = s.currency;
      if (s.privacy !== undefined)  S.privacy     = s.privacy;
      if (s.histPeriod)             S.histPeriod  = s.histPeriod;
      if (s.sort)                   S.sort        = s.sort;
      if (s.sortDir !== undefined)  S.sortDir     = s.sortDir;
      if (s.debug !== undefined)    S.debug       = s.debug;
      if (s.autoRefresh !== undefined) S.autoRefresh = s.autoRefresh;
      if (s.accountsView)           S.accountsView = s.accountsView;
      if (s.assistantEnabled !== undefined) S.assistantEnabled = s.assistantEnabled;
      if (s.navItems)               S.navItems = sanitizeNavItems(s.navItems);
      if (s.bgPrivacy !== undefined) S.bgPrivacy = s.bgPrivacy;
      if (s.bgIdle !== undefined)    S.bgIdle    = s.bgIdle;
      if (s.priceApiKey)            S.priceApiKey = s.priceApiKey;
      if (s.lockEnabled !== undefined) S.lockEnabled = s.lockEnabled;
      if (s.lockHash)                  S.lockHash    = s.lockHash;
      if (s.lockSalt)                  S.lockSalt    = s.lockSalt;
      if (s.lockBio !== undefined)     S.lockBio     = s.lockBio;
      if (s.lockBioId)                 S.lockBioId   = s.lockBioId;
      if (s.lockDelay !== undefined)   S.lockDelay   = s.lockDelay;
      if (s.lockFails !== undefined)   S.lockFails   = s.lockFails;
      if (s.lockUntil !== undefined)   S.lockUntil   = s.lockUntil;
      if (s.fmpApiKey)              S.fmpApiKey   = s.fmpApiKey;
    }
    return true;
  } catch(e) { return false; }
}

function savePrices(prices) {
  // prices = { 'MC': 734.2, 'AAPL': 189.3, ... }
  try {
    const fxToSave = Object.fromEntries(Object.entries(FX_RATES).filter(([k]) => k !== 'EUR'));
    localStorage.setItem(STORE_PRICES, JSON.stringify({ prices, updatedAt: Date.now(), fxRates: fxToSave, fxUpdatedAt: _fxUpdatedAt }));
  } catch(e) {}
}

function saveFxRates() {
  try {
    const raw = localStorage.getItem(STORE_PRICES);
    const data = raw ? JSON.parse(raw) : { prices: {}, updatedAt: 0 };
    data.fxRates = Object.fromEntries(Object.entries(FX_RATES).filter(([k]) => k !== 'EUR'));
    data.fxUpdatedAt = _fxUpdatedAt;
    localStorage.setItem(STORE_PRICES, JSON.stringify(data));
  } catch(e) {}
}

function loadPrices() {
  try {
    const raw=localStorage.getItem(STORE_PRICES);
    return raw ? JSON.parse(raw) : null;  // { prices:{...}, updatedAt: ms, fxRates:{...}, fxUpdatedAt: ms }
  } catch(e) { return null; }
}

// ── Historique réel des cours (séries quotidiennes par ticker) ──
// Format stocké : { 'AAPL': { series:[{d:'YYYY-MM-DD', c:close}], currency:'USD', fetchedAt: ms }, ... }
let _historyCache = null;
function loadHistory() {
  if (_historyCache) return _historyCache;
  try {
    const raw = localStorage.getItem(STORE_HISTORY);
    _historyCache = raw ? JSON.parse(raw) : {};
  } catch(e) { _historyCache = {}; }
  return _historyCache;
}
function saveHistory(ticker, series, currency) {
  const all = loadHistory();
  all[ticker] = { series, currency: currency || 'EUR', fetchedAt: Date.now() };
  _historyCache = all;
  try { localStorage.setItem(STORE_HISTORY, JSON.stringify(all)); } catch(e) {}
}
// Renvoie l'entrée historique d'un ticker si elle existe et contient des points, sinon null
function getHistorySeries(ticker) {
  const h = loadHistory()[ticker];
  return (h && Array.isArray(h.series) && h.series.length >= 2) ? h : null;
}

// ── Historique réel du patrimoine (snapshots quotidiens de la valeur totale) ──
// Format stocké : [{ d:'YYYY-MM-DD', v: valeur_en_devise_appli }] trié par date croissante.
// Clé jour en date LOCALE (toISOString décalait d'un jour en fuseau UTC+) — implémentation dans utils.js
function _dayKey(d) { return PU.dayKey(d); }
function loadWealth() {
  try { const a = JSON.parse(localStorage.getItem(STORE_WEALTH) || '[]'); return Array.isArray(a) ? a : []; }
  catch(e) { return []; }
}
function saveWealth(arr) { try { localStorage.setItem(STORE_WEALTH, JSON.stringify(arr)); } catch(e) {} }
// Enregistre (ou écrase) le point du jour avec la valeur totale courante. No-op en mode démo.
function snapshotWealth() {
  if (S.isDemo) return;
  const w = totalWealth();
  if (!(w > 0)) return;
  const key = _dayKey(Date.now());
  const arr = loadWealth().filter(p => p.d !== key);
  arr.push({ d: key, v: +w.toFixed(2) });
  arr.sort((a,b) => a.d.localeCompare(b.d));
  const overflow = arr.length - 800; // ~2 ans de points max
  if (overflow > 0) arr.splice(0, overflow);
  saveWealth(arr);
}
// Quantité détenue par un holding à une date donnée (cumul des transactions <= dayKey).
function _qtyOnDay(h, dayKey) {
  if (!h.transactions || !h.transactions.length) return h.quantity ?? 0;
  let q = 0;
  for (const tx of h.transactions) {
    if (tx.date > dayKey) continue;
    if (tx.type === 'BUY') q += tx.qty;
    else if (tx.type === 'SELL') q = Math.max(0, q - tx.qty);
  }
  return q;
}
// Reconstruit (approximativement) la valeur totale du patrimoine à une date passée :
// quantité détenue ce jour-là × dernière clôture connue <= ce jour (série réelle si dispo,
// sinon cours actuel), convertie en devise appli avec les taux FX courants.
function reconstructWealthOnDay(dayKey) {
  let tot = 0;
  S.accounts.filter(a => !a.observer).forEach(a => {
    const k = typeof accShare === 'function' ? accShare(a) : 1;   // ma part du compte, comme totalWealth()
    let accTot = 0;
    a.holdings.forEach(h => {
      const qty = _qtyOnDay(h, dayKey);
      if (qty <= 0) return;
      const hist = getHistorySeries(h.ticker);
      let price = h.currentPrice;
      if (hist) {
        let c = null;
        for (const p of hist.series) { if (p.d <= dayKey) c = p.c; else break; }
        if (c != null) price = c;
      }
      accTot += toRefCcy(qty * price, h.currency);
    });
    // Liquidités du compte à cette date (apports/retraits et transactions antérieurs)
    accTot += accCash(a, dayKey);
    tot += accTot * k;
  });
  return +tot.toFixed(2);
}
// Comble les jours passés manquants du store par reconstruction (idempotent : ne touche jamais
// aux vrais snapshots déjà enregistrés, ni au jour courant réservé au snapshot live).
function backfillWealthHistory(days = 365) {
  if (S.isDemo) return;
  const arr = loadWealth();
  const have = new Set(arr.map(p => p.d));
  const today = new Date(); today.setHours(0,0,0,0);
  let added = 0;
  for (let i = days; i >= 1; i--) {
    const key = _dayKey(today.getTime() - i*86400000);
    if (have.has(key)) continue;
    const v = reconstructWealthOnDay(key);
    if (v > 0) { arr.push({ d: key, v }); added++; }
  }
  if (added) { arr.sort((a,b) => a.d.localeCompare(b.d)); saveWealth(arr); }
}
