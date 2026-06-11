// Pure / quasi-pure utility functions.
// All global dependencies (FX_RATES, S.currency) are passed explicitly
// so these functions can be unit-tested without a DOM or global state.

export function mkTx(date, type, qty, price) { return { date, type, qty, price }; }

export function fmtPct(v) { return (v >= 0 ? '+' : '') + v.toFixed(2).replace('.', ',') + ' %'; }

export function fmtDate(s) {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function initials(n) {
  return n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function fmtNative(v, cur) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: cur || 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);
}

export function fmtCur(v, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);
}

// FX_RATES[X] = "units of X per EUR"
// e.g. FX_RATES.USD = 1.08 means 1 EUR = 1.08 USD
export function toRefCcy(amount, fromCcy, fxRates, appCcy = 'EUR') {
  const fromFx = fxRates[fromCcy || 'EUR'] || 1;
  const toFx   = fxRates[appCcy  || 'EUR'] || 1;
  return amount * toFx / fromFx;
}

export function accSum(holdings) {
  return holdings.reduce((s, h) => s + (h.valueRef ?? h.value), 0);
}

export function computeRealizedPnL(h) {
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

export function recalcHolding(h, fxRates, appCcy = 'EUR') {
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

// Accepts `now` parameter so callers in tests can inject a fixed timestamp
export function timeSince(ts, now = Date.now()) {
  const m = Math.floor((now - ts) / 60000);
  if (m < 1)  return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export function fxSubText(fxRates, appCcy, updatedAt) {
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
