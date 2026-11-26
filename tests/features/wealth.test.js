import { describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';
import { LOAN } from '../helpers/loan.js';

const calc = loadClassic('js/features/realestate-calc.js', { globals: LOAN, exports: ['immoCalc'] });
const W = loadClassic('js/features/wealth.js', {
  globals: calc,
  exports: ['wealthProperties', 'wealthBreakdown', 'accPocket', 'analysisData'],
});
const TODAY = '2026-11-22';
const prop = (over = {}) => ({ id: 'im1', name: 'Appart', kind: 'main', buyDate: '2025-09-11', price: 100000, notary: 0, works: 0, otherFees: 0, growth: 0, loan: null, ...over });
const hold = (over = {}) => ({ ticker: 'MC', type: 'Action', country: 'France', sector: 'Luxe', value: 1000, valueRef: 1000, ...over });
const acc = (over = {}) => ({ id: 'a', name: 'PEA', type: 'Plan d\'Épargne en Actions (PEA)', value: 1000, holdings: [hold()], ...over });
const noCash = () => 0;

describe('wealthProperties', () => {
  it('garde un bien valide', () => expect(W.wealthProperties([prop()], TODAY)).toHaveLength(1));
  it('écarte un bien acheté dans le futur, sans date ou sans prix', () => {
    expect(W.wealthProperties([prop({ buyDate: '2027-01-01' }), prop({ id: 'b', buyDate: '' }), prop({ id: 'c', price: 0 })], TODAY)).toEqual([]);
  });
  it('écarte un bien dont les valeurs ne sont pas calculables', () => {
    expect(W.wealthProperties([prop({ growth: Infinity })], TODAY)).toEqual([]);   // valeur infinie : bien écarté, pas de total « Infinity »
  });
  it('un bien acheté aujourd\'hui est pris en compte', () => expect(W.wealthProperties([prop({ buyDate: TODAY })], TODAY)).toHaveLength(1));
});

describe('wealthBreakdown', () => {
  it('sans bien : patrimoine net = patrimoine brut = comptes financiers', () => {
    const w = W.wealthBreakdown([acc({ value: 5000 })], [], TODAY);
    expect(w).toEqual({ financial: 5000, property: 0, debt: 0, count: 0, gross: 5000, net: 5000 });
  });
  it('exclut les comptes observateurs', () => {
    expect(W.wealthBreakdown([acc({ value: 5000 }), acc({ id: 'o', value: 999, observer: true })], [], TODAY).financial).toBe(5000);
  });
  it('net = comptes + immobilier brut − crédits ; brut = comptes + immobilier brut', () => {
    const p = prop({ price: 200000, loan: { amount: 150000, rate: 0, years: 10, payment: 0, first: '' } });
    const w = W.wealthBreakdown([acc({ value: 10000 })], [p], TODAY);
    expect(w.property).toBe(200000);
    expect(w.debt).toBeGreaterThan(0);
    expect(w.gross).toBe(210000);
    expect(w.net).toBeCloseTo(210000 - w.debt, 6);
    expect(w.count).toBe(1);
  });
  it('valeur d\'un compte absente ou non numérique : comptée 0', () => {
    expect(W.wealthBreakdown([acc({ value: undefined }), acc({ id: 'b', value: 100 })], [], TODAY).financial).toBe(100);
  });
  it('un bien futur n\'est compté ni dans la valeur, ni dans la dette', () => {
    const w = W.wealthBreakdown([acc({ value: 10 })], [prop({ buyDate: '2030-01-01', loan: { amount: 1000, rate: 0, years: 1 } })], TODAY);
    expect(w).toMatchObject({ property: 0, debt: 0, count: 0, net: 10 });
  });
});

describe('accPocket (grande classe d\'un compte)', () => {
  it.each([
    ['Livret A', 'Liquidités'], ['Compte courant', 'Liquidités'], ['Compte à terme', 'Liquidités'], ['LDDS', 'Liquidités'],
    ['Plan d\'Épargne en Actions (PEA)', 'Bourse'], ['Compte-Titres Ordinaire', 'Bourse'], ['Assurance-vie', 'Bourse'],
    ['PER', 'Bourse'], ['Pilier 3a', 'Bourse'], ['Plan d\'épargne retraite', 'Bourse'],
    ['Crypto', 'Crypto'], ['SCPI / Immobilier', 'Immobilier'], ['Métaux précieux', 'Autres'], ['Divers', 'Autres'], ['', 'Autres'],
  ])('%s → %s', (type, pocket) => expect(W.accPocket({ type })).toBe(pocket));
  it('compte sans type', () => expect(W.accPocket({})).toBe('Autres'));
});

describe('analysisData', () => {
  const sum = o => Object.values(o).reduce((s, v) => s + v, 0);
  const accounts = [
    acc({ value: 1500, holdings: [hold({ value: 1000, valueRef: 1000 })] }),   // 1000 de titres + 500 de cash
    acc({ id: 'c', type: 'Crypto', value: 300, holdings: [hold({ ticker: 'BTC', type: 'Crypto', country: 'France', sector: 'Techno', value: 300, valueRef: 300 })] }),
    acc({ id: 'l', type: 'Livret A', value: 200, holdings: [] }),
  ];
  const cashOf = a => (a.id === 'a' ? 500 : 0);

  it('sans bien : le total est la somme des comptes financiers', () => {
    const d = W.analysisData(accounts, [], TODAY, cashOf);
    expect(d.tot).toBe(2000);
    expect(sum(d.byPocket)).toBe(2000);
    expect(sum(d.byAccType)).toBe(2000);
  });
  it('le total de l\'Analyse est TOUJOURS égal au patrimoine net de l\'Accueil (une seule règle pour les biens)', () => {
    const props = [prop({ price: 300000, growth: 2, loan: { amount: 250000, rate: 3, years: 20, payment: 0, first: '' } }), prop({ id: 'f', buyDate: '2031-01-01' })];
    const d = W.analysisData(accounts, props, TODAY, cashOf);
    expect(d.tot).toBe(W.wealthBreakdown(accounts, props, TODAY).net);
    expect(d.propertyCount).toBe(1);
  });
  it('l\'immobilier entre pour sa valeur NETTE, une seule fois, dans les grandes classes, les types d\'actif et de compte', () => {
    const p = prop({ price: 300000, loan: { amount: 250000, rate: 0, years: 10, payment: 0, first: '' } });
    const d = W.analysisData(accounts, [p], TODAY, cashOf);
    const net = d.wealth.property - d.wealth.debt;
    expect(d.byPocket.Immobilier).toBeCloseTo(net, 6);
    expect(d.byAsset.Immobilier).toBeCloseTo(net, 6);
    expect(d.byAccType.Immobilier).toBeCloseTo(net, 6);
    expect(sum(d.byPocket)).toBeCloseTo(d.tot, 6);
  });
  it('les répartitions par type d\'actif couvrent titres + liquidités ; la crypto est à part', () => {
    const d = W.analysisData(accounts, [], TODAY, cashOf);
    expect(d.byAsset).toEqual({ Cash: 500, Actions: 1000, Crypto: 300 });
  });
  it('objectifs d\'allocation (byRaw / totRaw) : titres et cash seulement, jamais l\'immobilier', () => {
    const d = W.analysisData(accounts, [prop({ price: 300000 })], TODAY, cashOf);
    expect(d.byRaw).toEqual({ Cash: 500, Action: 1000, Crypto: 300 });
    expect(d.totRaw).toBe(1800);
    expect(d.byRaw.Immobilier).toBeUndefined();
  });
  it('exclut les comptes observateurs de toutes les répartitions', () => {
    const d = W.analysisData([...accounts, acc({ id: 'o', value: 9999, observer: true })], [], TODAY, cashOf);
    expect(d.tot).toBe(2000);
    expect(d.accs).toHaveLength(3);
  });
  it('géographie et secteurs : « Non renseigné » pour vide / tiret / inconnu, crypto regroupée', () => {
    const accs = [acc({ holdings: [
      hold({ country: '—', sector: 'Inconnu', valueRef: 10 }), hold({ country: '', sector: '-', valueRef: 20 }),
      hold({ country: 'USA', sector: 'Tech', valueRef: 30 }),
    ] }), accounts[1]];
    const d = W.analysisData(accs, [], TODAY, noCash);
    expect(d.byGeo).toEqual({ 'Non renseigné': 30, USA: 30, 'Crypto (sans pays)': 300 });
    expect(d.bySec).toEqual({ 'Non renseigné': 30, Tech: 30, Crypto: 300 });
  });
  it('un compte Immobilier (SCPI) va dans la classe Immobilier et ses titres aussi', () => {
    const d = W.analysisData([acc({ type: 'SCPI / Immobilier', value: 800, holdings: [hold({ type: 'ETF', value: 800, valueRef: 800 })] })], [], TODAY, noCash);
    expect(d.byPocket).toEqual({ Immobilier: 800 });
    expect(d.byAsset).toEqual({ Immobilier: 800 });
  });
  it('valeur de titre en devise appli (valueRef) prioritaire sur value (devise native)', () => {
    const d = W.analysisData([acc({ holdings: [hold({ value: 10, valueRef: 9 })] })], [], TODAY, noCash);
    expect(d.byAsset.Actions).toBe(9);
  });
  it('aucun compte, aucun bien : total nul', () => expect(W.analysisData([], [], TODAY, noCash).tot).toBe(0));
});

describe('cas de référence des captures : comptes financiers 102 738,83 € + immobilier net 30 535,13 € = 133 273,96 €', () => {
  it('le patrimoine net est la somme, et les « comptes financiers » ne contiennent PAS l\'immobilier', () => {
    const accounts = [acc({ value: 75284.98 }), acc({ id: 'b', value: 27453.85, type: 'Assurance-vie', holdings: [] })];
    // bien dont la valeur nette vaut 30 535,13 : 30 535,13 de valeur, sans crédit
    const p = prop({ price: 30535.13, growth: 0 });
    const w = W.wealthBreakdown(accounts, [p], TODAY);
    expect(w.financial).toBeCloseTo(102738.83, 2);
    expect(w.net).toBeCloseTo(133273.96, 2);
    expect(W.analysisData(accounts, [p], TODAY, noCash).tot).toBeCloseTo(133273.96, 2);
  });
});

describe('grande classe « Fonds euros »', () => {
  const FE = loadClassic('js/features/wealth.js', { globals: calc, exports: ['analysisData', 'isFondsEuros'] });
  const av = { id: 'av', type: 'Assurance-Vie', value: 100, holdings: [
    { name: 'Fonds Euros', type: 'Obligation', sector: 'Fonds euros', valueRef: 70 },
    { name: 'Amundi EM', type: 'ETF', valueRef: 25 },
  ] };
  it('repère un support en fonds euros par son nom, son secteur ou son type', () => {
    expect(FE.isFondsEuros({ name: 'Fonds Euros' })).toBe(true);
    expect(FE.isFondsEuros({ name: 'Eurossima', sector: 'Fonds en euros' })).toBe(true);
    expect(FE.isFondsEuros({ type: 'Fonds euros' })).toBe(true);
    expect(FE.isFondsEuros({ name: 'Amundi Euro Stoxx 50', type: 'ETF' })).toBe(false);
  });
  it('l\'assurance-vie est ventilée : fonds euros à part, le reste (et le cash) en Bourse ; total inchangé', () => {
    const d = FE.analysisData([av], [], '2026-11-26', () => 5);
    expect(d.byPocket['Fonds euros']).toBe(70);
    expect(d.byPocket.Bourse).toBe(30);
    expect(d.byAsset['Fonds euros']).toBe(70);
    expect(d.byAsset.Obligations).toBeUndefined();
    expect(Object.values(d.byPocket).reduce((s, v) => s + v, 0)).toBe(100);
  });
});
