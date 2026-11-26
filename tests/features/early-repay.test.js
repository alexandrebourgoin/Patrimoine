import { describe, it, expect } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';
import { LOAN } from '../helpers/loan.js';

const E = loadClassic('js/features/early-repay.js', { globals: LOAN, exports: ['erLegalIra', 'earlyRepaySim', 'erCompare', 'erBreakEven', 'erSensitivity', 'ER_CONSO_FREE'] });
// 200 000 € à 3 % sur 20 ans, 1re échéance le 5 janvier 2020 ; au 26/11/2026, 83 échéances payées
const L = { amount: 200000, rate: 3, years: 20, first: '2020-01-05', insurance: 40 };
const TODAY = '2026-11-26';
const sim = (o = {}) => E.earlyRepaySim(L, '2020-01-05', TODAY, { regime: 'immo', ...o });

describe('indemnités de remboursement anticipé : plafonds légaux', () => {
  it('immobilier : min(6 mois d intérêts sur la somme remboursée, 3 % du capital restant dû)', () => {
    expect(E.erLegalIra('immo', { paid: 30000, bal: 90000, rate: 3.5 }).amount).toBeCloseTo(525, 6);
    expect(E.erLegalIra('immo', { paid: 90000, bal: 90000, rate: 8 }).amount).toBeCloseTo(2700, 6);
  });
  it('consommation : rien jusqu à 10 000 € ; 1 % au-delà, 0,5 % s il reste un an ou moins ; jamais plus que les intérêts restants', () => {
    expect(E.erLegalIra('conso', { paid: 10000, bal: 15000, monthsLeft: 30, interestLeft: 900 }).amount).toBe(0);
    expect(E.erLegalIra('conso', { paid: 12000, bal: 15000, monthsLeft: 30, interestLeft: 900 }).amount).toBeCloseTo(120, 6);
    expect(E.erLegalIra('conso', { paid: 12000, bal: 15000, monthsLeft: 12, interestLeft: 900 }).amount).toBeCloseTo(60, 6);
    expect(E.erLegalIra('conso', { paid: 12000, bal: 12000, monthsLeft: 30, interestLeft: 50 }).amount).toBe(50);
  });
});

describe('remboursement anticipé : simulation', () => {
  it('remboursement total : plus aucune échéance, intérêts et assurance restants économisés', () => {
    const r = sim({ amount: 1e9 });
    const s = LOAN.loanSchedule(L, '2020-01-05', TODAY);
    expect(r.total).toBe(true);
    expect(r.paid).toBeCloseTo(s.remaining, 6);
    expect(r.after.months).toBe(0);
    expect(r.before.months).toBe(240 - 83);
    expect(r.saved).toBeCloseTo(r.before.interest + 40 * 157, 6);
    expect(r.ira).toBeCloseTo(Math.min(r.paid * 0.015, 0.03 * r.bal), 6);
    expect(r.net).toBeCloseTo(r.saved - r.ira, 6);
  });
  it('réduire la durée : même mensualité, fin avancée ; réduire la mensualité : même fin, mensualité plus basse', () => {
    const d = sim({ amount: 30000, mode: 'duration' });
    expect(d.after.pmt).toBeCloseTo(d.before.pmt, 6);
    expect(d.after.months).toBeLessThan(d.before.months);
    expect(d.monthsSaved).toBe(d.before.months - d.after.months);
    expect(d.after.rows.at(-1).bal).toBe(0);
    const p = sim({ amount: 30000, mode: 'payment' });
    expect(p.after.months).toBe(p.before.months);
    expect(p.after.end).toBe(p.before.end);
    expect(p.paymentDrop).toBeGreaterThan(0);
    // capital remboursé à la fin = capital restant après le versement
    expect(p.after.rows.reduce((s, x) => s + x.princ, 0)).toBeCloseTo(p.bal - 30000, 4);
    // réduire la durée économise plus d'intérêts que réduire la mensualité
    expect(d.before.interest - d.after.interest).toBeGreaterThan(p.before.interest - p.after.interest);
  });
  it('indemnités : aucune, ou montant saisi ; frais ajoutés à la somme versée', () => {
    expect(sim({ amount: 30000, ira: { kind: 'none' } }).ira).toBe(0);
    const r = sim({ amount: 30000, ira: { kind: 'amount', value: 300 }, fees: 150 });
    expect(r.ira).toBe(300);
    expect(r.cash).toBe(30450);
  });
  it('assurance sur le capital restant : elle baisse avec le capital', () => {
    const fixed = sim({ amount: 50000, mode: 'payment' }), prop = sim({ amount: 50000, mode: 'payment', insBasis: 'remaining' });
    expect(fixed.after.ins).toBe(40);
    expect(prop.after.ins).toBeCloseTo(40 * (prop.bal - 50000) / prop.bal, 6);
  });
  it('crédit non calculable ou déjà remboursé : null', () => {
    expect(E.earlyRepaySim({ amount: 0, years: 1 }, '2020-01-01', TODAY)).toBeNull();
    expect(E.earlyRepaySim({ amount: 1000, rate: 1, years: 1, first: '2020-01-01' }, '2020-01-01', TODAY)).toBeNull();
  });
});

describe('rembourser ou placer', () => {
  it('sans frais ni impôt ni assurance ni indemnité, l équilibre est le taux effectif du crédit', () => {
    const r = E.earlyRepaySim({ ...L, insurance: 0 }, '2020-01-05', TODAY, { amount: 30000, mode: 'duration', ira: { kind: 'none' } });
    const be = E.erBreakEven(r, {});
    expect(be).toBeCloseTo((Math.pow(1 + 3 / 1200, 12) - 1) * 100, 3);
    expect(E.erCompare(r, { rate: be }).gap).toBeCloseTo(0, 2);
  });
  it('placer gagne au-dessus du seuil, rembourser en dessous ; écart croissant avec le rendement', () => {
    const r = sim({ amount: 30000, mode: 'payment' });
    const be = E.erBreakEven(r, {});
    expect(E.erCompare(r, { rate: be + 1 }).gap).toBeGreaterThan(0);
    expect(E.erCompare(r, { rate: be - 1 }).gap).toBeLessThan(0);
    const t = E.erSensitivity(r, {}, 0, 8);
    expect(t.map(x => x.rate)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (let i = 1; i < t.length; i++) expect(t[i].gap).toBeGreaterThan(t[i - 1].gap);
  });
  it('les indemnités, l assurance, l impôt et les frais du placement relèvent le seuil', () => {
    const base = E.earlyRepaySim({ ...L, insurance: 0 }, '2020-01-05', TODAY, { amount: 30000, ira: { kind: 'none' } });
    const b0 = E.erBreakEven(base, {});
    expect(E.erBreakEven(sim({ amount: 30000, insBasis: 'remaining' }), {})).toBeGreaterThan(b0);   // assurance économisée
    expect(E.erBreakEven(base, { tax: 30 })).toBeGreaterThan(b0);
    expect(E.erBreakEven(base, { fees: 0.5 })).toBeCloseTo(b0, 6);            // seuil exprimé net de frais
    expect(E.erCompare(base, { rate: 5, fees: 0.5 }).gap).toBeLessThan(E.erCompare(base, { rate: 5 }).gap);
    const ira = E.earlyRepaySim({ ...L, insurance: 0 }, '2020-01-05', TODAY, { amount: 30000 });
    expect(E.erBreakEven(ira, {})).toBeLessThan(b0);   // payer une indemnité rend le remboursement moins attractif
  });
});
