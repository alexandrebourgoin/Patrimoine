import { beforeEach, describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const { createOrderAlertStore } = loadClassic('js/features/order-alert-storage.js', { exports: ['createOrderAlertStore'] });

function memoryStorage() {
  const data = new Map();
  return { data, getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)); }, removeItem: k => { data.delete(k); } };
}
const order = (over = {}) => ({ id: 'o1', accId: 'a1', holdId: 'h1', type: 'BUY', qty: 2, limit: 95, createdAt: 1700000000000, ...over });
const alert = (over = {}) => ({ id: 'x1', ticker: 'MC', dir: 'above', price: 90, createdAt: 1700000000000, ...over });

describe('createOrderAlertStore', () => {
  let storage;
  beforeEach(() => { storage = memoryStorage(); });

  it('refuse un mode inconnu', () => {
    expect(() => createOrderAlertStore(storage, 'prod')).toThrow(/Mode inconnu/);
  });

  it('renvoie des listes vides quand rien n\'est enregistré', () => {
    expect(createOrderAlertStore(storage, 'real').read()).toEqual({ orders: [], alerts: [] });
  });

  it('sépare les modes démo et réel (clés distinctes)', () => {
    const real = createOrderAlertStore(storage, 'real'), demo = createOrderAlertStore(storage, 'demo');
    real.saveOrders([order()]);
    expect(demo.read().orders).toHaveLength(0);
    expect(real.key).toBe('patrimoine-orders-alerts-real');
    expect(demo.key).toBe('patrimoine-orders-alerts-demo');
  });

  it('enregistrer les ordres conserve les alertes, et inversement', () => {
    const s = createOrderAlertStore(storage, 'real');
    s.saveAlerts([alert()]);
    s.saveOrders([order()]);
    expect(s.read().alerts).toHaveLength(1);
    s.saveAlerts([]);
    expect(s.read().orders).toHaveLength(1);
  });

  it('read() renvoie des copies : modifier le résultat ne touche pas le stockage', () => {
    const s = createOrderAlertStore(storage, 'real');
    s.saveOrders([order()]);
    s.read().orders[0].qty = 999;
    expect(s.read().orders[0].qty).toBe(2);
  });

  it('JSON corrompu : lecture ET écriture lèvent une erreur, la donnée n\'est jamais remplacée', () => {
    storage.setItem('patrimoine-orders-alerts-real', '{broken');
    const s = createOrderAlertStore(storage, 'real');
    expect(() => s.read()).toThrow(/JSON invalide/);
    expect(() => s.saveOrders([order()])).toThrow();
    expect(() => s.saveAlerts([alert()])).toThrow();
    expect(storage.getItem('patrimoine-orders-alerts-real')).toBe('{broken');
  });

  it.each([
    ['type inconnu', order({ type: 'DIV' })],
    ['quantité nulle', order({ qty: 0 })],
    ['prix limite négatif', order({ limit: -1 })],
    ['quantité non numérique', order({ qty: '2' })],
    ['quantité infinie', order({ qty: Infinity })],
    ['identifiant manquant', order({ id: '' })],
  ])('refuse d\'enregistrer un ordre invalide (%s)', (_, bad) => {
    expect(() => createOrderAlertStore(storage, 'real').saveOrders([bad])).toThrow(/Ordre n°1 invalide/);
    expect(storage.data.size).toBe(0);
  });

  it.each([
    ['sens inconnu', alert({ dir: 'equal' })],
    ['prix nul', alert({ price: 0 })],
    ['ticker vide', alert({ ticker: '' })],
  ])('refuse d\'enregistrer une alerte invalide (%s)', (_, bad) => {
    expect(() => createOrderAlertStore(storage, 'real').saveAlerts([bad])).toThrow(/Alerte n°1 invalide/);
  });

  it('refuse deux éléments de même identifiant dans une liste', () => {
    expect(() => createOrderAlertStore(storage, 'real').saveOrders([order(), order()])).toThrow(/double/);
  });

  it('données déjà enregistrées mais invalides : lecture refusée avec le numéro de l\'élément', () => {
    storage.setItem('patrimoine-orders-alerts-real', JSON.stringify({ orders: [order(), order({ id: 'o2', qty: -3 })], alerts: [] }));
    expect(() => createOrderAlertStore(storage, 'real').read()).toThrow(/Ordre n°2 invalide/);
  });

  it('quota plein : l\'erreur remonte et l\'ancien contenu reste intact', () => {
    const s = createOrderAlertStore(storage, 'real');
    s.saveOrders([order()]);
    const before = storage.getItem(s.key);
    storage.setItem = () => { throw new Error('quota'); };
    expect(() => s.saveOrders([order(), order({ id: 'o2' })])).toThrow('quota');
    expect(storage.getItem(s.key)).toBe(before);
  });

  it('clear() supprime la clé du mode seulement', () => {
    const real = createOrderAlertStore(storage, 'real'), demo = createOrderAlertStore(storage, 'demo');
    real.saveOrders([order()]); demo.saveOrders([order()]);
    real.clear();
    expect(storage.getItem(real.key)).toBeNull();
    expect(demo.read().orders).toHaveLength(1);
  });

  describe('anciennes données (clés sans mode)', () => {
    beforeEach(() => {
      storage.setItem('patrimoine-orders', JSON.stringify([order()]));
      storage.setItem('patrimoine-alerts', JSON.stringify([alert()]));
    });
    it('readLegacy lit les deux anciennes clés', () => {
      const l = createOrderAlertStore(storage, 'real').readLegacy();
      expect(l.orders).toHaveLength(1); expect(l.alerts).toHaveLength(1);
    });
    it('importLegacy exige la confirmation explicite du mode', () => {
      const s = createOrderAlertStore(storage, 'real');
      expect(() => s.importLegacy()).toThrow(/Confirmation/);
      expect(() => s.importLegacy({ confirmMode: 'oui' })).toThrow(/Confirmation/);
      expect(s.read().orders).toHaveLength(0);
    });
    it('importLegacy copie dans le mode demandé et conserve les anciennes clés', () => {
      const s = createOrderAlertStore(storage, 'demo');
      expect(s.importLegacy({ confirmMode: true })).toEqual({ orders: 1, alerts: 1 });
      expect(s.read().orders).toHaveLength(1);
      expect(createOrderAlertStore(storage, 'real').read().orders).toHaveLength(0);
      expect(storage.getItem('patrimoine-orders')).toBe(JSON.stringify([order()]));
    });
    it('importLegacy refuse d\'écraser un mode qui contient déjà des données', () => {
      const s = createOrderAlertStore(storage, 'real');
      s.saveAlerts([alert({ id: 'deja' })]);
      expect(() => s.importLegacy({ confirmMode: true })).toThrow(/déjà/);
      expect(s.read().alerts.map(a => a.id)).toEqual(['deja']);
    });
    it('anciennes données illisibles : readLegacy lève, rien n\'est importé', () => {
      storage.setItem('patrimoine-orders', 'pas du json');
      const s = createOrderAlertStore(storage, 'real');
      expect(() => s.readLegacy()).toThrow(/JSON invalide/);
      expect(() => s.importLegacy({ confirmMode: true })).toThrow();
      expect(storage.getItem(s.key)).toBeNull();
    });
  });
});
