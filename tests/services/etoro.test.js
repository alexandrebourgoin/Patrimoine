import { describe, it, expect, vi } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';

// Réponses d'exemple au format de la documentation eToro (api-portal.etoro.com, 26/11/2026), sans réseau.
const PNL = {
  clientPortfolio: {
    credit: 1000,
    positions: [
      // Apple au comptant, deux lots : 10 + 5 unités
      { positionID: 1, instrumentID: 1001, isBuy: true, leverage: 1, settlementTypeID: 1, units: 10, amount: 1500, openDateTime: '2025-03-01T10:00:00Z', unrealizedPnL: { pnL: 200 } },
      { positionID: 2, instrumentID: 1001, isBuy: true, leverage: 1, settlementTypeID: 1, units: 5, amount: 900, openDateTime: '2024-11-02T10:00:00Z', unrealizedPnL: { pnL: -50 } },
      // Bitcoin crypto réelle (casse « Id » des exemples de la doc, pnL à plat)
      { positionId: 3, instrumentId: 100000, isBuy: true, leverage: 1, settlementTypeId: 3, units: 0.02, amount: 1200, openDateTime: '2025-06-01T00:00:00Z', pnL: 300 },
      // CFD à levier 5 sur l'or : valeur = montant + plus-value, pas unités × cours
      { positionID: 4, instrumentID: 18, isBuy: true, leverage: 5, settlementTypeID: 0, units: 2, amount: 400, openDateTime: '2025-09-01T00:00:00Z', unrealizedPnL: { pnL: 60 } },
    ],
    mirrors: [
      { mirrorID: 77, parentUsername: 'jaynemesis', availableAmount: 100, closedPositionsNetProfit: 40, startedCopyDate: '2024-05-01T00:00:00Z',
        positions: [{ instrumentID: 1001, units: 1, amount: 500, unrealizedPnL: { pnL: 25 } }] },
    ],
    orders: [{ amount: 50 }],
    ordersForOpen: [{ mirrorID: 0, amount: 30, totalExternalCosts: 1 }, { mirrorID: 77, amount: 999 }],
  },
};
const INSTR = {
  1001: { instrumentDisplayName: 'Apple', symbolFull: 'AAPL', instrumentTypeID: 5 },
  100000: { instrumentDisplayName: 'Bitcoin', symbolFull: 'BTC', instrumentTypeID: 10 },
  18: { instrumentDisplayName: 'Or', symbolFull: 'GOLD', instrumentTypeID: 2 },
};

function storage() { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, keys: () => Object.keys(m) }; }
const S = { accounts: [], isDemo: false };
const saveData = vi.fn(), toast = vi.fn();
const E = loadClassic('js/services/etoro.js', {
  globals: { S, saveData, toast, _dayKey: () => '2026-11-26', recalcHolding: h => globalThis.PU.recalcHolding(h, {}, 'USD'),
    accTotal: a => globalThis.PU.accTotal(a, {}, 'USD'), localStorage: storage(), fetch: (...a) => globalThis.__fetch(...a) },
  exports: ['ETORO_KEYS_STORE', 'etoroPortfolio', 'etoroHoldings', 'etoroApply', 'etoroSync', 'etoroDue', 'etoroKeys', 'etoroKeysSave',
    'etoroKeysDelete', 'etoroMask', 'etoroErrorText', 'etoroGet'],
});

describe('eToro : solde (equity) et positions, d après la réponse /trading/info/real/pnl', () => {
  const port = E.etoroPortfolio(PNL, INSTR);
  it('solde = liquidités disponibles + investi + plus-values latentes (guide « Calculate equity »)', () => {
    // Liquidités disponibles = 1000 − 30 (ordre en propre) − 50 (ordre) = 920
    // Investi = 1500 + 900 + 1200 + 400 + 500 + (100 − 40) + 30 + 50 + 1 = 4641
    // Plus-values = 200 − 50 + 300 + 60 + 25 + 40 = 575
    expect(port.equity).toBeCloseTo(920 + 4641 + 575, 6);
    expect(port.cash).toBeCloseTo(1000 + 1, 6);   // argent des ordres en attente : toujours dans le solde
    expect(port.cash + port.holdings.reduce((s, h) => s + h.value, 0)).toBeCloseTo(port.equity, 6);
  });
  it('positions regroupées par instrument, nom et symbole eToro ; CFD à part, valeur = montant + plus-value', () => {
    const by = Object.fromEntries(port.holdings.map(h => [h.key, h]));
    expect(by['1001']).toMatchObject({ ticker: 'AAPL', name: 'Apple', type: 'Action', units: 15, cost: 2400, value: 2550, opened: '2024-11-02' });
    expect(by['100000']).toMatchObject({ ticker: 'BTC', type: 'Crypto', value: 1500 });
    expect(by['18:cfd']).toMatchObject({ name: 'Or · CFD ×5', value: 460, leveraged: true });
  });
  it('copy trading : une ligne par trader copié, sans le détail', () => {
    const m = port.holdings.find(h => h.key === 'mirror:77');
    expect(m).toMatchObject({ name: 'Copie de jaynemesis', units: 1, value: 500 + 25 + 60 + 40 });
  });
  it('réponse vide ou partielle : solde nul, aucune position', () => {
    expect(E.etoroPortfolio({}, {})).toMatchObject({ equity: 0, cash: 0, holdings: [] });
    expect(E.etoroPortfolio({ clientPortfolio: { credit: 12.5 } }).equity).toBe(12.5);
  });
  it('instrument sans nom (catalogue indisponible) : identifiant eToro gardé', () => {
    expect(E.etoroPortfolio(PNL, {}).holdings[0].ticker).toBe('ETORO-1001');
  });
});

