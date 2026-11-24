import { describe, expect, it } from 'vitest';
import '../../utils.js';

// Liquidités par devise (poches) et régularisation : PU.cfCcy, accCashByCcy, accCashAnchor, accCash, accCashflowNet.
const { cfCcy, accCashByCcy, accCashAnchor, accCash, accCashflowNet, accTotal } = globalThis.PU;
const FX = { EUR: 1, USD: 1.08, GBP: 1.16, CHF: 1.05, JPY: 163 };   // unités de X pour 1 EUR
const tx = (date, type, qty, price) => ({ date, type, qty, price });
const hold = (currency, txs, valueRef = 0) => ({ currency, transactions: txs, valueRef });
const acc = (over = {}) => ({ currency: 'EUR', cashflows: [], holdings: [], ...over });

describe('cfCcy : devise d\'un apport ou retrait', () => {
  it('celle saisie, sinon celle du compte, sinon EUR', () => {
    expect(cfCcy(acc({ currency: 'USD' }), { ccy: 'GBP' })).toBe('GBP');
    expect(cfCcy(acc({ currency: 'USD' }), {})).toBe('USD');
    expect(cfCcy({}, {})).toBe('EUR');
  });
});

describe('accCashByCcy : poches par devise', () => {
  it('vide tant qu\'aucun apport ni régularisation (compte non suivi en trésorerie)', () => {
    expect(accCashByCcy(acc({ holdings: [hold('EUR', [tx('2024-01-01', 'BUY', 1, 100)])] }))).toEqual({});
    expect(accCashByCcy(null)).toEqual({});
  });
  it('un apport en dollars alimente la poche USD, les achats en euros débitent la poche EUR', () => {
    const a = acc({ cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 1080, ccy: 'USD' }, { date: '2024-01-01', type: 'DEP', amount: 2000, ccy: 'EUR' }],
      holdings: [hold('EUR', [tx('2024-02-01', 'BUY', 1, 500)])] });
    expect(accCashByCcy(a)).toEqual({ USD: 1080, EUR: 1500 });
  });
  it('achats en dollars sans apport en dollars : poche USD NÉGATIVE, poche EUR intacte (cas de la capture : −10 348,50 $US)', () => {
    const a = acc({ cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 12000, ccy: 'EUR' }], holdings: [hold('USD', [tx('2024-02-01', 'BUY', 10, 1034.85)])] });
    const pk = accCashByCcy(a);
    expect(pk.EUR).toBe(12000);
    expect(pk.USD).toBeCloseTo(-10348.5, 2);
    // le total reste cohérent : 12 000 € − 10 348,50 $ / 1,08
    expect(accCash(a, FX, 'EUR')).toBeCloseTo(12000 - 10348.5 / 1.08, 2);
  });
  it('ventes et dividendes créditent la poche de la devise du titre', () => {
    const a = acc({ cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 1000 }], holdings: [hold('USD', [tx('2024-02-01', 'BUY', 10, 50), tx('2024-03-01', 'SELL', 4, 60), tx('2024-04-01', 'DIV', 6, 2)])] });
    expect(accCashByCcy(a)).toEqual({ EUR: 1000, USD: -500 + 240 + 12 });
  });
  it('retrait : débite la poche de sa devise', () => {
    expect(accCashByCcy(acc({ cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 100 }, { date: '2024-02-01', type: 'WIT', amount: 30 }] }))).toEqual({ EUR: 70 });
  });
  it('un apport ancien sans devise prend celle du compte', () => {
    expect(accCashByCcy(acc({ currency: 'USD', cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 100 }] }))).toEqual({ USD: 100 });
  });
  it('upTo ignore les mouvements postérieurs', () => {
    const a = acc({ cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 100 }, { date: '2024-06-01', type: 'DEP', amount: 900 }] });
    expect(accCashByCcy(a, '2024-03-01')).toEqual({ EUR: 100 });
  });
});

describe('régularisation (cashAdjust)', () => {
  const adj = (date, balances, id = date) => ({ id, date, balances });
  const base = () => acc({
    cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 1000 }, { date: '2024-03-01', type: 'DEP', amount: 200 }],
    holdings: [hold('EUR', [tx('2024-02-01', 'BUY', 1, 300), tx('2024-04-01', 'BUY', 1, 50)])],
    cashAdjust: [adj('2024-02-15', { EUR: 5000, USD: 100 })],
  });
  it('accCashAnchor : dernière régularisation datée au plus tard de upTo', () => {
    const a = acc({ cashAdjust: [adj('2024-01-10', {}), adj('2024-05-10', {})] });
    expect(accCashAnchor(a).date).toBe('2024-05-10');
    expect(accCashAnchor(a, '2024-03-01').date).toBe('2024-01-10');
    expect(accCashAnchor(a, '2023-12-31')).toBeNull();
    expect(accCashAnchor(acc())).toBeNull();
  });
  it('repart des soldes régularisés : les mouvements antérieurs ou du jour même sont ignorés, les postérieurs comptent', () => {
    // 5000 € + 100 $ au 15/02 ; puis +200 € (01/03) − 50 € (01/04) ; l'apport du 01/01 et l'achat du 01/02 sont antérieurs
    expect(accCashByCcy(base())).toEqual({ EUR: 5150, USD: 100 });
  });
  it('un mouvement daté du jour de la régularisation est absorbé par elle', () => {
    const a = base(); a.cashflows.push({ date: '2024-02-15', type: 'DEP', amount: 999 });
    expect(accCashByCcy(a).EUR).toBe(5150);
  });
  it('avant la régularisation (upTo), l\'historique reste calculé sans elle', () => {
    expect(accCashByCcy(base(), '2024-02-10')).toEqual({ EUR: 700 });   // 1000 − 300
  });
  it('un compte régularisé sans aucun apport est suivi en trésorerie', () => {
    expect(accCashByCcy(acc({ cashAdjust: [adj('2024-01-01', { EUR: 250 })] }))).toEqual({ EUR: 250 });
  });
  it('accCash convertit et additionne les poches ; accTotal = titres + liquidités', () => {
    const a = acc({ cashAdjust: [adj('2024-01-01', { EUR: 100, USD: 108 })], holdings: [{ currency: 'EUR', valueRef: 400, transactions: [] }] });
    expect(accCash(a, FX, 'EUR')).toBe(200);
    expect(accTotal(a, FX, 'EUR')).toBe(600);
  });
  it('à date égale, la régularisation la plus tardive dans la liste l\'emporte', () => {
    expect(accCashAnchor(acc({ cashAdjust: [adj('2024-01-01', { EUR: 1 }, 'a'), adj('2024-01-01', { EUR: 2 }, 'b')] })).id).toBe('b');
  });
});

describe('accCashflowNet : chaque apport dans sa devise', () => {
  it('convertit USD et EUR séparément vers la devise appli', () => {
    const a = acc({ cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 1080, ccy: 'USD' }, { date: '2024-01-02', type: 'DEP', amount: 500, ccy: 'EUR' }, { date: '2024-01-03', type: 'WIT', amount: 108, ccy: 'USD' }] });
    expect(accCashflowNet(a, FX, 'EUR')).toBeCloseTo(1000 + 500 - 100, 6);
  });
  it('changer la devise du compte ne réinterprète pas un apport qui porte sa devise', () => {
    const a = acc({ currency: 'EUR', cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 1000, ccy: 'EUR' }] });
    const before = accCash(a, FX, 'EUR');
    a.currency = 'USD';
    expect(accCash(a, FX, 'EUR')).toBe(before);
  });
});
