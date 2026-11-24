// DCA : calculs et validations, fonctions PURES (plans, comptes, date du jour et tables de titres sont passés en paramètres ;
// aucun accès à S, au DOM, au stockage ni à l'horloge). Tout est théorique : aucun achat n'est écrit dans les comptes.
// Chargé avant dca.js (stockage + écran) et dca-isin.js (résolution en ligne des ISIN).
//
// Plan : { from:'AAAA-MM-JJ' (date d'effet), budget (mensuel), day (1-31), lines:[{ ticker, name, weight (%), color, isin?, resolved?, yahooSymbol?, currency? }] }
// `plans` est trié par date d'effet : les échéances passées gardent l'ancien budget et l'ancienne répartition.
// Dans un plan ENREGISTRÉ les poids sont toujours des pourcentages ; les montants n'existent que dans le formulaire.

// ═══════════════════════════════════════════════
// DATES (jours locaux, au format AAAA-MM-JJ)
// ═══════════════════════════════════════════════
function dcaYmd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dcaParseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
// Vrai seulement pour une date réelle (le 31 février est refusé)
function dcaValidYmd(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && dcaYmd(dcaParseYmd(s)) === s; }

// ═══════════════════════════════════════════════
// ÉCHÉANCES
// ═══════════════════════════════════════════════
// Plan en vigueur à une date (le dernier dont la date d'effet est passée)
function dcaPlanAt(plans, ymd) {
  let p = null;
  for (const x of plans) if (x.from <= ymd) p = x;
  return p;
}
// Toutes les échéances de la 1re date d'effet jusqu'à `untilYmd` (incluse) : [{ date, plan }]
// Le jour 31 est ramené à la fin des mois courts ; une échéance antérieure à la date d'effet du plan est sautée.
function dcaOccurrences(plans, untilYmd) {
  const out = [];
  if (!plans.length) return out;
  let cur = dcaParseYmd(plans[0].from); cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const until = dcaParseYmd(untilYmd);
  while (cur <= until) {
    const y = cur.getFullYear(), m = cur.getMonth(), last = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < plans.length; i++) {
      const c = dcaYmd(new Date(y, m, Math.min(plans[i].day, last)));
      const next = plans[i + 1];
      if (c >= plans[i].from && (!next || c < next.from)) { if (c <= untilYmd) out.push({ date: c, plan: plans[i] }); break; }
    }
    cur = new Date(y, m + 1, 1);
  }
  return out;
}
// Échéances passées, cumul théorique, 12 prochaines échéances (stratégie en vigueur à chaque date) et plan courant
function dcaStats(plans, today) {
  const past = dcaOccurrences(plans, today);
  const cumul = past.reduce((s, o) => s + o.plan.budget, 0);
  const horizon = dcaParseYmd(today); horizon.setMonth(horizon.getMonth() + 14);
  const future = dcaOccurrences(plans, dcaYmd(horizon)).filter(o => o.date > today).slice(0, 12);
  let run = cumul;
  const proj = future.map(o => { run += o.plan.budget; return { date: o.date, budget: o.plan.budget, cumul: run }; });
  return { today, past, cumul, next: future[0] || null, proj, current: dcaPlanAt(plans, today) || plans[0] || null };
}

