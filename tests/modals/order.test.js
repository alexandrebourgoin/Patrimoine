import { beforeEach, describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic, fakeDocument } from '../helpers/load-classic.js';

// Modale d'ajout / modification d'un mouvement (js/modals/order.js), avec le VRAI contrôle chronologique.
const check = loadClassic('js/features/transaction-check.js', {
  globals: { PU: globalThis.PU, fmtDate: d => d },
  exports: ['txCheckAdd', 'txCheckEdit', 'txCheckDelete'],
});

// DOM minimal : valeurs des champs, écouteurs conservés, boutons Achat / Vente / Dividende de la modale d'ajout.
function makeDom() {
  const els = {}, handlers = {}, base = fakeDocument(), queries = [];
  const get = id => (els[id] ??= {
    id, value: '', textContent: '', classList: { add() {}, remove() {}, toggle() {} }, querySelector: () => null,
    addEventListener(type, fn) { (handlers[id] ??= {})[type] = fn; },
  });
  const label = { textContent: '' };
  const typeBtns = ['BUY', 'SELL', 'DIV'].map(t => ({
    dataset: { type: t }, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(_, fn) { this.click = fn; },
  }));
  const document = {
    ...base, getElementById: get,
    querySelector: () => ({ closest: () => ({ querySelector: () => label }) }),
    // seuls les boutons de LA modale (#modal-type-btns) sont renvoyés : les autres .type-btn de la page ne sont pas touchés
    querySelectorAll: sel => { queries.push(sel); return sel === '#modal-type-btns .type-btn' ? typeBtns : []; },
  };
  return { els, handlers, typeBtns, queries, document };
}

describe('modale d\'ajout d\'un mouvement', () => {
  let S, dom, toasts, calls, api, h, acc;
  const tx = (date, type, qty, price = 10) => ({ date, type, qty, price });
  beforeEach(() => {
    h = { id: 'h1', ticker: 'MC', name: 'LVMH', currency: 'EUR', currentPrice: 100, quantity: 0, transactions: [tx('2026-01-01', 'BUY', 10)] };
    acc = { id: 'a1', name: 'PEA', holdings: [h], value: 0 };
    S = { screen: 'stock', accounts: [acc] };
    dom = makeDom(); toasts = []; calls = { stock: 0, main: 0 };
    api = loadClassic('js/modals/order.js', {
      globals: {
        ...check, document: dom.document, S, registerModal() {}, toast: m => toasts.push(m),
        _dayKey: () => '2026-11-23',
        recalcHolding(x) { x.quantity = x.transactions.reduce((q, t) => (t.type === 'BUY' ? q + t.qty : t.type === 'SELL' ? q - t.qty : q), 0); },
        accTotal: () => 42, renderScreen: id => { if (id === 'stock') calls.stock++; }, refreshMain() { calls.main++; }, renderHoldsHTML() {},
      },
      exports: ['openAddOrder'],
    });
  });
  const open = (type, { qty = '1', price = '10', date = '2026-02-01' } = {}) => {
    api.openAddOrder('a1', 'h1');
    dom.typeBtns.find(b => b.dataset.type === type).click();
    dom.els['modal-qty'].value = qty; dom.els['modal-price'].value = price; dom.els['modal-date'].value = date;
  };
  const submit = () => dom.handlers['modal-submit'].click();

  it('aucun sélecteur global « .type-btn » : les boutons des autres feuilles (ordres limites, alertes) ne sont pas touchés', () => {
    api.openAddOrder('a1', 'h1');
    const typeBtnQueries = dom.queries.filter(q => q.includes('.type-btn'));
    expect(typeBtnQueries.length).toBeGreaterThan(0);
    expect(typeBtnQueries.every(q => q.startsWith('#modal-type-btns') || q.startsWith('#edit-type-btns'))).toBe(true);
  });

  it('prérempli avec la date locale du jour (pas la date UTC) et le cours actuel', () => {
    api.openAddOrder('a1', 'h1');
    expect(dom.els['modal-date'].value).toBe('2026-11-23');
    expect(dom.els['modal-price'].value).toBe('100.00');
  });

  it('un achat est ajouté, la fiche titre est réaffichée et les écrans principaux rafraîchis', () => {
    open('BUY'); submit();
    expect(h.transactions).toHaveLength(2);
    expect(acc.value).toBe(42);
    expect(calls.stock).toBe(1);
    expect(calls.main).toBe(1);
    expect(toasts.at(-1)).toBe('Achat enregistré ✓');
  });

  it('hors fiche titre, la fiche n\'est pas réaffichée', () => {
    S.screen = 'account';
    open('BUY'); submit();
    expect(calls.stock).toBe(0);
  });

  it('une vente dans la quantité détenue est acceptée', () => {
    open('SELL', { qty: '10' }); submit();
    expect(h.transactions).toHaveLength(2);
    expect(toasts.at(-1)).toBe('Vente enregistré ✓');
  });

  it('une vente au-delà de la quantité détenue est refusée sans rien modifier', () => {
    open('SELL', { qty: '11' }); submit();
    expect(h.transactions).toHaveLength(1);
    expect(toasts.at(-1)).toMatch(/^Vente impossible : la vente du 2026-02-01 \(11\)/);
    expect(calls.main).toBe(0);
  });

  it('une vente antidatée avant l\'achat est refusée', () => {
    open('SELL', { qty: '1', date: '2025-12-31' }); submit();
    expect(h.transactions).toHaveLength(1);
    expect(toasts.at(-1)).toMatch(/^Vente impossible/);
  });

  it('un dividende n\'est jamais bloqué par le contrôle des ventes', () => {
    open('DIV', { qty: '500' }); submit();
    expect(h.transactions).toHaveLength(2);
  });

  it('quantité ou prix vides : refusé', () => {
    open('BUY', { qty: '' }); submit();
    expect(toasts.at(-1)).toBe('Quantité et prix requis');
    expect(h.transactions).toHaveLength(1);
  });
});

