import { beforeEach, describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

// Import CSV : les règles du compte de destination s'appliquent (js/features/account-rules.js).
const { SECURITIES_DB } = loadClassic('js/data/securities.js', { exports: ['SECURITIES_DB'] });
const rules = loadClassic('js/features/account-rules.js', { exports: ['ACCOUNT_TYPES', 'assetTypeError', 'allowedAssetTypes', 'csvRejectedTickers'] });
const PEA = "Plan d'Épargne en Actions (PEA)";
const row = (ticker, over = {}) => ({ ticker, name: ticker, date: '2024-01-10', type: 'BUY', qty: 1, price: 10, ...over });

// Titres de la base utilisés (type / pays réels)
const FR = Object.entries(SECURITIES_DB).find(([, s]) => s.type === 'Action' && s.country === 'France')[0];
const US = Object.entries(SECURITIES_DB).find(([, s]) => s.type === 'Action' && s.country === 'USA')[0];
const CRYPTO = Object.entries(SECURITIES_DB).find(([, s]) => s.type === 'Crypto')?.[0];

describe('csvRejectedTickers', () => {
  const pea = { type: PEA, holdings: [] };
  it('refuse un nouveau titre interdit par le type de compte, avec la raison, une seule fois par titre', () => {
    const r = rules.csvRejectedTickers(pea, [row(US), row(US, { date: '2024-02-01' }), row(FR)], SECURITIES_DB);
    expect(r).toEqual([{ ticker: US, reason: 'PEA : actions européennes uniquement' }]);
  });
  it('un titre inconnu de la base (pays « Inconnu ») est refusé sur un PEA : on demande de préciser le pays', () => {
    expect(rules.csvRejectedTickers(pea, [row('ZZZUNKNOWN')], SECURITIES_DB)).toEqual([{ ticker: 'ZZZUNKNOWN', reason: 'PEA : indique le pays (France ou UE)' }]);
  });
  if (CRYPTO) it('refuse une crypto sur un compte-titres', () => {
    expect(rules.csvRejectedTickers({ type: 'Compte-Titres Ordinaire', holdings: [] }, [row(CRYPTO)], SECURITIES_DB)[0].reason).toBe('Crypto interdite sur ce type de compte');
  });
  it('un titre déjà présent dans le compte reçoit ses mouvements, même s\'il n\'est plus conforme', () => {
    expect(rules.csvRejectedTickers({ type: PEA, holdings: [{ ticker: US }] }, [row(US)], SECURITIES_DB)).toEqual([]);
  });
  it('type sans restriction : rien n\'est refusé', () => {
    expect(rules.csvRejectedTickers({ type: 'SCPI / Immobilier', holdings: [] }, [row(US), row('ZZZ')], SECURITIES_DB)).toEqual([]);
  });
  it('ignore les lignes sans ticker', () => expect(rules.csvRejectedTickers(pea, [{ qty: 1 }], SECURITIES_DB)).toEqual([]));
});

describe('confirmImport', () => {
  let S, toasts, calls, api, selected, dom;
  const acc = (over = {}) => ({ id: 'a1', name: 'PEA', type: PEA, holdings: [], cashflows: [], value: 0, ...over });
  beforeEach(() => {
    S = { accounts: [] }; toasts = []; calls = { confirm: null, saved: 0, main: 0 }; selected = '__new__';
    dom = { getElementById: id => (id === 'csv-acc-select' ? { value: selected } : { classList: { add() {}, remove() {} }, addEventListener() {} }) };
    api = loadClassic('js/services/csv-import.js', {
      globals: {
        ...rules, S, SECURITIES_DB, ISIN_MAP: {}, document: { ...dom, querySelectorAll: () => [] }, toast: m => toasts.push(m), esc: s => String(s), registerModal() {},
        recalcHolding(h) { h.quantity = h.transactions.reduce((q, t) => (t.type === 'BUY' ? q + t.qty : t.type === 'SELL' ? q - t.qty : q), 0); },
        accTotal: () => 7, saveData() { calls.saved++; }, refreshMain() { calls.main++; }, haptic() {}, openConfirm: (m, cb) => { calls.confirm = { m, cb }; },
      },
      exports: ['confirmImport', 'openImportPreview'],
    });
  });
  // Charge les lignes en attente par le chemin réel : openImportPreview(rows, …) les mémorise
  const load = rows => { api.openImportPreview(rows, 'Générique', new Set()); };

  it('compte existant : les titres autorisés sont importés après confirmation de ceux qui sont refusés', () => {
    const a = acc(); S.accounts = [a]; selected = 'a1';
    load([row(FR), row(US)]);
    api.confirmImport();
    expect(a.holdings).toEqual([]);                           // rien avant confirmation
    expect(calls.confirm.m).toBe(`1 titre refusé par les règles du compte : ${US} (PEA : actions européennes uniquement). Importer le reste ?`);
    calls.confirm.cb();
    expect(a.holdings.map(h => h.ticker)).toEqual([FR]);
    expect(a.value).toBe(7);
    expect(toasts.at(-1)).toBe('1 mouvement importé ✓');
  });
  it('rien de refusé : import direct, sans confirmation', () => {
    const a = acc(); S.accounts = [a]; selected = 'a1';
    load([row(FR)]);
    api.confirmImport();
    expect(calls.confirm).toBeNull();
    expect(a.holdings).toHaveLength(1);
  });
  it('tout est refusé : aucun import, message explicite', () => {
    const a = acc(); S.accounts = [a]; selected = 'a1';
    load([row(US)]);
    api.confirmImport();
    expect(a.holdings).toEqual([]);
    expect(toasts.at(-1)).toBe(`Import refusé : ${US} (PEA : actions européennes uniquement)`);
    expect(calls.saved).toBe(0);
  });
  it('nouveau compte : jamais créé si tout est refusé, créé seulement une fois l\'import confirmé', () => {
    // compte importé = type par défaut (compte-titres) : une crypto y est refusée, une action américaine acceptée
    load(CRYPTO ? [row(CRYPTO)] : [row(FR)]);
    selected = '__new__';
    api.confirmImport();
    if (CRYPTO) { expect(S.accounts).toEqual([]); expect(toasts.at(-1)).toMatch(/^Import refusé/); }
    else expect(S.accounts).toHaveLength(1);
  });
  it('nouveau compte : créé avec les titres acceptés', () => {
    load([row(US), row(FR)]);
    api.confirmImport();
    expect(S.accounts).toHaveLength(1);
    expect(S.accounts[0].holdings.map(h => h.ticker)).toEqual([US, FR]);
    expect(calls.saved).toBe(1);
  });
  it('compte introuvable : prévient sans rien créer', () => {
    selected = 'inconnu'; load([row(FR)]);
    api.confirmImport();
    expect(toasts.at(-1)).toBe('Compte introuvable');
  });
  it('ignore les lignes incomplètes (sans quantité ou prix)', () => {
    const a = acc({ type: 'SCPI / Immobilier' }); S.accounts = [a]; selected = 'a1';
    load([row(FR, { qty: 0 }), row(FR, { price: 0 })]);
    api.confirmImport();
    expect(toasts.at(-1)).toBe('Aucun mouvement à importer');
  });
  it('plusieurs titres refusés : message au pluriel', () => {
    const a = acc(); S.accounts = [a]; selected = 'a1';
    load([row(FR), row('ZZZ1'), row(US)]);
    api.confirmImport();
    expect(calls.confirm.m).toMatch(/^2 titres refusés par les règles du compte : ZZZ1 \(.*\), /);
  });
});
