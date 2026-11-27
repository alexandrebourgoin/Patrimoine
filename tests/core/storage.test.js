import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../utils.js';                         // expose globalThis.PU
import { loadClassic } from '../helpers/load-classic.js';

// localStorage factice (Map) : chaque test repart d'une instance neuve du vrai js/core/storage.js,
// avec son propre S — le cache `_historyCache` du module ne fuit donc pas d'un test à l'autre.
const EXPORTS = ['STORE_ACCOUNTS', 'STORE_SETTINGS', 'STORE_PRICES', 'STORE_HISTORY', 'STORE_WEALTH', 'STORE_LEGACY',
  'saveAccounts', 'saveSettings', 'saveData', 'loadData', 'savePrices', 'saveFxRates', 'loadPrices',
  'loadHistory', 'saveHistory', 'getHistorySeries', 'loadWealth', 'saveWealth', 'snapshotWealth',
  '_qtyOnDay', 'reconstructWealthOnDay', 'backfillWealthHistory'];

function fresh(extra = {}) {
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
  };
  const S = {
    accounts: [], isDemo: true, watchlist: [], targets: {}, user: { name: 'Alexandre Martin' },
    theme: 'auto', currency: 'EUR', privacy: false, histPeriod: '1M', sort: 'value', sortDir: -1, debug: false,
    autoRefresh: false, accountsView: 'list', assistantEnabled: true, navItems: ['dashboard'], bgPrivacy: true, bgIdle: 0,
    priceApiKey: '', fmpApiKey: '', lockEnabled: false, lockHash: '', lockSalt: '', lockBio: false, lockBioId: '',
    lockDelay: 60, lockFails: 0, lockUntil: 0,
  };
  const api = loadClassic('js/core/storage.js', {
    globals: {
      localStorage, S, PU: globalThis.PU,
      FX_RATES: { EUR: 1, USD: 1.08 }, _fxUpdatedAt: 1234,
      sanitizeNavItems: a => ['SAN', ...a],            // marqueur : prouve que loadData filtre via sanitizeNavItems
      totalWealth: () => S.accounts.filter(a => !a.observer).reduce((s, a) => s + (a.value || 0), 0),
      toRefCcy: v => v, accCash: () => 0, ...extra,
    },
    exports: EXPORTS,
  });
  return { api, store, S };
}
const json = (store, key) => JSON.parse(store.get(key));

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2024, 5, 15, 12)); });   // 15/06/2024
afterEach(() => { vi.useRealTimers(); });

describe('clés de stockage (ne jamais renommer : ce sont les données des utilisateurs)', () => {
  it('noms exacts', () => {
    const { api } = fresh();
    expect([api.STORE_ACCOUNTS, api.STORE_SETTINGS, api.STORE_PRICES, api.STORE_HISTORY, api.STORE_WEALTH, api.STORE_LEGACY]).toEqual([
      'patrimoine-accounts', 'patrimoine-settings', 'patrimoine-prices', 'patrimoine-history', 'patrimoine-wealth', 'patrimoine-data']);
  });
});

describe('saveAccounts / saveSettings / saveData', () => {
  it('saveAccounts : comptes, isDemo, watchlist, objectifs, utilisateur', () => {
    const { api, store, S } = fresh();
    S.accounts = [{ id: 'a' }]; S.isDemo = false; S.watchlist = [{ ticker: 'X' }]; S.targets = { Action: 60 };
    api.saveAccounts();
    expect(json(store, 'patrimoine-accounts')).toEqual({
      accounts: [{ id: 'a' }], isDemo: false, watchlist: [{ ticker: 'X' }], targets: { Action: 60 }, user: { name: 'Alexandre Martin' } });
  });
  it('saveSettings : écrit tous les réglages, dont le verrou (hash/sel/essais) et les clés API', () => {
    const { api, store, S } = fresh();
    Object.assign(S, { theme: 'dark', lockEnabled: true, lockHash: 'h', lockSalt: 's', lockFails: 3, lockUntil: 99, fmpApiKey: 'k' });
    api.saveSettings();
    const s = json(store, 'patrimoine-settings');
    expect(s).toMatchObject({ theme: 'dark', lockEnabled: true, lockHash: 'h', lockSalt: 's', lockFails: 3, lockUntil: 99, fmpApiKey: 'k' });
    expect(Object.keys(s)).toHaveLength(23);
  });
  it('saveData écrit les deux clés', () => {
    const { api, store } = fresh();
    api.saveData();
    expect(store.has('patrimoine-accounts') && store.has('patrimoine-settings')).toBe(true);
  });
});

