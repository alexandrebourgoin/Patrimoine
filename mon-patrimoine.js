// ═══════════════════════════════════════════════
// MON PATRIMOINE — point d'entrée. Scripts classiques (pas d'ES modules), chargés dans l'ordre de mon-patrimoine.html :
//   utils.js (PU, fonctions pures) → js/core/dom-guard.js → js/data/*  (tables, démo, changelog)
//   → js/core/{screens,modals,storage,ui,navigation,shell}.js → js/services/* (cours, CSV)
//   → js/features/* (verrou, DCA, assistant, glisser-déposer, graphiques, confidentialité)
//   → js/modals/* → js/screens/* → CE FICHIER.
// Ici : état global S, version, wrappers de formatage/devises, correctifs de comptes, initialisation, retour Android, mise à jour, SW.
// Chaque nouveau fichier de js/ doit être ajouté AU HTML (ordre = dépendances) ET à SHELL de sw.js.
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
const S = {
  screen: 'dashboard',
  stack: ['dashboard'],
  accountId: null,
  holdingId: null,
  theme: 'auto',
  currency: 'EUR',
  privacy: false,
  user: { name: 'Alexandre Martin' },
  accounts: [],
  sort: 'value',
  sortDir: -1,
  search: '',
  histPeriod: '1M',
  targets: { Action: 60, ETF: 25, Obligation: 10, Cash: 5 },
  _histCache: {},
  srchQuery: '',
  srchMode: 'titres',   // 'titres' | 'mouvements'
  watchlist: genDemoWatchlist(),
  lastPriceUpdate: null,
  isDemo: true,   // true = données démo (jamais sauvegardées)
  watchTicker: null,
  watchPeriod: '3M',
  watchSort: 'default',  // 'default' | 'perf_desc' | 'perf_asc'
  stockPeriod: 'MAX',   // '1M' | '3M' | '6M' | '1A' | 'MAX'
  debug: false,
  autoRefresh: false, // auto-refresh au démarrage (désactivé par défaut)
  accountsView: 'list', // 'list' | 'grid' — affichage de l'écran Comptes
  assistantEnabled: true, // affiche le menu Assistant IA (recos locales)
  navItems: ['dashboard','comptes','recherche','analysis'], // raccourcis de la barre du bas (3 à 5)
  bgPrivacy: true,    // masque l'écran quand l'appli passe en arrière-plan
  bgIdle: 0,          // s d'inactivité avant masquage (0 = jamais)
  priceApiKey: '',    // clé Twelve Data (US stocks)
  fmpApiKey:   '',    // clé Financial Modeling Prep (actions EU + US)
  // ── Sécurité (verrouillage d'accès) ──
  lockEnabled: false, // verrou par code activé
  lockHash:   '',     // dérivé PBKDF2 du code (le code lui-même n'est jamais stocké)
  lockSalt:   '',     // sel aléatoire du dérivé
  lockBio:    false,  // déverrouillage biométrique activé
  lockBioId:  '',     // id du credential WebAuthn (base64url)
  lockDelay:  60,     // secondes en arrière-plan avant re-verrouillage (0 = immédiat)
  lockFails:  0,      // essais ratés consécutifs
  lockUntil:  0,      // fin du blocage anti-force brute (timestamp ms)
  dca: { plans: [], goals: [] }, // DCA & objectifs (chargé par loadDca, voir js/features/dca.js)
  _debugLog: [],      // non persisté
  _tdOffset:  0,      // rotation Twelve Data (non persisté)
};


// Le 3e chiffre EST la version du cache du service worker : 1.10.NN ↔ patrimoine-vNN.
// Toute modif de fichier impose de bumper les deux (sw.js + ici) — un écart est signalé
// dans Réglages → À propos, qui affiche le cache réellement servi.
const APP_VERSION = '1.11.126';
const CACHE_NAME  = 'patrimoine-v' + APP_VERSION.split('.')[2];


// ═══════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════
function fmtCur(v) {
  return PU.fmtCur(v, S.currency);
}
function fmtPct(v) { return PU.fmtPct(v); }
function fmtDate(s) { return PU.fmtDate(s); }
function initials(n) { return PU.initials(n); }
// Observer accounts excluded from total wealth
function totalWealth() { return S.accounts.filter(a=>!a.observer).reduce((s,a)=>s+a.value,0); }

