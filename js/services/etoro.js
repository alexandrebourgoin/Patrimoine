// Compte eToro synchronisé en lecture seule (E14, spécification : claude/spec-E14-comptes-api.md du projet).
// API publique eToro (api-portal.etoro.com, vérifié le 26/11/2026) :
//   GET /trading/info/real/pnl         → clientPortfolio : credit, positions (avec unrealizedPnL), mirrors (copy trading), ordres
//   GET /market-data/instruments?instrumentIds=1,2 → instrumentDisplayDatas : nom, symbole, type
//   En-têtes : x-api-key (clé publique), x-user-key (clé utilisateur), x-request-id (UUID). Quota : 60 requêtes / 60 s.
// Solde = « equity » au sens d'eToro (guide « Calculate equity ») :
//   liquidités disponibles + montants investis + plus-values latentes, copies de traders comprises. Montants en USD.
//
// Service lié « eToro » du registre LINKED_SERVICES (js/services/linked.js) : appels par le proxy des cours
// (?api=etoro&call=pnl | instruments), clés sur l'appareil, synchro avec les cours.
//
// Partie pure (testée sans réseau) : etoroPortfolio(). Partie réseau : etoroLoad(), etoroSync().

// Clé publique (x-api-key) : identique pour tous les utilisateurs, affichée par eToro dans Paramètres → Trading → Gestion des clés API
// et publiée par eToro (www.etoro.com/wp-content/uploads/agent-portfolios/SKILL.md). Connue de l'app : seule la clé utilisateur est saisie.
const ETORO_PUBLIC_KEY = 'sdgdskldFPLGfjHn1421dgnlxdGTbngdflg6290bRjslfihsjhSDsdgGHH25hjf';
// Types d'instruments eToro (instrumentTypeID) → type de position de l'app
const ETORO_TYPES = { 5: 'Action', 6: 'ETF', 10: 'Crypto' };

// ── Conversion pure : réponse eToro → positions et liquidités de l'app ──
// Les exemples de la documentation mélangent « instrumentID » et « instrumentId » : on lit les deux.
const _eg = (o, ...names) => { for (const n of names) if (o && o[n] != null) return o[n]; return undefined; };
const _enum = v => (Number.isFinite(+v) ? +v : 0);
const _epnl = p => _enum(_eg(p.unrealizedPnL || {}, 'pnL', 'pnl') ?? _eg(p, 'pnL', 'pnl'));

// pnl : réponse de /trading/info/real/pnl ; instruments : { [id]: { instrumentDisplayName, symbolFull, instrumentTypeID } }
// → { equity, cash, invested, unrealized, holdings:[{ key, ticker, name, type, units, cost, value, leveraged, opened }], mirrors:[…] }
//   Tous les montants en USD. value = montant investi + plus-value latente (juste aussi pour CFD, levier et vente à découvert).
function etoroPortfolio(pnl, instruments = {}) {
  const cp = (pnl && (pnl.clientPortfolio || pnl.ClientPortfolio)) || {};
  const positions = cp.positions || [];
  const mirrors = cp.mirrors || [];
  const own = (cp.ordersForOpen || []).filter(o => !_enum(_eg(o, 'mirrorID', 'mirrorId')));
  const ordersAmt = own.reduce((s, o) => s + _enum(o.amount), 0) + (cp.orders || []).reduce((s, o) => s + _enum(o.amount), 0);
  const orderCosts = own.reduce((s, o) => s + _enum(o.totalExternalCosts), 0);

  // Positions en propre, regroupées par instrument et par nature (achat au comptant / CFD, levier ou vente)
  const groups = {};
  positions.forEach(p => {
    const id = _enum(_eg(p, 'instrumentID', 'instrumentId'));
    const lev = _enum(p.leverage) || 1, buy = p.isBuy !== false, settle = _enum(_eg(p, 'settlementTypeID', 'settlementTypeId'));
    const leveraged = !buy || lev > 1 || settle === 0;
    const key = id + (leveraged ? (buy ? ':cfd' : ':short') : '');
    const g = groups[key] ||= { key, id, units: 0, cost: 0, value: 0, leveraged, short: !buy, lev, opened: null };
    const amount = _enum(p.amount), units = _enum(p.units);
    g.units += units; g.cost += amount; g.value += amount + _epnl(p);
    const d = String(_eg(p, 'openDateTime') || '').slice(0, 10);
    if (d && (!g.opened || d < g.opened)) g.opened = d;
  });
  const holdings = Object.values(groups).map(g => {
    const ins = instruments[g.id] || {};
    const sym = ins.symbolFull || ('ETORO-' + g.id);
    const kind = g.short ? ' · vente' : g.leveraged ? (g.lev > 1 ? ` · CFD ×${g.lev}` : ' · CFD') : '';
    return { key: g.key, instrumentId: g.id, ticker: sym, name: (ins.instrumentDisplayName || sym) + kind,
      type: ETORO_TYPES[_enum(ins.instrumentTypeID)] || 'Action', units: g.units, cost: g.cost, value: g.value,
      leveraged: g.leveraged, opened: g.opened };
  });

  // Copies de traders : une ligne par trader, sans le détail de ses titres
  const mirrorLines = mirrors.map(m => {
    const mp = m.positions || [], closed = _enum(m.closedPositionsNetProfit), avail = _enum(m.availableAmount);
    const invested = mp.reduce((s, p) => s + _enum(p.amount), 0) + (avail - closed);
    const value = invested + mp.reduce((s, p) => s + _epnl(p), 0) + closed;
    const user = _eg(m, 'parentUsername') || 'trader';
    return { key: 'mirror:' + _eg(m, 'mirrorID', 'mirrorId'), ticker: 'COPY', name: 'Copie de ' + user, type: 'Action',
      units: 1, cost: invested, value, leveraged: false, opened: String(_eg(m, 'startedCopyDate') || '').slice(0, 10) || null };
  });

  const credit = _enum(_eg(cp, 'credit', 'credits'));
  const cash = credit - ordersAmt;                                   // liquidités disponibles
  const lines = [...holdings, ...mirrorLines];
  const invested = lines.reduce((s, h) => s + h.cost, 0) + ordersAmt + orderCosts;
  const unrealized = lines.reduce((s, h) => s + (h.value - h.cost), 0);
  // Les ordres en attente restent comptés dans le solde (argent bloqué, pas dépensé) : on les range avec les liquidités
  return { equity: cash + invested + unrealized, cash: cash + ordersAmt + orderCosts, invested, unrealized, holdings: lines };
}