describe("écriture refusée (quota plein)", () => {
  const full = { getItem: () => null, setItem() { throw new DOMException("quota", "QuotaExceededError"); }, removeItem() {} };
  it("saveAccounts / saveSettings renvoient false et préviennent (au plus une fois toutes les 10 s)", () => {
    const toast = vi.fn();
    const { api } = fresh({ localStorage: full, toast });
    expect(api.saveAccounts()).toBe(false);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toContain("Comptes non enregistrés");
    expect(api.saveSettings()).toBe(false);          // dans les 10 s : pas de second message
    expect(toast).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 11));
    expect(api.saveData()).toBe(false);
    expect(toast).toHaveBeenCalledTimes(2);
  });
  it("écriture normale : renvoie true, aucun message", () => {
    const toast = vi.fn();
    const { api } = fresh({ toast });
    expect(api.saveAccounts()).toBe(true);
    expect(api.saveSettings()).toBe(true);
    expect(api.saveData()).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });
  it("sans toast défini (tests, chargement partiel) : pas d'exception", () => {
    const { api } = fresh({ localStorage: full });
    expect(() => api.saveAccounts()).not.toThrow();
  });
});

describe('loadData', () => {
  it('aucune donnée → false, S inchangé (1re ouverture)', () => {
    const { api, S } = fresh();
    expect(api.loadData()).toBe(false);
    expect(S.isDemo).toBe(true);
    expect(S.accounts).toEqual([]);
  });
  it('aller-retour save → load restaure comptes, mode réel et réglages', () => {
    const a = fresh();
    Object.assign(a.S, { accounts: [{ id: 'a', name: 'PEA' }], isDemo: false, theme: 'dark', currency: 'USD', privacy: true, lockDelay: 0 });
    a.api.saveData();
    const b = fresh();
    for (const [k, v] of a.store) b.store.set(k, v);
    expect(b.api.loadData()).toBe(true);
    expect(b.S).toMatchObject({ accounts: [{ id: 'a', name: 'PEA' }], isDemo: false, theme: 'dark', currency: 'USD', privacy: true, lockDelay: 0 });
  });
  it('une valeur « fausse » enregistrée (privacy:false, lockDelay:0) écrase bien le défaut', () => {
    const { api, store, S } = fresh();
    S.privacy = true; S.lockDelay = 60;
    store.set('patrimoine-settings', JSON.stringify({ privacy: false, lockDelay: 0 }));
    api.loadData();
    expect(S.privacy).toBe(false);
    expect(S.lockDelay).toBe(0);
  });
  it('les raccourcis de la barre du bas passent par sanitizeNavItems', () => {
    const { api, store, S } = fresh();
    store.set('patrimoine-settings', JSON.stringify({ navItems: ['comptes'] }));
    api.loadData();
    expect(S.navItems).toEqual(['SAN', 'comptes']);
  });
  it('JSON corrompu → false, sans exception', () => {
    const { api, store } = fresh();
    store.set('patrimoine-accounts', '{pas du json');
    expect(api.loadData()).toBe(false);
  });
});

describe('migration depuis l\'ancien format (clé unique patrimoine-data)', () => {
  const legacy = { accounts: [{ id: 'old' }], isDemo: false, watchlist: [{ ticker: 'W' }], theme: 'dark', currency: 'USD', sort: 'name' };
  it('ventile dans les deux clés, supprime l\'ancienne, charge les valeurs', () => {
    const { api, store, S } = fresh();
    store.set('patrimoine-data', JSON.stringify(legacy));
    expect(api.loadData()).toBe(true);
    expect(store.has('patrimoine-data')).toBe(false);
    expect(json(store, 'patrimoine-accounts')).toMatchObject({ accounts: [{ id: 'old' }], isDemo: false });
    expect(json(store, 'patrimoine-settings')).toMatchObject({ theme: 'dark', currency: 'USD', sort: 'name', histPeriod: '1M' });
    expect(S).toMatchObject({ accounts: [{ id: 'old' }], isDemo: false, theme: 'dark', currency: 'USD' });
  });
  it('n\'écrase JAMAIS des données déjà au nouveau format', () => {
    const { api, store, S } = fresh();
    store.set('patrimoine-accounts', JSON.stringify({ accounts: [{ id: 'new' }], isDemo: false }));
    store.set('patrimoine-data', JSON.stringify(legacy));
    api.loadData();
    expect(S.accounts).toEqual([{ id: 'new' }]);
  });
});