// Approximate FX rates for P/L produit display only
const FX_RATES = { EUR:1, USD:1.08, GBP:1.16, CHF:1.05, JPY:163 };

function fmtNative(v, cur) { return PU.fmtNative(v, cur); }

// Convert amount from native currency to app currency using FX_RATES
// FX_RATES[X] = "units of X per EUR", so to convert X→EUR: amount / FX_RATES[X]
function toRefCcy(amount, fromCcy) { return PU.toRefCcy(amount, fromCcy, FX_RATES, S.currency); }
// Sum holdings values converted to app currency
function accSum(holdings) { return PU.accSum(holdings); }
// Liquidités non investies du compte (devise appli) — somme des poches par devise.
// `upTo` borne le calcul à une date passée (reconstruction de l'historique).
function accCash(acc, upTo) { return PU.accCash(acc, FX_RATES, S.currency, upTo); }
// Solde du compte = valeur des titres + liquidités. À utiliser partout où `acc.value` est (re)calculé.
function accTotal(acc) { return PU.accTotal(acc, FX_RATES, S.currency); }

function computeRealizedPnL(h) { return PU.computeRealizedPnL(h); }

function recalcHolding(h) { return PU.recalcHolding(h, FX_RATES, S.currency); }

function masked(v) { return S.privacy?'<span class="prv">● ● ●</span>':fmtCur(v); }
function maskedNative(v,cur) { return S.privacy?'<span class="prv">● ● ●</span>':fmtNative(v,cur); }
// Échappement innerHTML — implémentation dans utils.js
function esc(s) { return PU.esc(s); }

// ═══════════════════════════════════════════════
// COMPTES — performance, liquidités par devise, régularisation, indice
// Ces fonctions REMPLACENT celles de js/screens/account.js (chargé avant ce fichier) : même nom, comportement corrigé.
// Dette technique assumée : l'ancien code reste dans account.js, inutilisé ; à nettoyer quand ce fichier pourra être modifié en entier.
// ═══════════════════════════════════════════════
// Flux externes d'un compte = UNIQUEMENT les apports et retraits saisis (devise appli, au change du jour).
// Les achats, les ventes et les régularisations de liquidités ne sont pas des flux : une régularisation corrige le niveau de liquidités, elle n'apporte ni ne retire d'argent.
function _accFlows(acc) {
  return (acc.cashflows || [])
    .filter(c => c.date && (c.type === 'DEP' || c.type === 'WIT'))
    .map(c => ({ date: c.date, amt: (c.type === 'WIT' ? -1 : 1) * toRefCcy(+c.amount || 0, c.ccy || acc.currency || 'EUR') }));
}

// Plus-value du compte = valorisation (titres + liquidités) − apports nets saisis (apports − retraits).
function accPerfInfo(acc) {
  const fl = _accFlows(acc);
  if (!fl.length) return null;
  const dep = fl.filter(f => f.amt > 0).reduce((s, f) => s + f.amt, 0);
  const wit = Math.abs(fl.filter(f => f.amt < 0).reduce((s, f) => s + f.amt, 0));
  const net = dep - wit;
  if (!(net > 0)) return null;
  const val = acc.value;
  const gain = val - net, pct = gain / net * 100;
  // Date de début : date d'ouverture saisie sur le compte, sinon le plus ancien apport ou mouvement
  let start = acc.startDate || null, auto = false;
  if (!start) {
    const ds = [...fl.map(f => f.date), ...(acc.holdings || []).flatMap(h => (h.transactions || []).map(t => t.date))].filter(Boolean).sort();
    start = ds[0] || null; auto = true;
  }
  let years = null, annual = null;
  if (start) {
    years = (Date.now() - new Date(start + 'T00:00:00').getTime()) / (365.25 * 86400000);
    if (years >= 1 && val > 0) annual = (Math.pow(val / net, 1 / years) - 1) * 100;
  }
  return { net, gain, pct, start, auto, years, annual, dep, wit };
}

// Valeur du compte à une date passée (devise appli) : quantités détenues ce jour-là × clôture connue + liquidités du jour.
function accValueOnDay(acc, day) {
  let tot = 0, approx = false;
  (acc.holdings || []).forEach(h => {
    const q = _qtyOnDay(h, day); if (q <= 0) return;
    const hist = getHistorySeries(h.ticker);
    let price = h.currentPrice, found = false;
    if (hist) {
      let c = null;
      for (const p of hist.series) { if (p.d <= day) c = p.c; else break; }
      if (c != null) { price = c; found = true; }
    }
    if (!found) approx = true;
    tot += toRefCcy(q * price, h.currency);
  });
  tot += accCash(acc, day);
  return { v: tot, approx };
}

