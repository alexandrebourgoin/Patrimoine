import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// js/data/securities.js est un script classique (const globales, pas d'exports).
// On l'évalue tel quel pour tester le VRAI fichier livré dans la PWA.
const SRC = readFileSync(new URL('../../js/data/securities.js', import.meta.url), 'utf8');
const { SECURITIES_DB, YAHOO_MAP, CG_IDS, ISIN_MAP, yahooSymbolFor } =
  new Function(`${SRC}; return { SECURITIES_DB, YAHOO_MAP, CG_IDS, ISIN_MAP, yahooSymbolFor };`)();

// Un littéral d'objet accepte silencieusement deux fois la même clé (la 2e écrase la 1re).
function duplicateKeys(block) {
  const seen = new Set(), dups = [];
  for (const m of block.matchAll(/^\s*'([A-Z0-9-]+)'\s*:/gm)) {
    if (seen.has(m[1])) dups.push(m[1]); else seen.add(m[1]);
  }
  return dups;
}
const blockOf = name => SRC.slice(SRC.indexOf(`const ${name} =`)).split(/\n\};/)[0];

describe('SECURITIES_DB', () => {
  it('chaque titre a les 5 champs attendus', () => {
    for (const [t, d] of Object.entries(SECURITIES_DB)) {
      for (const k of ['name', 'sector', 'country', 'currency', 'type']) {
        expect(d[k], `${t}.${k}`).toBeTruthy();
      }
      expect(['Action', 'ETF', 'Crypto', 'Obligation'], `${t}.type`).toContain(d.type);
      expect(d.currency, `${t}.currency`).toMatch(/^[A-Z]{3}$/);
    }
  });
  it('pas de clé dupliquée', () => {
    expect(duplicateKeys(blockOf('SECURITIES_DB'))).toEqual([]);
  });
});

describe('YAHOO_MAP / CG_IDS', () => {
  it('tout titre de YAHOO_MAP existe dans SECURITIES_DB', () => {
    for (const t of Object.keys(YAHOO_MAP)) expect(SECURITIES_DB[t], t).toBeDefined();
  });
  it('pas de clé dupliquée dans YAHOO_MAP', () => {
    const dups = [...blockOf('YAHOO_MAP').matchAll(/'([A-Z0-9-]+)'\s*:/g)].map(m => m[1])
      .filter((k, i, a) => a.indexOf(k) !== i);
    expect(dups).toEqual([]);
  });
  it('les cryptos de SECURITIES_DB ont un id CoinGecko, et inversement', () => {
    const cryptos = Object.entries(SECURITIES_DB).filter(([, d]) => d.type === 'Crypto').map(([t]) => t);
    for (const t of cryptos) expect(CG_IDS[t], t).toBeTruthy();
    for (const t of Object.keys(CG_IDS)) expect(SECURITIES_DB[t]?.type, t).toBe('Crypto');
  });
});

describe('ISIN_MAP', () => {
  it('clés au format ISIN (2 lettres + 10 alphanum)', () => {
    for (const isin of Object.keys(ISIN_MAP)) expect(isin).toMatch(/^[A-Z]{2}[A-Z0-9]{10}$/);
  });
  it('chaque entrée a ticker et name', () => {
    for (const [isin, e] of Object.entries(ISIN_MAP)) {
      expect(e.ticker, isin).toBeTruthy();
      expect(e.name, isin).toBeTruthy();
    }
  });
  it('FR0013412269 → PANX (cas réel v1.11.90)', () => {
    expect(ISIN_MAP.FR0013412269.ticker).toBe('PANX');
  });
});

describe('yahooSymbolFor', () => {
  it('priorité : override > YAHOO_MAP > ticker brut', () => {
    expect(yahooSymbolFor('MC')).toBe('MC.PA');
    expect(yahooSymbolFor('VWCE', 'VWCE.DE')).toBe('VWCE.DE');
    expect(yahooSymbolFor('MC', 'MC.XX')).toBe('MC.XX');
    expect(yahooSymbolFor('HOOD')).toBe('HOOD');
  });
});
