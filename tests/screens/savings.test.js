import { describe, it, expect } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';

// Écran d'un livret : vrais calculs (savings.js), rendu sans portefeuille.
const taxEnv = loadClassic('js/features/tax-envelope.js', { exports: ['TAX_ENVELOPES'] });
const accPerf = loadClassic('js/features/account-perf.js', { globals: { PU: globalThis.PU }, exports: ['accFlows'] });
const SV = loadClassic('js/features/savings.js', { globals: { ...taxEnv, ...accPerf }, exports: ['SAVINGS_RATES', 'SAVINGS_RATES_DATE', 'savingsSummary'] });
const screen = rate => loadClassic('js/screens/savings.js', {
  globals: { ...SV, masked: v => v.toFixed(2), fmtDate: d => d, esc: s => String(s), iconHtml: s => s, toRefCcy: v => v,
    accHeroValHTML: a => a.value.toFixed(2), accEnvelopeHTML: () => '<ENV/>', _CHIP: '' },
  exports: ['renderSavingsAccount'],
}).renderSavingsAccount({ id: 'l', name: 'Livret', type: 'Livret A', currency: 'EUR', value: 10150, holdings: [], rate,
  cashflows: [{ type: 'DEP', amount: 10000, date: '2026-01-01' }, { type: 'INT', amount: 150, date: '2026-12-31' }] });

describe('écran livret', () => {
  it('solde, taux, intérêts estimés, enveloppe ; pas de totaux versé / retiré ; ni portefeuille ni ajout de titre', () => {
    const html = screen(1.7);
    expect(html).toContain("Taux 1,7 % · ≈ 172.55 d'intérêts par an au solde actuel");
    for (const k of ['Versé<', 'Retiré<', 'Intérêts reçus<']) expect(html.includes(k)).toBe(false);
    expect(html).toContain('<ENV/>');
    expect(html).toContain('id="js-moves"');
    for (const id of ['js-add-hold', 'js-holds', 'js-search', 'Portefeuille']) expect(html.includes(id)).toBe(false);
  });
  it('taux absent : invitation à le saisir ; taux différent du taux réglementé : rappel', () => {
    expect(screen(undefined)).toContain('Taux non renseigné');
    expect(screen(1.5)).toContain('Taux réglementé en vigueur depuis le 2026-08-01 : 1,7 %');
    expect(screen(1.7).includes('Taux réglementé en vigueur')).toBe(false);
  });
});