// Performance pondérée des flux (Dietz modifié) depuis t0Day : gain = V1 − V0 − flux ; % = gain / (V0 + flux pondérés par leur ancienneté).
function accPerfPeriod(acc, t0Day, v0, inclusive) {
  const T = Date.now(), t0 = new Date(t0Day + 'T00:00:00').getTime();
  if (!(T > t0)) return null;
  const today = _dayKey(T);
  let F = 0, W = 0, P = 0;
  _accFlows(acc).forEach(f => {
    if (f.date > today || (inclusive ? f.date < t0Day : f.date <= t0Day)) return;
    const t = new Date(f.date + 'T00:00:00').getTime();
    F += f.amt; if (f.amt > 0) P += f.amt;
    W += f.amt * Math.max(0, (T - t) / (T - t0));
  });
  let denom = v0 + W;
  if (denom < 0.02 * (v0 + P)) denom = v0 + P;   // flux tout récents : on retombe sur le capital investi
  if (!(denom > 0)) return null;
  return { pct: (acc.value - v0 - F) / denom * 100, gain: acc.value - v0 - F };
}

// Résumé : YTD (depuis le 31 décembre précédent) et historique (depuis l'ouverture du compte).
function accPerfSummary(acc, perf) {
  if (!perf) return null;
  const ds = [..._accFlows(acc).map(f => f.date), ...(acc.holdings || []).flatMap(h => (h.transactions || []).map(t => t.date))].filter(Boolean).sort();
  const first = ds[0] || null;
  const t0 = perf.start && first ? (perf.start < first ? perf.start : first) : (perf.start || first);
  if (!t0) return null;
  const pye = (new Date().getFullYear() - 1) + '-12-31';
  const all = accPerfPeriod(acc, t0, 0, true);
  if (!all) return null;
  let ytd = all, approx = false;
  if (t0 <= pye) {
    const v0 = accValueOnDay(acc, pye); approx = v0.approx;
    ytd = accPerfPeriod(acc, pye, v0.v, false);
  }
  return { t0, pye, all, ytd, approx };
}
// Performance affichée dans la liste des comptes : la même que sur l'écran du compte (mode YTD ou historique mémorisé).
function accPerfPct(acc) {
  const sum = accPerfSummary(acc, accPerfInfo(acc));
  if (!sum) return null;
  const cur = _perfModeGet() === 'all' ? sum.all : sum.ytd;
  return cur ? cur.pct : null;
}

// Mouvements : un apport/retrait saisi dans une autre devise que celle du compte garde sa devise
const _getAccountMovesBase = getAccountMoves;
getAccountMoves = function (acc) {
  const mv = _getAccountMovesBase(acc);
  mv.forEach(m => {
    if (!m.cfId) return;
    const c = (acc.cashflows || []).find(x => x.id === m.cfId);
    if (c && c.ccy) m.ccy = c.ccy;
  });
  return mv;
};

// Bloc ajouté sous le résumé du compte : poches de liquidités, cumul des apports et des retraits, positions non autorisées
function _accExtraHTML(acc) {
  const perf = accPerfInfo(acc), ccy = acc.currency || S.currency;
  const pk = Object.entries(PU.accCashByCcy(acc)).filter(([, v]) => Math.abs(v) > 0.005);
  let h = '';
  if (pk.length > 1 || (pk.length === 1 && pk[0][0] !== ccy))
    h += `<div class='t-sm' style='margin-top:6px'>Poches de liquidités : ${pk.map(([c, v]) => `<b class='t-num'>${maskedNative(v, c)}</b>`).join(' · ')}</div>`;
  if (perf)
    h += `<div class='t-sm' style='margin-top:6px;display:flex;gap:4px 14px;flex-wrap:wrap'><span>Apports cumulés <b class='t-num'>${accNative(acc, perf.dep)}</b></span><span>Retraits cumulés <b class='t-num'>${accNative(acc, perf.wit)}</b></span></div>`;
  const bad = (acc.holdings || []).filter(x => typeof assetTypeError === 'function' && assetTypeError(acc, x.type, x.country));
  if (bad.length) h += `<div class='t-sm' style='margin-top:8px;color:var(--loss)'>Position non autorisée sur ce type de compte : ${bad.map(x => esc(x.ticker)).join(', ')}. Supprime-la ou change le type du compte.</div>`;
  return h;
}
const _renderAccountBase = renderAccount;
renderAccount = function () {
  let html = _renderAccountBase();
  const acc = S.accounts.find(a => a.id === S.accountId);
  if (!html || !acc) return html;
  // La date d'ouverture se saisit uniquement à la création ou à la modification du compte : le bouton « Date de début » de la consultation est masqué
  html = html.replace(/<span id="js-start-btn"[^>]*>[^<]*<\/span>/, '<span id="js-start-btn" style="display:none"></span>');
  const marker = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
  const i = html.indexOf(marker);
  return i < 0 ? html : html.slice(0, i) + _accExtraHTML(acc) + html.slice(i);
};