describe('cache de cours et taux de change', () => {
  it('savePrices : cours + taux sans EUR + horodatage des taux', () => {
    const { api, store } = fresh();
    api.savePrices({ MC: 734.2 });
    expect(json(store, 'patrimoine-prices')).toMatchObject({ prices: { MC: 734.2 }, fxRates: { USD: 1.08 }, fxUpdatedAt: 1234 });
    expect(json(store, 'patrimoine-prices').fxRates.EUR).toBeUndefined();
  });
  it('saveFxRates conserve les cours déjà enregistrés', () => {
    const { api, store } = fresh();
    api.savePrices({ MC: 734.2 });
    api.saveFxRates();
    expect(json(store, 'patrimoine-prices').prices).toEqual({ MC: 734.2 });
  });
  it('loadPrices : null si absent ou corrompu', () => {
    const { api, store } = fresh();
    expect(api.loadPrices()).toBeNull();
    store.set('patrimoine-prices', '???');
    expect(api.loadPrices()).toBeNull();
  });
});

describe('historique réel des cours', () => {
  it('saveHistory / getHistorySeries : devise EUR par défaut', () => {
    const { api } = fresh();
    api.saveHistory('MC', [{ d: '2024-01-01', c: 1 }, { d: '2024-01-02', c: 2 }]);
    expect(api.getHistorySeries('MC')).toMatchObject({ currency: 'EUR', series: [{ d: '2024-01-01', c: 1 }, { d: '2024-01-02', c: 2 }] });
  });
  it('moins de 2 points ou ticker inconnu → null (le graphique retombe sur la courbe estimée)', () => {
    const { api } = fresh();
    api.saveHistory('X', [{ d: '2024-01-01', c: 1 }]);
    expect(api.getHistorySeries('X')).toBeNull();
    expect(api.getHistorySeries('INCONNU')).toBeNull();
  });
  it('relit le store au premier accès ; JSON corrompu → {}', () => {
    const a = fresh(); a.store.set('patrimoine-history', JSON.stringify({ Z: { series: [{ d: 'a', c: 1 }, { d: 'b', c: 2 }] } }));
    expect(a.api.getHistorySeries('Z')).not.toBeNull();
    const b = fresh(); b.store.set('patrimoine-history', '{oups');
    expect(b.api.loadHistory()).toEqual({});
  });
});

describe('snapshots quotidiens du patrimoine', () => {
  it('loadWealth : [] si absent, corrompu ou pas un tableau', () => {
    const { api, store } = fresh();
    expect(api.loadWealth()).toEqual([]);
    store.set('patrimoine-wealth', '{x'); expect(api.loadWealth()).toEqual([]);
    store.set('patrimoine-wealth', '{"a":1}'); expect(api.loadWealth()).toEqual([]);
  });
  it('snapshotWealth : no-op en mode démo et quand le total est nul', () => {
    const { api, store, S } = fresh();
    S.accounts = [{ value: 1000 }];
    api.snapshotWealth();                               // démo
    S.isDemo = false; S.accounts = [{ value: 0 }];
    api.snapshotWealth();                               // total nul
    expect(store.has('patrimoine-wealth')).toBe(false);
  });
  it('écrit le point du jour arrondi à 2 décimales, puis l\'écrase (un seul point par jour)', () => {
    const { api, S } = fresh();
    S.isDemo = false; S.accounts = [{ value: 1000.456 }];
    api.snapshotWealth();
    expect(api.loadWealth()).toEqual([{ d: '2024-06-15', v: 1000.46 }]);
    S.accounts = [{ value: 1200 }];
    api.snapshotWealth();
    expect(api.loadWealth()).toEqual([{ d: '2024-06-15', v: 1200 }]);
  });
  it('ignore les comptes « observateur » (hors patrimoine)', () => {
    const { api, S } = fresh();
    S.isDemo = false; S.accounts = [{ value: 1000 }, { value: 500, observer: true }];
    api.snapshotWealth();
    expect(api.loadWealth()[0].v).toBe(1000);
  });
  it('garde 800 points au maximum, en supprimant les plus anciens', () => {
    const { api, S } = fresh();
    S.isDemo = false; S.accounts = [{ value: 1 }];
    api.saveWealth(Array.from({ length: 805 }, (_, i) => ({ d: `2000-01-${String(i).padStart(4, '0')}`, v: i + 1 })));
    api.snapshotWealth();
    const w = api.loadWealth();
    expect(w).toHaveLength(800);
    expect(w.at(-1).d).toBe('2024-06-15');
    expect(w[0].v).toBe(7);          // 806 points au total → les 6 plus anciens (v=1..6) sont partis
  });
});

