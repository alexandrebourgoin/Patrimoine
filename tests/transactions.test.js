import { describe, it, expect, vi } from 'vitest';
import { loadClassic } from './helpers/load-classic.js';

const { transactionHistoryIsValid: validate } = loadClassic('js/modals/order.js', {
  globals: { registerModal() {} },
  exports: ['transactionHistoryIsValid'],
});
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

// Test du binding réel avec événements simulés, pas un test de navigateur.
function stockFixture(confirm = true) {
  const h = { id: 'h', transactions: [tx('2026-01-01', 'BUY', 10), tx('2026-01-02', 'SELL', 5)] };
  const account = { id: 'a', holdings: [h] };
  const handlers = {};
  const elements = Object.fromEntries(['#js-add-movement', '#js-tx-list'].map(selector => [selector, {
    addEventListener: (event, callback) => { handlers[selector] = callback; },
  }]));
  const globals = {
    SCREEN_BIND: {},
    S: { accountId: 'a', holdingId: 'h', accounts: [account] },
    back() {},
    openAddOrder: vi.fn(),
    openEditTx: vi.fn(),
    openConfirm: vi.fn((_message, callback) => { if (confirm) callback(); }),
    transactionHistoryIsValid: validate,
    fmtDate: value => value,
    toast: vi.fn(),
    recalcHolding: vi.fn(),
    accTotal: vi.fn(() => 100),
    renderScreen: vi.fn(),
    refreshMain: vi.fn(),
  };
  loadClassic('js/screens/stock.js', { globals });
  globals.SCREEN_BIND.stock({
    querySelector: selector => elements[selector] || null,
    querySelectorAll: () => [],
  }, 'stock');
  const remove = index => handlers['#js-tx-list']({
    target: { closest: selector => selector === '.tx-del-btn' ? { dataset: { txidx: String(index) } } : null },
  });
  return { h, handlers, remove, globals };
}

describe('Actions de la fiche titre', () => {
  it('ouvre la modale existante pour le compte et le titre courants', () => {
    const f = stockFixture();
    f.handlers['#js-add-movement']();
    expect(f.globals.openAddOrder).toHaveBeenCalledWith('a', 'h');
  });

  it('refuse de supprimer un achat nécessaire à une vente ultérieure', () => {
    const f = stockFixture();
    const before = [...f.h.transactions];
    f.remove(0);
    expect(f.h.transactions).toEqual(before);
    expect(f.globals.recalcHolding).not.toHaveBeenCalled();
    expect(f.globals.toast).toHaveBeenCalledWith(expect.stringContaining('Suppression impossible'));
  });

  it('autorise la suppression d’une vente et actualise les données', () => {
    const f = stockFixture();
    f.remove(1);
    expect(f.h.transactions).toHaveLength(1);
    expect(f.h.transactions[0].type).toBe('BUY');
    expect(f.globals.recalcHolding).toHaveBeenCalledWith(f.h);
    expect(f.globals.refreshMain).toHaveBeenCalledOnce();
  });

  it('ne modifie rien avant la confirmation de suppression', () => {
    const f = stockFixture(false);
    f.remove(1);
    expect(f.h.transactions).toHaveLength(2);
    expect(f.globals.recalcHolding).not.toHaveBeenCalled();
  });

  it('ignore un index de suppression invalide', () => {
    const f = stockFixture();
    f.remove(-1);
    expect(f.globals.openConfirm).not.toHaveBeenCalled();
    expect(f.h.transactions).toHaveLength(2);
  });
});
