import { beforeEach, describe, expect, it } from 'vitest';
import { loadClassic } from './helpers/load-classic.js';

const { createOrderAlertStore: createStore } = loadClassic('js/features/order-alert-storage.js', {
  exports: ['createOrderAlertStore'],
});
const order = { id: 'o1', accId: 'a', holdId: 'h', type: 'BUY', qty: 2, limit: 10 };
const alert = { id: 'a1', ticker: 'TEST', dir: 'above', price: 20 };
let data, storage, demo, real;

beforeEach(() => {
  data = new Map();
  storage = {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, value),
  };
  demo = createStore(storage, 'demo');
  real = createStore(storage, 'real');
});

describe('Stockage des ordres et alertes', () => {
  it('lit un nouveau stockage sans rien écrire', () => {
    expect(real.read()).toEqual({ version: 1, mode: 'real', orders: [], alerts: [] });
    expect(data.size).toBe(0);
  });

  it('sépare les modes et conserve les autres listes', () => {
    demo.saveOrders([order]);
    real.saveAlerts([alert]);
    expect(real.read().orders).toEqual([]);
    expect(demo.read().alerts).toEqual([]);
    real.saveOrders([order]);
    expect(real.read().alerts).toEqual([alert]);
    real.saveAlerts([]);
    expect(real.read().orders).toEqual([order]);
  });

  it('exporte une copie indépendante et restaure un document valide', () => {
    real.saveOrders([order]);
    const snapshot = real.exportData();
    snapshot.orders[0].qty = 99;
    expect(real.read().orders[0].qty).toBe(2);
    real.importData({ version: 1, mode: 'real', orders: [], alerts: [alert] });
    expect(real.read().alerts).toEqual([alert]);
    expect(real.read().orders).toEqual([]);
  });

  it('refuse un autre mode et les données invalides sans écraser le stockage', () => {
    real.saveOrders([order]);
    const before = data.get('patrimoine-orders-alerts-real');
    expect(() => real.importData(demo.exportData())).toThrow();
    expect(() => real.saveOrders([{ ...order, qty: Infinity }])).toThrow();
    expect(() => real.saveOrders([order, order])).toThrow();
    expect(data.get('patrimoine-orders-alerts-real')).toBe(before);
  });

  it('préserve les anciennes clés sans migration automatique', () => {
    storage.setItem('patrimoine-orders', JSON.stringify([order]));
    storage.setItem('patrimoine-alerts', JSON.stringify([alert]));
    const before = [...data];
    expect(real.readLegacy()).toEqual({ orders: [order], alerts: [alert] });
    expect([...data]).toEqual(before);
    expect(real.read().orders).toEqual([]);
    expect(demo.read().alerts).toEqual([]);
  });

  it('ne remplace pas des données corrompues par une liste vide', () => {
    storage.setItem('patrimoine-orders-alerts-real', '{broken');
    expect(() => real.saveOrders([order])).toThrow();
    expect(storage.getItem('patrimoine-orders-alerts-real')).toBe('{broken');
  });

  it('propage les erreurs de quota', () => {
    const store = createStore({ getItem: () => null, setItem() { throw new Error('quota'); } }, 'real');
    expect(() => store.saveOrders([order])).toThrow('quota');
  });

  it('exige une confirmation explicite avant reprise des anciennes données', () => {
    storage.setItem('patrimoine-orders', JSON.stringify([order]));
    const before = [...data];
    expect(() => real.importLegacy()).toThrow('Confirme le mode');
    expect(() => real.importLegacy({ confirmMode: false })).toThrow('Confirme le mode');
    expect([...data]).toEqual(before);
  });

  it('copie les anciennes données dans le seul mode confirmé sans effacer les sources', () => {
    storage.setItem('patrimoine-orders', JSON.stringify([order]));
    storage.setItem('patrimoine-alerts', JSON.stringify([alert]));
    const sourceOrders = storage.getItem('patrimoine-orders');
    const sourceAlerts = storage.getItem('patrimoine-alerts');
    real.importLegacy({ confirmMode: true });
    expect(real.read()).toEqual({ version: 1, mode: 'real', orders: [order], alerts: [alert] });
    expect(demo.read()).toEqual({ version: 1, mode: 'demo', orders: [], alerts: [] });
    expect(storage.getItem('patrimoine-orders')).toBe(sourceOrders);
    expect(storage.getItem('patrimoine-alerts')).toBe(sourceAlerts);
  });

  it('refuse la reprise dans une destination déjà remplie', () => {
    storage.setItem('patrimoine-orders', JSON.stringify([order]));
    real.saveAlerts([alert]);
    const before = [...data];
    expect(() => real.importLegacy({ confirmMode: true })).toThrow('contient déjà des données');
    expect([...data]).toEqual(before);
  });

  it('valide toutes les anciennes listes avant la moindre écriture de reprise', () => {
    storage.setItem('patrimoine-orders', JSON.stringify([order]));
    storage.setItem('patrimoine-alerts', JSON.stringify([{ ...alert, price: 0 }]));
    const before = [...data];
    expect(() => real.importLegacy({ confirmMode: true })).toThrow('Alerte invalide');
    expect([...data]).toEqual(before);
  });
});