// Comparaison à un indice : téléchargement avec délai maximal (plus de « chargement » sans fin) et déclenchement garanti
async function loadBenchmark(key, startDay) {
  const b = BENCHMARKS[key]; if (!b) return;
  const tag = key + '|' + (startDay || '');
  if (_benchTried[tag]) return;
  _benchTried[tag] = true;
  const years = startDay ? (Date.now() - new Date(startDay + 'T00:00:00').getTime()) / (365.25 * 86400000) : 1;
  const range = years <= 0.9 ? '1y' : years <= 1.9 ? '2y' : years <= 4.9 ? '5y' : years <= 9.9 ? '10y' : 'max';
  const jobs = [['IDX:' + key, b.sym]];
  if (_benchNeedsFx(key)) jobs.push(['IDX:EURUSD', 'EURUSD=X']);
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), ms))]);
  await Promise.all(jobs.map(async ([id, sym]) => {
    try {
      const s = await withTimeout(_fetchYahooHistory(sym, range), 15000);
      if (s && s.length >= 2) saveHistory(id, s, 'USD');
    } catch (e) { dbgLog('[ERR]', 'Indice ' + id + ' : ' + (e?.message || e)); }
  }));
  if (S.screen === 'account') renderScreen('account');
}

// Comparatif avec l'indice : tableau Période / Compte / Indice / Écart.
// La performance de l'indice est calculée depuis la même date de début que celle du compte (date d'ouverture saisie, sinon premier mouvement) ;
// si l'historique déjà téléchargé ne remonte pas jusque-là, il est rechargé sur la bonne durée (une tentative par indice et par date de début).
function _bmCell(v) {
  return v == null ? "<span class='t-sm'>—</span>" : `<b class='${v < 0 ? 't-loss' : 't-gain'} t-num'>${fmtPct(v)}</b>`;
}
accBenchHTML = function (acc, perf, sum) {
  const key = accBenchmarkKey(acc), b = BENCHMARKS[key];
  const chip = `<span id='js-bm-btn' class='tap' style='padding:3px 10px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2);cursor:pointer'>${b ? 'Indice : ' + esc(b.label) : 'Comparer à un indice'}</span>`;
  if (!b) return `<div class='t-sm' style='margin-top:8px'>${chip}</div>`;
  if (!perf || !sum) return `<div class='t-sm' style='margin-top:8px'>${chip} · Ajoute un apport pour comparer</div>`;
  const t0 = sum.t0, ser = benchSeries(key);
  const covers = !!ser && new Date(ser.series[0].d + 'T00:00:00').getTime() <= new Date(t0 + 'T00:00:00').getTime() + 7 * 86400000;
  if (!covers && !_benchTried[key + '|' + t0]) {
    setTimeout(() => loadBenchmark(key, t0), 0);
    return `<div class='t-sm' style='margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap'>${chip}<span>chargement de l'indice…</span></div>`;
  }
  if (!ser) return `<div class='t-sm' style='margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap'>${chip}<span>indice indisponible pour le moment</span></div>`;
  const g = 'display:grid;grid-template-columns:1.7fr 1fr 1fr 1fr;gap:6px;align-items:baseline;font-size:12px';
  const bAll = benchRet(ser.series, t0);
  const sameYtd = sum.t0 > sum.pye;
  const bYtd = sameYtd ? bAll : benchRet(ser.series, sum.pye);
  const row = (lbl, a, r) => {
    const x = (a == null || r == null) ? null : a - r;
    return `<div style='${g};padding:7px 0;border-top:1px solid var(--border)'><span style='font-weight:700'>${lbl}</span>${_bmCell(a)}${_bmCell(r)}${x == null ? "<span class='t-sm'>—</span>" : `<b class='${x < 0 ? 't-loss' : 't-gain'} t-num'>${x >= 0 ? '+' : ''}${x.toFixed(1)} pts</b>`}</div>`;
  };
  const ccyNote = ser.conv ? 'indice converti en euros' : (b.ccy === 'USD' ? 'indice en dollars (non converti)' : 'indice dans sa devise');
  const partial = covers ? '' : ` · historique de l'indice disponible depuis le ${fmtDate(ser.series[0].d)} seulement`;
  return `<div style='margin-top:8px'>
    <div style='margin-bottom:8px'>${chip}</div>
    <div style='padding:4px 12px 6px;border-radius:12px;background:var(--card2)'>
      <div style='${g};padding:6px 0;color:var(--text2);font-size:11px;font-weight:700'><span>Période</span><span>Compte</span><span>${esc(b.label)}</span><span>Écart</span></div>
      ${sameYtd ? '' : row('Depuis le 1er janv.', sum.ytd ? sum.ytd.pct : null, bYtd)}
      ${row('Depuis le ' + fmtDate(t0), sum.all ? sum.all.pct : null, bAll)}
    </div>
    <div class='t-sm' style='font-size:10px;margin-top:4px'>Perf. du compte pondérée des apports et retraits${sum.approx ? ' · YTD approximatif (historique de cours incomplet)' : ''} · ${ccyNote}${partial}.</div>
  </div>`;
};

