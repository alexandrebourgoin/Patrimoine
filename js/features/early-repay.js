// Remboursement anticipé (E08) et comparaison « rembourser ou placer » (E09). Fonctions PURES (aucun accès à S ni au DOM).
// Dépend, À L'APPEL, de loanSchedule (js/features/loan-calc.js).
//
// Indemnités de remboursement anticipé (IRA) : plafonds légaux vérifiés en novembre 2026 (service-public.gouv.fr,
// economie.gouv.fr ; Code de la consommation) :
//   • crédit immobilier à taux fixe : au plus 6 mois d'intérêts au taux du prêt sur la somme remboursée,
//     sans dépasser 3 % du capital restant dû avant le remboursement ;
//   • crédit à la consommation à taux fixe : aucune indemnité si 10 000 € ou moins sont remboursés sur 12 mois ;
//     sinon au plus 1 % de la somme remboursée (0,5 % s'il reste un an ou moins), sans dépasser les intérêts qui restaient à payer.
// Le contrat peut prévoir moins (souvent : aucune indemnité) : l'utilisateur choisit « plafond légal », « aucune » ou un montant.
//
// Simplification assumée : le remboursement a lieu juste après une échéance (pas d'intérêts courus entre deux échéances).

const ER_CONSO_FREE = 10000;   // € remboursés sur 12 mois sans indemnité (crédit à la consommation)

// Plafond légal des indemnités. regime : 'immo' | 'conso'. paid : somme remboursée ; bal : capital restant dû avant ;
// monthsLeft : mois restants avant ; interestLeft : intérêts qui restaient à payer ; rate : taux annuel (%)
function erLegalIra(regime, { paid, bal, monthsLeft, interestLeft, rate }) {
  if (!(paid > 0)) return { amount: 0, text: 'Rien à rembourser' };
  if (regime === 'immo') {
    const six = paid * (rate || 0) / 100 / 2, three = 0.03 * bal;
    return { amount: Math.min(six, three), six, three, text: '6 mois d\'intérêts sur la somme remboursée, sans dépasser 3 % du capital restant dû' };
  }
  if (paid <= ER_CONSO_FREE) return { amount: 0, text: 'Aucune indemnité : 10 000 € ou moins remboursés sur 12 mois' };
  const pct = monthsLeft > 12 ? 1 : 0.5;
  return { amount: Math.min(paid * pct / 100, Math.max(0, interestLeft)), pct, text: `${String(pct).replace('.', ',')} % de la somme remboursée, sans dépasser les intérêts restants` };
}

// Mensualité constante d'un capital sur m mois au taux mensuel r
function _erPmt(bal, r, m) { return m <= 0 ? 0 : r > 0 ? bal * r / (1 - Math.pow(1 + r, -m)) : bal / m; }
// Échéancier d'un capital `bal` remboursé par mensualités `pmt` (la dernière solde le capital) ; au plus maxM mois
function _erRun(bal, r, pmt, maxM) {
  const rows = [];
  for (let k = 1; bal > 0.005 && k <= maxM; k++) {
    const interest = bal * r;
    let princ = pmt - interest;
    if (k === maxM || princ > bal) princ = bal;
    bal = Math.max(0, bal - princ);
    rows.push({ pmt: princ + interest, princ, interest, bal });
  }
  return rows;
}
const _erSum = (rows, k) => rows.reduce((s, x) => s + x[k], 0);

