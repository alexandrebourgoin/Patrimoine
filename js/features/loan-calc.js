// Crédits amortissables : calculs PURS communs à l'immobilier (realestate-calc.js) et aux autres crédits.
// Aucun accès à S, au DOM, au stockage ni à l'horloge : « today » est passé ('AAAA-MM-JJ').
// Crédit : { amount, rate (%/an, nominal), years, first ('AAAA-MM-JJ', 1re échéance, optionnelle),
//            insurance (€/mois, optionnelle), payment (ancienne saisie : mensualité totale assurance comprise, optionnelle) }
// V1 : mensualités constantes, taux fixe (0 % accepté, ex. PTZ). Pas de différé, de taux variable ni de prêt in fine.

// Date + n mois, en gardant le jour (ramené à la fin du mois si besoin) : 31 janv. + 1 mois = 28/29 févr. Calcul en UTC.
function loanAddMonths(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return first.getUTCFullYear() + '-' + String(first.getUTCMonth() + 1).padStart(2, '0') + '-' + String(Math.min(d, last)).padStart(2, '0');
}

// Assurance mensuelle : montant saisi (€/mois) ; à défaut, ancienne saisie « mensualité totale » − mensualité calculée.
function loanInsurance(L, pmt) {
  if (L.insurance > 0) return L.insurance;
  return L.payment > 0 ? Math.max(0, L.payment - pmt) : 0;
}

// Échéancier complet. defaultFirst : 1re échéance si L.first est absente. Échéance « passée » = datée au plus tard d'aujourd'hui.
// null si le crédit n'est pas calculable (montant ou durée manquants).
function loanSchedule(L, defaultFirst, today) {
  if (!L || !(L.amount > 0) || !(L.years > 0)) return null;
  const n = Math.round(L.years * 12), r = (L.rate || 0) / 1200;
  const pmt = r > 0 ? L.amount * r / (1 - Math.pow(1 + r, -n)) : L.amount / n;
  const ins = loanInsurance(L, pmt);
  const first = L.first || defaultFirst;
  const rows = [];
  let bal = L.amount;
  for (let k = 1; k <= n; k++) {
    const interest = bal * r;
    let princ = pmt - interest;
    if (k === n || princ > bal) princ = bal;   // dernière échéance : solde exact
    bal = Math.max(0, bal - princ);
    const date = loanAddMonths(first, k - 1);
    rows.push({ k, date, pmt: princ + interest, princ, interest, ins, bal, past: date <= today });
  }
  const past = rows.filter(x => x.past);
  const repaid = past.reduce((s, x) => s + x.princ, 0);
  return {
    n, pmt, ins, rows, repaid, remaining: L.amount - repaid, pct: repaid / L.amount * 100,
    interestPaid: past.reduce((s, x) => s + x.interest, 0), insPaid: past.reduce((s, x) => s + x.ins, 0),
    next: rows.find(x => !x.past) || null, end: rows[rows.length - 1].date,
    warn: !(L.insurance > 0) && L.payment > 0 && L.payment < pmt - 1,   // mensualité saisie inférieure à la mensualité calculée
  };
}
