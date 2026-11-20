import { describe, it, expect } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const { DCAAllocation: allocation } = loadClassic('js/features/dca.js', {
  globals: { registerModal() {} },
  exports: ['DCAAllocation'],
});

describe('Calculs de répartition DCA', () => {
  it('refuse la conversion sans budget sans modifier les poids', () => {
    const weights = [60, 40];
    expect(() => allocation.toAmounts(weights, 0)).toThrow(/Budget/);
    expect(weights).toEqual([60, 40]);
  });
  it('convertit les poids en montants arrondis au centime', () => {
    expect(allocation.toAmounts([60, 40], 100)).toEqual([60, 40]);
    expect(allocation.toAmounts([100 / 3, 100 / 3, 100 / 3], 100)).toEqual([33.33, 33.33, 33.33]);
  });
  it.each([[[33.33, 33.33, 33.33]], [[50, 50.01]]])('accepte un centime de différence : %j', amounts => {
    const weights = allocation.toWeights(amounts, 100);
    expect(weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 10);
    expect(weights.every(value => value >= 0)).toBe(true);
  });
  it('refuse plus d’un centime de différence', () => {
    expect(() => allocation.toWeights([99.98], 100)).toThrow();
  });
  it('refuse les poids négatifs et les valeurs non finies', () => {
    expect(() => allocation.normalizeWeights([-10, 110])).toThrow();
    expect(() => allocation.toWeights([NaN], 100)).toThrow();
    expect(() => allocation.toAmounts([100], Infinity)).toThrow();
  });
  it('normalise les pourcentages arrondis sans attribuer le reliquat à une ligne nulle', () => {
    const weights = allocation.normalizeWeights([33.33, 33.33, 33.33, 0]);
    expect(weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 10);
    expect(weights[3]).toBe(0);
  });
  it('refuse un doublon après résolution sans modifier le plan', () => {
    const lines = [{ ticker: 'FR0000000001', isin: 'FR0000000001', resolved: false }, { ticker: 'AAA' }];
    const before = JSON.stringify(lines);
    expect(() => allocation.resolveLine(lines, 0, { ticker: ' aaa ' })).toThrow(/deux fois/);
    expect(JSON.stringify(lines)).toBe(before);
  });
  it('conserve l’ISIN et le poids lors d’une résolution valide', () => {
    const lines = [{ ticker: 'FR0000000001', isin: 'FR0000000001', weight: 100 }];
    const result = allocation.resolveLine(lines, 0, { ticker: 'AAA', name: 'Titre A' });
    expect(result[0]).toMatchObject({ ticker: 'AAA', isin: 'FR0000000001', weight: 100, resolved: true });
    expect(lines[0].ticker).toBe('FR0000000001');
  });
});