// Positions de l'app (format des comptes) à partir du portefeuille eToro. Les identifiants restent stables d'une synchro à l'autre.

// Prix unitaires en USD : coût / unités et valeur / unités, pour que quantité × cours = valeur eToro.
function etoroHoldings(port, today) {
  return port.holdings.filter(h => h.units > 0).map(h => {
    const id = 'etoro-' + h.key.replace(/[^a-z0-9]+/gi, '-');
    return { id, ticker: h.ticker, name: h.name, type: h.type, currency: 'USD', sector: 'Autre', country: 'Autre',
      sync: 'etoro', currentPrice: h.value / h.units, quoteAt: null,
      transactions: [{ id: id + '-open', date: h.opened && h.opened <= today ? h.opened : today, type: 'BUY', qty: h.units, price: h.cost / h.units }] };
  });
}

// ── Réseau ──
function _etoroUuid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
}
// Messages propres à eToro (les autres : linkedErrorText)
function etoroErrorText(status) {
  if (status === 401) return 'Clé refusée par eToro : vérifie la clé utilisateur';
  if (status === 403) return 'Accès refusé : la clé eToro doit avoir la permission « Lecture » sur le compte réel';
  return '';
}
function etoroGet(call, params, keys) {
  return linkedGet('etoro', call, params, { 'x-api-key': keys.apiKey || ETORO_PUBLIC_KEY, 'x-user-key': keys.userKey, 'x-request-id': _etoroUuid() });
}
// Portefeuille + noms des instruments (par paquets de 100)
async function etoroLoad(keys) {
  const pnl = await etoroGet('pnl', '', keys);
  const cp = pnl.clientPortfolio || {};
  const ids = [...new Set((cp.positions || []).map(p => _enum(_eg(p, 'instrumentID', 'instrumentId'))).filter(Boolean))];
  const instruments = {};
  for (let i = 0; i < ids.length; i += 100) {
    try {
      const d = await etoroGet('instruments', 'ids=' + ids.slice(i, i + 100).join(','), keys);
      (d.instrumentDisplayDatas || []).forEach(x => { instruments[_enum(_eg(x, 'instrumentID', 'instrumentId'))] = x; });
    } catch (e) { /* noms indisponibles : on garde les identifiants, le solde reste juste */ }
  }
  return { pnl, instruments };
}

// Applique un portefeuille au compte : positions remplacées, liquidités posées en régularisation datée du jour.
function etoroApply(acc, port, today, nowMs) {
  acc.holdings = etoroHoldings(port, today);
  acc.holdings.forEach(h => recalcHolding(h));
  acc.cashflows = [];
  acc.cashAdjust = [{ id: 'etoro', date: today, balances: { USD: +port.cash.toFixed(2) } }];
  acc.currency = 'USD';
  acc.sync = { ...(acc.sync || {}), provider: 'etoro', lastSync: nowMs, error: '', equityUSD: +port.equity.toFixed(2) };
  acc.value = accTotal(acc);
}
// Synchronise un compte. Échec : le dernier solde est conservé, l'erreur est notée sur le compte. → true si réussi
const _etoroBusy = new Set();
async function etoroSync(acc, { keys, quiet } = {}) {
  if (!acc || !acc.sync || _etoroBusy.has(acc.id)) return false;
  keys = keys || linkedKeys(acc.id);
  if (!keys || !keys.userKey) { acc.sync.error = 'Clé eToro absente sur cet appareil : touche « eToro » sur le compte pour la saisir'; return false; }
  _etoroBusy.add(acc.id);
  try {
    const { pnl, instruments } = await etoroLoad(keys);
    etoroApply(acc, etoroPortfolio(pnl, instruments), _dayKey(Date.now()), Date.now());
    saveData();
    if (!quiet) toast('eToro synchronisé ✓');
    return true;
  } catch (e) {
    acc.sync.error = e.message; saveData();
    if (!quiet) toast(e.message);
    return false;
  } finally { _etoroBusy.delete(acc.id); }
}
// Inscription dans le registre des services liés (js/services/linked.js), sous garde
if (typeof LINKED_SERVICES !== 'undefined') LINKED_SERVICES.etoro = {
  label: 'eToro', sub: 'Solde, positions, copies de traders', bank: 'eToro', currency: 'USD',
  keyLabel: 'Clé utilisateur eToro', keyPlaceholder: 'Colle la clé (affichée une seule fois)',
  help: "Sur etoro.com : Paramètres → Trading → Gestion des clés API → « Créer une clé API », environnement <b>Réel</b>, permission <b>Lecture</b>. Copie la clé utilisateur tout de suite : eToro ne l'affiche qu'une fois.",
  keysFrom: input => ({ apiKey: ETORO_PUBLIC_KEY, userKey: String(input || '').trim() }),
  keysReady: k => !!(k && k.userKey),
  sync: (acc, o) => etoroSync(acc, o),
  errorText: etoroErrorText,
};
