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
  // Signe APRÈS arrondi au centième : −0,004 % est un zéro (affiché « +0,00 % », jamais « -0,00 % » en rouge).
  function pctSign(v) { const r = Math.round(v * 100); return r > 0 ? 1 : r < 0 ? -1 : 0; }
  function fmtPct(v) { const s = pctSign(v); return (s >= 0 ? '+' : '') + (s === 0 ? 0 : v).toFixed(2).replace('.', ',') + ' %'; }
  // Classe de couleur d'une variation en % : gain, perte, ou neutre (zéro arrondi)
  function pctClass(v) { const s = pctSign(v); return s > 0 ? 't-gain' : s < 0 ? 't-loss' : ''; }

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
  // Les liquidités sont tenues PAR DEVISE (poches) : un compte-titres peut avoir des euros, des dollars, etc.
  // `upTo` (clé jour 'YYYY-MM-DD', optionnel) borne le calcul à une date : utilisé pour reconstruire la valeur du
  // patrimoine à une date passée. `after` (optionnel, exclusif) ignore tout ce qui est daté de cette date ou avant :
  // sert à repartir d'une régularisation (acc.cashAdjust).

  // Devise d'un apport / retrait : celle saisie (c.ccy), sinon celle du compte. Un apport ancien (sans ccy) reprend la devise
  // du compte ; c'est la saisie de la devise sur chaque mouvement qui évite que changer la devise du compte le réinterprète.
  function cfCcy(acc, c) { return c.ccy || acc.currency || 'EUR'; }

  // Apports − retraits, chacun dans sa devise, convertis en devise appli.
  function accCashflowNet(acc, fxRates, appCcy = 'EUR', upTo, after) {
    let net = 0;
    (acc.cashflows || []).forEach(c => {
      if (upTo && c.date > upTo) return;
      if (after && c.date <= after) return;
      const a = +c.amount || 0;
      net += toRefCcy(c.type === 'WIT' ? -a : a, cfCcy(acc, c), fxRates, appCcy);
    });
    return net;
  }

  // Montant net sorti de la trésorerie pour investir : achats − ventes − dividendes
  // encaissés. Chaque transaction est dans la devise native du titre.
  function accInvestedNet(acc, fxRates, appCcy = 'EUR', upTo, after) {
    let net = 0;
    (acc.holdings || []).forEach(h => {
      let n = 0;
      (h.transactions || []).forEach(tx => {
        if (upTo && tx.date > upTo) return;
        if (after && tx.date <= after) return;
        const amt = (+tx.qty || 0) * (+tx.price || 0);
        if (tx.type === 'BUY') n += amt;
        else if (tx.type === 'SELL' || tx.type === 'DIV') n -= amt;
      });
      net += toRefCcy(n, h.currency, fxRates, appCcy);
    });
    return net;
  }

  // Dernière régularisation des liquidités (acc.cashAdjust : [{ id, date, balances: { EUR: 1200, USD: 300 } }])
  // datée au plus tard de `upTo` ; null s'il n'y en a pas.
  function accCashAnchor(acc, upTo) {
    let best = null;
    ((acc && acc.cashAdjust) || []).forEach(a => {
      if (!a || !a.date) return;
      if (upTo && a.date > upTo) return;
      if (!best || a.date >= best.date) best = a;
    });
    return best;
  }

  // Poches de liquidités par devise (montants dans la devise de chaque poche).
  // Sans régularisation : apports/retraits (par devise) − achats + ventes + dividendes (devise du titre) ; vide tant qu'aucun
  // apport/retrait n'est saisi (le compte n'est alors pas suivi en trésorerie : ses titres seuls font le solde).
  // Avec régularisation : soldes saisis à la date de la dernière régularisation, puis mouvements postérieurs.
  function accCashByCcy(acc, upTo) {
    if (!acc) return {};
    const anchor = accCashAnchor(acc, upTo), after = anchor ? anchor.date : null;
    if (!anchor && !(acc.cashflows && acc.cashflows.length)) return {};
    const pk = {};
    const add = (ccy, v) => { pk[ccy] = (pk[ccy] || 0) + v; };
    if (anchor) Object.entries(anchor.balances || {}).forEach(([c, v]) => add(c, +v || 0));
    (acc.cashflows || []).forEach(c => {
      if (upTo && c.date > upTo) return;
      if (after && c.date <= after) return;
      const a = +c.amount || 0;
      add(cfCcy(acc, c), c.type === 'WIT' ? -a : a);
    });
    (acc.holdings || []).forEach(h => (h.transactions || []).forEach(tx => {
      if (upTo && tx.date > upTo) return;
      if (after && tx.date <= after) return;
      const amt = (+tx.qty || 0) * (+tx.price || 0);
      if (tx.type === 'BUY') add(h.currency || 'EUR', -amt);
      else if (tx.type === 'SELL' || tx.type === 'DIV') add(h.currency || 'EUR', amt);
    }));
    return pk;
  }

  // Liquidités disponibles sur le compte (devise appli) = somme des poches converties.
  function accCash(acc, fxRates, appCcy = 'EUR', upTo) {
    if (!acc) return 0;
    const pk = accCashByCcy(acc, upTo);
    return +Object.entries(pk).reduce((s, [c, v]) => s + toRefCcy(v, c, fxRates, appCcy), 0).toFixed(2);
  }

  // Solde du compte (devise appli) = valeur des titres + liquidités non investies.
  function accTotal(acc, fxRates, appCcy = 'EUR') {
    return +(accSum(acc.holdings || []) + accCash(acc, fxRates, appCcy)).toFixed(2);
  }

  function computeRealizedPnL(h) {
    let runQty = 0, runCost = 0, realized = 0;
    sortTx(h.transactions).forEach(tx => {
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

  // Ordre chronologique des mouvements : par date ; à date égale, achats et dividendes AVANT les ventes
  // (on ne peut pas vendre ce qu'on achète le même jour sans l'avoir acheté d'abord) ; à égalité, ordre de saisie conservé.
  // Source unique : recalcHolding, computeRealizedPnL et le contrôle des ventes (oversells) rejouent le même ordre.
  function sortTx(txs) {
    const rank = t => (t.type === 'SELL' ? 1 : 0);
    return [...txs].sort((a, b) => a.date.localeCompare(b.date) || rank(a) - rank(b));
  }

  // Ventes qui dépassent la quantité détenue à leur date : [{ date, qty, held }] (liste vide = historique cohérent)
  function oversells(txs) {
    const out = [];
    let held = 0;
    sortTx(txs).forEach(tx => {
      if (tx.type === 'BUY') held += tx.qty;
      else if (tx.type === 'SELL') {
        if (tx.qty > held + 1e-9) out.push({ date: tx.date, qty: tx.qty, held: Math.max(held, 0) });
        held -= tx.qty;
      }
    });
    return out;
  }

  function recalcHolding(h, fxRates, appCcy = 'EUR') {
    let qty = 0, costBasis = 0;
    sortTx(h.transactions).forEach(tx => {
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
    // Seules les devises dont le taux est disponible, fini et > 0 sont retenues (sinon « 1 EUR = 1.0000 $ » affiché à tort)
    const top2 = ALL.filter(p => p.ccy !== appCcy && Number.isFinite(fxRates[p.ccy]) && fxRates[p.ccy] > 0).slice(0, 2);
    return top2.map(p => {
      const r = (fxRates[p.ccy] || 1) / appFx;
      return `1 ${appCcy} = ${r >= 10 ? r.toFixed(2) : r.toFixed(4)} ${p.sym}`;
    }).join(' · ');
  }

  root.PU = {
    mkTx, fmtPct, pctSign, pctClass, fmtDate, initials, fmtNative, fmtCur, esc, dayKey,
    toRefCcy, accSum, cfCcy, accCashflowNet, accInvestedNet, accCashAnchor, accCashByCcy, accCash, accTotal,
    computeRealizedPnL, recalcHolding, timeSince, fxSubText, sortTx, oversells,
  };
})(globalThis);