// ═══════════════════════════════════════════════
// RÉPARTITION : pourcentages ↔ montants
// Tous les montants sont calculés en CENTIMES entiers : 3 × 33,33 € sur 100 € (99,99 €) reste un plan valide,
// et la conversion dans un sens puis dans l'autre ne perd jamais un centime.
// ═══════════════════════════════════════════════
function _dcaCheckNumbers(values) {
  if (!Array.isArray(values) || !values.length || values.some(v => !Number.isFinite(v) || v < 0)) throw new TypeError('Répartition invalide');
}
function _dcaBudgetCents(budget) {
  if (!Number.isFinite(budget) || budget <= 0) throw new RangeError('Budget hors limites');
  const cents = Math.round(budget * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new RangeError('Budget hors limites');
  return cents;
}
// Ramène des valeurs positives à des poids dont la somme vaut exactement 100 (l'arrondi est absorbé par la plus grande part)
function _dcaNormalized(values) {
  const total = values.reduce((s, v) => s + v, 0);
  if (!Number.isFinite(total) || total <= 0) throw new RangeError('Répartition vide ou hors limites');
  const weights = values.map(v => v / total * 100);
  weights[values.indexOf(Math.max(...values))] += 100 - weights.reduce((s, v) => s + v, 0);
  return weights;
}
// Poids saisis en % : le total doit faire 100 % à un centième près
function dcaNormalizeWeights(weights) {
  _dcaCheckNumbers(weights);
  if (Math.abs(weights.reduce((s, v) => s + v, 0) - 100) > 0.01 + 1e-10) throw new RangeError('Le total doit faire 100 %');
  return _dcaNormalized(weights);
}
// % → montants (au centime)
function dcaWeightsToAmounts(weights, budget) {
  const cents = _dcaBudgetCents(budget);
  _dcaCheckNumbers(weights);
  return weights.map(w => Math.round(cents * w / 100) / 100);
}
// Montants → % : le total doit égaler le budget à un centime près
function dcaAmountsToWeights(amounts, budget) {
  const cents = _dcaBudgetCents(budget);
  _dcaCheckNumbers(amounts);
  const inCents = amounts.map(a => Math.round(a * 100));
  if (inCents.some(v => !Number.isSafeInteger(v))) throw new RangeError('Montant hors limites');
  const total = inCents.reduce((s, v) => s + v, 0);
  if (!Number.isSafeInteger(total) || Math.abs(total - cents) > 1) throw new RangeError('Le total des montants doit égaler le budget mensuel');
  return _dcaNormalized(inCents);
}

// ═══════════════════════════════════════════════
// TITRES : tickers et ISIN
// ═══════════════════════════════════════════════
function dcaIsIsin(s) { return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(String(s || '')); }

// Remplace la ligne `index` par le titre résolu. Lève RangeError si ce titre figure déjà dans le plan (jamais de doublon).
function dcaResolveLine(lines, index, info) {
  if (!Array.isArray(lines) || !Number.isInteger(index) || !lines[index]) throw new TypeError('Ligne introuvable');
  const ticker = typeof info?.ticker === 'string' ? info.ticker.trim().toUpperCase() : '';
  if (!ticker) throw new TypeError('Ticker résolu invalide');
  if (lines.some((l, i) => i !== index && String(l.ticker || '').trim().toUpperCase() === ticker)) throw new RangeError('Un titre apparaît deux fois après résolution');
  return lines.map((l, i) => i !== index ? { ...l } : {
    ...l, ticker, name: info.name || ticker, resolved: true,
    ...(info.yahooSymbol ? { yahooSymbol: info.yahooSymbol } : {}),
    ...(info.currency ? { currency: info.currency } : {}),
  });
}

// Lignes d'un plan à enregistrer. draft : [{ticker, color}] saisies ; weights : poids (%) déjà validés.
// ctx : { plans (historique), securities (SECURITIES_DB), watchlist, isinMap }.
// Un ISIN déjà résolu dans l'historique (ou connu de la table locale) est remplacé par son ticker ; sinon il est conservé,
// à résoudre en ligne plus tard (dca-isin.js). Les informations connues (nom, devise, symbole Yahoo) sont reprises de l'historique.
function dcaBuildLines(draft, weights, ctx) {
  const history = ctx.plans.flatMap(p => p.lines || []);
  let lines = draft.map((line, i) => {
    const ticker = line.ticker.trim().toUpperCase();
    const known = history.find(h => h.ticker === ticker || h.isin === ticker);
    const isin = dcaIsIsin(ticker) ? ticker : known?.isin;
    return {
      ticker,
      name: ctx.securities[ticker]?.name || ctx.watchlist.find(w => w.ticker === ticker)?.name || known?.name || ticker,
      weight: weights[i], color: line.color,
      ...(isin ? { isin, resolved: ticker !== isin && !!known?.resolved } : {}),
      ...(known?.yahooSymbol && ticker !== isin ? { yahooSymbol: known.yahooSymbol } : {}),
      ...(known?.currency ? { currency: known.currency } : {}),
    };
  });
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.isin || line.resolved) continue;
    const mapped = ctx.isinMap ? ctx.isinMap[line.isin] : null;
    const known = history.find(h => h.isin === line.isin && h.resolved);
    const info = typeof mapped === 'string' ? { ticker: mapped } : mapped || known;
    if (info?.ticker) lines = dcaResolveLine(lines, i, { ...info, name: ctx.securities[info.ticker]?.name || info.name || info.ticker });
  }
  return lines;
}

// ═══════════════════════════════════════════════
// FORMULAIRES : validation
// ═══════════════════════════════════════════════
// Plan saisi (hors répartition) → message d'erreur ou null
function dcaPlanError(p) {
  if (!Number.isFinite(p.budget) || p.budget <= 0) return 'Indique un budget mensuel';
  if (!Number.isInteger(p.day) || p.day < 1 || p.day > 31) return 'Jour du mois entre 1 et 31';
  if (!dcaValidYmd(p.from)) return "Indique une date d'effet valide";
  if (p.lines.some(l => !l.ticker)) return 'Renseigne le ticker ou l’ISIN de chaque ligne';
  if (new Set(p.lines.map(l => l.ticker)).size !== p.lines.length) return 'Un titre apparaît deux fois';
  return null;
}
function dcaGoalError(g) {
  if (!g.name) return "Donne un nom à l'objectif";
  if (!(g.target > 0)) return 'Indique un montant cible';
  if (!dcaValidYmd(g.date)) return 'Indique une date cible valide';
  return null;
}

