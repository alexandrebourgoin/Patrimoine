// Comparaison d'un compte à un indice (S&P 500, MSCI World, CAC 40, Bitcoin…).
// Fonctions PURES (séries passées en paramètres) + chargeur des cours (loadBenchmark, qui utilise le proxy Yahoo à l'appel).
// Indice choisi par compte (acc.benchmark : clé ci-dessous, '' = aucun ; absent = défaut selon le type de compte :
// Bitcoin pour un compte Crypto, CAC 40 pour un PEA, aucun sinon). Séries gardées dans l'historique local sous la clé 'IDX:<clé>'.
// MSCI World / ACWI sont suivis via les ETF iShares URTH / ACWI. Un indice coté en USD est converti en euros avec l'historique
// EUR/USD (quand la devise appli est l'euro), sinon la comparaison mélangerait performance de l'indice et variation du dollar.

const BENCHMARKS = {
  SPX:   { label: 'S&P 500',    sym: '^GSPC',   ccy: 'USD' },
  WORLD: { label: 'MSCI World', sym: 'URTH',    ccy: 'USD' },
  ACWI:  { label: 'MSCI ACWI',  sym: 'ACWI',    ccy: 'USD' },
  CAC40: { label: 'CAC 40',     sym: '^FCHI',   ccy: 'EUR' },
  BTC:   { label: 'Bitcoin',    sym: 'BTC-USD', ccy: 'USD' },
};
const BENCH_COVER_DAYS = 7;   // tolérance : la série couvre la date de début si elle commence au plus 7 jours après

function accBenchmarkKey(acc) {
  if (acc.benchmark !== undefined) return acc.benchmark;
  const t = (acc.type || '').toLowerCase();
  if (/crypto/.test(t)) return 'BTC';
  if (/\bpea\b/.test(t)) return 'CAC40';
  return '';
}
// Un indice en USD doit être converti quand la devise appli est l'euro
function benchNeedsFx(key, appCcy) { const b = BENCHMARKS[key]; return !!b && b.ccy === 'USD' && appCcy === 'EUR'; }

// Série de l'indice dans la devise appli : un indice en USD est divisé par l'EUR/USD du jour (dernier cours connu à chaque date).
// idx / fx : { series:[{d, c}] } ou null. → { series, conv } ou null si la série (ou le taux nécessaire) est absente.
function benchSeries(idx, fx, needsFx) {
  if (!idx) return null;
  if (!needsFx) return { series: idx.series, conv: false };
  if (!fx) return null;
  let j = 0, last = null;
  const out = [];
  idx.series.forEach(p => {
    while (j < fx.series.length && fx.series[j].d <= p.d) { last = fx.series[j].c; j++; }
    const r = last != null ? last : fx.series[0].c;
    if (r > 0) out.push({ d: p.d, c: p.c / r });
  });
  return out.length >= 2 ? { series: out, conv: true } : null;
}
// Variation (%) entre le dernier cours ≤ fromDay (ou le 1er point connu) et le dernier cours
function benchRet(series, fromDay) {
  if (!series || series.length < 2) return null;
  let base = series[0];
  for (const p of series) { if (p.d <= fromDay) base = p; else break; }
  const last = series[series.length - 1];
  return base.c > 0 ? (last.c / base.c - 1) * 100 : null;
}
// La série remonte-t-elle jusqu'à la date de début (à une semaine près) ?
function benchCovers(series, startDay) {
  if (!series || !series.length) return false;
  const utc = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  return utc(series[0].d) <= utc(startDay) + BENCH_COVER_DAYS;
}
// Durée à télécharger pour couvrir `years` années
function benchRange(years) { return years <= 0.9 ? '1y' : years <= 1.9 ? '2y' : years <= 4.9 ? '5y' : years <= 9.9 ? '10y' : 'max'; }

// ── Chargement (réseau) : une tentative par indice et par date de début durant la session, délai maximal de 15 s ──
const _benchTried = {};
async function loadBenchmark(key, startDay) {
  const b = BENCHMARKS[key]; if (!b) return;
  const tag = key + '|' + (startDay || '');
  if (_benchTried[tag]) return;
  _benchTried[tag] = true;
  const years = startDay ? (Date.now() - new Date(startDay + 'T00:00:00').getTime()) / (365.25 * 86400000) : 1;
  const range = benchRange(years);
  const jobs = [['IDX:' + key, b.sym]];
  if (benchNeedsFx(key, S.currency)) jobs.push(['IDX:EURUSD', 'EURUSD=X']);
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), ms))]);
  await Promise.all(jobs.map(async ([id, sym]) => {
    try {
      const s = await withTimeout(_fetchYahooHistory(sym, range), 15000);
      if (s && s.length >= 2) saveHistory(id, s, 'USD');
    } catch (e) { dbgLog('[ERR]', 'Indice ' + id + ' : ' + (e?.message || e)); }
  }));
  if (S.screen === 'account') renderScreen('account');
}
