// Symboles dans les URL du proxy des cours et de FMP : chacun encodé, comme les appels unitaires
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadClassic } from '../helpers/load-classic.js';

const { symbolsParam } = loadClassic('js/services/prices.js', { globals: { S: {} }, exports: ['symbolsParam'] });

describe('liste de symboles pour une URL', () => {
  it('chaque symbole est encodé, les virgules séparent', () => {
    expect(symbolsParam(['MC.PA', '^FCHI', 'EURUSD=X', 'BRK-B'])).toBe('MC.PA,%5EFCHI,EURUSD%3DX,BRK-B');
    expect(symbolsParam([])).toBe('');
  });
  it('plus aucune liste de symboles jointe sans encodage dans une URL', () => {
    const src = readFileSync('js/services/prices.js', 'utf8');
    expect(src).not.toMatch(/'\?symbols=' \+ yahooSymbols\.join/);
    expect(src).not.toMatch(/quote\/\$\{yahooSymbols\.join/);
  });
});