// Simulation. L : crédit (amount, rate, years, first, insurance…) ; defaultFirst : 1re échéance par défaut ; today : 'AAAA-MM-JJ'.
// o = { amount (somme remboursée ; ≥ capital restant = total), mode:'duration'|'payment', regime:'immo'|'conso',
//       ira:{ kind:'legal'|'none'|'amount', value }, fees (frais de dossier €), insBasis:'initial'|'remaining' }
// → null si le crédit n'est pas calculable ou déjà remboursé.
function earlyRepaySim(L, defaultFirst, today, o = {}) {
  const s = loanSchedule(L, defaultFirst, today);
  if (!s || !s.next) return null;
  const r = (L.rate || 0) / 1200;
  const k0 = s.rows.filter(x => x.past).length;                 // échéances déjà payées
  const bal = k0 ? s.rows[k0 - 1].bal : L.amount;               // capital restant dû au remboursement
  const oldRows = s.rows.slice(k0), m = oldRows.length;
  const paid = Math.min(Math.max(0, +o.amount || 0), bal);
  const total = paid >= bal - 0.005;
  const mode = total ? 'total' : (o.mode === 'payment' ? 'payment' : 'duration');
  const newBal = total ? 0 : bal - paid;
  const newRows = total ? [] : mode === 'payment' ? _erRun(newBal, r, _erPmt(newBal, r, m), m) : _erRun(newBal, r, s.pmt, m);
  // Assurance (€/mois) : fixe si calculée sur le capital initial ; proportionnelle au capital restant sinon
  const insAfter = o.insBasis === 'remaining' && bal > 0 ? s.ins * newBal / bal : s.ins;
  const interestLeft = _erSum(oldRows, 'interest');
  const legal = erLegalIra(o.regime === 'conso' ? 'conso' : 'immo', { paid, bal, monthsLeft: m, interestLeft, rate: L.rate });
  const ira = !o.ira || o.ira.kind === 'legal' ? legal.amount : o.ira.kind === 'amount' ? Math.max(0, +o.ira.value || 0) : 0;
  const fees = Math.max(0, +o.fees || 0);
  const before = { months: m, pmt: s.pmt, ins: s.ins, interest: interestLeft, insurance: s.ins * m, end: s.end };
  const after = { months: newRows.length, pmt: newRows.length ? newRows[0].pmt : 0, ins: newRows.length ? insAfter : 0,
    interest: _erSum(newRows, 'interest'), insurance: insAfter * newRows.length, end: newRows.length ? oldRows[newRows.length - 1].date : null, rows: newRows };
  const saved = (before.interest - after.interest) + (before.insurance - after.insurance);
  // Mensualités (assurance comprise) mois par mois jusqu'à la fin prévue : avant / après. Base de la comparaison E09.
  const flowsBefore = oldRows.map(x => x.pmt + s.ins), flowsAfter = oldRows.map((_, i) => newRows[i] ? newRows[i].pmt + insAfter : 0);
  return { bal, paid, total, mode, regime: o.regime === 'conso' ? 'conso' : 'immo', legal, ira, fees, cash: paid + ira + fees,
    before, after, saved, net: saved - ira - fees, monthsSaved: m - newRows.length,
    paymentDrop: mode === 'payment' ? (s.pmt + s.ins) - (after.pmt + after.ins) : 0, flowsBefore, flowsAfter, horizon: s.end };
}

// ── E09 : rembourser ou placer ? ──
// Comparaison sur le MÊME horizon (fin prévue du crédit) et les MÊMES flux :
//   A, rembourser : on verse `cash` (somme + IRA + frais) aujourd'hui ; chaque mois, la baisse de mensualité (ou la mensualité
//      disparue après la nouvelle fin) est placée ;
//   B, placer : on place `cash` aujourd'hui et on garde l'échéancier d'origine.
// p = { rate (% / an, rendement brut), fees (% / an de frais du placement), tax (% prélevé sur les gains à la fin) }
// → { keep (placement B à l'horizon), repay (placement A), gap = keep − repay (> 0 : placer est plus avantageux), months }
function erCompare(sim, p = {}) {
  const net = ((+p.rate || 0) - (+p.fees || 0)) / 100;
  const rm = net > -1 ? Math.pow(1 + net, 1 / 12) - 1 : -1;
  const n = sim.flowsBefore.length, tax = Math.min(100, Math.max(0, +p.tax || 0)) / 100;
  const after = (fv, put) => fv - Math.max(0, fv - put) * tax;   // impôt sur la plus-value seulement
  const keepFv = sim.cash * Math.pow(1 + rm, n);
  let repFv = 0, repPut = 0;
  for (let i = 0; i < n; i++) {
    const save = sim.flowsBefore[i] - sim.flowsAfter[i];          // économie du mois i+1, placée jusqu'à l'horizon
    repFv = repFv * (1 + rm) + save; repPut += save;
  }
  const keep = after(keepFv, sim.cash), repay = after(repFv, repPut);
  return { keep, repay, gap: keep - repay, months: n };
}
// Rendement annuel net (après frais, avant impôt) qui rend les deux options équivalentes ; null hors de [−20 %, 30 %]
function erBreakEven(sim, p = {}) {
  const f = x => erCompare(sim, { ...p, rate: x + (+p.fees || 0) }).gap;
  let lo = -20, hi = 30;
  if (f(lo) > 0 || f(hi) < 0) return null;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
// Table de sensibilité : écart pour chaque rendement brut de `from` à `to` %
function erSensitivity(sim, p = {}, from = 0, to = 8) {
  const out = [];
  for (let x = from; x <= to; x++) out.push({ rate: x, gap: erCompare(sim, { ...p, rate: x }).gap });
  return out;
}
