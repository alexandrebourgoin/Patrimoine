import { beforeEach, describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic, fakeDocument } from '../helpers/load-classic.js';

function makeDom() {
  const els = {}, handlers = {}, base = fakeDocument();
  const get = id => (els[id] ??= { id, value: '', innerHTML: '', classList: { add() {}, remove() {} }, focus() {}, querySelectorAll: () => [], addEventListener(t, f) { (handlers[id] ??= {})[t] = f; } });
  return { els, handlers, document: { ...base, getElementById: get } };
}

describe('Apports / retraits : devise par mouvement', () => {
  let S, dom, toasts, api, acc;
  beforeEach(() => {
    acc = { id: 'a1', currency: 'EUR', cashflows: [], holdings: [], value: 0 };
    S = { currency: 'EUR', accounts: [acc] };
    dom = makeDom(); toasts = [];
    api = loadClassic('js/modals/cashflow.js', {
      globals: {
        S, document: dom.document, PU: globalThis.PU, FX_RATES: { EUR: 1, USD: 1.08, GBP: 1.16 }, _dayKey: () => '2026-11-24', esc: s => String(s), fmtDate: d => d,
        maskedNative: (v, c) => `${v} ${c}`, toast: m => toasts.push(m), accTotal: () => 42, renderScreen() {}, refreshMain() {}, registerModal() {},
      },
      exports: ['openCfModal', 'renderCfList'],
    });
  });
  const submit = ({ amount = '100', ccy, date = '2026-11-01' } = {}) => {
    api.openCfModal('a1');
    dom.els['cf-amount'].value = amount; dom.els['cf-date'].value = date; dom.els['cf-note'].value = '';
    if (ccy) dom.els['cf-ccy'].value = ccy;
    dom.handlers['cf-submit'].click();
  };

  it('le sélecteur propose la devise du compte en premier puis les devises connues, présélectionne celle du compte', () => {
    acc.currency = 'USD';
    api.openCfModal('a1');
    expect(dom.els['cf-ccy'].value).toBe('USD');
    expect(dom.els['cf-ccy'].innerHTML.indexOf('>USD<')).toBeLessThan(dom.els['cf-ccy'].innerHTML.indexOf('>EUR<'));
    expect(dom.els['cf-ccy'].innerHTML).toContain('>GBP<');
  });
  it('un apport enregistre sa devise', () => {
    submit({ ccy: 'USD' });
    expect(acc.cashflows[0]).toMatchObject({ type: 'DEP', amount: 100, ccy: 'USD', date: '2026-11-01' });
    expect(acc.value).toBe(42);
    expect(toasts.at(-1)).toBe('Apport enregistré ✓');
  });
  it('par défaut, la devise du compte', () => {
    submit();
    expect(acc.cashflows[0].ccy).toBe('EUR');
  });
  it('un montant vide ou nul est refusé', () => {
    submit({ amount: '' });
    expect(acc.cashflows).toEqual([]);
    expect(toasts.at(-1)).toBe('Montant requis');
  });
  it('les mouvements sont triés par date', () => {
    submit({ date: '2026-11-10' }); submit({ date: '2026-11-01' });
    expect(acc.cashflows.map(c => c.date)).toEqual(['2026-11-01', '2026-11-10']);
  });
  it('la liste affiche chaque montant dans SA devise, et la devise du compte pour un apport ancien (sans devise)', () => {
    acc.cashflows = [{ id: 'x', date: '2026-01-01', type: 'DEP', amount: 50, ccy: 'USD' }, { id: 'y', date: '2026-01-02', type: 'WIT', amount: 20 }];
    api.openCfModal('a1');
    const html = dom.els['cf-list'].innerHTML;
    expect(html).toContain('+50 USD');
    expect(html).toContain('−20 EUR');
  });
});
