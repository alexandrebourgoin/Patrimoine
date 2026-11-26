// Immobilier : calculs et validation, fonctions PURES (aucun accès à S, au DOM, au stockage ni à l'horloge : « today » est passé).
// Volontairement simple : ni loyers, ni fiscalité. On suit combien le bien a coûté, combien il vaut (hypothèse de prise de valeur
// annuelle constante) et combien du crédit est remboursé.
// Bien : { id, name, kind:'main'|'secondary'|'rental', buyDate:'AAAA-MM-JJ', price, notary, works, otherFees, growth (%/an),
//          loans: [ { id, label, amount, rate (%/an), years, first (1re échéance 'AAAA-MM-JJ', optionnelle),
//                     insurance (€/mois, optionnelle) } ] }   ← plusieurs crédits par bien (prêt principal, PTZ, prêt employeur…)
// Quote-part (facultative) : share = % du bien détenu (défaut 100) ; chaque crédit : debtShare = % de la dette supportée
// (défaut = share du bien, modifiable : 60 % du bien et 50 % du crédit, par exemple). Les montants restent saisis à 100 %.
// Ancien format, toujours lu : loan: null | { amount, rate, years, payment (mensualité totale, assurance comprise), first }.
// immoLoans(p) renvoie toujours la liste ; un bien enregistré par le formulaire passe au format « loans ».
// Échéanciers de crédit : js/features/loan-calc.js (chargé avant ce fichier).
// Les valeurs estimées dépendent du JOUR (pas de l'heure) : deux écrans affichés à quelques secondes d'écart donnent les mêmes montants.

const IMMO_KINDS = { main: 'Résidence principale', secondary: 'Résidence secondaire', rental: 'Bien locatif' };
const IMMO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const _imFinite = n => typeof n === 'number' && Number.isFinite(n);
const _imNonNeg = n => _imFinite(n) && n >= 0;

// Un crédit est-il bien formé ? (montant et durée > 0, taux, mensualité et assurance ≥ 0, date valide)
const _imPct = v => v === undefined || (_imFinite(v) && v > 0 && v <= 100);
function _imLoanValid(L) {
  return !!L && typeof L === 'object' && _imPct(L.debtShare) && _imFinite(L.amount) && L.amount > 0 && _imFinite(L.years) && L.years > 0
    && _imNonNeg(L.rate ?? 0) && _imNonNeg(L.payment ?? 0) && _imNonNeg(L.insurance ?? 0)
    && (!L.first || IMMO_DATE_RE.test(L.first)) && (L.label === undefined || typeof L.label === 'string');
}
// Crédits d'un bien, quel que soit le format enregistré (liste « loans » ou ancien « loan » unique)
function immoLoans(p) {
  if (Array.isArray(p && p.loans)) return p.loans;
  return p && p.loan ? [{ id: 'l1', label: '', ...p.loan }] : [];
}

// Un bien est-il bien formé ? (utilisé par le stockage : un enregistrement invalide fait lever, il n'est jamais ignoré)
function immoValid(p) {
  if (!p || typeof p !== 'object') return false;
  if (typeof p.id !== 'string' || p.id === '' || typeof p.name !== 'string') return false;
  if (!IMMO_KINDS[p.kind] || !IMMO_DATE_RE.test(p.buyDate || '')) return false;
  if (!(_imFinite(p.price) && p.price > 0)) return false;
  if (!_imNonNeg(p.notary ?? 0) || !_imNonNeg(p.works ?? 0) || !_imNonNeg(p.otherFees ?? 0) || !_imFinite(p.growth ?? 0)) return false;
  if (!_imPct(p.share)) return false;
  if (p.loans !== undefined && !Array.isArray(p.loans)) return false;
  if (p.loans === undefined && p.loan !== null && p.loan !== undefined && !_imLoanValid(p.loan)) return false;
  return immoLoans(p).every(_imLoanValid);
}

// Saisie du formulaire → message d'erreur ou null. others : les AUTRES biens (le bien modifié en est exclu).
function immoFormError(p, others) {
  if (!IMMO_DATE_RE.test(p.buyDate || '')) return "La date d'achat est obligatoire";
  if (!(p.price > 0)) return "Indique le prix d'achat";
  for (const [k, label] of [['notary', 'Frais de notaire'], ['works', 'Travaux'], ['otherFees', 'Autres frais']])
    if (!_imNonNeg(p[k])) return `${label} : indique un montant positif ou nul`;
  if (!_imPct(p.share)) return 'La part de propriété doit être comprise entre 1 et 100 %';
  const loans = immoLoans(p);
  for (const [i, L] of loans.entries()) {
    const name = loans.length > 1 ? `Crédit ${i + 1}${L.label ? ' (' + L.label + ')' : ''} : ` : '';
    const msg = m => name ? name + m : m[0].toUpperCase() + m.slice(1);
    if (!(L.years > 0)) return msg('indique la durée du crédit');
    if (!_imNonNeg(L.rate)) return msg('le taux du crédit doit être positif ou nul');
    if (!_imNonNeg(L.insurance ?? 0)) return msg("l'assurance doit être positive ou nulle");
    if (!_imPct(L.debtShare)) return msg('la part de dette doit être comprise entre 1 et 100 %');
  }
  if (p.kind === 'main' && others.some(x => x.kind === 'main')) return 'Une résidence principale existe déjà';
  return null;
}

