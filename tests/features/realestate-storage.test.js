import { beforeEach, describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';
import { LOAN } from '../helpers/loan.js';

const { immoValid } = loadClassic('js/features/realestate-calc.js', { globals: LOAN, exports: ['immoValid'] });
const { createImmoStore } = loadClassic('js/features/realestate-storage.js', { globals: { immoValid }, exports: ['createImmoStore'] });

function memoryStorage() {
  const data = new Map();
  return { data, getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)); }, removeItem: k => { data.delete(k); } };
}
const prop = (over = {}) => ({ id: 'im1', name: 'Appart', kind: 'main', buyDate: '2025-09-11', price: 100000, notary: 8000, works: 0, otherFees: 0, growth: 2, loan: null, ...over });

describe('createImmoStore', () => {
  let storage;
  beforeEach(() => { storage = memoryStorage(); });

  it('refuse un mode inconnu', () => expect(() => createImmoStore(storage, 'x')).toThrow(/Mode inconnu/));
  it('liste vide quand rien n\'est enregistré', () => expect(createImmoStore(storage, 'real').read()).toEqual([]));

  it('sépare les modes démo et réel', () => {
    const real = createImmoStore(storage, 'real'), demo = createImmoStore(storage, 'demo');
    real.save([prop()]);
    expect(demo.read()).toEqual([]);
    expect(real.key).toBe('patrimoine-immo-real');
    expect(demo.key).toBe('patrimoine-immo-demo');
  });

  it('enregistre puis relit, y compris le crédit', () => {
    const s = createImmoStore(storage, 'real');
    s.save([prop({ loan: { amount: 90000, rate: 3.5, years: 20, payment: 560, first: '' } })]);
    expect(s.read()[0].loan.amount).toBe(90000);
  });

  it('read() renvoie des copies, crédit compris', () => {
    const s = createImmoStore(storage, 'real');
    s.save([prop({ loan: { amount: 1, rate: 0, years: 1 } })]);
    const r = s.read(); r[0].price = 1; r[0].loan.amount = 999;
    expect(s.read()[0].price).toBe(100000);
    expect(s.read()[0].loan.amount).toBe(1);
  });

  it('JSON corrompu : lecture et écriture lèvent, la donnée n\'est jamais remplacée', () => {
    storage.setItem('patrimoine-immo-real', '[broken');
    const s = createImmoStore(storage, 'real');
    expect(() => s.read()).toThrow(/JSON invalide/);
    expect(() => s.save([prop()])).toThrow();
    expect(storage.getItem('patrimoine-immo-real')).toBe('[broken');
  });

  it('format inattendu (objet au lieu d\'une liste) refusé', () => {
    storage.setItem('patrimoine-immo-real', '{"a":1}');
    expect(() => createImmoStore(storage, 'real').read()).toThrow(/liste attendue/);
  });

  it('refuse d\'enregistrer un bien invalide ou deux biens de même identifiant, sans rien écrire', () => {
    const s = createImmoStore(storage, 'real');
    expect(() => s.save([prop({ price: 0 })])).toThrow(/Bien n°1 invalide/);
    expect(() => s.save([prop(), prop()])).toThrow(/double/);
    expect(storage.data.size).toBe(0);
  });

  it('quota plein : l\'erreur remonte, l\'ancien contenu reste', () => {
    const s = createImmoStore(storage, 'real');
    s.save([prop()]);
    const before = storage.getItem(s.key);
    storage.setItem = () => { throw new Error('quota'); };
    expect(() => s.save([prop(), prop({ id: 'im2' })])).toThrow('quota');
    expect(storage.getItem(s.key)).toBe(before);
  });

  it('clear() ne supprime que la clé de son mode', () => {
    const real = createImmoStore(storage, 'real'), demo = createImmoStore(storage, 'demo');
    real.save([prop()]); demo.save([prop()]);
    real.clear();
    expect(storage.getItem(real.key)).toBeNull();
    expect(demo.read()).toHaveLength(1);
  });

  describe('ancienne clé unique patrimoine-immo', () => {
    beforeEach(() => storage.setItem('patrimoine-immo', JSON.stringify([prop()])));
    it('readLegacy lit les anciens biens', () => expect(createImmoStore(storage, 'real').readLegacy()).toHaveLength(1));
    it('importLegacy exige la confirmation explicite du mode', () => {
      const s = createImmoStore(storage, 'real');
      expect(() => s.importLegacy()).toThrow(/Confirmation/);
      expect(() => s.importLegacy({ confirmMode: 1 })).toThrow(/Confirmation/);
      expect(s.read()).toEqual([]);
    });
    it('importLegacy copie dans le mode demandé et garde l\'ancienne clé', () => {
      const s = createImmoStore(storage, 'demo');
      expect(s.importLegacy({ confirmMode: true })).toBe(1);
      expect(s.read()).toHaveLength(1);
      expect(createImmoStore(storage, 'real').read()).toEqual([]);
      expect(storage.getItem('patrimoine-immo')).toBe(JSON.stringify([prop()]));
    });
    it('importLegacy refuse d\'écraser un mode qui contient déjà des biens', () => {
      const s = createImmoStore(storage, 'real');
      s.save([prop({ id: 'deja' })]);
      expect(() => s.importLegacy({ confirmMode: true })).toThrow(/déjà/);
      expect(s.read().map(p => p.id)).toEqual(['deja']);
    });
    it('anciennes données illisibles : rien n\'est importé', () => {
      storage.setItem('patrimoine-immo', 'oups');
      const s = createImmoStore(storage, 'real');
      expect(() => s.importLegacy({ confirmMode: true })).toThrow();
      expect(storage.getItem(s.key)).toBeNull();
    });
    it('sans ancienne clé : liste vide', () => {
      storage.removeItem('patrimoine-immo');
      expect(createImmoStore(storage, 'real').readLegacy()).toEqual([]);
    });
  });
});
