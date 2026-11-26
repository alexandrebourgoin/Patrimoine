import { describe, it, expect, beforeEach } from 'vitest';
import { loadClassic, fakeDocument } from '../helpers/load-classic.js';
import { LOAN } from '../helpers/loan.js';

// Fenêtre « Remboursement anticipé » : vrais calculs (js/features/early-repay.js), faux DOM.
const ER = loadClassic('js/features/early-repay.js', { globals: LOAN, exports: ['earlyRepaySim', 'erCompare', 'erBreakEven', 'erSensitivity'] });
function makeDom() {
  const els = {}, handlers = {}, base = fakeDocument();
  const get = id => (els[id] ??= { id, value: '', innerHTML: '', classList: { on: new Set(), add(c) { this.on.add(c); }, remove(c) { this.on.delete(c); }, toggle(c, f) { f ? this.on.add(c) : this.on.delete(c); } },
    contains: () => false, addEventListener(t, fn) { (handlers[id] ??= {})[t] = fn; } });
  return { els, handlers, document: { ...base, getElementById: get, activeElement: null } };
}
const L = { amount: 200000, rate: 3, years: 20, first: '2020-01-05', insurance: 40 };

describe('fenêtre remboursement anticipé', () => {
  let dom, api, amort;
  beforeEach(() => {
    dom = makeDom(); amort = [];
    api = loadClassic('js/screens/early-repay.js', {
      globals: { ...LOAN, ...ER, document: dom.document, registerModal() {}, esc: s => String(s), masked: v => v.toFixed(2), fmtDate: d => d,
        _dayKey: () => '2026-11-26', openLoanAmort: (t, s) => amort.push([t, s]) },
      exports: ['openEarlyRepay', 'closeEarlyRepay'],
    });
  });
  const out = () => dom.els['er-out'].innerHTML + dom.els['er-cmp'].innerHTML;
  const set = (id, v) => { dom.els[id].value = v; dom.handlers['er-sheet'].input(); };

  it('s ouvre sur un remboursement total au plafond légal, avec le bon régime', () => {
    api.openEarlyRepay('Appart', L, '2020-01-05', 'immo');
    expect(dom.els['er-sheet'].classList.on.has('show')).toBe(true);
    expect(dom.els['er-regime'].value).toBe('immo');
    expect(+dom.els['er-amount'].value).toBeGreaterThan(100000);
    expect(out()).toContain('Crédit soldé');
    expect(out()).toContain('Plafond légal : 6 mois d\'intérêts');
    expect(dom.els['er-mode-row'].classList.on.has('hidden')).toBe(true);   // pas de choix durée / mensualité pour un total
    expect(out()).toContain('Rendement net d\'équilibre');
    expect((out().match(/<span class="er-l">\d %<\/span>/g) || []).length).toBe(9);    // sensibilité 0 à 8 %
  });
  it('partiel : choix durée / mensualité, montant d indemnité saisi, nouveau tableau d amortissement', () => {
    api.openEarlyRepay('Appart', L, '2020-01-05', 'immo');
    set('er-amount', '30000');
    expect(dom.els['er-mode-row'].classList.on.has('hidden')).toBe(false);
    expect(out()).toMatch(/de moins\), même mensualité/);
    dom.els['er-mode'].value = 'payment'; dom.handlers['er-sheet'].change();
    expect(out()).toMatch(/même fin/);
    dom.els['er-ira'].value = 'amount'; set('er-ira-val', '123');
    expect(dom.els['er-ira-val-row'].classList.on.has('hidden')).toBe(false);
    expect(out()).toContain('<span>Indemnités (IRA)</span><span class="t-num">123.00</span>');
    dom.handlers['er-out'].click({ target: { closest: s => (s === '#er-amort' ? {} : null) } });
    expect(amort).toHaveLength(1);
    expect(amort[0][1].rows[0].date).toBe('2026-12-05');
    expect(amort[0][1].rows.at(-1).bal).toBe(0);
  });
  it('crédit à la consommation : aucune indemnité sous 10 000 €', () => {
    api.openEarlyRepay('Auto', { amount: 15000, rate: 5, years: 5, first: '2025-01-10' }, '2025-01-10', 'conso');
    set('er-amount', '5000');
    expect(out()).toContain('<span>Indemnités (IRA)</span><span class="t-num">0.00</span>');
    expect(out()).toContain('Aucune indemnité : 10 000 € ou moins');
  });
  it('fermeture', () => {
    api.openEarlyRepay('Appart', L, '2020-01-05', 'immo');
    api.closeEarlyRepay();
    expect(dom.els['er-sheet'].classList.on.has('show')).toBe(false);
  });
});
