// Immobilier : calculs et validation, fonctions PURES (aucun accès à S, au DOM, au stockage ni à l'horloge : « today » est passé).
// Volontairement simple : ni loyers, ni fiscalité. On suit combien le bien a coûté, combien il vaut (hypothèse de prise de valeur
// annuelle constante) et combien du crédit est remboursé.
// Bien : { id, name, kind:'main'|'secondary'|'rental', buyDate:'AAAA-MM-JJ', price, notary, works, otherFees, growth (%/an),
//          loan: null | { amount, rate (%/an), years, payment (mensualité totale saisie, assurance comprise, optionnelle),
//                         first (1re échéance 'AAAA-MM-JJ', optionnelle) } }
// Échéanciers de crédit : js/features/loan-calc.js (chargé avant ce fichier).
// Les valeurs estimées dépendent du JOUR (pas de l'heure) : deux écrans affichés à quelques secondes d'écart donnent les mêmes montants.

const IMMO_KINDS = { main: 'Résidence principale', secondary: 'Résidence secondaire', rental: 'Bien locatif' };
const IMMO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const _imFinite = n => typeof n === 'number' && Number.isFinite(n);
const _imNonNeg = n => _imFinite(n) && n >= 0;

// Un bien est-il bien formé ? (utilisé par le stockage : un enregistrement invalide fait lever, il n'est jamais ignoré)
function immoValid(p) {
  if (!p || typeof p !== 'object') return false;
  if (typeof p.id !== 'string' || p.id === '' || typeof p.name !== 'string') return false;
  if (!IMMO_KINDS[p.kind] || !IMMO_DATE_RE.test(p.buyDate || '')) return false;
  if (!(_imFinite(p.price) && p.price > 0)) return false;
  if (!_imNonNeg(p.notary ?? 0) || !_imNonNeg(p.works ?? 0) || !_imNonNeg(p.otherFees ?? 0) || !_imFinite(p.growth ?? 0)) return false;
  const L = p.loan;
  if (L === null || L === undefined) return true;
  return _imFinite(L.amount) && L.amount > 0 && _imFinite(L.years) && L.years > 0 && _imNonNeg(L.rate ?? 0)
    && _imNonNeg(L.payment ?? 0) && (!L.first || IMMO_DATE_RE.test(L.first));
}

// Saisie du formulaire → message d'erreur ou null. others : les AUTRES biens (le bien modifié en est exclu).
function immoFormError(p, others) {
  if (!IMMO_DATE_RE.test(p.buyDate || '')) return "La date d'achat est obligatoire";
  if (!(p.price > 0)) return "Indique le prix d'achat";
  for (const [k, label] of [['notary', 'Frais de notaire'], ['works', 'Travaux'], ['otherFees', 'Autres frais']])
    if (!_imNonNeg(p[k])) return `${label} : indique un montant positif ou nul`;
  if (p.loan && !(p.loan.years > 0)) return 'Indique la durée du crédit';
  if (p.loan && !_imNonNeg(p.loan.rate)) return 'Le taux du crédit doit être positif ou nul';
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

// Crédit : mensualité théorique (hors assurance), assurance déduite de la mensualité saisie, échéancier complet.
// Échéance « passée » = datée au plus tard d'aujourd'hui.
function immoLoan(p, today) { return loanSchedule(p.loan, immoAddMonths(p.buyDate, 1), today); }

// Coût d'acquisition, valeur estimée (prix × (1 + croissance)^années), dette restante, patrimoine net du bien
function immoCalc(p, today) {
  const cost = (p.price || 0) + (p.notary || 0) + (p.works || 0) + (p.otherFees || 0);
  const t = immoYearsBetween(p.buyDate, today);
  const value = (p.price || 0) * Math.pow(1 + (p.growth || 0) / 100, t);
  const loan = immoLoan(p, today), debt = loan ? loan.remaining : 0;
  return { cost, t, value, loan, debt, equity: value - debt, gap: value - cost };
}
function immoTotals(list, today) {
  return list.reduce((s, p) => {
    const c = immoCalc(p, today);
    s.value += c.value; s.debt += c.debt; s.equity += c.equity; s.cost += c.cost; s.gap += c.gap;
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
