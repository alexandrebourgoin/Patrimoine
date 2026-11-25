import { describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const R = loadClassic('js/features/order-alert-rules.js', {
  exports: ['oaHeldQty', 'oaFindTarget', 'oaOrderableAccounts', 'oaQuote', 'oaAlertTriggered', 'oaBadgeCount', 'oaPriceHint',
    'oaOrderError', 'oaExecutionError', 'oaQtyAfter', 'oaIsDuplicateAlert', 'oaFmtQty', 'oaNewId', 'oaGapPct'],
});
const hold = (over = {}) => ({ id: 'h1', ticker: 'MC', name: 'LVMH', type: 'Action', currency: 'EUR', quantity: 10, currentPrice: 100, transactions: [], ...over });
const acc = (over = {}) => ({ id: 'a1', name: 'PEA', holdings: [hold()], ...over });

describe('oaHeldQty', () => {
  it('utilise quantity quand elle est tenue à jour', () => expect(R.oaHeldQty(hold({ quantity: 7 }))).toBe(7));
  it('sinon rejoue les mouvements (achats +, ventes −, dividendes ignorés)', () => {
    const h = { transactions: [{ type: 'BUY', qty: 5 }, { type: 'SELL', qty: 2 }, { type: 'DIV', qty: 99 }] };
    expect(R.oaHeldQty(h)).toBe(3);
  });
});

describe('oaFindTarget / oaOrderableAccounts', () => {
  it('retrouve compte et position, même si les identifiants sont de types différents', () => {
    const r = R.oaFindTarget([acc({ id: 1, holdings: [hold({ id: 2 })] })], { accId: '1', holdId: '2' });
    expect(r.h.ticker).toBe('MC');
  });
  it('renvoie null si le compte ou la position a disparu', () => {
    expect(R.oaFindTarget([acc()], { accId: 'zz', holdId: 'h1' })).toBeNull();
    expect(R.oaFindTarget([acc()], { accId: 'a1', holdId: 'zz' })).toBeNull();
  });
  it('exclut les comptes observateurs et ceux qui n\'ont que du cash', () => {
    const list = [acc(), acc({ id: 'b', observer: true }), acc({ id: 'c', holdings: [hold({ type: 'Cash' })] })];
    expect(R.oaOrderableAccounts(list).map(a => a.id)).toEqual(['a1']);
  });
});

describe('oaQuote', () => {
  it('prend la position d\'un compte en priorité, avec sa devise', () => {
    expect(R.oaQuote([acc({ holdings: [hold({ currency: 'USD' })] })], [{ ticker: 'MC', price: 1 }], 'MC')).toEqual({ p: 100, ccy: 'USD', name: 'LVMH' });
  });
  it('ignore une position sans cours et se rabat sur la liste de suivi', () => {
    const accounts = [acc({ holdings: [hold({ currentPrice: 0 })] })];
    expect(R.oaQuote(accounts, [{ ticker: 'MC', name: 'LVMH', price: 5 }], 'MC')).toEqual({ p: 5, ccy: 'EUR', name: 'LVMH' });
  });
  it('null si le titre est inconnu ou sans cours', () => {
    expect(R.oaQuote([acc()], [], 'XYZ')).toBeNull();
    expect(R.oaQuote([], [{ ticker: 'A', price: 0 }], 'A')).toBeNull();
  });
});

describe('oaAlertTriggered', () => {
  const q = { p: 100 };
  it('au-dessus : inclusif', () => {
    expect(R.oaAlertTriggered({ dir: 'above', price: 100 }, q)).toBe(true);
    expect(R.oaAlertTriggered({ dir: 'above', price: 100.01 }, q)).toBe(false);
  });
  it('en dessous : inclusif', () => {
    expect(R.oaAlertTriggered({ dir: 'below', price: 100 }, q)).toBe(true);
    expect(R.oaAlertTriggered({ dir: 'below', price: 99.99 }, q)).toBe(false);
  });
  it('jamais déclenchée sans cours connu', () => expect(R.oaAlertTriggered({ dir: 'above', price: 1 }, null)).toBe(false));
});

describe('oaBadgeCount', () => {
  it('compte les ordres dont la cible existe + les alertes déclenchées', () => {
    const data = {
      orders: [{ accId: 'a1', holdId: 'h1' }, { accId: 'inconnu', holdId: 'h1' }],
      alerts: [{ ticker: 'MC', dir: 'above', price: 90 }, { ticker: 'MC', dir: 'below', price: 50 }, { ticker: 'XYZ', dir: 'above', price: 1 }],
    };
    expect(R.oaBadgeCount([acc()], [], data)).toBe(2);
  });
  it('0 sans donnée', () => expect(R.oaBadgeCount([], [], { orders: [], alerts: [] })).toBe(0));
});

describe('oaPriceHint', () => {
  const buy = { type: 'BUY', limit: 95 }, sell = { type: 'SELL', limit: 105 };
  const series = { currency: 'EUR', series: [{ d: '2026-11-01', c: 90 }, { d: '2026-11-10', c: 94 }, { d: '2026-11-15', c: 110 }] };
  it('achat : cours actuel ≤ limite → atteint', () => expect(R.oaPriceHint(buy, 95, null, null)).toEqual({ hit: true, source: 'current', price: 95 }));
  it('vente : cours actuel ≥ limite → atteint', () => expect(R.oaPriceHint(sell, 105, null, null).hit).toBe(true));
  it('cours actuel du mauvais côté et pas d\'historique → pas atteint', () => expect(R.oaPriceHint(buy, 100, null, null)).toEqual({ hit: false }));
  it('cherche dans les clôtures depuis la création de l\'ordre, et renvoie la plus récente', () => {
    expect(R.oaPriceHint(buy, 100, series, '2026-11-05')).toEqual({ hit: true, source: 'close', price: 94, day: '2026-11-10', currency: 'EUR' });
  });
  it('ignore les clôtures antérieures à la création', () => {
    expect(R.oaPriceHint(buy, 100, series, '2026-11-12')).toEqual({ hit: false });
  });
  it('vente : une clôture au-dessus de la limite suffit', () => {
    expect(R.oaPriceHint(sell, 100, series, '2026-11-12')).toMatchObject({ hit: true, source: 'close', price: 110 });
  });
  it('sans date de création, l\'historique n\'est pas consulté', () => expect(R.oaPriceHint(buy, 100, series, null)).toEqual({ hit: false }));
});

describe('oaOrderError', () => {
  const ok = { hasTarget: true, type: 'BUY', qty: 2, limit: 95, held: 10 };
  it('valide', () => expect(R.oaOrderError(ok)).toBeNull());
  it('cible manquante', () => expect(R.oaOrderError({ ...ok, hasTarget: false })).toBe('Compte et titre requis'));
  it('quantité ou prix absents / nuls / NaN', () => {
    for (const bad of [{ qty: 0 }, { qty: NaN }, { limit: 0 }, { limit: -2 }])
      expect(R.oaOrderError({ ...ok, ...bad })).toBe('Quantité et prix limite requis');
  });
  it('vente supérieure à la quantité détenue refusée, égale acceptée, achat jamais limité', () => {
    expect(R.oaOrderError({ ...ok, type: 'SELL', qty: 11 })).toBe('Vente impossible : vous ne détenez que 10 titre(s)');
    expect(R.oaOrderError({ ...ok, type: 'SELL', qty: 10 })).toBeNull();
    expect(R.oaOrderError({ ...ok, type: 'BUY', qty: 1000 })).toBeNull();
  });
  it('quantité détenue négative affichée à 0', () => {
    expect(R.oaOrderError({ ...ok, type: 'SELL', held: -3 })).toBe('Vente impossible : vous ne détenez que 0 titre(s)');
  });
});

describe('oaExecutionError / oaQtyAfter', () => {
  it('prix requis', () => expect(R.oaExecutionError({ type: 'BUY', qty: 1 }, 0, 0)).toBe("Prix d'exécution requis"));
  it('vente trop grosse refusée', () => expect(R.oaExecutionError({ type: 'SELL', qty: 50 }, 10, 96)).toBe('Exécution impossible : vous ne détenez que 10 titre(s)'));
  it('exécution valide', () => expect(R.oaExecutionError({ type: 'SELL', qty: 10 }, 10, 96)).toBeNull());
  it('quantité après exécution', () => {
    expect(R.oaQtyAfter({ type: 'BUY', qty: 2 }, 10)).toBe(12);
    expect(R.oaQtyAfter({ type: 'SELL', qty: 2 }, 10)).toBe(8);
  });
});

describe('divers', () => {
  it('doublon d\'alerte : même titre, sens et seuil', () => {
    const list = [{ ticker: 'MC', dir: 'above', price: 90 }];
    expect(R.oaIsDuplicateAlert(list, { ticker: 'MC', dir: 'above', price: 90 })).toBe(true);
    expect(R.oaIsDuplicateAlert(list, { ticker: 'MC', dir: 'below', price: 90 })).toBe(false);
    expect(R.oaIsDuplicateAlert(list, { ticker: 'MC', dir: 'above', price: 91 })).toBe(false);
    expect(R.oaIsDuplicateAlert(list, { ticker: 'AI', dir: 'above', price: 90 })).toBe(false);
  });
  it('oaFmtQty enlève le bruit de flottant', () => {
    expect(R.oaFmtQty(0.1 + 0.2)).toBe('0.3');
    expect(R.oaFmtQty(2)).toBe('2');
  });
  it('oaNewId : préfixe, déterministe avec now/rnd injectés, et distinct pour deux tirages', () => {
    expect(R.oaNewId('o', 1000, 0.5)).toBe(R.oaNewId('o', 1000, 0.5));
    expect(R.oaNewId('o', 1000, 0.5).startsWith('o')).toBe(true);
    expect(R.oaNewId('o', 1000, 0.1)).not.toBe(R.oaNewId('o', 1000, 0.9));
  });
});

describe('oaGapPct : variation restante jusqu\'au prix visé', () => {
  it('baisse et hausse en %, null si incalculable', () => {
    expect(R.oaGapPct(100, 95)).toBeCloseTo(-5, 10);
    expect(R.oaGapPct(100, 110)).toBeCloseTo(10, 10);
    expect(R.oaGapPct(0, 95)).toBeNull();
    expect(R.oaGapPct(100, NaN)).toBeNull();
  });
});
