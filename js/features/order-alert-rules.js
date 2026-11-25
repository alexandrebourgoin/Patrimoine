// Règles métier des ordres limites et des alertes de prix : fonctions PURES (aucun accès à S, au DOM ou au stockage).
// Les données nécessaires (comptes, favoris, séries) sont passées en paramètres : testable seul, réutilisable par l'assistant.
// Aucun ordre n'est passé par l'application : c'est un suivi manuel. L'utilisateur confirme l'exécution, ce qui ajoute le mouvement.

const OA_EPS = 1e-9;

// Quantité détenue d'une position : `quantity` si elle est tenue à jour, sinon rejouée depuis les mouvements
function oaHeldQty(h) {
  if (typeof h.quantity === 'number') return h.quantity;
  return (h.transactions || []).reduce((q, t) => t.type === 'BUY' ? q + t.qty : t.type === 'SELL' ? q - t.qty : q, 0);
}

// Compte et position visés par un ordre, ou null si l'un des deux a disparu
function oaFindTarget(accounts, order) {
  const acc = accounts.find(a => String(a.id) === String(order.accId));
  const h = acc ? acc.holdings.find(x => String(x.id) === String(order.holdId)) : null;
  return acc && h ? { acc, h } : null;
}

// Comptes sur lesquels on peut passer un ordre : ni observateur, ni limités à du cash
function oaOrderableAccounts(accounts) {
  return accounts.filter(a => !a.observer && a.holdings.some(h => h.type !== 'Cash'));
}

// Dernier cours connu d'un ticker : position d'un compte d'abord, sinon liste de suivi. → {p, ccy, name} | null
function oaQuote(accounts, watchlist, ticker) {
  for (const a of accounts) for (const h of a.holdings)
    if (h.ticker === ticker && h.currentPrice > 0) return { p: h.currentPrice, ccy: h.currency || 'EUR', name: h.name };
  const w = watchlist.find(x => x.ticker === ticker);
  return w && w.price > 0 ? { p: w.price, ccy: w.currency || 'EUR', name: w.name } : null;
}

// Une alerte est « déclenchée » tant que le dernier cours connu est du bon côté du prix (inclusif)
function oaAlertTriggered(alert, quote) {
  if (!quote) return false;
  return alert.dir === 'above' ? quote.p >= alert.price : quote.p <= alert.price;
}

// Valeur de la pastille : ordres dont le compte et le titre existent + alertes déclenchées
function oaBadgeCount(accounts, watchlist, data) {
  const orders = data.orders.filter(o => oaFindTarget(accounts, o)).length;
  const alerts = data.alerts.filter(a => oaAlertTriggered(a, oaQuote(accounts, watchlist, a.ticker))).length;
  return orders + alerts;
}

// Le prix limite a-t-il pu être touché ? Indicatif : cours actuel, puis clôtures quotidiennes depuis la création de l'ordre.
// series : { series:[{d:'AAAA-MM-JJ', c}], currency } ou null ; sinceDay : jour de création (AAAA-MM-JJ) ou null.
// → { hit:false } | { hit:true, source:'current', price } | { hit:true, source:'close', price, day, currency }
function oaPriceHint(order, currentPrice, series, sinceDay) {
  const ok = p => order.type === 'BUY' ? p <= order.limit : p >= order.limit;
  if (currentPrice > 0 && ok(currentPrice)) return { hit: true, source: 'current', price: currentPrice };
  if (series && sinceDay) {
    const pts = series.series.filter(p => p.d >= sinceDay && ok(p.c));
    if (pts.length) {
      const p = pts[pts.length - 1];
      return { hit: true, source: 'close', price: p.c, day: p.d, currency: series.currency };
    }
  }
  return { hit: false };
}

// Saisie d'un ordre → message d'erreur, ou null si valide. held : quantité détenue de la position.
function oaOrderError({ hasTarget, type, qty, limit, held }) {
  if (!hasTarget) return 'Compte et titre requis';
  if (!(qty > 0) || !(limit > 0)) return 'Quantité et prix limite requis';
  if (type === 'SELL' && qty > held + OA_EPS) return 'Vente impossible : vous ne détenez que ' + oaFmtQty(Math.max(held, 0)) + ' titre(s)';
  return null;
}
// Exécution d'un ordre au prix réel → message d'erreur, ou null si valide
function oaExecutionError(order, held, price) {
  if (!(price > 0)) return "Prix d'exécution requis";
  if (order.type === 'SELL' && order.qty > held + OA_EPS) return 'Exécution impossible : vous ne détenez que ' + oaFmtQty(Math.max(held, 0)) + ' titre(s)';
  return null;
}
// Quantité détenue après exécution
function oaQtyAfter(order, held) { return order.type === 'BUY' ? held + order.qty : held - order.qty; }

// Même titre, même sens, même seuil : inutile de le créer deux fois
function oaIsDuplicateAlert(alerts, { ticker, dir, price }) {
  return alerts.some(a => a.ticker === ticker && a.dir === dir && a.price === price);
}

// Quantité sans bruit de flottant (6 décimales max)
// Variation (en %) que le cours actuel doit faire pour atteindre un prix : (cible / actuel − 1) × 100. null si incalculable.
function oaGapPct(current, target) {
  return current > 0 && target > 0 && Number.isFinite(current) && Number.isFinite(target) ? (target / current - 1) * 100 : null;
}
function oaFmtQty(q) { return (Math.round(q * 1e6) / 1e6).toString(); }

// Identifiant unique (horodatage + aléa) ; now / rnd injectables pour les tests
function oaNewId(prefix, now = Date.now(), rnd = Math.random()) {
  return prefix + now.toString(36) + rnd.toString(36).slice(2, 6);
}