describe('modale de modification d\'un mouvement', () => {
  let dom, toasts, api, h;
  const tx = (date, type, qty, price = 10) => ({ date, type, qty, price });
  beforeEach(() => {
    h = { id: 'h1', ticker: 'MC', currency: 'EUR', currentPrice: 100, quantity: 0, transactions: [tx('2026-01-01', 'BUY', 10), tx('2026-02-01', 'SELL', 10)] };
    const S = { screen: 'stock', accounts: [{ id: 'a1', name: 'PEA', holdings: [h], value: 0 }] };
    dom = makeDom(); toasts = [];
    api = loadClassic('js/modals/order.js', {
      globals: {
        ...check, document: dom.document, S, registerModal() {}, toast: m => toasts.push(m), _dayKey: () => '2026-11-23',
        recalcHolding() {}, accTotal: () => 0, renderScreen() {}, refreshMain() {}, renderHoldsHTML() {},
      },
      exports: ['openEditTx'],
    });
  });
  const edit = (idx, { qty, price = '10', date }) => {
    api.openEditTx('a1', 'h1', idx);
    dom.els['edit-tx-qty'].value = qty; dom.els['edit-tx-price'].value = price; dom.els['edit-tx-date'].value = date;
    dom.handlers['edit-tx-submit'].click();
  };

  it('réduire un achat sous la quantité déjà vendue est refusé, mouvement inchangé', () => {
    edit(0, { qty: '5', date: '2026-01-01' });
    expect(h.transactions[0].qty).toBe(10);
    expect(toasts.at(-1)).toMatch(/^Modification impossible/);
  });
  it('une modification cohérente est enregistrée', () => {
    edit(1, { qty: '10', date: '2026-02-15' });
    expect(h.transactions[1].date).toBe('2026-02-15');
    expect(toasts.at(-1)).toBe('Mouvement modifié ✓');
  });
});
