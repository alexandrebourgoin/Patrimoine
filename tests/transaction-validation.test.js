import { describe, it, expect } from 'vitest';
import { loadClassic } from './helpers/load-classic.js';

const { transactionHistoryIsValid: validate } = loadClassic('js/modals/order.js', {
  exports: ['transactionHistoryIsValid'],
});

describe('Historiques malformés', () => {
  it.each([
    ['null', null],
    ['objet à la place du tableau', {}],
    ['mouvement null', [null]],
    ['date absente', [{ type: 'BUY', qty: 1 }]],
    ['date non textuelle', [{ date: 20260101, type: 'BUY', qty: 1 }]],
    ['format non ISO', [{ date: '01/01/2026', type: 'BUY', qty: 1 }]],
    ['jour inexistant', [{ date: '2026-02-30', type: 'BUY', qty: 1 }]],
    ['année non bissextile', [{ date: '2026-02-29', type: 'BUY', qty: 1 }]],
    ['quantité non numérique', [{ date: '2026-01-01', type: 'BUY', qty: '1' }]],
    ['quantité NaN', [{ date: '2026-01-01', type: 'BUY', qty: NaN }]],
    ['débordement de quantité', [
      { date: '2026-01-01', type: 'BUY', qty: Number.MAX_VALUE },
      { date: '2026-01-02', type: 'BUY', qty: Number.MAX_VALUE },
    ]],
  ])('refuse %s sans exception', (_label, input) => {
    expect(() => validate(input)).not.toThrow();
    expect(validate(input)).toBe(false);
  });

  it('accepte une date bissextile valide sans modifier la saisie', () => {
    const input = [{ date: '2024-02-29', type: 'BUY', qty: 1 }];
    const before = JSON.stringify(input);
    expect(validate(input)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('accepte un historique vide', () => {
    expect(validate([])).toBe(true);
  });
});
