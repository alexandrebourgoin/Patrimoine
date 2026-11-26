import { beforeEach, describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic, fakeDocument } from '../helpers/load-classic.js';

// L'écran dépend du stockage et des règles : on charge les VRAIS fichiers (comme le navigateur) et on les injecte en globales.
const { createOrderAlertStore } = loadClassic('js/features/order-alert-storage.js', { exports: ['createOrderAlertStore'] });
const RULE_NAMES = ['OA_EPS', 'oaHeldQty', 'oaFindTarget', 'oaOrderableAccounts', 'oaQuote', 'oaAlertTriggered', 'oaBadgeCount', 'oaPriceHint',
  'oaOrderError', 'oaExecutionError', 'oaQtyAfter', 'oaIsDuplicateAlert', 'oaFmtQty', 'oaNewId', 'oaGapPct'];
const rules = loadClassic('js/features/order-alert-rules.js', { exports: RULE_NAMES });
const txCheck = loadClassic('js/features/transaction-check.js', { globals: { PU: globalThis.PU, fmtDate: d => d }, exports: ['txCheckAdd'] });

// DOM minimal : chaque élément retient sa valeur ; les écouteurs posés à l'évaluation sont conservés pour être déclenchés.
function makeDom() {
  const els = {}, handlers = {}, base = fakeDocument();
  const get = id => (els[id] ??= {
    id, value: '', innerHTML: '', textContent: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { (handlers[id] ??= {})[type] = fn; },
  });
  return { els, handlers, document: { ...base, getElementById: get, querySelector: () => null } };
}
function memoryStorage() {
  const data = new Map();
  return { data, getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); } };
}
// Clic simulé sur un élément portant un attribut data-… (le gestionnaire utilise e.target.closest)
const clickOn = (attr, value) => ({ target: { closest: sel => (sel === `[${attr}]` ? { dataset: { [attr.replace('data-', '')]: value } } : null) } });

