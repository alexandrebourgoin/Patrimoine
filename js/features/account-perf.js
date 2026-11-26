// Performance d'un compte : fonctions PURES (aucun accès à S, au DOM, au stockage ni à l'horloge).
// UNE seule méthode, utilisée par l'écran du compte ET la liste des comptes : performance pondérée des flux (Dietz modifié).
//
// Flux EXTERNES = les apports et retraits saisis (acc.cashflows, type DEP / WIT), chacun dans sa devise, convertis en devise appli,
// PLUS l'écart de chaque régularisation de liquidités (acc.cashAdjust : solde réel saisi − solde calculé à cette date).
// Les achats, ventes et dividendes ne sont jamais des flux (de l'argent qui change de forme, pas de l'argent qui entre ou sort).
// Une régularisation est traitée comme un apport ou un retrait : elle corrige le niveau de liquidités sans jamais compter comme un gain.
// Elle n'entre PAS dans les « apports / retraits cumulés » affichés (ce ne sont pas des versements de l'utilisateur).
//
//   gain = V1 − V0 − Σ flux          pourcentage = gain / (V0 + Σ flux × part de la période restant à courir)
//
// ctx = { today:'AAAA-MM-JJ', conv:(montant, devise) → devise appli, value: valeur actuelle du compte (devise appli) }
// Les jours sont comptés en UTC à partir des clés AAAA-MM-JJ : aucune dépendance au fuseau ni à l'heure d'été.

const _apDay = ymd => { const [y, m, d] = ymd.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
const _apPye = today => (Number(today.slice(0, 4)) - 1) + '-12-31';   // 31 décembre précédent : base du YTD

// Apports (+) et retraits (−) saisis : [{ date, amt }] en devise appli
function accFlows(acc, conv) {
  return (acc.cashflows || [])
    .filter(c => c.date && (c.type === 'DEP' || c.type === 'WIT'))
    .map(c => ({ date: c.date, amt: (c.type === 'WIT' ? -1 : 1) * conv(+c.amount || 0, PU.cfCcy(acc, c)) }));
}

// Flux de la performance : apports / retraits + écarts de régularisation. Chaque écart se mesure juste avant la régularisation
// (mouvements du jour compris, régularisations antérieures prises en compte) : écart = Σ soldes saisis − Σ poches calculées, converti en devise appli.
function accPerfFlows(acc, conv) {
  const flows = accFlows(acc, conv);
  const sum = pk => Object.entries(pk).reduce((s, [c, v]) => s + conv(v, c), 0);
  [...(acc.cashAdjust || [])].filter(a => a && a.date).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).forEach(a => {
    const prior = { ...acc, cashAdjust: (acc.cashAdjust || []).filter(x => x && x.date && x.date < a.date) };
    const jump = sum(a.balances || {}) - sum(PU.accCashByCcy(prior, a.date));
    if (Math.abs(jump) > 0.005) flows.push({ date: a.date, amt: jump });
  });
  return flows;
}

// Premier jour connu du compte : le plus ancien apport, retrait ou mouvement
function _apFirstDay(acc, flows) {
  const ds = [...flows.map(f => f.date), ...(acc.holdings || []).flatMap(h => (h.transactions || []).map(t => t.date))].filter(Boolean).sort();
  return ds[0] || null;
}

// Apports et retraits cumulés, plus-value brute (valeur − apports nets) et date de début. null sans apport net positif.
// Date de début : date d'ouverture saisie (acc.startDate), sinon le premier mouvement connu.
function accPerfInfo(acc, ctx) {
  const fl = accFlows(acc, ctx.conv);
  if (!fl.length) return null;
  const dep = fl.filter(f => f.amt > 0).reduce((s, f) => s + f.amt, 0);
  const wit = Math.abs(fl.filter(f => f.amt < 0).reduce((s, f) => s + f.amt, 0));
  const net = dep - wit;
  if (!(net > 0)) return null;
  const start = acc.startDate || _apFirstDay(acc, fl);
  const years = start ? Math.max(0, (_apDay(ctx.today) - _apDay(start)) / 365.25) : null;
  return { net, dep, wit, gain: ctx.value - net, pct: (ctx.value - net) / net * 100, start, auto: !acc.startDate, years };
}

