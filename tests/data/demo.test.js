import { describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';

// Les données de démonstration doivent respecter les règles des comptes (sinon elles les contournent en silence :
// un type de compte au libellé inexact n'a ni devise imposée ni types d'actifs contrôlés).
const rules = loadClassic('js/features/account-rules.js', { exports: ['ACCOUNT_TYPES', 'assetTypeError', 'ACC_TYPE_CCY'] });
const FX_RATES = { EUR: 1, USD: 1.08, GBP: 1.16, CHF: 1.05, JPY: 163 };
const { genDemo } = loadClassic('js/data/demo.js', {
  globals: { PU: globalThis.PU, FX_RATES, toRefCcy: (v, c) => globalThis.PU.toRefCcy(v, c, FX_RATES, 'EUR') },
  exports: ['genDemo'],
});

describe('comptes de démonstration', () => {
  const accs = genDemo();
  it('chaque compte a un type EXACT de la liste des types (les règles s\'y appliquent)', () => {
    for (const a of accs) expect(rules.ACCOUNT_TYPES, a.name).toContain(a.type);
  });
  it('chaque position respecte les types d\'actifs et le pays imposés par son compte', () => {
    for (const a of accs) for (const h of a.holdings) expect(rules.assetTypeError(a, h.type, h.country), `${a.name} / ${h.ticker}`).toBe('');
  });
  it('la devise de chaque compte est compatible avec la devise imposée par son type', () => {
    for (const a of accs) { const rule = rules.ACC_TYPE_CCY[a.type]; if (rule && rule[1]) expect(a.currency, a.name).toBe(rule[0]); }
  });
});
