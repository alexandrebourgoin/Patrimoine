import { describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';

const { sortTx, oversells, recalcHolding, computeRealizedPnL } = globalThis.PU;
const C = loadClassic('js/features/transaction-check.js', {
  globals: { PU: globalThis.PU, fmtDate: d => d },
  exports: ['txNewOversell', 'txCheckAdd', 'txCheckEdit', 'txCheckDelete'],
});
const tx = (date, type, qty, price = 10) => ({ date, type, qty, price });

describe('PU.sortTx : ordre chronologique', () => {
  it('trie par date', () => {
    expect(sortTx([tx('2026-02-01', 'BUY', 1), tx('2026-01-01', 'BUY', 2)]).map(t => t.date)).toEqual(['2026-01-01', '2026-02-01']);
  });
  it('à date égale, achats et dividendes avant les ventes, même saisis après', () => {
    const out = sortTx([tx('2026-01-01', 'SELL', 1), tx('2026-01-01', 'DIV', 1), tx('2026-01-01', 'BUY', 1)]);
    expect(out.map(t => t.type)).toEqual(['DIV', 'BUY', 'SELL']);
  });
  it('à rang égal, l\'ordre de saisie est conservé', () => {
    const out = sortTx([tx('2026-01-01', 'BUY', 1), tx('2026-01-01', 'BUY', 2), tx('2026-01-01', 'BUY', 3)]);
    expect(out.map(t => t.qty)).toEqual([1, 2, 3]);
  });
  it('ne modifie pas la liste d\'origine', () => {
    const src = [tx('2026-02-01', 'BUY', 1), tx('2026-01-01', 'BUY', 2)];
    sortTx(src);
    expect(src[0].date).toBe('2026-02-01');
  });
});

describe('PU.oversells', () => {
  it('historique cohérent → aucune vente excessive', () => {
    expect(oversells([tx('2026-01-01', 'BUY', 10), tx('2026-02-01', 'SELL', 10)])).toEqual([]);
  });
  it('vente avant l\'achat correspondant : détectée avec la quantité détenue à sa date', () => {
    expect(oversells([tx('2026-03-01', 'BUY', 10), tx('2026-02-01', 'SELL', 4)])).toEqual([{ date: '2026-02-01', qty: 4, held: 0 }]);
  });
  it('vente et achat le même jour, vente saisie en premier : acceptée (achat rejoué avant)', () => {
    expect(oversells([tx('2026-01-01', 'SELL', 5), tx('2026-01-01', 'BUY', 5)])).toEqual([]);
  });
  it('plusieurs ventes qui, ensemble, dépassent la quantité', () => {
    const v = oversells([tx('2026-01-01', 'BUY', 10), tx('2026-02-01', 'SELL', 6), tx('2026-03-01', 'SELL', 6)]);
    expect(v).toEqual([{ date: '2026-03-01', qty: 6, held: 4 }]);
  });
  it('les dividendes ne changent pas la quantité', () => {
    expect(oversells([tx('2026-01-01', 'BUY', 1), tx('2026-01-02', 'DIV', 100), tx('2026-01-03', 'SELL', 2)])).toHaveLength(1);
  });
  it('tolère le bruit de flottant (0,1 + 0,2 puis vente de 0,3)', () => {
    expect(oversells([tx('2026-01-01', 'BUY', 0.1), tx('2026-01-02', 'BUY', 0.2), tx('2026-01-03', 'SELL', 0.3)])).toEqual([]);
  });
});

describe('recalcHolding et computeRealizedPnL rejouent le même ordre', () => {
  const h = () => ({ currency: 'EUR', currentPrice: 20, transactions: [tx('2026-01-01', 'SELL', 5, 20), tx('2026-01-01', 'BUY', 10, 10)] });
  it('achat et vente du même jour : la vente est prise en compte (quantité 5, plus-value réalisée)', () => {
    const x = h();
    recalcHolding(x, { EUR: 1 }, 'EUR');
    expect(x.quantity).toBe(5);
    expect(computeRealizedPnL(x)).toBe(50);
  });
});

describe('txCheckAdd', () => {
  const list = [tx('2026-01-01', 'BUY', 10)];
  it('achat toujours accepté', () => expect(C.txCheckAdd(list, tx('2026-01-02', 'BUY', 999))).toBeNull());
  it('vente dans la quantité détenue acceptée', () => expect(C.txCheckAdd(list, tx('2026-02-01', 'SELL', 10))).toBeNull());
  it('vente supérieure refusée, message avec date, quantité et détention', () => {
    expect(C.txCheckAdd(list, tx('2026-02-01', 'SELL', 11)))
      .toBe('Vente impossible : la vente du 2026-02-01 (11) dépasserait les 10 titre(s) détenus à cette date');
  });
  it('vente antidatée avant l\'achat refusée', () => {
    expect(C.txCheckAdd(list, tx('2025-12-01', 'SELL', 1))).toMatch(/^Vente impossible/);
  });
  it('vente du même jour que l\'achat acceptée', () => expect(C.txCheckAdd(list, tx('2026-01-01', 'SELL', 10))).toBeNull());
  it('une vente ajoutée qui rend une vente ultérieure impossible est refusée', () => {
    const l = [tx('2026-01-01', 'BUY', 10), tx('2026-03-01', 'SELL', 8)];
    expect(C.txCheckAdd(l, tx('2026-02-01', 'SELL', 5))).toMatch(/la vente du 2026-03-01/);
  });
});

describe('txCheckEdit', () => {
  const list = [tx('2026-01-01', 'BUY', 10), tx('2026-02-01', 'SELL', 10)];
  it('modification neutre acceptée', () => expect(C.txCheckEdit(list, 1, tx('2026-02-05', 'SELL', 10))).toBeNull());
  it('réduire l\'achat sous la vente est refusé', () => {
    expect(C.txCheckEdit(list, 0, tx('2026-01-01', 'BUY', 5))).toMatch(/^Modification impossible : la vente du 2026-02-01/);
  });
  it('déplacer l\'achat après la vente est refusé', () => {
    expect(C.txCheckEdit(list, 0, tx('2026-03-01', 'BUY', 10))).toMatch(/^Modification impossible/);
  });
  it('transformer l\'achat en vente est refusé', () => {
    expect(C.txCheckEdit(list, 0, tx('2026-01-01', 'SELL', 10))).toMatch(/^Modification impossible/);
  });
  it('ne modifie pas la liste d\'origine', () => {
    C.txCheckEdit(list, 0, tx('2026-01-01', 'BUY', 1));
    expect(list[0].qty).toBe(10);
  });
});

describe('txCheckDelete', () => {
  it('supprimer l\'achat qui couvre une vente est refusé', () => {
    const list = [tx('2026-01-01', 'BUY', 10), tx('2026-02-01', 'SELL', 10)];
    expect(C.txCheckDelete(list, 0)).toMatch(/^Suppression impossible : la vente du 2026-02-01/);
  });
  it('supprimer la vente, un dividende ou un achat non nécessaire est accepté', () => {
    const list = [tx('2026-01-01', 'BUY', 10), tx('2026-01-15', 'BUY', 5), tx('2026-02-01', 'SELL', 10), tx('2026-02-02', 'DIV', 10)];
    expect(C.txCheckDelete(list, 2)).toBeNull();
    expect(C.txCheckDelete(list, 3)).toBeNull();
    expect(C.txCheckDelete(list, 1)).toBeNull();
  });
});

describe('historique déjà incohérent (anciennes données)', () => {
  const bad = [tx('2026-01-01', 'BUY', 5), tx('2026-02-01', 'SELL', 9)];
  it('ne bloque pas une modification sans rapport', () => {
    expect(C.txCheckAdd(bad, tx('2026-03-01', 'BUY', 1))).toBeNull();
    expect(C.txCheckEdit(bad, 0, tx('2026-01-01', 'BUY', 5))).toBeNull();
  });
  it('refuse toujours une nouvelle vente excessive', () => {
    expect(C.txCheckAdd(bad, tx('2026-04-01', 'SELL', 1))).toMatch(/^Vente impossible/);
  });
});
