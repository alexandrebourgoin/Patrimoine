// Fonctions utilitaires pures — SOURCE UNIQUE partagée appli + tests.
// Chargé par mon-patrimoine.html en <script> classique AVANT mon-patrimoine.js
// (pas d'ES modules : la PWA peut être servie en file://). Expose le namespace
// global `PU` ; mon-patrimoine.js délègue ici (wrappers injectant S/FX_RATES).
// Les tests vitest l'importent en side-effect : import './utils.js' puis globalThis.PU.
// Toute dépendance globale (FX_RATES, S.currency) est passée en paramètre.

(function (root) {
  'use strict';

  function mkTx(date, type, qty, price) { return { date, type, qty, price }; }

  //   = espace fine insécable (typographie française), identique à l'implémentation historique
  function fmtPct(v) { return (v >= 0 ? '+' : '') + v.toFixed(2).replace('.', ',') + ' %'; }

  function fmtDate(s) {
    return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function initials(n) {
    return n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  function fmtNative(v, cur) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: cur || 'EUR',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(v);
  }

  function fmtCur(v, currency = 'EUR') {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(v);
  }

  // Échappe le texte utilisateur/API avant interpolation innerHTML (sûr aussi dans les attributs "")
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Clé jour en date LOCALE — jamais toISOString (décale de -1 jour en fuseau UTC+)
  function dayKey(d) {
    const t = new Date(d);
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }

  // FX_RATES[X] = "units of X per EUR"
  // e.g. FX_RATES.USD = 1.08 means 1 EUR = 1.08 USD
  function toRefCcy(amount, fromCcy, fxRates, appCcy = 'EUR') {
    const fromFx = fxRates[fromCcy || 'EUR'] || 1;
    const toFx   = fxRates[appCcy  || 'EUR'] || 1;
    return amount * toFx / fromFx;
  }

  function accSum(holdings) {
    return holdings.reduce((s, h) => s + (h.valueRef ?? h.value), 0);
  }

  // ── Trésorerie d'un compte ─────────────────────────────────────────────
  // `upTo` (clé jour 'YYYY-MM-DD', optionnel) borne le calcul à une date : utilisé
  // pour reconstruire la valeur du patrimoine à une date passée.

  // Apports − retraits, saisis dans la devise du compte, convertis en devise appli.
  function accCashflowNet(acc, fxRates, appCcy = 'EUR', upTo) {
    let net = 0;
    (acc.cashflows || []).forEach(c => {
      if (upTo && c.date > upTo) return;
      const a = +c.amount || 0;
      net += (c.type === 'WIT' ? -a : a);
    });
    return toRefCcy(net, acc.currency, fxRates, appCcy);
  }

  // Montant net sorti de la trésorerie pour investir : achats − ventes − dividendes
  // encaissés. Chaque transaction est dans la devise native du titre.
  function accInvestedNet(acc, fxRates, appCcy = 'EUR', upTo) {
    let net = 0;
    (acc.holdings || []).forEach(h => {
      let n = 0;
      (h.transactions || []).forEach(tx => {
        if (upTo && tx.date > upTo) return;
        const amt = (+tx.qty || 0) * (+tx.price || 0);
        if (tx.type === 'BUY') n += amt;
        else if (tx.type === 'SELL' || tx.type === 'DIV') n -= amt;
      });
      net += toRefCcy(n, h.currency, fxRates, appCcy);
    });
    return net;
  }

  // Liquidités disponibles sur le compte (devise appli) = apports nets − investi net.
  // Renvoie 0 tant qu'aucun apport/retrait n'est saisi : le compte n'est alors pas
  // suivi en trésorerie et ses titres seuls font le solde (comportement historique).
  function accCash(acc, fxRates, appCcy = 'EUR', upTo) {
    if (!acc || !acc.cashflows || !acc.cashflows.length) return 0;
    return +(accCashflowNet(acc, fxRates, appCcy, upTo)
           - accInvestedNet(acc, fxRates, appCcy, upTo)).toFixed(2);
  }

  // Solde du compte (devise appli) = valeur des titres + liquidités non investies.
  function accTotal(acc, fxRates, appCcy = 'EUR') {
    return +(accSum(acc.holdings || []) + accCash(acc, fxRates, appCcy)).toFixed(2);
  }

  function computeRealizedPnL(h) {
    let runQty = 0, runCost = 0, realized = 0;
    [...h.transactions].sort((a, b) => a.date.localeCompare(b.date)).forEach(tx => {
      if (tx.type === 'BUY') {
        runCost += tx.qty * tx.price;
        runQty  += tx.qty;
      } else if (tx.type === 'SELL' && runQty > 0) {
        const avgCost = runCost / runQty;
        realized += (tx.price - avgCost) * tx.qty;
        const remQty = Math.max(0, runQty - tx.qty);
        runCost = avgCost * remQty;
        runQty  = remQty;
      }
    });
    return realized;
  }

  function recalcHolding(h, fxRates, appCcy = 'EUR') {
    let qty = 0, costBasis = 0;
    [...h.transactions].sort((a, b) => a.date.localeCompare(b.date)).forEach(tx => {
      if (tx.type === 'BUY') {
        costBasis += tx.qty * tx.price;
        qty       += tx.qty;
      } else if (tx.type === 'SELL' && qty > 0) {
        const avg = costBasis / qty;
        costBasis = avg * Math.max(0, qty - tx.qty);
        qty       = Math.max(0, qty - tx.qty);
      }
    });
    h.quantity    = +qty.toFixed(8);
    h.avgBuyPrice = qty > 0 ? costBasis / qty : 0;
    h.value       = +(h.quantity * h.currentPrice).toFixed(2);
    h.pnl         = (h.currentPrice - h.avgBuyPrice) * h.quantity;
    h.pnlPct      = h.avgBuyPrice > 0 ? ((h.currentPrice - h.avgBuyPrice) / h.avgBuyPrice) * 100 : 0;
    h.valueRef    = +toRefCcy(h.value, h.currency, fxRates, appCcy).toFixed(2);
    h.pnlRef      = +toRefCcy(h.pnl,   h.currency, fxRates, appCcy).toFixed(2);
  }

  // `now` injectable pour des tests déterministes
  function timeSince(ts, now = Date.now()) {
    const m = Math.floor((now - ts) / 60000);
    if (m < 1)  return "à l'instant";
    if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
  }

  function fxSubText(fxRates, appCcy, updatedAt) {
    if (!updatedAt) return 'Valeurs approximatives';
    const appFx = fxRates[appCcy] || 1;
    const ALL = [
      { ccy: 'USD', sym: '$' }, { ccy: 'EUR', sym: '€' },
      { ccy: 'GBP', sym: '£' }, { ccy: 'CHF', sym: 'Fr' }, { ccy: 'JPY', sym: '¥' },
    ];
    const top2 = ALL.filter(p => p.ccy !== appCcy).slice(0, 2);
    return top2.map(p => {
      const r = (fxRates[p.ccy] || 1) / appFx;
      return `1 ${appCcy} = ${r >= 10 ? r.toFixed(2) : r.toFixed(4)} ${p.sym}`;
    }).join(' · ');
  }

  root.PU = {
    mkTx, fmtPct, fmtDate, initials, fmtNative, fmtCur, esc, dayKey,
    toRefCcy, accSum, accCashflowNet, accInvestedNet, accCash, accTotal,
    computeRealizedPnL, recalcHolding, timeSince, fxSubText,
  };
})(globalThis);
