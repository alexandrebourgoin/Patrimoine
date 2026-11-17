import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const S = { currency: 'EUR', accounts: [], watchlist: [] };
const { fxPairsNeeded, _histRange, _histSeriesFromByDay } = loadClassic('js/services/prices.js', {
  globals: { S, FX_RATES: { EUR: 1 }, dbgLog() {}, toast() {}, refreshMain() {} },
  exports: ['fxPairsNeeded', '_histRange', '_histSeriesFromByDay'],
});

afterEach(() => { vi.useRealTimers(); S.currency = 'EUR'; S.accounts = []; S.watchlist = []; });

describe('fxPairsNeeded', () => {
  it('base : USD, GBP, CHF, JPY contre EUR', () => {
    expect(fxPairsNeeded()).toEqual(['EURUSD=X', 'EURGBP=X', 'EURCHF=X', 'EURJPY=X']);
  });
  it('ajoute les devises des comptes, des titres et de la watchlist (sans doublon, jamais EUR)', () => {
    S.accounts = [{ currency: 'CAD', holdings: [{ currency: 'AUD' }, { currency: 'USD' }, { currency: 'EUR' }] }];
    S.watchlist = [{ currency: 'SEK' }];
    expect(fxPairsNeeded()).toEqual([
      'EURUSD=X', 'EURGBP=X', 'EURCHF=X', 'EURJPY=X', 'EURCAD=X', 'EURAUD=X', 'EURSEK=X',
    ]);
  });
  it('devise de référence non-EUR incluse (une seule fois)', () => {
    S.currency = 'USD';
    expect(fxPairsNeeded().filter(p => p === 'EURUSD=X')).toHaveLength(1);
    S.currency = 'CAD';
    expect(fxPairsNeeded()).toContain('EURCAD=X');
  });
});

describe('_histRange (profondeur d\'historique à demander)', () => {
  const at = iso => { vi.useFakeTimers(); vi.setSystemTime(new Date(2024, 5, 15, 12)); return { transactions: iso.map(date => ({ date })) }; };
  it('selon l\'ancienneté du 1er ordre', () => {
    expect(_histRange(at(['2024-01-01']))).toBe('1y');
    expect(_histRange(at(['2022-12-01']))).toBe('2y');
    expect(_histRange(at(['2020-06-15']))).toBe('5y');
    expect(_histRange(at(['2016-06-15']))).toBe('10y');
    expect(_histRange(at(['2010-01-01']))).toBe('max');
  });
  it('prend le plus ancien des ordres, quel que soit leur ordre dans la liste', () => {
    expect(_histRange(at(['2024-01-01', '2016-06-15']))).toBe('10y');
  });
  it('sans transaction : 1 an', () => {
    expect(_histRange(at([]))).toBe('1y');
  });
});

describe('_histSeriesFromByDay', () => {
  it('dictionnaire {jour → clôture} → série ascendante [{d, c}]', () => {
    expect(_histSeriesFromByDay({ '2024-03-02': 12, '2024-03-01': 10, '2024-02-28': 9 })).toEqual([
      { d: '2024-02-28', c: 9 }, { d: '2024-03-01', c: 10 }, { d: '2024-03-02', c: 12 },
    ]);
  });
});
