import { beforeEach, describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic, fakeDocument } from '../helpers/load-classic.js';

// Règles des livrets (vrais modules) : plafond de versements, intérêts
const taxEnv = loadClassic('js/features/tax-envelope.js', { exports: ['TAX_ENVELOPES'] });
const accPerf = loadClassic('js/features/account-perf.js', { globals: { PU: globalThis.PU }, exports: ['accFlows'] });
const SAV = loadClassic('js/features/savings.js', { globals: { ...taxEnv, ...accPerf }, exports: ['isSavingsAccount', 'savingsCeiling', 'savingsSummary', 'savingsDepositError', 'savingsRoomAt'] });

function makeDom() {
  const els = {}, handlers = {}, base = fakeDocument();
  const get = id => (els[id] ??= { id, value: '', innerHTML: '', textContent: '', classList: { on: new Set(), add(c) { this.on.add(c); }, remove(c) { this.on.delete(c); }, toggle(c, f) { f ? this.on.add(c) : this.on.delete(c); } }, focus() {}, querySelectorAll: () => [], addEventListener(t, f) { (handlers[id] ??= {})[t] = f; } });
  // Boutons Apport / Retrait / Intérêts : écouteurs attachés au chargement du module
  const btns = ['DEP', 'WIT', 'INT'].map(t => ({ dataset: { cftype: t }, classList: { add() {}, remove() {}, toggle() {} }, addEventListener(e, f) { this.click = f; } }));
  return { els, handlers, btns, document: { ...base, getElementById: get, querySelectorAll: sel => (sel === '[data-cftype]' ? btns : []) } };
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
        ...SAV, toRefCcy: v => v, masked: v => String(v),
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

  describe('livret : versement, retrait, intérêts et plafond', () => {
    beforeEach(() => { acc.type = 'LDDS'; acc.cashflows = [{ id: 'x', date: '2026-01-01', type: 'DEP', amount: 11000, ccy: 'EUR' }]; });
    it('ouverture : titre, bouton « Intérêts » visible, place restante sous le plafond', () => {
      api.openCfModal('a1');
      expect(dom.els['cf-title'].textContent).toBe('Versement / Retrait / Intérêts');
      expect(dom.els['cf-int-btn'].classList.on.has('hidden')).toBe(false);
      expect(dom.els['cf-cap'].textContent).toMatch(/^Plafond 12000 · encore 1000 à verser au \d\d\/\d\d\/\d{4} \(solde, intérêts compris\)\.$/);
    });
    it('un versement au-delà du plafond est refusé, sans rien enregistrer', () => {
      submit({ amount: '1500' });
      expect(acc.cashflows).toHaveLength(1);
      expect(toasts.at(-1)).toMatch(/^Plafond LDDS \(12.000 €\) : au .*, il reste 1.000 € à verser/);
      submit({ amount: '1000' });
      expect(acc.cashflows).toHaveLength(2);
      expect(toasts.at(-1)).toBe('Versement enregistré ✓');
    });
    it('les intérêts peuvent dépasser le plafond', () => {
      acc.cashflows[0].amount = 12000;
      api.openCfModal('a1');
      dom.btns[2].click();
      dom.els['cf-amount'].value = '204'; dom.els['cf-date'].value = '2026-12-31'; dom.els['cf-note'].value = '';
      dom.handlers['cf-submit'].click();
      expect(acc.cashflows.at(-1)).toMatchObject({ type: 'INT', amount: 204 });
      expect(toasts.at(-1)).toBe('Intérêts enregistrés ✓');
    });
  });
  it('compte-titres : pas de bouton « Intérêts », pas de plafond', () => {
    api.openCfModal('a1');
    expect(dom.els['cf-title'].textContent).toBe('Apport / Retrait');
    expect(dom.els['cf-int-btn'].classList.on.has('hidden')).toBe(true);
    expect(dom.els['cf-cap'].classList.on.has('hidden')).toBe(true);
  });
});
