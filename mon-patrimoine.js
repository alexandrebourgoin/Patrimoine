// ═══════════════════════════════════════════════
// MON PATRIMOINE — point d'entrée. Scripts classiques (pas d'ES modules), chargés dans l'ordre de mon-patrimoine.html :
//   utils.js (PU, fonctions pures) → js/core/dom-guard.js → js/data/*  (tables, démo, changelog)
//   → js/core/{screens,modals,storage,ui,navigation,shell}.js → js/services/* (cours, CSV)
//   → js/features/* (verrou, DCA, assistant, glisser-déposer, graphiques, confidentialité)
//   → js/modals/* → js/screens/* → CE FICHIER.
// Ici : état global S, version, wrappers de formatage/devises, correctifs de comptes, écran Immobilier, initialisation, retour Android, mise à jour, SW.
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
const APP_VERSION = '1.11.130';
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

// Compteurs de la barre du bas : « Ordres » = ordres en cours + alertes de prix déclenchées (même en mode démo) ; « Non synchro » = titres sans cours récent
function navBadgeCount(key) {
  try {
    if (key === 'stale')  return S.isDemo ? 0 : staleHoldings().length;
    if (key === 'orders') return loadOrders().filter(o => _ordLookup(o)).length + alertsTriggeredCount();
  } catch (e) {}
  return 0;
}

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
// IMMOBILIER — biens (résidence principale, bien locatif), valeur estimée, crédit simplifié et tableau d'amortissement.
// Volontairement simple : ni loyers, ni fiscalité. On suit seulement : combien le bien a coûté, combien il vaut (hypothèse de prise de valeur
// annuelle constante) et combien du crédit est remboursé. Données dans localStorage (clé patrimoine-immo), hors patrimoine total pour l'instant.
// Bien : { id, name, kind:'main'|'rental', buyDate, price, notary, works, growth,
//          loan: null | { amount, rate (%/an), years, payment (mensualité totale saisie, optionnelle), first (1re échéance, optionnelle) } }
// ═══════════════════════════════════════════════
const STORE_IMMO = 'patrimoine-immo';
function loadImmo() {
  try { const a = JSON.parse(localStorage.getItem(STORE_IMMO) || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function saveImmo(a) { try { localStorage.setItem(STORE_IMMO, JSON.stringify(a)); } catch (e) {} }
const IMMO_KIND = { main: 'Résidence principale', rental: 'Bien locatif' };

// Date + n mois, en gardant le jour (ramené à la fin du mois si besoin)
function _immoAddMonths(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const base = new Date(y, m - 1 + n, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return _dayKey(new Date(base.getFullYear(), base.getMonth(), Math.min(d, last)));
}
// Crédit : mensualité théorique (hors assurance), assurance déduite de la mensualité saisie, tableau complet, échéances passées / à venir
function immoLoan(p) {
  const L = p.loan;
  if (!L || !(L.amount > 0) || !(L.years > 0)) return null;
  const n = Math.round(L.years * 12), r = (L.rate || 0) / 1200;
  const pmt = r > 0 ? L.amount * r / (1 - Math.pow(1 + r, -n)) : L.amount / n;
  const ins = L.payment > 0 ? Math.max(0, L.payment - pmt) : 0;
  const first = L.first || _immoAddMonths(p.buyDate || _dayKey(Date.now()), 1);
  const today = _dayKey(Date.now());
  const rows = [];
  let bal = L.amount;
  for (let k = 1; k <= n; k++) {
    const interest = bal * r;
    let princ = pmt - interest;
    if (k === n || princ > bal) princ = bal;
    bal = Math.max(0, bal - princ);
    const date = _immoAddMonths(first, k - 1);
    rows.push({ k, date, pmt: princ + interest, princ, interest, ins, bal, past: date <= today });
  }
  const past = rows.filter(x => x.past);
  const repaid = past.reduce((s, x) => s + x.princ, 0);
  return {
    n, pmt, ins, rows, repaid, remaining: L.amount - repaid, pct: repaid / L.amount * 100,
    interestPaid: past.reduce((s, x) => s + x.interest, 0), insPaid: past.reduce((s, x) => s + x.ins, 0),
    next: rows.find(x => !x.past) || null, end: rows[rows.length - 1].date,
    warn: L.payment > 0 && L.payment < pmt - 1,
  };
}
// Valeurs d'un bien : coût d'acquisition, valeur estimée (prix d'achat × (1 + croissance)^années écoulées), dette restante, patrimoine net
function immoCalc(p) {
  const cost = (p.price || 0) + (p.notary || 0) + (p.works || 0);
  const t = Math.max(0, (Date.now() - new Date(p.buyDate + 'T00:00:00').getTime()) / (365.25 * 86400000));
  const value = (p.price || 0) * Math.pow(1 + (p.growth || 0) / 100, t);
  const loan = immoLoan(p), debt = loan ? loan.remaining : 0;
  return { cost, t, value, loan, debt, equity: value - debt, gap: value - cost };
}
function _immoAge(t) {
  const y = Math.floor(t), m = Math.floor((t - y) * 12);
  return y ? `${y} an${y > 1 ? 's' : ''}${m ? ' ' + m + ' mois' : ''}` : (m ? m + ' mois' : "moins d'un mois");
}
function _immoRow(k, v, strong) {
  return `<div style='display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:${strong ? 14 : 13}px;${strong ? 'font-weight:800' : ''}'><span style='color:${strong ? 'var(--text)' : 'var(--text2)'}'>${k}</span><span class='t-num' style='text-align:right'>${v}</span></div>`;
}
function _immoSigned(v) { return `<span class='${v < 0 ? 't-loss' : 't-gain'}'>${v >= 0 ? '+' : '−'}${masked(Math.abs(v))}</span>`; }

function renderImmo() {
  const list = loadImmo().filter(p => p.buyDate).map(p => ({ p, c: immoCalc(p) }));
  const sum = k => list.reduce((s, x) => s + x.c[k], 0);
  const summary = list.length ? `<div style='margin:14px 20px 0;padding:14px;border-radius:14px;background:var(--card);border:1px solid var(--border)'>
      ${_immoRow('Valeur estimée', `<b>${masked(sum('value'))}</b>`)}
      ${_immoRow('Capital restant dû', masked(sum('debt')))}
      ${_immoRow('Patrimoine immobilier net', masked(sum('equity')), true)}
      <div style='border-top:1px solid var(--border);margin:6px 0'></div>
      ${_immoRow('Coût total d\'acquisition', masked(sum('cost')))}
      ${_immoRow('Écart valeur − coût', _immoSigned(sum('gap')))}
    </div>` : '';
  const cards = list.map(({ p, c }) => {
    const L = c.loan;
    const loanBlock = L ? `
      <div style='margin-top:12px;padding-top:10px;border-top:1px solid var(--border)'>
        <div style='display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px'><span>Crédit remboursé</span><span class='t-num'>${L.pct.toFixed(1)} %</span></div>
        <div style='height:8px;border-radius:4px;background:var(--card);overflow:hidden'><div style='width:${Math.min(100, L.pct).toFixed(1)}%;height:100%;background:var(--gain)'></div></div>
        ${_immoRow('Capital remboursé', `${masked(L.repaid)} <span class='t-sm'>/ ${masked(p.loan.amount)}</span>`)}
        ${_immoRow('Capital restant dû', masked(L.remaining))}
        ${_immoRow('Mensualité', `${masked(p.loan.payment > 0 ? p.loan.payment : L.pmt)}${L.ins > 0.005 ? ` <span class='t-sm'>dont assurance ≈ ${masked(L.ins)}</span>` : ''}`)}
        ${_immoRow('Intérêts payés' + (L.ins > 0.005 ? ' + assurance' : ''), masked(L.interestPaid + L.insPaid))}
        ${L.next ? _immoRow('Prochaine échéance', fmtDate(L.next.date)) : ''}
        ${_immoRow('Fin du prêt', fmtDate(L.end))}
        ${L.warn ? `<div class='t-sm' style='color:var(--loss);margin-top:4px'>La mensualité saisie est inférieure à la mensualité calculée (${masked(L.pmt)}) : vérifie le taux ou la durée.</div>` : ''}
      </div>` : '';
    return `<div style='margin:14px 20px 0;padding:14px;border-radius:14px;background:var(--card2);border:1px solid var(--border)'>
      <div style='display:flex;justify-content:space-between;align-items:center;gap:8px'>
        <div style='font-size:16px;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>🏠 ${esc(p.name)}</div>
        <span style='font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--card);color:var(--text2);flex-shrink:0'>${esc(IMMO_KIND[p.kind] || 'Bien')}</span>
      </div>
      <div class='t-sm' style='margin:2px 0 8px'>Acheté le ${fmtDate(p.buyDate)} · il y a ${_immoAge(c.t)}</div>
      ${_immoRow("Prix d'achat", masked(p.price))}
      ${p.notary > 0 ? _immoRow('Frais de notaire', masked(p.notary)) : ''}
      ${p.works > 0 ? _immoRow('Travaux', masked(p.works)) : ''}
      ${_immoRow('Coût total', `<b>${masked(c.cost)}</b>`)}
      <div style='border-top:1px solid var(--border);margin:6px 0'></div>
      ${_immoRow(`Valeur estimée <span class='t-sm'>(+${p.growth || 0} %/an)</span>`, `<b>${masked(c.value)}</b>`)}
      ${_immoRow('Écart valeur − coût', _immoSigned(c.gap))}
      ${loanBlock}
      <div style='border-top:1px solid var(--border);margin:8px 0 2px'></div>
      ${_immoRow('Patrimoine net du bien' + (L ? ' <span class="t-sm">(valeur − capital restant dû)</span>' : ''), masked(c.equity), true)}
      <div style='display:flex;gap:8px;margin-top:12px;flex-wrap:wrap'>
        <button class='confirm-cancel' data-imedit='${esc(p.id)}' style='flex:1;height:40px;border-radius:12px;font-weight:700;cursor:pointer'>Modifier</button>
        ${L ? `<button class='confirm-cancel' data-imamort='${esc(p.id)}' style='flex:2;height:40px;border-radius:12px;font-weight:700;cursor:pointer'>Tableau d'amortissement</button>` : ''}
        <button class='confirm-cancel' data-imdel='${esc(p.id)}' style='height:40px;padding:0 14px;border-radius:12px;font-weight:700;cursor:pointer;color:var(--loss)'>Supprimer</button>
      </div>
    </div>`;
  }).join('');
  return `<div class='back tap' id='js-back'>
    <svg viewBox='0 0 24 24' fill='currentColor'><path d='M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'/></svg>
    Retour
  </div>
  <div class='settings-top' style='padding-top:4px'>
    <div class='t-title'>Immobilier</div>
    <div class='t-sm' style='margin-top:2px'>Ce que t'a coûté chaque bien, ce qu'il vaut (hypothèse de prise de valeur annuelle) et ce que tu as remboursé. Ni loyers, ni fiscalité.</div>
  </div>
  ${summary}
  <div style='margin:14px 20px 0'><button class='form-submit' data-imnew='1' style='margin:0'>+ Ajouter un bien</button></div>
  ${cards || "<div class='t-sm' style='text-align:center;padding:30px 20px'>Aucun bien. Ajoute ta résidence principale ou un bien locatif.</div>"}
  <div style='height:100px'></div>`;
}
function bindImmo(el) {
  el.querySelector('#js-back')?.addEventListener('click', back);
  el.onclick = e => {
    if (e.target.closest('[data-imnew]')) return openImmoForm();
    const ed = e.target.closest('[data-imedit]'); if (ed) return openImmoForm(ed.dataset.imedit);
    const am = e.target.closest('[data-imamort]'); if (am) return openImmoAmort(am.dataset.imamort);
    const de = e.target.closest('[data-imdel]');
    if (de) {
      const id = de.dataset.imdel, p = loadImmo().find(x => x.id === id);
      openConfirm(`Supprimer le bien "${p ? p.name : ''}" ?`, () => { saveImmo(loadImmo().filter(x => x.id !== id)); renderScreen('immo'); toast('Bien supprimé'); });
    }
  };
}

// Écran + feuilles créés ici (le HTML n'a pas à les déclarer)
(function () {
  const ref = document.getElementById('s-dca');
  if (ref && !document.getElementById('s-immo')) {
    const d = document.createElement('div');
    d.id = 's-immo'; d.className = 'screen no-nav';
    ref.insertAdjacentElement('afterend', d);
  }
  const closeBtn = `width:32px;height:32px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:16px;flex-shrink:0`;
  const fld = (id, label, extra) => `<div class='form-field'><div class='form-label'>${label}</div><input class='form-input' id='${id}' ${extra || "type='number' step='any' inputmode='decimal'"}></div>`;
  document.body.insertAdjacentHTML('beforeend', `
<div id='im-bg' class='add-modal-bg'></div>
<div id='im-sheet' class='add-modal-sheet' style='max-height:92vh;overflow-y:auto'>
  <div class='modal-drag'></div>
  <div class='modal-body'>
    <div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:14px'>
      <div class='modal-title' id='im-title' style='margin-bottom:0'>Nouveau bien</div>
      <div id='im-close' style='${closeBtn}'>✕</div>
    </div>
    <div class='form-row'>${fld('im-name', 'Nom du bien', "type='text' placeholder='Appartement, maison…'")}</div>
    <div class='form-row'><div class='form-field'><div class='form-label'>Type</div><select class='form-input' id='im-kind' style='cursor:pointer'><option value='main'>Résidence principale</option><option value='rental'>Bien locatif</option></select></div></div>
    <div class='t-label' style='margin:6px 0 6px'>Achat</div>
    <div class='form-row'>${fld('im-date', "Date d'achat", "type='date'")}${fld('im-price', "Prix d'achat", "type='number' step='any' inputmode='decimal' placeholder='100000'")}</div>
    <div class='form-row'>${fld('im-notary', 'Frais de notaire', "type='number' step='any' inputmode='decimal' placeholder='10000'")}${fld('im-works', 'Travaux', "type='number' step='any' inputmode='decimal' placeholder='0'")}</div>
    <div class='t-sm' style='margin:-4px 0 10px'>Frais de notaire : environ 7,5 à 8 % dans l'ancien, 2 à 3 % dans le neuf. <span id='im-notary-est' class='tap' style='color:var(--accent);font-weight:700;cursor:pointer'>Estimer à 8 %</span></div>
    <div class='form-row'>${fld('im-growth', 'Prise de valeur annuelle estimée (%/an)', "type='number' step='0.1' inputmode='decimal' placeholder='2'")}</div>
    <div class='t-label' style='margin:10px 0 6px'>Crédit immobilier <span class='t-sm'>(facultatif)</span></div>
    <div class='form-row'>${fld('im-l-amt', 'Montant emprunté', "type='number' step='any' inputmode='decimal' placeholder='90000'")}${fld('im-l-rate', 'Taux annuel (%)', "type='number' step='0.01' inputmode='decimal' placeholder='3.5'")}</div>
    <div class='form-row'>${fld('im-l-years', 'Durée (années)', "type='number' step='any' inputmode='decimal' placeholder='20'")}${fld('im-l-pay', 'Mensualité totale (assurance comprise)', "type='number' step='any' inputmode='decimal' placeholder='facultatif'")}</div>
    <div class='form-row'>${fld('im-l-first', 'Première échéance (si différente)', "type='date'")}</div>
    <div id='im-prev' class='t-sm' style='margin:2px 0 12px'></div>
    <button class='form-submit' id='im-save'>Enregistrer</button>
  </div>
</div>
<div id='ima-bg' class='add-modal-bg'></div>
<div id='ima-sheet' class='add-modal-sheet' style='max-height:92vh;overflow-y:auto'>
  <div class='modal-drag'></div>
  <div class='modal-body' id='ima-body'></div>
</div>`);
})();

let _imEditId = null;
function _imNum(id) { return parseFloat(String(document.getElementById(id).value).replace(',', '.')) || 0; }
function _imRead() {
  const g = id => document.getElementById(id).value;
  const amt = _imNum('im-l-amt');
  return {
    name: g('im-name').trim(), kind: g('im-kind'), buyDate: g('im-date'),
    price: _imNum('im-price'), notary: _imNum('im-notary'), works: _imNum('im-works'), growth: _imNum('im-growth'),
    loan: amt > 0 ? { amount: amt, rate: _imNum('im-l-rate'), years: _imNum('im-l-years'), payment: _imNum('im-l-pay'), first: g('im-l-first') || '' } : null,
  };
}
// Aperçu du crédit pendant la saisie : mensualité théorique et assurance déduite de la mensualité saisie
function _imPreview() {
  const el = document.getElementById('im-prev'); if (!el) return;
  const p = _imRead(), L = immoLoan(p);
  if (!L) { el.innerHTML = p.loan ? "Indique la durée du crédit pour calculer l'échéancier." : ''; return; }
  const financed = (p.price + p.notary + p.works) > 0 ? ` · ${(p.loan.amount / (p.price + p.notary + p.works) * 100).toFixed(0)} % du coût total financé` : '';
  el.innerHTML = `Mensualité calculée (hors assurance) : <b>${masked(L.pmt)}</b> sur ${L.n} mois${financed}.` +
    (p.loan.payment > 0 ? (L.ins > 0.005 ? ` Assurance déduite : <b>≈ ${masked(L.ins)}</b>/mois.` : (L.warn ? ' <span style="color:var(--loss)">La mensualité saisie est inférieure au calcul : vérifie taux et durée.</span>' : ' Aucune assurance détectée.')) : ' Saisis ta mensualité totale pour en déduire l\'assurance.');
}
function openImmoForm(id) {
  const p = id ? loadImmo().find(x => x.id === id) : null;
  _imEditId = p ? p.id : null;
  const set = (i, v) => { document.getElementById(i).value = (v === undefined || v === null || v === 0 && i !== 'im-growth') ? '' : v; };
  document.getElementById('im-title').textContent = p ? 'Modifier le bien' : 'Nouveau bien';
  set('im-name', p ? p.name : ''); document.getElementById('im-kind').value = p ? p.kind : 'main';
  set('im-date', p ? p.buyDate : ''); set('im-price', p ? p.price : ''); set('im-notary', p ? p.notary : ''); set('im-works', p ? p.works : '');
  set('im-growth', p ? p.growth : 2);
  const L = p && p.loan;
  set('im-l-amt', L ? L.amount : ''); set('im-l-rate', L ? L.rate : ''); set('im-l-years', L ? L.years : ''); set('im-l-pay', L ? L.payment : ''); set('im-l-first', L ? L.first : '');
  _imPreview();
  document.getElementById('im-bg').classList.add('show');
  document.getElementById('im-sheet').classList.add('show');
}
function closeImmoForm() {
  document.getElementById('im-bg').classList.remove('show');
  document.getElementById('im-sheet').classList.remove('show');
  _imEditId = null;
}
document.getElementById('im-bg').addEventListener('click', closeImmoForm);
document.getElementById('im-close').addEventListener('click', closeImmoForm);
document.getElementById('im-sheet').addEventListener('input', _imPreview);
document.getElementById('im-notary-est').addEventListener('click', () => {
  const price = _imNum('im-price');
  if (!(price > 0)) return toast("Saisis d'abord le prix d'achat");
  document.getElementById('im-notary').value = Math.round(price * 0.08);
  _imPreview();
});
document.getElementById('im-save').addEventListener('click', () => {
  const p = _imRead();
  if (!p.buyDate) return toast("La date d'achat est obligatoire");
  if (!(p.price > 0)) return toast("Indique le prix d'achat");
  if (p.loan && !(p.loan.years > 0)) return toast('Indique la durée du crédit');
  if (!p.name) p.name = IMMO_KIND[p.kind] || 'Bien';
  const all = loadImmo();
  if (_imEditId && all.some(x => x.id === _imEditId)) {
    const i = all.findIndex(x => x.id === _imEditId);
    all[i] = { ...all[i], ...p, id: _imEditId };
  } else {
    all.push({ id: 'im' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ...p });
  }
  saveImmo(all);
  closeImmoForm();
  if (S.screen === 'immo') renderScreen('immo');
  toast('Bien enregistré ✓');
});

// Tableau d'amortissement : une ligne par année, dépliable en échéances mensuelles (passées en gris, prochaine mise en évidence)
function openImmoAmort(id) {
  const p = loadImmo().find(x => x.id === id), L = p && immoLoan(p);
  if (!L) return;
  const years = {};
  L.rows.forEach(r => { (years[r.date.slice(0, 4)] = years[r.date.slice(0, 4)] || []).push(r); });
  const g = 'display:grid;grid-template-columns:1.3fr 1fr 1fr 1.2fr;gap:6px;align-items:baseline;font-size:12px';
  const head = `<div style='${g};padding:6px 0;color:var(--text2);font-size:11px;font-weight:700'><span>Date</span><span>Capital</span><span>Intérêts</span><span>Reste dû</span></div>`;
  const body = Object.entries(years).map(([y, rows]) => {
    const cap = rows.reduce((s, r) => s + r.princ, 0), int = rows.reduce((s, r) => s + r.interest, 0), last = rows[rows.length - 1];
    const allPast = rows.every(r => r.past), somePast = rows.some(r => r.past);
    const months = rows.map(r => `<div style='${g};padding:5px 0;border-top:1px solid var(--border);${r.past ? 'opacity:.55' : ''}${L.next && r.k === L.next.k ? ';font-weight:800;color:var(--accent)' : ''}'><span>${fmtDate(r.date)}</span><span class='t-num'>${masked(r.princ)}</span><span class='t-num'>${masked(r.interest)}</span><span class='t-num'>${masked(r.bal)}</span></div>`).join('');
    return `<details ${somePast && !allPast ? 'open' : ''} style='border-top:1px solid var(--border)'>
      <summary style='cursor:pointer;padding:9px 0;${g};list-style:none;${allPast ? 'opacity:.6' : ''}'><b>${y}${allPast ? ' ✓' : ''}</b><span class='t-num'>${masked(cap)}</span><span class='t-num'>${masked(int)}</span><span class='t-num'>${masked(last.bal)}</span></summary>
      ${months}
    </details>`;
  }).join('');
  document.getElementById('ima-body').innerHTML = `<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:10px'>
      <div class='modal-title' style='margin-bottom:0'>Amortissement — ${esc(p.name)}</div>
      <div id='ima-close' style='width:32px;height:32px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:16px;flex-shrink:0'>✕</div></div>
    <div class='t-sm' style='margin-bottom:8px'>${L.n} échéances · mensualité ${masked(L.pmt)}${L.ins > 0.005 ? ` + assurance ≈ ${masked(L.ins)}` : ''} · échéances passées en gris, prochaine en couleur. Touche une année pour voir les mois.</div>
    ${head}${body}`;
  document.getElementById('ima-bg').classList.add('show');
  document.getElementById('ima-sheet').classList.add('show');
}
function closeImmoAmort() {
  document.getElementById('ima-bg').classList.remove('show');
  document.getElementById('ima-sheet').classList.remove('show');
}
document.getElementById('ima-bg').addEventListener('click', closeImmoAmort);
document.getElementById('ima-body').addEventListener('click', e => { if (e.target.closest('#ima-close')) closeImmoAmort(); });
registerModal('im-sheet', closeImmoForm);
registerModal('ima-sheet', closeImmoAmort);

// Raccourci « Immobilier » (barre du bas personnalisable) + entrée de menu sous « DCA » ; l'écran est rendu ici (navigation.js ne le connaît pas)
_NAV_PATH.immo = 'M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z';
NAV_CATALOG.immo = { label: 'Immobilier', kind: 'screen' };
const _renderScreenBase = renderScreen;
renderScreen = function (id) {
  if (id === 'immo') {
    const el = document.getElementById('s-immo');
    if (el) { el.innerHTML = renderImmo(); bindImmo(el); }
    return;
  }
  return _renderScreenBase(id);
};
const _renderDrawerImmoBase = renderDrawer;
renderDrawer = function () {
  _renderDrawerImmoBase();
  const d = document.getElementById('drawer');
  if (!d || _drawerEdit) return;
  const o = d.querySelector('[data-dkey="dca"]');
  if (o && !d.querySelector('[data-dkey="immo"]')) o.insertAdjacentHTML('afterend', drawerRow('immo'));
};

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