// Compteurs de la barre du bas : ordres en attente (même en mode démo), alertes de prix déclenchées, titres non synchronisés
function navBadgeCount(key) {
  try {
    if (key === 'stale')  return S.isDemo ? 0 : staleHoldings().length;
    if (key === 'orders') return loadOrders().filter(o => _ordLookup(o)).length;
    if (key === 'alerts') return alertsTriggeredCount();
  } catch (e) {}
  return 0;
}

// Menu : l'entrée « Alertes » s'affiche juste sous « Ordres »
const _renderDrawerBase = renderDrawer;
renderDrawer = function () {
  _renderDrawerBase();
  const d = document.getElementById('drawer');
  if (!d || _drawerEdit || !NAV_CATALOG.alerts) return;
  const o = d.querySelector('[data-dkey="orders"]');
  if (o && !d.querySelector('[data-dkey="alerts"]')) o.insertAdjacentHTML('afterend', drawerRow('alerts'));
};

// ── Régulariser les liquidités : plusieurs poches (devises) fixées à une même date. Corrige le niveau de liquidités, sans effet sur la performance. ──
let _ca2 = null;
document.body.insertAdjacentHTML('beforeend', `<div id='ca2-bg' class='add-modal-bg'></div>
<div id='ca2-sheet' class='add-modal-sheet' style='max-height:92vh;overflow-y:auto'><div class='modal-drag'></div><div class='modal-body' id='ca2-body'></div></div>`);
function _ca2Num(v) { return parseFloat(String(v).replace(',', '.')) || 0; }
function _ca2Rows(acc, date) {
  const pk = PU.accCashByCcy(acc, date);
  const set = new Set([acc.currency || S.currency, ...(acc.holdings || []).map(h => h.currency || 'EUR'), ...Object.keys(pk)]);
  return [...set].map(c => ({ ccy: c, val: String(Math.round((pk[c] || 0) * 100) / 100) }));
}
function openCa2(accId) {
  const acc = S.accounts.find(a => a.id === accId); if (!acc) return;
  const date = _dayKey(Date.now());
  _ca2 = { accId, date, rows: _ca2Rows(acc, date) };
  renderCa2();
  document.getElementById('ca2-bg').classList.add('show');
  document.getElementById('ca2-sheet').classList.add('show');
}
function closeCa2() {
  document.getElementById('ca2-bg').classList.remove('show');
  document.getElementById('ca2-sheet').classList.remove('show');
  _ca2 = null;
}
function renderCa2() {
  const acc = S.accounts.find(a => a.id === (_ca2 && _ca2.accId)); if (!acc) return;
  const adjs = [...(acc.cashAdjust || [])].sort((a, b) => b.date.localeCompare(a.date));
  const free = Object.keys(FX_RATES).filter(c => !_ca2.rows.some(r => r.ccy === c));
  const tot = _ca2.rows.reduce((s, r) => s + toRefCcy(_ca2Num(r.val), r.ccy), 0);
  const rows = _ca2.rows.map(r => `<div class='form-row'><div class='form-field'><div class='form-label'>Liquidités en ${esc(r.ccy)}</div><input class='form-input ca2-v' data-c='${esc(r.ccy)}' type='number' step='any' inputmode='decimal' value='${esc(r.val)}'></div></div>`).join('');
  const list = adjs.length ? `<div class='t-label' style='margin:16px 0 4px'>Régularisations enregistrées</div>` + adjs.map(a => `<div class='tx-item' style='padding:8px 0'><div class='flex1 col gap4' style='min-width:0'><div style='font-size:13px;font-weight:700'>${fmtDate(a.date)}</div><div class='t-sm'>${Object.entries(a.balances || {}).map(([c, v]) => maskedNative(+v || 0, c)).join(' · ')}</div></div><div class='tx-del-btn' data-ca2del='${esc(a.id)}' title='Supprimer'><svg viewBox='0 0 24 24' fill='currentColor'><path d='M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'/></svg></div></div>`).join('') : '';
  document.getElementById('ca2-body').innerHTML = `<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:12px'>
    <div class='modal-title' style='margin-bottom:0'>Régulariser les liquidités</div>
    <div id='ca2-close' style='width:32px;height:32px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:16px;flex-shrink:0'>✕</div></div>
    <div class='t-sm' style='margin-bottom:12px'>Indique, pour une même date, le solde réel de chaque poche de liquidités (relevé du courtier). Cela corrige le niveau de liquidités du compte ; ce n'est ni un apport ni un retrait.</div>
    <div class='form-row'><div class='form-field'><div class='form-label'>Date</div><input class='form-input' type='date' id='ca2-date' value='${esc(_ca2.date)}'></div></div>
    ${rows}
    ${free.length ? `<div style='display:flex;gap:8px;align-items:center;margin:4px 0 10px'><select class='form-input' id='ca2-add-sel' style='flex:1;cursor:pointer'>${free.map(c => `<option value='${c}'>${c}</option>`).join('')}</select><div id='ca2-add' class='tap' style='padding:8px 14px;border-radius:20px;border:1px solid var(--border);font-size:12px;font-weight:700;color:var(--text2);cursor:pointer'>+ Devise</div></div>` : ''}
    <div class='t-sm' style='margin-bottom:10px'>Total : <b id='ca2-tot' class='t-num'>${masked(tot)}</b> (devise de l'appli)</div>
    <button class='form-submit' id='ca2-save'>Enregistrer</button>
    ${list}`;
}
function saveCa2() {
  const acc = S.accounts.find(a => a.id === (_ca2 && _ca2.accId)); if (!acc) return;
  const date = _ca2.date || _dayKey(Date.now());
  const balances = {};
  _ca2.rows.forEach(r => { balances[r.ccy] = Math.round(_ca2Num(r.val) * 100) / 100; });
  acc.cashAdjust = (acc.cashAdjust || []).filter(a => a.date !== date).concat({ id: 'ca_' + Date.now().toString(36), date, balances }).sort((a, b) => a.date < b.date ? -1 : 1);
  acc.value = accTotal(acc);
  closeCa2();
  renderScreen('account');
  refreshMain();
  toast('Liquidités régularisées ✓');
}
document.getElementById('ca2-bg').addEventListener('click', closeCa2);
document.getElementById('ca2-body').addEventListener('click', e => {
  if (!_ca2) return;
  if (e.target.closest('#ca2-close')) return closeCa2();
  if (e.target.closest('#ca2-add')) {
    const v = document.getElementById('ca2-add-sel').value;
    if (v) { _ca2.rows.push({ ccy: v, val: '0' }); renderCa2(); }
    return;
  }
  if (e.target.closest('#ca2-save')) return saveCa2();
  const d = e.target.closest('[data-ca2del]');
  if (d) {
    const acc = S.accounts.find(a => a.id === _ca2.accId); if (!acc) return;
    acc.cashAdjust = (acc.cashAdjust || []).filter(a => a.id !== d.dataset.ca2del);
    acc.value = accTotal(acc);
    renderCa2(); renderScreen('account'); refreshMain();
  }
});
document.getElementById('ca2-body').addEventListener('input', e => {
  const i = e.target.closest('.ca2-v'); if (!i || !_ca2) return;
  const r = _ca2.rows.find(x => x.ccy === i.dataset.c); if (r) r.val = i.value;
  const el = document.getElementById('ca2-tot');
  if (el) el.innerHTML = masked(_ca2.rows.reduce((s, x) => s + toRefCcy(_ca2Num(x.val), x.ccy), 0));
});
document.getElementById('ca2-body').addEventListener('change', e => {
  if (e.target.id !== 'ca2-date' || !_ca2) return;
  const acc = S.accounts.find(a => a.id === _ca2.accId); if (!acc) return;
  _ca2.date = e.target.value || _ca2.date;
  _ca2.rows = _ca2Rows(acc, _ca2.date);
  renderCa2();
});
// Le bouton « Régulariser les liquidités » de l'écran du compte ouvre cette fenêtre (capture : l'ancien gestionnaire n'est pas appelé)
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#js-ca-btn')) return;
  e.stopPropagation(); e.preventDefault();
  openCa2(S.accountId);
}, true);
registerModal('ca2-sheet', closeCa2);

