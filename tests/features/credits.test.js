import { describe, it, expect } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';
import { LOAN } from '../helpers/loan.js';

const CR = loadClassic('js/features/credits.js', {
  globals: LOAN,
  exports: ['CREDIT_KINDS', 'creditValid', 'creditFormError', 'creditSchedule', 'creditShare', 'creditTotals', 'createCreditStore'],
});
const c = (o = {}) => ({ id: 'c1', name: 'Voiture', kind: 'auto', amount: 15000, rate: 4.5, years: 5, signDate: '2025-03-10', insurance: 12, debtShare: 100, ...o });
function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
}

describe('autres crédits : validation', () => {
  it('crédit bien formé ; refus des valeurs impossibles', () => {
    expect(CR.creditValid(c())).toBe(true);
    for (const bad of [{ amount: 0 }, { years: 0 }, { rate: -1 }, { kind: 'xx' }, { signDate: '' }, { insurance: -2 }, { debtShare: 0 }, { debtShare: 120 }, { first: '10/03/2025' }])
      expect(CR.creditValid(c(bad))).toBe(false);
  });
  it('messages du formulaire', () => {
    expect(CR.creditFormError(c({ amount: 0 }))).toBe('Indique le montant emprunté');
    expect(CR.creditFormError(c({ years: 0 }))).toBe('Indique la durée du crédit');
    expect(CR.creditFormError(c({ signDate: '' }))).toBe('La date de signature est obligatoire');
    expect(CR.creditFormError(c({ first: '2025-01-01' }))).toBe('La première échéance doit suivre la signature');
    expect(CR.creditFormError(c({ debtShare: 0 }))).toBe('La part de dette doit être comprise entre 1 et 100 %');
    expect(CR.creditFormError(c())).toBeNull();
  });
});

describe('autres crédits : échéancier et totaux', () => {
  it('1re échéance un mois après la signature par défaut ; assurance mensuelle comprise', () => {
    const s = CR.creditSchedule(c(), '2025-03-31');
    expect(s.rows[0].date).toBe('2025-04-10');
    expect(s.n).toBe(60);
    expect(s.pmt).toBeCloseTo(279.65, 2);
    expect(s.ins).toBe(12);
  });
  it('totaux : capital restant dû à 100 % et ma part ; mensualités de ma part', () => {
    const t = CR.creditTotals([c(), c({ id: 'c2', debtShare: 50 })], '2025-03-31');
    expect(t.remaining).toBe(30000);
    expect(t.myRemaining).toBe(22500);
    expect(t.myMonthly).toBeCloseTo((279.65 + 12) * 1.5, 1);
    expect(t.count).toBe(2);
  });
});

describe('autres crédits : stockage', () => {
  it('démo et réel séparés ; aller-retour ; données invalides refusées sans rien écraser', () => {
    const st = memoryStorage();
    CR.createCreditStore(st, 'real').save([c()]);
    expect(CR.createCreditStore(st, 'real').read()).toEqual([c()]);
    expect(CR.createCreditStore(st, 'demo').read()).toEqual([]);
    expect(() => CR.createCreditStore(st, 'real').save([c({ amount: -1 })])).toThrow('Crédit n°1 invalide');
    st.setItem('patrimoine-credits-real', '{oups');
    expect(() => CR.createCreditStore(st, 'real').read()).toThrow('JSON invalide');
    expect(() => CR.createCreditStore(st, 'real').save([c()])).toThrow();
    expect(st.getItem('patrimoine-credits-real')).toBe('{oups');
  });
});