describe('Écran Ordres et alertes', () => {
  let S, dom, storage, toasts, calls, api, NAV_BADGES;
  const holding = (over = {}) => ({ id: 'h1', ticker: 'MC', name: 'LVMH', type: 'Action', currency: 'EUR', quantity: 10, currentPrice: 100, transactions: [], ...over });
  beforeEach(() => {
    S = { isDemo: false, screen: 'orders', accounts: [{ id: 'a1', name: 'PEA', icon: '📊', type: 'PEA', holdings: [holding()] }], watchlist: [] };
    dom = makeDom();
    storage = memoryStorage();
    NAV_BADGES = {};
    toasts = []; calls = { render: [], nav: 0, refresh: 0, confirm: null };
    api = loadClassic('js/screens/orders.js', {
      globals: {
        ...rules, ...txCheck,
        document: dom.document, S, localStorage: storage, createOrderAlertStore, NAV_BADGES,
        SCREEN_BIND: {}, registerModal() {}, toast: m => toasts.push(m), esc: s => String(s),
        maskedNative: (v, c) => `${v} ${c}`, fmtDate: d => d, _dayKey: () => '2026-11-21', getHistorySeries: () => null,
        recalcHolding(h) { h.quantity = h.transactions.reduce((q, t) => t.type === 'BUY' ? q + t.qty : q - t.qty, 10); },
        accTotal: () => 0, refreshMain() { calls.refresh++; }, renderScreen: id => calls.render.push(id), renderNav() { calls.nav++; },
        renderHoldsHTML() {}, openConfirm: (m, cb) => { calls.confirm = { m, cb }; }, back() {},
      },
      exports: ['renderOrders', 'orderAlertBadgeCount', 'openOaOrder', 'openOaExec', 'oaExecute', 'openOaAlert', 'SCREEN_BIND'],
    });
  });
  const store = mode => createOrderAlertStore(storage, mode || 'real');
  const order = (over = {}) => ({ id: 'o1', accId: 'a1', holdId: 'h1', type: 'BUY', qty: 2, limit: 95, createdAt: 1700000000000, ...over });
  const alert = (over = {}) => ({ id: 'x1', ticker: 'MC', dir: 'above', price: 90, createdAt: 1700000000000, ...over });
  const bind = () => { const el = { querySelector: () => null }; api.SCREEN_BIND.orders(el); return el; };

  describe('affichage', () => {
    it('affiche les ordres et les alertes du mode courant uniquement', () => {
      store('real').saveOrders([order()]);
      store('demo').saveOrders([order({ id: 'o2', qty: 7 })]);
      const html = api.renderOrders();
      expect(html).toContain('Ordres en cours <span class="oa-count">1</span>');
      expect(html).toContain('data-oexec="o1"');
      expect(html.includes('data-oexec="o2"')).toBe(false);
      S.isDemo = true;
      expect(api.renderOrders()).toContain('data-oexec="o2"');
    });

    it('le titre de l\'écran reprend le libellé unique « Ordres »', () => {
      expect(api.renderOrders()).toContain('<div class="top-bar-title">Ordres</div>');
    });

    it('carte d\'ordre compacte : nom, montant total, sens, compte, écart du cours à la limite', () => {
      store().saveOrders([order({ limit: 95 })]);
      const html = api.renderOrders();
      expect(html).toContain('LVMH <span class="oa-tick">MC</span>');
      expect(html).toContain('<div class="oa-total t-num">190 EUR</div>');
      expect(html).toContain('<span class="oa-side buy">Achat</span> 2 × 95 EUR');
      expect(html).toContain('limite à <b>−5,0 %</b>');
      expect(html).toContain('data-onew="1"');
      expect(html).toContain('data-anew="1"');
    });
    it('alerte : seuil, écart restant et suppression par icône', () => {
      store().saveAlerts([alert({ price: 110 })]);
      const html = api.renderOrders();
      expect(html).toContain('Alerte si cours ≥ <b>110 EUR</b>');
      expect(html).toContain('seuil à <b>+10,0 %</b>');
      expect(html).toContain('class="oa-icon" data-adel="x1"');
    });
    it('signale les alertes déclenchées et les trie en premier', () => {
      store().saveAlerts([alert({ id: 'x1', price: 500 }), alert({ id: 'x2', price: 90 })]);
      const html = api.renderOrders();
      expect(html).toContain('Alertes de prix <span class="oa-count">2 · 1 déclenchée</span>');
      expect(html.indexOf('data-adel="x2"')).toBeLessThan(html.indexOf('data-adel="x1"'));
    });

    it('signale des données corrompues sans rien effacer ni compter', () => {
      storage.setItem('patrimoine-orders-alerts-real', '{broken');
      expect(api.renderOrders()).toContain('Données illisibles');
      expect(storage.getItem('patrimoine-orders-alerts-real')).toBe('{broken');
      expect(api.orderAlertBadgeCount()).toBe(0);
    });

    it('propose de nettoyer les ordres dont le compte ou le titre a disparu', () => {
      store().saveOrders([order(), order({ id: 'o2', accId: 'inconnu' })]);
      expect(api.renderOrders()).toContain('1 ordre sans compte ou titre correspondant');
    });
  });

  describe('pastille de la barre du bas', () => {
    it('est enregistrée dans NAV_BADGES.orders', () => {
      expect(NAV_BADGES.orders).toBe(api.orderAlertBadgeCount);
    });
    it('compte les ordres en cours et les alertes déclenchées', () => {
      store().saveOrders([order(), order({ id: 'o2', accId: 'inconnu' })]);
      store().saveAlerts([alert(), alert({ id: 'x2', dir: 'below', price: 50 })]);
      expect(api.orderAlertBadgeCount()).toBe(2);
    });
  });

  describe('actions sur la liste', () => {
    it('annuler un ordre ne retire que celui-là et rafraîchit l\'écran et la pastille', () => {
      store().saveOrders([order(), order({ id: 'o2' })]);
      bind().onclick(clickOn('data-ocancel', 'o1'));
      expect(store().read().orders.map(o => o.id)).toEqual(['o2']);
      expect(calls.render).toEqual(['orders']);
      expect(calls.nav).toBe(1);
    });
    it('supprimer une alerte ne retire que celle-là', () => {
      store().saveAlerts([alert(), alert({ id: 'x2', price: 91 })]);
      bind().onclick(clickOn('data-adel', 'x1'));
      expect(store().read().alerts.map(a => a.id)).toEqual(['x2']);
      expect(toasts.at(-1)).toBe('Alerte supprimée');
    });
    it('nettoyer retire seulement les ordres orphelins', () => {
      store().saveOrders([order(), order({ id: 'o2', accId: 'inconnu' })]);
      bind().onclick(clickOn('data-opurge', '1'));
      expect(store().read().orders.map(o => o.id)).toEqual(['o1']);
    });
    it('n\'annule rien si l\'enregistrement échoue (données corrompues)', () => {
      storage.setItem('patrimoine-orders-alerts-real', '{broken');
      bind().onclick(clickOn('data-ocancel', 'o1'));
      expect(storage.getItem('patrimoine-orders-alerts-real')).toBe('{broken');
      expect(toasts.at(-1).startsWith('Enregistrement impossible')).toBe(true);
      expect(calls.render).toEqual([]);
    });
  });

  describe('exécution d\'un ordre', () => {
    const fillExec = (price = '96') => {
      dom.els['oa-exec-price'] = { value: price };
      dom.els['oa-exec-date'] = { value: '2026-11-21' };
    };
    it('un achat ajoute le mouvement au compte, retire l\'ordre et rafraîchit', () => {
      store().saveOrders([order()]);
      api.openOaExec('o1'); fillExec();
      api.oaExecute();
      expect(S.accounts[0].holdings[0].transactions).toEqual([{ date: '2026-11-21', type: 'BUY', qty: 2, price: 96 }]);
      expect(store().read().orders).toHaveLength(0);
      expect(calls.refresh).toBe(1);
      expect(toasts.at(-1)).toBe('Achat ajouté sur PEA ✓');
    });
    it('refuse une vente supérieure à la quantité détenue, sans rien modifier', () => {
      store().saveOrders([order({ type: 'SELL', qty: 50 })]);
      api.openOaExec('o1'); fillExec();
      api.oaExecute();
      expect(S.accounts[0].holdings[0].transactions).toHaveLength(0);
      expect(store().read().orders).toHaveLength(1);
      expect(toasts.at(-1)).toBe('Exécution impossible : vous ne détenez que 10 titre(s)');
    });
    it('refuse une vente exécutée à une date antérieure à l\'achat des titres (contrôle chronologique)', () => {
      S.accounts[0].holdings[0].transactions = [{ date: '2026-06-01', type: 'BUY', qty: 10, price: 90 }];
      store().saveOrders([order({ type: 'SELL', qty: 5 })]);
      api.openOaExec('o1');
      dom.els['oa-exec-price'] = { value: '96' };
      dom.els['oa-exec-date'] = { value: '2026-05-01' };
      api.oaExecute();
      expect(S.accounts[0].holdings[0].transactions).toHaveLength(1);
      expect(store().read().orders).toHaveLength(1);
      expect(toasts.at(-1)).toMatch(/^Vente impossible : la vente du 2026-05-01/);
    });
    it('refuse un prix d\'exécution vide', () => {
      store().saveOrders([order()]);
      api.openOaExec('o1'); fillExec('');
      api.oaExecute();
      expect(S.accounts[0].holdings[0].transactions).toHaveLength(0);
      expect(toasts.at(-1)).toBe("Prix d'exécution requis");
    });
    it('n\'ajoute aucun mouvement si l\'ordre ne peut pas être retiré (quota plein)', () => {
      store().saveOrders([order()]);
      api.openOaExec('o1'); fillExec();
      const real = storage.setItem;
      storage.setItem = () => { throw new Error('quota'); };
      api.oaExecute();
      storage.setItem = real;
      expect(S.accounts[0].holdings[0].transactions).toHaveLength(0);
      expect(store().read().orders).toHaveLength(1);
      expect(toasts.at(-1)).toBe('Enregistrement impossible : quota');
    });
    it('ordre introuvable : prévient', () => {
      api.openOaExec('absent');
      expect(toasts.at(-1)).toBe('Ordre introuvable');
    });
  });

  describe('reprise des anciennes données', () => {
    it('proposée seulement si le mode courant est vide, puis copiée après confirmation', () => {
      storage.setItem('patrimoine-orders', JSON.stringify([order()]));
      storage.setItem('patrimoine-alerts', JSON.stringify([alert()]));
      expect(api.renderOrders()).toContain('Anciennes données détectées');
      bind().onclick(clickOn('data-olegacy', '1'));
      expect(calls.confirm.m).toContain('mode réel');
      expect(store('demo').read().orders).toHaveLength(0);
      calls.confirm.cb();
      expect(store().read().orders).toHaveLength(1);
      expect(store().read().alerts).toHaveLength(1);
      expect(storage.getItem('patrimoine-orders')).toBe(JSON.stringify([order()]));
      expect(api.renderOrders().includes('Anciennes données détectées')).toBe(false);
    });
    it('n\'est pas proposée quand le mode courant contient déjà des données', () => {
      storage.setItem('patrimoine-orders', JSON.stringify([order()]));
      store().saveAlerts([alert()]);
      expect(api.renderOrders().includes('Anciennes données détectées')).toBe(false);
    });
  });

  describe('formulaire d\'ordre', () => {
    function fillOrderForm({ type = 'BUY', qty = '2', limit = '95' } = {}) {
      api.openOaOrder();
      dom.handlers['oa-order-type-btns'].click(clickOn('data-otype', type));
      dom.els['oa-order-acc'].value = 'a1';
      dom.els['oa-order-hold'].value = 'h1';
      dom.els['oa-order-qty'].value = qty;
      dom.els['oa-order-limit'].value = limit;
    }
    it('n\'ouvre pas le formulaire sans compte éligible (les comptes observateurs sont exclus)', () => {
      S.accounts[0].observer = true;
      api.openOaOrder();
      expect(toasts).toEqual(['Aucune position sur laquelle passer un ordre']);
    });
    it('enregistre un nouvel ordre limite dans le mode courant', () => {
      fillOrderForm();
      dom.handlers['oa-order-submit'].click();
      const saved = store().read().orders;
      expect(saved).toHaveLength(1);
      expect({ accId: saved[0].accId, holdId: saved[0].holdId, type: saved[0].type, qty: saved[0].qty, limit: saved[0].limit })
        .toEqual({ accId: 'a1', holdId: 'h1', type: 'BUY', qty: 2, limit: 95 });
      expect(store('demo').read().orders).toHaveLength(0);
      expect(toasts.at(-1)).toBe('Ordre limite enregistré ✓');
      expect(calls.nav).toBe(1);
    });
    it('refuse un ordre de vente supérieur à la quantité détenue', () => {
      fillOrderForm({ type: 'SELL', qty: '50' });
      dom.handlers['oa-order-submit'].click();
      expect(store().read().orders).toHaveLength(0);
      expect(toasts.at(-1)).toBe('Vente impossible : vous ne détenez que 10 titre(s)');
    });
    it('refuse une quantité ou un prix vides', () => {
      fillOrderForm({ qty: '', limit: '95' });
      dom.handlers['oa-order-submit'].click();
      expect(toasts.at(-1)).toBe('Quantité et prix limite requis');
      expect(store().read().orders).toHaveLength(0);
    });
    it('modifie un ordre existant sans en créer un second et conserve sa date de création', () => {
      store().saveOrders([order()]);
      api.openOaOrder('o1');
      expect(dom.els['oa-order-qty'].value).toBe(2);
      dom.els['oa-order-qty'].value = '3';
      dom.els['oa-order-acc'].value = 'a1';
      dom.els['oa-order-hold'].value = 'h1';
      dom.handlers['oa-order-submit'].click();
      const saved = store().read().orders;
      expect(saved).toHaveLength(1);
      expect(saved[0].qty).toBe(3);
      expect(saved[0].createdAt).toBe(1700000000000);
      expect(toasts.at(-1)).toBe('Ordre modifié ✓');
    });
    it('ne remplace pas des données corrompues en enregistrant un ordre', () => {
      storage.setItem('patrimoine-orders-alerts-real', '{broken');
      fillOrderForm();
      dom.handlers['oa-order-submit'].click();
      expect(storage.getItem('patrimoine-orders-alerts-real')).toBe('{broken');
      expect(toasts.at(-1).startsWith('Enregistrement impossible')).toBe(true);
    });
  });

  describe('formulaire d\'alerte', () => {
    function fillAlertForm({ dir = 'above', price = '120', ticker = 'MC' } = {}) {
      api.openOaAlert();
      dom.handlers['oa-alert-dir-btns'].click(clickOn('data-adir', dir));
      dom.els['oa-alert-tick'].value = ticker;
      dom.els['oa-alert-price'].value = price;
    }
    it('n\'ouvre pas sans titre à surveiller', () => {
      S.accounts = []; S.watchlist = [];
      api.openOaAlert();
      expect(toasts).toEqual(['Aucun titre : ajoute une position ou un favori']);
    });
    it('enregistre une alerte avec le nom du titre et le sens choisi', () => {
      fillAlertForm({ dir: 'below' });
      dom.handlers['oa-alert-submit'].click();
      const [a] = store().read().alerts;
      expect({ ticker: a.ticker, name: a.name, dir: a.dir, price: a.price }).toEqual({ ticker: 'MC', name: 'LVMH', dir: 'below', price: 120 });
      expect(toasts.at(-1)).toBe('Alerte enregistrée ✓');
    });
    it('refuse une alerte identique (même titre, sens et seuil)', () => {
      store().saveAlerts([alert({ price: 120 })]);
      fillAlertForm();
      dom.handlers['oa-alert-submit'].click();
      expect(store().read().alerts).toHaveLength(1);
      expect(toasts.at(-1)).toBe('Cette alerte existe déjà');
    });
    it('refuse un prix vide', () => {
      fillAlertForm({ price: '' });
      dom.handlers['oa-alert-submit'].click();
      expect(toasts.at(-1)).toBe('Prix requis');
      expect(store().read().alerts).toHaveLength(0);
    });
  });
});