// ═══════════════════════════════════════════════
// INIT — charge les données puis dessine l'appli (les modules ci-dessus sont déjà évalués)
// ═══════════════════════════════════════════════
const _hasData=loadData();
loadDca();
_bgPrivacySync();   // le pré-script a lu localStorage ; on repart de l'état chargé
_idleReset();       // arme le masquage par inactivité (no-op si S.bgIdle=0)
// Si aucune donnée ou en mode démo → régénérer les données d'exemple (jamais persistées)
if(!_hasData || S.isDemo) S.accounts=genDemo();
// Première ouverture : sauvegarder les préférences par défaut
if(!_hasData) saveData();
// Appliquer thème sauvegardé (auto suit le système)
applyTheme(S.theme);
// Appliquer le cache de prix uniquement en mode réel
const _priceCache=loadPrices();
if(_priceCache?.fxRates) {
  Object.assign(FX_RATES, _priceCache.fxRates);
  _fxUpdatedAt = _priceCache.fxUpdatedAt || null;
}
if(_priceCache && !S.isDemo) applyPrices(_priceCache);
// Recalculer les soldes : le `acc.value` stocké peut dater d'avant la prise en compte des liquidités
S.accounts.forEach(a => { a.value = accTotal(a); });
// Historique du patrimoine : reconstruire le passé manquant puis figer le point du jour (mode réel)
if(!S.isDemo) { backfillWealthHistory(); snapshotWealth(); }
['dashboard','comptes','recherche','analysis'].forEach(renderScreen);
renderNav();
document.getElementById('nav').classList.remove('hidden');
// Sécurité : sonder le capteur biométrique, puis armer le verrou s'il est configuré
bioAvailable().then(v => {
  _bioOk = v;
  if (_lockState) {                    // overlay déjà affiché → révéler le bouton empreinte
    _lockPaint('');
    if (_lockState.mode === 'unlock' && S.lockBio && S.lockBioId) _lockBio();
  }
});
if (lockArmed()) lockApp();
else document.documentElement.classList.remove('locked');
// Suivre les changements du thème système (uniquement en mode auto)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{
  if(S.theme==='auto') applyTheme('auto');
});
// Auto-refresh au démarrage (uniquement si activé dans les réglages)
if (S.autoRefresh && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const _stale = !S.lastPriceUpdate || (Date.now() - S.lastPriceUpdate > 15 * 60 * 1000);
  if (_stale) setTimeout(fetchLivePrices, 800);
}
// Popup changelog si nouvelle version
try {
  if (localStorage.getItem(STORE_VERSION) !== APP_VERSION) {
    // La version suit le cache : un simple bump technique n'a pas forcément de notes.
    // Sans entrée, on enregistre la version sans afficher une fenêtre vide.
    if (!(CHANGELOG[APP_VERSION] || []).length) {
      localStorage.setItem(STORE_VERSION, APP_VERSION);
    } else {
      const _showCl = () => openChangelogModal(true);
      if (isLocked()) _lockPending = _showCl;   // différé jusqu'au déverrouillage
      else setTimeout(_showCl, 600);
    }
  }
} catch(e) {}

// Retour Android + Échap : js/core/back-handler.js. Mise à jour + enregistrement du service worker : js/core/app-update.js.