describe('_qtyOnDay', () => {
  const { api } = fresh();
  const h = { quantity: 99, transactions: [
    { date: '2024-01-10', type: 'BUY', qty: 10 }, { date: '2024-02-10', type: 'SELL', qty: 4 },
    { date: '2024-03-10', type: 'BUY', qty: 5 }, { date: '2024-02-11', type: 'DIV', qty: 10 }] };
  it('cumule achats et ventes jusqu\'à la date incluse, ignore les dividendes et le futur', () => {
    expect(api._qtyOnDay(h, '2024-01-09')).toBe(0);
    expect(api._qtyOnDay(h, '2024-01-10')).toBe(10);
    expect(api._qtyOnDay(h, '2024-02-10')).toBe(6);
    expect(api._qtyOnDay(h, '2024-12-31')).toBe(11);
  });
  it('une vente supérieure à la quantité détenue ne passe pas sous zéro', () => {
    expect(api._qtyOnDay({ transactions: [{ date: '2024-01-01', type: 'BUY', qty: 2 }, { date: '2024-01-02', type: 'SELL', qty: 5 }] }, '2024-01-05')).toBe(0);
  });
  it('sans transactions : la quantité actuelle du titre', () => {
    expect(api._qtyOnDay({ quantity: 7, transactions: [] }, '2024-01-01')).toBe(7);
    expect(api._qtyOnDay({}, '2024-01-01')).toBe(0);
  });
});

describe('reconstructWealthOnDay / backfillWealthHistory', () => {
  const account = (extra = {}) => ({ id: 'a', holdings: [{ ticker: 'T', currency: 'EUR', currentPrice: 100,
    transactions: [{ date: '2024-01-10', type: 'BUY', qty: 10 }] }], ...extra });

  it('compte MA PART du compte, comme les snapshots (totalWealth) : pas de saut entre jours reconstruits et jours enregistrés', () => {
    const { api, S } = fresh({ accShare: a => (a.share ? a.share / 100 : 1) });
    S.accounts = [account({ share: 50 })];
    expect(api.reconstructWealthOnDay('2024-02-01')).toBe(500);   // 10 × 100 × 50 %
  });
  it('quantité détenue ce jour-là × cours courant (sans historique)', () => {
    const { api, S } = fresh(); S.accounts = [account()];
    expect(api.reconstructWealthOnDay('2024-01-09')).toBe(0);
    expect(api.reconstructWealthOnDay('2024-02-01')).toBe(1000);
  });
  it('utilise la dernière clôture réelle ≤ ce jour ; avant la 1re clôture, retombe sur le cours courant', () => {
    const { api, S } = fresh(); S.accounts = [account()];
    api.saveHistory('T', [{ d: '2024-01-15', c: 50 }, { d: '2024-02-15', c: 60 }]);
    expect(api.reconstructWealthOnDay('2024-02-01')).toBe(500);   // 10 × 50
    expect(api.reconstructWealthOnDay('2024-03-01')).toBe(600);   // 10 × 60
    expect(api.reconstructWealthOnDay('2024-01-12')).toBe(1000);  // avant la 1re clôture → 10 × 100
  });
  it('ignore les comptes observateur', () => {
    const { api, S } = fresh(); S.accounts = [account({ observer: true })];
    expect(api.reconstructWealthOnDay('2024-02-01')).toBe(0);
  });
  it('backfill : comble les jours passés, jamais le jour courant, ne touche pas aux vrais snapshots, idempotent', () => {
    const { api, store, S } = fresh();
    S.isDemo = false; S.accounts = [account()];
    api.saveWealth([{ d: '2024-06-12', v: 999 }]);
    api.backfillWealthHistory(5);                                  // 10/06 … 14/06
    const w = api.loadWealth();
    expect(w.map(p => p.d)).toEqual(['2024-06-10', '2024-06-11', '2024-06-12', '2024-06-13', '2024-06-14']);
    expect(w.find(p => p.d === '2024-06-12').v).toBe(999);         // snapshot réel préservé
    expect(w.some(p => p.d === '2024-06-15')).toBe(false);         // jour courant réservé au snapshot live
    const before = store.get('patrimoine-wealth');
    api.backfillWealthHistory(5);
    expect(store.get('patrimoine-wealth')).toBe(before);           // 2e appel : rien ne change
  });
  it('backfill : no-op en mode démo', () => {
    const { api, store, S } = fresh(); S.accounts = [account()];
    api.backfillWealthHistory(5);
    expect(store.has('patrimoine-wealth')).toBe(false);
  });
});
