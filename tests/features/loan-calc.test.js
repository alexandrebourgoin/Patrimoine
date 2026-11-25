import { describe, it, expect } from 'vitest';
import { LOAN } from '../helpers/loan.js';

// Moteur de crédit commun (immobilier et, ensuite, autres crédits).
const { loanAddMonths, loanSchedule } = LOAN;
const L = (o = {}) => ({ amount: 120000, rate: 3, years: 20, first: '2025-01-05', ...o });

describe('loanSchedule', () => {
  it('mensualité constante classique et capital intégralement remboursé', () => {
    const s = loanSchedule(L(), '2025-01-05', '2024-12-31');
    expect(s.n).toBe(240);
    expect(s.pmt).toBeCloseTo(665.52, 2);
    expect(s.rows.reduce((t, r) => t + r.princ, 0)).toBeCloseTo(120000, 6);
    expect(s.rows.at(-1).bal).toBe(0);
    expect(s.end).toBe('2044-12-05');
    expect(s.remaining).toBe(120000);   // aucune échéance passée
  });
  it('taux 0 % (PTZ) : mensualité = montant / nombre de mois, aucun intérêt', () => {
    const s = loanSchedule(L({ rate: 0, amount: 24000, years: 10 }), null, '2030-01-01');
    expect(s.pmt).toBe(200);
    expect(s.interestPaid).toBe(0);
  });
  it('capital restant dû au jour J (échéances datées au plus tard ce jour)', () => {
    const s = loanSchedule(L(), null, '2025-03-05');
    expect(s.rows.filter(r => r.past)).toHaveLength(3);
    expect(s.remaining).toBeCloseTo(120000 - s.rows.slice(0, 3).reduce((t, r) => t + r.princ, 0), 6);
    expect(s.next.date).toBe('2025-04-05');
  });
  it('assurance : montant mensuel saisi, prioritaire sur l\'ancienne « mensualité totale »', () => {
    expect(loanSchedule(L({ insurance: 25 }), null, '2025-01-01').ins).toBe(25);
    expect(loanSchedule(L({ insurance: 25, payment: 999 }), null, '2025-01-01').ins).toBe(25);
  });
  it('ancienne saisie : assurance = mensualité totale − mensualité calculée ; alerte si inférieure', () => {
    const s = loanSchedule(L({ payment: 700 }), null, '2025-01-01');
    expect(s.ins).toBeCloseTo(700 - 665.52, 1);
    expect(loanSchedule(L({ payment: 600 }), null, '2025-01-01').warn).toBe(true);
    expect(loanSchedule(L({ payment: 600, insurance: 20 }), null, '2025-01-01').warn).toBe(false);
  });
  it('1re échéance par défaut, et crédit incomplet → null', () => {
    expect(loanSchedule(L({ first: undefined }), '2025-02-11', '2025-01-01').rows[0].date).toBe('2025-02-11');
    expect(loanSchedule(null, '2025-01-01', '2025-01-01')).toBeNull();
    expect(loanSchedule(L({ years: 0 }), '2025-01-01', '2025-01-01')).toBeNull();
  });
});

describe('loanAddMonths', () => {
  it('garde le jour, ramené à la fin du mois si besoin', () => {
    expect(loanAddMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(loanAddMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(loanAddMonths('2025-11-15', 3)).toBe('2026-02-15');
  });
});
