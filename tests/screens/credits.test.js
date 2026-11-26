import { describe, it, expect, beforeEach } from 'vitest';
import { loadClassic, fakeDocument } from '../helpers/load-classic.js';
import { LOAN } from '../helpers/loan.js';

// Écrans Crédits : liste, fiche, formulaire (vrais modules de calcul et de stockage, faux DOM).
const CRF = ['CREDIT_KINDS', 'creditFormError', 'creditSchedule', 'creditShare', 'creditTotals', 'createCreditStore', 'crRead', 'crStore', 'crReadError'];
function memoryStorage() {
  const m = new Map();
  return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
}
function makeDom() {
  const els = {}, handlers = {}, base = fakeDocument();
  const get = id => (els[id] ??= { id, value: '', innerHTML: '', textContent: '', classList: { add() {}, remove() {} },
    addEventListener(t, fn) { (handlers[id] ??= {})[t] = fn; } });
  return { els, handlers, document: { ...base, getElementById: get } };
}

describe('écrans Crédits', () => {
  let S, storage, dom, toasts, api;
  beforeEach(() => {
    S = { isDemo: false, screen: 'credits' };
    storage = memoryStorage(); dom = makeDom(); toasts = [];
    const feat = loadClassic('js/features/credits.js', { globals: { ...LOAN, S, localStorage: storage }, exports: CRF });
    api = loadClassic('js/screens/credits.js', {
      globals: {
        ...LOAN, ...feat, S, localStorage: storage, document: dom.document, SCREEN_BIND: {}, registerModal() {},
        toast: m => toasts.push(m), esc: s => String(s), masked: v => v.toFixed(2), fmtDate: d => d, _dayKey: () => '2026-11-26',
        renderScreen() {}, go() {}, back() {}, openConfirm() {}, openLoanAmort() {},
      },
      exports: ['renderCredits', 'renderCreditDetail', 'openCreditForm', 'saveCreditForm'],
    });
  });
  const fill = v => {
    api.openCreditForm();
    Object.entries({ 'cr-name': 'Voiture', 'cr-kind': 'auto', 'cr-amount': '15000', 'cr-rate': '4,5', 'cr-years': '5', 'cr-sign': '2025-03-10', 'cr-first': '', 'cr-ins': '12', 'cr-share': '100', ...v })
      .forEach(([k, x]) => { dom.els[k].value = x; });
  };
  it('liste vide : invitation', () => expect(api.renderCredits()).toContain('Aucun crédit'));
  it('formulaire : enregistre le crédit (virgule décimale), puis liste et total', () => {
    fill(); dom.handlers['cr-save'].click();
    expect(toasts.at(-1)).toBe('Crédit enregistré ✓');
    const saved = JSON.parse(storage.getItem('patrimoine-credits-real'))[0];
    expect(saved).toMatchObject({ name: 'Voiture', kind: 'auto', amount: 15000, rate: 4.5, years: 5, insurance: 12, debtShare: 100 });
    const html = api.renderCredits();
    expect(html).toContain('Voiture');
    expect(html).toContain('Capital restant dû');
    expect(html).toContain('<div class="top-bar-title">Crédits</div>');
  });
  it('formulaire : refuse un crédit sans durée', () => {
    fill({ 'cr-years': '' }); dom.handlers['cr-save'].click();
    expect(toasts.at(-1)).toBe('Indique la durée du crédit');
    expect(storage.getItem('patrimoine-credits-real')).toBeNull();
  });
  it('fiche : échéancier, ma part de la dette quand elle est partielle', () => {
    fill({ 'cr-share': '50' }); dom.handlers['cr-save'].click();
    S.creditId = JSON.parse(storage.getItem('patrimoine-credits-real'))[0].id;
    const html = api.renderCreditDetail();
    expect(html).toContain('Capital restant dû');
    expect(html).toContain('Ma part de la dette (50 %)');
    expect(html).toContain('data-cramort="1"');
    expect(html).toContain('data-crer="1"');
  });
});
