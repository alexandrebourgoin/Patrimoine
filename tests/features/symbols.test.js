// Cotations choisies par l'utilisateur : mémorisées par ticker, valables partout, sauvegardées
import { describe, it, expect } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), dump: () => Object.fromEntries(m) };
}
const SY = loadClassic('js/features/symbols.js', {
  globals: { localStorage: fakeStorage() },
  exports: ['SYMBOLS_STORE', 'symbolsAll', 'symbolUser', 'symbolSet', 'symbolClear', 'symbolQuery', 'yahooCandidates', 'cgCandidates', 'symbolEntry'],
});

describe('cotations choisies : stockage', () => {
  it('clé « patrimoine-symbols » : sauvegardée automatiquement avec le reste', () => {
    expect(SY.SYMBOLS_STORE.startsWith('patrimoine-')).toBe(true);
  });
  it('mémorise, relit, remplace et retire un choix ; refuse un choix vide', () => {
    const st = fakeStorage();
    SY.symbolSet('3CP', { yahoo: '3CP.F', label: '3CP.F · Francfort · EUR' }, st, 1);
    SY.symbolSet('AAVE', { cg: 'aave' }, st, 2);
    expect(SY.symbolUser('3CP', st)).toEqual({ yahoo: '3CP.F', label: '3CP.F · Francfort · EUR', at: 1 });
    expect(SY.symbolUser('AAVE', st).cg).toBe('aave');
    SY.symbolSet('3CP', { yahoo: '1810.HK' }, st, 3);
    expect(SY.symbolUser('3CP', st)).toEqual({ yahoo: '1810.HK', at: 3 });
    SY.symbolClear('3CP', st);
    expect(SY.symbolUser('3CP', st)).toBeNull();
    expect(() => SY.symbolSet('X', {}, st)).toThrow();
  });
  it('stockage illisible : aucun choix, sans erreur', () => {
    expect(SY.symbolsAll(fakeStorage({ 'patrimoine-symbols': '{oups' }))).toEqual({});
    expect(SY.symbolUser('X', fakeStorage({ 'patrimoine-symbols': '[1]' }))).toBeNull();
  });
});

describe('entrée mémorisée pour une cotation choisie', () => {
  it('symbole Yahoo avec place et devise, ou identifiant CoinGecko', () => {
    expect(SY.symbolEntry({ kind: 'yahoo', id: '3CP.F', place: 'Frankfurt', currency: 'EUR' })).toEqual({ yahoo: '3CP.F', label: '3CP.F · Frankfurt · EUR' });
    expect(SY.symbolEntry({ kind: 'cg', id: 'aave', name: 'Aave (AAVE)' })).toEqual({ cg: 'aave', label: 'Aave (AAVE)' });
  });
});

describe('recherche proposée', () => {
  it('ISIN d\'abord (le plus fiable), sinon le nom ; crypto : le ticker', () => {
    expect(SY.symbolQuery({ ticker: 'JE00BDD9Q956', name: 'Wisdomtree Nat Gas' })).toBe('JE00BDD9Q956');
    expect(SY.symbolQuery({ ticker: '3CP', name: 'Xiaomi corporation', isin: 'KYG9830T1067' })).toBe('KYG9830T1067');
    expect(SY.symbolQuery({ ticker: '3CP', name: 'Xiaomi corporation' })).toBe('Xiaomi corporation');
    expect(SY.symbolQuery({ ticker: 'AAVE', name: 'AAVE', type: 'Crypto' })).toBe('AAVE');
  });
});

describe('analyse des réponses', () => {
  it('Yahoo : places et devises de chaque cotation, cours joints', () => {
    const search = { quotes: [
      { symbol: '3CP.F', quoteType: 'EQUITY', exchDisp: 'Frankfurt', shortname: 'XIAOMI CORP' },
      { symbol: '1810.HK', quoteType: 'EQUITY', exchDisp: 'Hong Kong', shortname: 'XIAOMI-W' },
      { symbol: 'XIACF', quoteType: 'OPTION' },
    ] };
    const quotes = { quoteResponse: { result: [
      { symbol: '3CP.F', currency: 'EUR', regularMarketPrice: 3.52, fullExchangeName: 'Frankfurt', regularMarketTime: 1795800000 },
      { symbol: '1810.HK', currency: 'HKD', regularMarketPrice: 31.2, fullExchangeName: 'HKSE', longName: 'Xiaomi Corporation' },
    ] } };
    expect(SY.yahooCandidates(search, quotes)).toEqual([
      { kind: 'yahoo', id: '3CP.F', ticker: '3CP', type: 'Action', name: 'XIAOMI CORP', place: 'Frankfurt', currency: 'EUR', price: 3.52, quoteAt: 1795800000000 },
      { kind: 'yahoo', id: '1810.HK', ticker: '1810', type: 'Action', name: 'Xiaomi Corporation', place: 'HKSE', currency: 'HKD', price: 31.2, quoteAt: null },
    ]);
    expect(SY.yahooCandidates({ quotes: [{ symbol: 'A', quoteType: 'ETF' }] }, null)[0]).toMatchObject({ id: 'A', ticker: 'A', type: 'ETF', price: null, currency: '' });
    expect(SY.yahooCandidates({ quotes: [{ symbol: '0P0001.SW', quoteType: 'MUTUALFUND' }] }, null)[0].type).toBe('ETF');
  });
  it('CoinGecko : symbole exact en tête, puis par capitalisation ; cours en USD', () => {
    const search = { coins: [
      { id: 'aave-old', name: 'Aave old', symbol: 'lend', market_cap_rank: 900 },
      { id: 'aavegotchi', name: 'Aavegotchi', symbol: 'ghst', market_cap_rank: 300 },
      { id: 'aave', name: 'Aave', symbol: 'aave', market_cap_rank: 40 },
    ] };
    const c = SY.cgCandidates(search, { aave: { usd: 111.3, last_updated_at: 1795800000 } }, 'AAVE');
    expect(c.map(x => x.id)).toEqual(['aave', 'aavegotchi', 'aave-old']);
    expect(c[0]).toEqual({ kind: 'cg', id: 'aave', ticker: 'AAVE', type: 'Crypto', name: 'Aave (AAVE)', place: 'Crypto · rang 40', currency: 'USD', price: 111.3, quoteAt: 1795800000000 });
  });
});

describe('le choix vaut pour toute l\'app', () => {
  const st = fakeStorage();
  const S = loadClassic('js/features/symbols.js', { globals: { localStorage: st }, exports: ['symbolSet', 'symbolUser'] });
  const D = loadClassic('js/data/securities.js', { globals: { symbolUser: t => S.symbolUser(t, st) }, exports: ['yahooSymbolFor', 'cgIdFor'] });
  it('symbole Yahoo choisi prioritaire sur la résolution ISIN du holding et la table', () => {
    expect(D.yahooSymbolFor('3CP')).toBe('3CP');
    expect(D.yahooSymbolFor('3CP', 'XIA.DE')).toBe('XIA.DE');
    S.symbolSet('3CP', { yahoo: '3CP.F' }, st);
    expect(D.yahooSymbolFor('3CP', 'XIA.DE')).toBe('3CP.F');
  });
  it('identifiant CoinGecko choisi, sinon la table', () => {
    expect(D.cgIdFor('BTC')).toBe('bitcoin');
    expect(D.cgIdFor('AAVE')).toBeUndefined();
    S.symbolSet('AAVE', { cg: 'aave' }, st);
    expect(D.cgIdFor('AAVE')).toBe('aave');
  });
});