// Performance depuis t0Day. v0 = valeur du compte à t0Day ; inclusive : les flux datés de t0Day comptent (période « depuis le début »).
// → { pct, gain } ou null (période vide ou base nulle)
function accPerfPeriod(acc, t0Day, v0, inclusive, ctx) {
  const T = _apDay(ctx.today), t0 = _apDay(t0Day);
  if (!(T > t0)) return null;
  let F = 0, W = 0, P = 0;
  accPerfFlows(acc, ctx.conv).forEach(f => {
    if (f.date > ctx.today || (inclusive ? f.date < t0Day : f.date <= t0Day)) return;
    const t = _apDay(f.date);
    F += f.amt; if (f.amt > 0) P += f.amt;
    W += f.amt * Math.max(0, (T - t) / (T - t0));
  });
  let denom = v0 + W;
  if (denom < 0.02 * (v0 + P)) denom = v0 + P;   // flux tout récents : on retombe sur le capital investi
  if (!(denom > 0)) return null;
  const gain = ctx.value - v0 - F;
  return { pct: gain / denom * 100, gain };
}

// Résumé : « all » (depuis le début du compte), « ytd » (depuis le 31 décembre précédent) et performance annuelle moyenne.
// valueOnDay(jour) → { v, approx } : valeur du compte à une date passée (approx = historique de cours incomplet).
// Un compte plus récent que l'année : le YTD est l'historique. annual : taux annuel équivalent de la performance affichée, à partir d'un an.
function accPerfSummary(acc, perf, ctx, valueOnDay) {
  if (!perf) return null;
  const first = _apFirstDay(acc, accFlows(acc, ctx.conv));
  const t0 = perf.start && first ? (perf.start < first ? perf.start : first) : (perf.start || first);
  if (!t0) return null;
  const pye = _apPye(ctx.today);
  const all = accPerfPeriod(acc, t0, 0, true, ctx);
  if (!all) return null;
  let ytd = all, approx = false;
  if (t0 <= pye) {
    const v0 = valueOnDay(pye); approx = v0.approx;
    ytd = v0.unknown ? null : accPerfPeriod(acc, pye, v0.v, false, ctx);   // aucun cours au 31/12 : YTD inconnu (« — »)
  }
  const years = (_apDay(ctx.today) - _apDay(t0)) / 365.25;
  const annual = years >= 1 && all.pct > -100 ? (Math.pow(1 + all.pct / 100, 1 / years) - 1) * 100 : null;
  return { t0, pye, all, ytd, approx, annual };
}

// Pourcentage affiché pour un mode ('ytd' | 'all'), ou null. Utilisé à l'identique par l'écran du compte et la liste des comptes.
function accPerfPct(acc, mode, ctx, valueOnDay) {
  const sum = accPerfSummary(acc, accPerfInfo(acc, ctx), ctx, valueOnDay);
  if (!sum) return null;
  const cur = mode === 'all' ? sum.all : sum.ytd;
  return cur ? cur.pct : null;
}

// Valeur d'un compte à une date passée (devise appli) : quantités détenues ce jour-là × dernière clôture connue + liquidités du jour.
// env = { qtyOnDay(position, jour), closeOn(ticker, jour) → cours | null, conv(montant, devise), cashOn(compte, jour) }
// approx = true si un titre n'a pas d'historique de cours à cette date (son cours actuel est alors utilisé).
function accValueOnDay(acc, day, env) {
  let tot = 0, approx = false, known = 0, held = 0;
  (acc.holdings || []).forEach(h => {
    const q = env.qtyOnDay(h, day);
    if (q <= 0) return;
    held++;
    let price = env.closeOn(h.ticker, day);
    if (price == null) { price = h.currentPrice; approx = true; } else known++;
    tot += env.conv(q * price, h.currency);
  });
  tot += env.cashOn(acc, day);
  // unknown : AUCUN cours de clôture connu pour les titres détenus ce jour-là. La « valeur » ne serait que les cours
  // actuels : une performance calculée dessus vaudrait ~0 % sans rien mesurer.
  return { v: tot, approx, unknown: held > 0 && known === 0 };
}