// Date + n mois, en gardant le jour (ramené à la fin du mois si besoin) : 31 janv. + 1 mois = 28/29 févr.
function immoAddMonths(ymd, n) { return loanAddMonths(ymd, n); }   // moteur commun : js/features/loan-calc.js
// Années écoulées entre deux jours (365,25 j/an), jamais négatives ; calcul en UTC : insensible aux changements d'heure
function immoYearsBetween(fromYmd, toYmd) {
  const utc = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.max(0, (utc(toYmd) - utc(fromYmd)) / (365.25 * 86400000));
}

// Échéancier de chaque crédit du bien (1re échéance par défaut : un mois après l'achat). → [{ L, s }]
function immoLoanSchedules(p, today) {
  return immoLoans(p).map(L => ({ L, s: loanSchedule(L, immoAddMonths(p.buyDate, 1), today) })).filter(x => x.s);
}
// Synthèse de tous les crédits du bien (null sans crédit) : mêmes champs qu'un échéancier, cumulés
function immoLoan(p, today) {
  const all = immoLoanSchedules(p, today);
  if (!all.length) return null;
  const sum = k => all.reduce((t, x) => t + x.s[k], 0);
  const amount = all.reduce((t, x) => t + x.L.amount, 0), repaid = sum('repaid');
  if (all.length === 1) return { ...all[0].s, count: 1, amount, parts: all };   // un seul crédit : son échéancier complet
  const next = all.map(x => x.s.next).filter(Boolean).sort((a, b) => (a.date < b.date ? -1 : 1))[0] || null;
  return {
    count: all.length, amount, pmt: sum('pmt'), ins: sum('ins'), repaid, remaining: amount - repaid, pct: repaid / amount * 100,
    interestPaid: sum('interestPaid'), insPaid: sum('insPaid'), next, end: all.map(x => x.s.end).sort().pop(),
    warn: all.some(x => x.s.warn), parts: all,
  };
}

// Coût d'acquisition, valeur estimée (prix × (1 + croissance)^années), dette restante, patrimoine net du bien
function immoCalc(p, today) {
  const cost = (p.price || 0) + (p.notary || 0) + (p.works || 0) + (p.otherFees || 0);
  const t = immoYearsBetween(p.buyDate, today);
  const value = (p.price || 0) * Math.pow(1 + (p.growth || 0) / 100, t);
  const loan = immoLoan(p, today), debt = loan ? loan.remaining : 0;
  // Ma part : propriété × share ; dette = Σ capital restant dû × part de CHAQUE crédit (jamais déduite de la propriété)
  const share = immoShare(p), myValue = value * share;
  const myDebt = loan ? loan.parts.reduce((t, { L, s }) => t + s.remaining * immoDebtShare(p, L), 0) : 0;
  return { cost, t, value, loan, debt, equity: value - debt, gap: value - cost, share, myValue, myDebt, myEquity: myValue - myDebt };
}
// Parts (0 à 1) : du bien, et d'un de ses crédits (par défaut celle du bien)
function immoShare(p) { return (p.share ?? 100) / 100; }
function immoDebtShare(p, L) { return (L.debtShare ?? p.share ?? 100) / 100; }
function immoTotals(list, today) {
  return list.reduce((s, p) => {
    const c = immoCalc(p, today);
    // Valeur, dette et net : MA PART (quote-part du bien, part de chaque crédit) ; coût et écart : à 100 %
    s.value += c.myValue; s.debt += c.myDebt; s.equity += c.myEquity; s.cost += c.cost; s.gap += c.gap;
    return s;
  }, { value: 0, debt: 0, equity: 0, cost: 0, gap: 0 });
}
// « 1 an 2 mois », « 5 mois », « moins d'un mois »
function immoAge(t) {
  const y = Math.floor(t), m = Math.floor((t - y) * 12);
  return y ? `${y} an${y > 1 ? 's' : ''}${m ? ' ' + m + ' mois' : ''}` : (m ? m + ' mois' : "moins d'un mois");
}
// Frais de notaire estimés à 8 % du prix (ancien), arrondis à l'euro
function immoNotaryEstimate(price) { return Math.round(price * 0.08); }
