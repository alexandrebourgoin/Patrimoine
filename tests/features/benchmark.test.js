import { describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const B = loadClassic('js/features/benchmark.js', {
  exports: ['BENCHMARKS', 'accBenchmarkKey', 'benchNeedsFx', 'benchSeries', 'benchRet', 'benchCovers', 'benchRange'],
});
const s = (...pts) => pts.map(([d, c]) => ({ d, c }));

describe('accBenchmarkKey', () => {
  it('défauts selon le type : Bitcoin pour un compte Crypto, CAC 40 pour un PEA, aucun sinon', () => {
    expect(B.accBenchmarkKey({ type: 'Compte Crypto' })).toBe('BTC');
    expect(B.accBenchmarkKey({ type: "Plan d'Épargne en Actions (PEA)" })).toBe('CAC40');
    expect(B.accBenchmarkKey({ type: 'Compte-Titres Ordinaire' })).toBe('');
    expect(B.accBenchmarkKey({})).toBe('');
  });
  it('le choix explicite prime, y compris « aucun » (chaîne vide)', () => {
    expect(B.accBenchmarkKey({ type: 'PEA', benchmark: 'WORLD' })).toBe('WORLD');
    expect(B.accBenchmarkKey({ type: 'PEA', benchmark: '' })).toBe('');
  });
  it('« PEA » ne se confond pas avec un mot qui le contient', () => expect(B.accBenchmarkKey({ type: 'Peaufinage' })).toBe(''));
});

describe('benchNeedsFx', () => {
  it('un indice en USD doit être converti quand la devise appli est l\'euro, pas les autres cas', () => {
    expect(B.benchNeedsFx('SPX', 'EUR')).toBe(true);
    expect(B.benchNeedsFx('SPX', 'USD')).toBe(false);
    expect(B.benchNeedsFx('CAC40', 'EUR')).toBe(false);
    expect(B.benchNeedsFx('INCONNU', 'EUR')).toBe(false);
  });
});

describe('benchSeries', () => {
  const idx = { series: s(['2024-01-01', 100], ['2024-01-02', 110], ['2024-01-03', 120]) };
  it('indice sans conversion : série inchangée', () => expect(B.benchSeries(idx, null, false)).toEqual({ series: idx.series, conv: false }));
  it('série absente : null', () => expect(B.benchSeries(null, null, false)).toBeNull());
  it('conversion nécessaire sans taux de change : null (jamais une comparaison faussée)', () => expect(B.benchSeries(idx, null, true)).toBeNull());
  it('divise chaque cours par le dernier EUR/USD connu à cette date (le 1er taux sert avant le premier point)', () => {
    const fx = { series: s(['2024-01-02', 2], ['2024-01-03', 4]) };
    const r = B.benchSeries(idx, fx, true);
    expect(r.conv).toBe(true);
    expect(r.series.map(p => p.c)).toEqual([100 / 2, 110 / 2, 120 / 4]);
  });
  it('le dollar qui monte annule le gain d\'un indice en dollars qui ne bouge pas', () => {
    const flat = { series: s(['2024-01-01', 100], ['2024-12-31', 100]) };
    const fx = { series: s(['2024-01-01', 1.0], ['2024-12-31', 1.25]) };
    expect(B.benchRet(B.benchSeries(flat, fx, true).series, '2024-01-01')).toBeCloseTo(-20, 8);
  });
  it('moins de 2 points exploitables : null', () => expect(B.benchSeries({ series: s(['2024-01-01', 1], ['2024-01-02', 1]) }, { series: s(['2024-01-01', 0]) }, true)).toBeNull());
});

describe('benchRet', () => {
  const ser = s(['2024-01-01', 100], ['2024-06-01', 150], ['2024-12-31', 120]);
  it('variation entre le dernier cours ≤ date et le dernier cours', () => {
    expect(B.benchRet(ser, '2024-06-01')).toBeCloseTo(-20, 8);
    expect(B.benchRet(ser, '2024-03-01')).toBeCloseTo(20, 8);   // base = 01/01
  });
  it('date antérieure à la série : le premier point sert de base', () => expect(B.benchRet(ser, '2020-01-01')).toBeCloseTo(20, 8));
  it('série trop courte ou base nulle : null', () => {
    expect(B.benchRet(s(['2024-01-01', 1]), '2024-01-01')).toBeNull();
    expect(B.benchRet(null, '2024-01-01')).toBeNull();
    expect(B.benchRet(s(['2024-01-01', 0], ['2024-02-01', 5]), '2024-01-01')).toBeNull();
  });
});

describe('benchCovers / benchRange', () => {
  it('la série couvre la date de début si elle commence au plus 7 jours après', () => {
    expect(B.benchCovers(s(['2024-01-08', 1]), '2024-01-01')).toBe(true);
    expect(B.benchCovers(s(['2024-01-09', 1]), '2024-01-01')).toBe(false);
    expect(B.benchCovers(s(['2023-01-01', 1]), '2024-01-01')).toBe(true);
    expect(B.benchCovers([], '2024-01-01')).toBe(false);
  });
  it('durée à télécharger selon l\'ancienneté', () => {
    expect([0.5, 1.5, 3, 7, 15].map(B.benchRange)).toEqual(['1y', '2y', '5y', '10y', 'max']);
  });
  it('catalogue : chaque indice a un libellé, un symbole et une devise', () => {
    for (const b of Object.values(B.BENCHMARKS)) expect(b).toMatchObject({ label: expect.any(String), sym: expect.any(String), ccy: expect.stringMatching(/^[A-Z]{3}$/) });
  });
});