describe('eToro : application au compte', () => {
  it('positions en USD (quantité × cours = valeur eToro), liquidités en régularisation du jour, solde du compte = solde eToro', () => {
    const acc = { id: 'e', currency: 'EUR', holdings: [{ id: 'old' }], cashflows: [{ type: 'DEP', amount: 1 }], sync: { provider: 'etoro', proxy: 'https://r.dev' } };
    const port = E.etoroPortfolio(PNL, INSTR);
    E.etoroApply(acc, port, '2026-11-26', 123);
    expect(acc.holdings.map(h => h.id)).toEqual(['etoro-1001', 'etoro-100000', 'etoro-18-cfd', 'etoro-mirror-77']);
    expect(acc.holdings.every(h => h.sync === 'etoro' && h.currency === 'USD')).toBe(true);
    expect(acc.holdings[0]).toMatchObject({ quantity: 15, value: 2550 });
    expect(acc.holdings[0].avgBuyPrice).toBeCloseTo(160, 6);
    expect(acc.cashflows).toEqual([]);
    expect(acc.cashAdjust).toEqual([{ id: 'etoro', date: '2026-11-26', balances: { USD: 1001 } }]);
    expect(acc.value).toBeCloseTo(port.equity, 2);
    expect(acc.sync).toMatchObject({ provider: 'etoro', proxy: 'https://r.dev', lastSync: 123, error: '' });
  });
});

describe('eToro : réseau, erreurs et clés', () => {
  it('appel avec les trois en-têtes, direct ou par le relais ; message clair par code d erreur', async () => {
    const calls = [];
    globalThis.__fetch = async (url, o) => { calls.push([url, o.headers]); return { ok: true, json: async () => ({ ok: 1 }) }; };
    await E.etoroGet('/trading/info/real/pnl', { apiKey: 'A', userKey: 'U' });
    await E.etoroGet('/trading/info/real/pnl', { apiKey: 'A', userKey: 'U' }, 'https://relais.dev/');
    expect(calls[0][0]).toBe('https://public-api.etoro.com/api/v1/trading/info/real/pnl');
    expect(calls[1][0]).toBe('https://relais.dev/trading/info/real/pnl');
    expect(calls[0][1]['x-api-key']).toBe('A');
    expect(calls[0][1]['x-user-key']).toBe('U');
    expect(calls[0][1]['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(E.etoroErrorText(401)).toMatch(/Clés refusées/);
    expect(E.etoroErrorText(429, '30')).toMatch(/30 s/);
    expect(E.etoroErrorText(0)).toMatch(/relais/);
  });
  it('synchro : succès → positions ; échec → dernier solde gardé et erreur notée ; sans clés → rien n est appelé', async () => {
    globalThis.__fetch = async url => ({ ok: true, json: async () => (url.includes('/pnl') ? PNL : { instrumentDisplayDatas: Object.entries(INSTR).map(([id, v]) => ({ instrumentID: +id, ...v })) }) });
    const acc = { id: 'e1', holdings: [], cashflows: [], sync: { provider: 'etoro' } };
    expect(await E.etoroSync(acc, { keys: { apiKey: 'A', userKey: 'U' }, quiet: true })).toBe(true);
    const before = acc.value;
    expect(acc.holdings[0].name).toBe('Apple');
    globalThis.__fetch = async () => ({ ok: false, status: 401, headers: { get: () => null } });
    expect(await E.etoroSync(acc, { keys: { apiKey: 'A', userKey: 'U' }, quiet: true })).toBe(false);
    expect(acc.value).toBe(before);
    expect(acc.sync.error).toMatch(/Clés refusées/);
    let called = false; globalThis.__fetch = async () => { called = true; };
    expect(await E.etoroSync({ id: 'zz', sync: { provider: 'etoro' } }, { quiet: true })).toBe(false);
    expect(called).toBe(false);
  });
  it('clés : rangées hors des données « patrimoine-* » (jamais sauvegardées), masquées à l affichage, supprimables', () => {
    expect(E.ETORO_KEYS_STORE.startsWith('patrimoine-')).toBe(false);
    const st = storage();
    E.etoroKeysSave('a', { apiKey: ' ABCDEFGHIJKL ', userKey: 'u123456789xyz' }, st);
    expect(E.etoroKeys('a', st)).toEqual({ apiKey: 'ABCDEFGHIJKL', userKey: 'u123456789xyz' });
    expect(E.etoroMask('ABCDEFGHIJKL')).toBe('ABCD…IJKL');
    E.etoroKeysDelete('a', st);
    expect(E.etoroKeys('a', st)).toBeNull();
  });
  it('synchro automatique : comptes eToro jamais synchronisés ou depuis plus d 1 h', () => {
    const now = 10 * 3600e3;
    const list = [{ id: 1, sync: { provider: 'etoro', lastSync: now - 30 * 60e3 } }, { id: 2, sync: { provider: 'etoro', lastSync: now - 2 * 3600e3 } },
      { id: 3, sync: { provider: 'etoro' } }, { id: 4 }];
    expect(E.etoroDue(list, now).map(a => a.id)).toEqual([2, 3]);
  });
});

describe('eToro : clé publique', () => {
  it('clé publique commune pré-remplie (affichée par eToro dans Gestion des clés API)', () => {
    const K = loadClassic('js/services/etoro.js', { globals: { localStorage: { getItem: () => null, setItem() {} } }, exports: ['ETORO_PUBLIC_KEY'] });
    expect(K.ETORO_PUBLIC_KEY).toBe('sdgdskldFPLGfjHn1421dgnlxdGTbngdflg6290bRjslfihsjhSDsdgGHH25hjf');
  });
});
