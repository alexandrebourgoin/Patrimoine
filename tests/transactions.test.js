import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

// Charge le vrai module classique sans lancer de navigateur.
// Le DOM factice permet son initialisation, pas une validation de l’interface.
const context = createContext({
  document: {
    getElementById: () => ({ addEventListener() {} }),
    querySelectorAll: () => [],
  },
  registerModal() {},
});
runInContext(readFileSync(new URL('../js/modals/order.js', import.meta.url), 'utf8'), context);
const validate = context.transactionHistoryIsValid;
const tx = (date, type, qty) => ({ date, type, qty, price: 10 });

describe('Contrôle chronologique des ventes', () => {
  it.each([
    ['vente partielle', [tx('2026-01-01', 'BUY', 10), tx('2026-01-02', 'SELL', 4)], true],
    ['survente', [tx('2026-01-01', 'BUY', 10), tx('2026-01-02', 'SELL', 11)], false],
    ['vente avant achat', [tx('2026-01-02', 'BUY', 10), tx('2026-01-01', 'SELL', 1)], false],
    ['achat puis vente le même jour', [tx('2026-01-01', 'BUY', 10), tx('2026-01-01', 'SELL', 10)], true],
    ['vente puis achat le même jour', [tx('2026-01-01', 'SELL', 10), tx('2026-01-01', 'BUY', 10)], false],
    ['dividende sans effet sur la quantité', [tx('2026-01-01', 'BUY', 2), tx('2026-01-02', 'DIV', 100), tx('2026-01-03', 'SELL', 3)], false],
    ['achat réduit sous une vente ultérieure', [tx('2026-01-01', 'BUY', 4), tx('2026-01-02', 'SELL', 5)], false],
    ['achat antidaté en fin de tableau', [tx('2026-01-02', 'SELL', 5), tx('2026-01-01', 'BUY', 5)], true],
    ['quantités décimales', [tx('2026-01-01', 'BUY', 0.3), tx('2026-01-02', 'SELL', 0.1), tx('2026-01-03', 'SELL', 0.2)], true],
    ['quantité nulle', [tx('2026-01-01', 'BUY', 0)], false],
    ['quantité infinie', [tx('2026-01-01', 'BUY', Infinity)], false],
    ['type inconnu', [tx('2026-01-01', 'OTHER', 1)], false],
  ])('%s', (_name, transactions, expected) => {
    const before = transactions.map(item => ({ ...item }));
    expect(validate(transactions)).toBe(expected);
    expect(transactions).toEqual(before);
  });
});
