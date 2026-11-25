import { describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';

const P = loadClassic('js/features/account-perf.js', {
  globals: { PU: globalThis.PU },
  exports: ['accFlows', 'accPerfFlows', 'accPerfInfo', 'accPerfPeriod', 'accPerfSummary', 'accPerfPct', 'accValueOnDay'],
});
const FX = { EUR: 1, USD: 1.08 };
const conv = (v, c) => v / (FX[c] || 1);
const ctx = (today, value) => ({ today, conv, value });
const dep = (date, amount, over = {}) => ({ date, type: 'DEP', amount, ...over });
const wit = (date, amount, over = {}) => ({ date, type: 'WIT', amount, ...over });
const acc = (cashflows, over = {}) => ({ currency: 'EUR', cashflows, holdings: [], ...over });
const noValue = () => ({ v: 0, approx: false });

describe('accFlows : flux externes', () => {
  it('apports positifs, retraits négatifs, chacun converti depuis SA devise', () => {
    const a = acc([dep('2024-01-01', 1080, { ccy: 'USD' }), dep('2024-02-01', 500), wit('2024-03-01', 216, { ccy: 'USD' })]);
    P.accFlows(a, conv).map(f => f.amt).forEach((v, i) => expect(v).toBeCloseTo([1000, 500, -200][i], 8));
  });
  it('ignore les mouvements sans date ou de type inconnu', () => {
    expect(P.accFlows(acc([{ type: 'DEP', amount: 5 }, { date: '2024-01-01', type: 'X', amount: 5 }]), conv)).toEqual([]);
  });
  it('accFlows : seulement les apports et retraits saisis (jamais achats, ventes, dividendes ni régularisations)', () => {
    const a = acc([dep('2024-01-01', 1000)], {
      holdings: [{ currency: 'EUR', transactions: [{ date: '2024-02-01', type: 'BUY', qty: 1, price: 900 }, { date: '2024-03-01', type: 'DIV', qty: 1, price: 50 }] }],
      cashAdjust: [{ id: 'r', date: '2024-04-01', balances: { EUR: 9999 } }],
    });
    expect(P.accFlows(a, conv)).toEqual([{ date: '2024-01-01', amt: 1000 }]);
  });
});

describe('accPerfFlows : apports, retraits et écarts de régularisation', () => {
  const adj = (date, balances, id = date) => ({ id, date, balances });
  it('sans régularisation : les flux saisis', () => {
    expect(P.accPerfFlows(acc([dep('2024-01-01', 100)]), conv)).toEqual([{ date: '2024-01-01', amt: 100 }]);
  });
  it('écart positif = apport, écart négatif = retrait, mesuré par rapport au solde calculé juste avant', () => {
    const a = acc([dep('2024-01-01', 1000)], { cashAdjust: [adj('2024-03-01', { EUR: 1200 })] });
    expect(P.accPerfFlows(a, conv)).toEqual([{ date: '2024-01-01', amt: 1000 }, { date: '2024-03-01', amt: 200 }]);
    const b = acc([dep('2024-01-01', 1000)], { cashAdjust: [adj('2024-03-01', { EUR: 900 })] });
    expect(P.accPerfFlows(b, conv).at(-1)).toEqual({ date: '2024-03-01', amt: -100 });
  });
  it('les achats déjà passés sont comptés dans le solde calculé : seule la différence avec le relevé est un flux', () => {
    const a = acc([dep('2024-01-01', 1000)], { holdings: [{ currency: 'EUR', transactions: [{ date: '2024-02-01', type: 'BUY', qty: 1, price: 400 }] }], cashAdjust: [adj('2024-03-01', { EUR: 600 })] });
    expect(P.accPerfFlows(a, conv)).toEqual([{ date: '2024-01-01', amt: 1000 }]);   // calculé 600 = relevé 600 : aucun écart
  });
  it('plusieurs devises : écart converti en devise appli (poche USD négative corrigée à 0)', () => {
    const a = acc([dep('2024-01-01', 1000)], { holdings: [{ currency: 'USD', transactions: [{ date: '2024-02-01', type: 'BUY', qty: 1, price: 540 }] }], cashAdjust: [adj('2024-03-01', { EUR: 1000, USD: 0 })] });
    const f = P.accPerfFlows(a, conv).at(-1);
    expect(f.date).toBe('2024-03-01');
    expect(f.amt).toBeCloseTo(540 / 1.08, 8);   // la poche USD passait de −540 $ à 0
  });
  it('plusieurs régularisations : chacune est mesurée par rapport à la précédente', () => {
    const a = acc([], { cashAdjust: [adj('2024-01-01', { EUR: 100 }), adj('2024-06-01', { EUR: 150 })] });
    expect(P.accPerfFlows(a, conv)).toEqual([{ date: '2024-01-01', amt: 100 }, { date: '2024-06-01', amt: 50 }]);
  });
  it('un écart nul ne produit aucun flux', () => {
    expect(P.accPerfFlows(acc([dep('2024-01-01', 100)], { cashAdjust: [adj('2024-02-01', { EUR: 100 })] }), conv)).toHaveLength(1);
  });
  it('les mouvements du jour de la régularisation sont pris en compte dans le solde calculé', () => {
    const a = acc([dep('2024-02-01', 300), dep('2024-02-15', 50)], { cashAdjust: [adj('2024-02-15', { EUR: 350 })] });
    expect(P.accPerfFlows(a, conv).filter(f => f.date === '2024-02-15')).toHaveLength(1);   // seul l'apport du jour, pas d'écart
  });
});

describe('accPerfInfo', () => {
  it('null sans apport, ou si les apports nets ne sont pas positifs', () => {
    expect(P.accPerfInfo(acc([]), ctx('2026-01-01', 100))).toBeNull();
    expect(P.accPerfInfo(acc([dep('2024-01-01', 100), wit('2024-02-01', 100)]), ctx('2026-01-01', 100))).toBeNull();
  });
  it('apports, retraits, apport net, plus-value brute et date de début (premier mouvement)', () => {
    const a = acc([dep('2024-06-01', 1000), dep('2024-01-15', 500), wit('2025-01-01', 200)], { holdings: [{ transactions: [{ date: '2023-12-01', type: 'BUY', qty: 1, price: 1 }] }] });
    const r = P.accPerfInfo(a, ctx('2026-01-01', 1800));
    expect(r).toMatchObject({ dep: 1500, wit: 200, net: 1300, gain: 500, start: '2023-12-01', auto: true });
    expect(r.pct).toBeCloseTo(500 / 1300 * 100, 8);
  });
  it('la date d\'ouverture saisie prime sur la date automatique', () => {
    const r = P.accPerfInfo(acc([dep('2024-06-01', 1000)], { startDate: '2022-05-15' }), ctx('2026-01-01', 1100));
    expect(r).toMatchObject({ start: '2022-05-15', auto: false });
  });
  it('apport en dollars : l\'apport net est converti (cas multi-devises)', () => {
    const r = P.accPerfInfo(acc([dep('2024-01-01', 1080, { ccy: 'USD' })]), ctx('2025-01-01', 1100));
    expect(r.net).toBeCloseTo(1000, 8);
    expect(r.gain).toBeCloseTo(100, 8);
  });
});

describe('accPerfPeriod : performance pondérée des flux (Dietz modifié)', () => {
  it('un seul apport au début : gain / apport', () => {
    const r = P.accPerfPeriod(acc([dep('2025-01-01', 1000)]), '2025-01-01', 0, true, ctx('2026-01-01', 1100));
    expect(r.pct).toBeCloseTo(10, 8);
    expect(r.gain).toBeCloseTo(100, 8);
  });
  it('un apport en milieu de période pèse pour moitié dans le dénominateur', () => {
    // 1000 au début, 1000 à mi-période, valeur finale 2200 : gain 200 ; base 1000 + 1000 × ~0,5
    const r = P.accPerfPeriod(acc([dep('2025-01-01', 1000), dep('2025-07-02', 1000)]), '2025-01-01', 0, true, ctx('2026-01-01', 2200));
    expect(r.gain).toBeCloseTo(200, 8);
    expect(r.pct).toBeCloseTo(200 / 1500 * 100, 0);
  });
  it('un retrait réduit le dénominateur et le gain est calculé après retrait', () => {
    const r = P.accPerfPeriod(acc([dep('2025-01-01', 1000), wit('2025-07-02', 500)]), '2025-01-01', 0, true, ctx('2026-01-01', 650));
    expect(r.gain).toBeCloseTo(150, 8);   // 650 − 0 − (1000 − 500)
    expect(r.pct).toBeGreaterThan(150 / 1000 * 100);
  });
  it('apport en dollars : converti avant pondération', () => {
    const r = P.accPerfPeriod(acc([dep('2025-01-01', 1080, { ccy: 'USD' })]), '2025-01-01', 0, true, ctx('2026-01-01', 1100));
    expect(r.pct).toBeCloseTo(10, 8);
  });
  it('depuis une date passée (YTD) : la valeur de départ est la base, les flux antérieurs sont exclus', () => {
    const r = P.accPerfPeriod(acc([dep('2024-01-01', 1000)]), '2025-12-31', 1200, false, ctx('2026-06-30', 1300));
    expect(r.pct).toBeCloseTo(100 / 1200 * 100, 8);
  });
  it('un flux daté du jour de départ est inclus (période « depuis le début ») ou exclu (YTD)', () => {
    const a = acc([dep('2025-12-31', 500)]);
    expect(P.accPerfPeriod(a, '2025-12-31', 0, true, ctx('2026-12-31', 600)).gain).toBeCloseTo(100, 8);
    expect(P.accPerfPeriod(a, '2025-12-31', 500, false, ctx('2026-12-31', 600)).gain).toBeCloseTo(100, 8);
  });
  it('les flux futurs sont ignorés', () => {
    const r = P.accPerfPeriod(acc([dep('2025-01-01', 1000), dep('2030-01-01', 5000)]), '2025-01-01', 0, true, ctx('2026-01-01', 1100));
    expect(r.pct).toBeCloseTo(10, 8);
  });
  it('période vide (aujourd\'hui ≤ début) ou base nulle : null', () => {
    expect(P.accPerfPeriod(acc([dep('2025-01-01', 1000)]), '2026-01-01', 0, true, ctx('2026-01-01', 1))).toBeNull();
    expect(P.accPerfPeriod(acc([]), '2025-01-01', 0, true, ctx('2026-01-01', 100))).toBeNull();
  });
  it('flux tout récents : on retombe sur le capital investi au lieu d\'un dénominateur quasi nul', () => {
    // 1000 au départ, retiré presque entièrement le lendemain : sans garde-fou, le dénominateur serait ≈ 3 et le pourcentage absurde
    const r = P.accPerfPeriod(acc([wit('2025-01-02', 1000)]), '2025-01-01', 1000, false, ctx('2026-01-01', 50));
    expect(r.gain).toBeCloseTo(50, 8);
    expect(r.pct).toBeCloseTo(5, 8);
  });
  it('une régularisation est un flux : elle ne crée ni gain ni perte (le gain reste celui d\'avant)', () => {
    // 1 000 € apportés, solde réel saisi à 1 500 € le 01/06 (écart +500 traité comme un apport), valeur finale 1 600 = 1 100 + 500
    const withAdj = acc([dep('2025-01-01', 1000)], { cashAdjust: [{ id: 'r', date: '2025-06-01', balances: { EUR: 1500 } }] });
    const r = P.accPerfPeriod(withAdj, '2025-01-01', 0, true, ctx('2026-01-01', 1600));
    expect(r.gain).toBeCloseTo(100, 8);
    expect(r.pct).toBeGreaterThan(0);
    expect(r.pct).toBeLessThan(10 + 1e-9);   // plus de capital pondéré qu'avant : jamais un gain gonflé
  });
});

describe('accPerfSummary', () => {
  const a = acc([dep('2024-01-01', 1000)]);
  const c = ctx('2026-06-30', 1300);
  const perf = () => P.accPerfInfo(a, c);
  it('null sans performance', () => expect(P.accPerfSummary(a, null, c, noValue)).toBeNull());
  it('historique depuis le début ; YTD depuis le 31 décembre précédent avec la valeur à cette date', () => {
    const s = P.accPerfSummary(a, perf(), c, day => { expect(day).toBe('2025-12-31'); return { v: 1200, approx: false }; });
    expect(s.t0).toBe('2024-01-01');
    expect(s.pye).toBe('2025-12-31');
    expect(s.all.pct).toBeCloseTo(30, 8);
    expect(s.ytd.pct).toBeCloseTo(100 / 1200 * 100, 8);
    expect(s.approx).toBe(false);
  });
  it('signale un YTD approximatif quand l\'historique de cours est incomplet', () => {
    expect(P.accPerfSummary(a, perf(), c, () => ({ v: 1200, approx: true })).approx).toBe(true);
  });
  it('compte plus récent que l\'année : le YTD est l\'historique (valeur de départ non demandée)', () => {
    const young = acc([dep('2026-03-01', 1000)]);
    const cy = ctx('2026-06-30', 1100);
    const s = P.accPerfSummary(young, P.accPerfInfo(young, cy), cy, () => { throw new Error('ne doit pas être appelé'); });
    expect(s.ytd).toBe(s.all);
  });
  it('performance annuelle moyenne : taux équivalent, seulement à partir d\'un an', () => {
    const two = acc([dep('2024-01-01', 1000)]), c2 = ctx('2026-01-01', 1210);
    const s = P.accPerfSummary(two, P.accPerfInfo(two, c2), c2, noValue);
    expect(s.annual).toBeCloseTo(10, 0);
    const c3 = ctx('2024-06-01', 1100);
    expect(P.accPerfSummary(two, P.accPerfInfo(two, c3), c3, noValue).annual).toBeNull();
  });
  it('l\'annuel est cohérent avec le pourcentage affiché : (1 + pct)^(1/années) − 1', () => {
    const s = P.accPerfSummary(a, perf(), c, noValue);
    const years = (Date.UTC(2026, 5, 30) - Date.UTC(2024, 0, 1)) / 86400000 / 365.25;
    expect(s.annual).toBeCloseTo((Math.pow(1 + s.all.pct / 100, 1 / years) - 1) * 100, 8);
  });
  it('date d\'ouverture antérieure au premier apport : elle devient le début', () => {
    const o = acc([dep('2024-01-01', 1000)], { startDate: '2022-05-15' });
    const co = ctx('2026-06-30', 1300);
    expect(P.accPerfSummary(o, P.accPerfInfo(o, co), co, noValue).t0).toBe('2022-05-15');
  });
});

describe('accPerfPct : même valeur pour l\'écran du compte et la liste', () => {
  const a = acc([dep('2024-01-01', 1000)]), c = ctx('2026-06-30', 1300);
  it('mode all / ytd', () => {
    expect(P.accPerfPct(a, 'all', c, noValue)).toBeCloseTo(30, 8);
    expect(P.accPerfPct(a, 'ytd', c, () => ({ v: 1200, approx: false }))).toBeCloseTo(100 / 1200 * 100, 8);
  });
  it('null sans apport', () => expect(P.accPerfPct(acc([]), 'all', c, noValue)).toBeNull());
});

describe('accValueOnDay', () => {
  const h = (over = {}) => ({ ticker: 'MC', currency: 'USD', currentPrice: 200, ...over });
  const env = (over = {}) => ({ qtyOnDay: () => 10, closeOn: () => 100, conv, cashOn: () => 50, ...over });
  it('quantités du jour × clôture connue, converties, + liquidités du jour', () => {
    const r = P.accValueOnDay({ holdings: [h()] }, '2025-12-31', env());
    expect(r.v).toBeCloseTo(10 * 100 / 1.08 + 50, 8);
    expect(r.approx).toBe(false);
  });
  it('sans clôture connue : cours actuel et résultat marqué approximatif ; inconnu si AUCUNE clôture', () => {
    const r = P.accValueOnDay({ holdings: [h()] }, '2025-12-31', env({ closeOn: () => null }));
    expect(r.v).toBeCloseTo(10 * 200 / 1.08 + 50, 8);
    expect(r.approx).toBe(true);
    expect(r.unknown).toBe(true);
    const partial = P.accValueOnDay({ holdings: [h(), h({ ticker: 'OR' })] }, '2025-12-31', env({ closeOn: t => (t === 'MC' ? 100 : null) }));
    expect(partial).toMatchObject({ approx: true, unknown: false });
  });
  it('position non détenue ce jour-là : ignorée (et n\'est pas approximative)', () => {
    const r = P.accValueOnDay({ holdings: [h()] }, '2020-01-01', env({ qtyOnDay: () => 0, closeOn: () => null }));
    expect(r).toEqual({ v: 50, approx: false, unknown: false });
  });
});