// ═══════════════════════════════════════════════
// PROJECTIONS
// ═══════════════════════════════════════════════
// Capital futur : capital + versements mensuels en fin de mois, sur `months` mois.
// convention 'effective' : rate = rendement annuel effectif (1 + r)^(1/12) − 1 par mois (projection du patrimoine)
// convention 'nominal'   : rate = taux nominal annuel / 12 par mois (objectifs : comportement d'origine conservé)
// Renvoie aussi growth (capitalisation du capital) et annuity (facteur des versements).
function dcaCapitalProjection(capital, monthly, rate, months, convention = 'effective') {
  if (![capital, monthly, rate, months].every(Number.isFinite) || !Number.isInteger(months) || months < 0) throw new TypeError('Paramètres de projection invalides');
  if (!['effective', 'nominal'].includes(convention)) throw new TypeError('Convention de taux invalide');
  if ((convention === 'effective' && rate <= -100) || (convention === 'nominal' && rate <= -1200)) throw new RangeError('Rendement hors limites');
  const logMonthly = convention === 'nominal' ? Math.log1p(rate / 1200) : Math.log1p(rate / 100) / 12;
  const i = Math.expm1(logMonthly), logGrowth = months * logMonthly;
  const growth = Math.exp(logGrowth), annuity = i === 0 ? months : Math.expm1(logGrowth) / i;
  const value = capital * growth + monthly * annuity;
  if (![value, growth, annuity].every(Number.isFinite)) throw new RangeError('Projection hors limites');
  return { value, growth, annuity };
}

// Objectif : mois restants, capital projeté, versement mensuel nécessaire, avancement. today : 'AAAA-MM-JJ'.
function dcaGoalCalc(g, budget, today) {
  const now = dcaParseYmd(today), end = dcaParseYmd(g.date);
  let n = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) n--;
  n = Math.max(0, n);
  const start = g.start || 0;
  const { value: proj, growth, annuity } = dcaCapitalProjection(start, budget, g.rate || 0, n, 'nominal');
  const need = n > 0 ? Math.max(0, (g.target - start * growth) / annuity) : null;
  return { n, proj, need, pct: Math.min(100, start / g.target * 100), ok: proj >= g.target };
}

const DCA_RETURN_MIN = -50, DCA_RETURN_MAX = 50;
// Hypothèses de rendement (%/an) : liquidités (rl) et autres actifs (rr) ; valeurs invalides → défauts 2 % et 7 %
function dcaProjectionSettings(settings) {
  const valid = v => Number.isFinite(v) && v >= DCA_RETURN_MIN && v <= DCA_RETURN_MAX;
  return { rl: valid(settings?.rl) ? settings.rl : 2, rr: valid(settings?.rr) ? settings.rr : 7 };
}
// Patrimoine FINANCIER actuel (comptes non observateurs) réparti en liquidités (cash non investi + positions Cash) et autres actifs.
// L'immobilier n'entre pas : il n'est pas investi par le DCA. cashOf(compte) = liquidités non investies du compte.
function dcaProjectionBase(accounts, cashOf) {
  let total = 0, liquid = 0;
  for (const a of accounts.filter(x => !x.observer)) {
    total += a.value || 0;
    liquid += cashOf(a);
    for (const h of a.holdings || []) if (h.type === 'Cash') liquid += h.valueRef ?? h.value;
  }
  const risk = total - liquid;
  if (![total, liquid, risk].every(Number.isFinite)) throw new TypeError('Valorisation financière invalide');
  return { total, liquid, risk };
}
// Capital à 1, 3, 5, 10, 15 et 20 ans : prudent / central / optimiste = rendement des autres actifs −3 / 0 / +3 points.
// Le versement mensuel est supposé investi dans les autres actifs ; les liquidités progressent à leur propre taux.
function dcaProjectionRows(base, monthly, settings) {
  if (!Number.isFinite(monthly) || monthly < 0) throw new TypeError('Budget projeté invalide');
  return [1, 3, 5, 10, 15, 20].map(years => {
    const months = years * 12;
    const cash = dcaCapitalProjection(base.liquid, 0, settings.rl, months).value;
    const scenario = delta => cash + dcaCapitalProjection(base.risk, monthly, Math.max(DCA_RETURN_MIN, settings.rr + delta), months).value;
    return { years, contributions: monthly * months, prudent: scenario(-3), central: scenario(0), optimistic: scenario(3) };
  });
}
