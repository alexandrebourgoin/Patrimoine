import { beforeEach, describe, expect, it } from 'vitest';
import { loadClassic, fakeDocument } from './helpers/load-classic.js';

// DOM minimal : chaque élément retient sa valeur ; les écouteurs posés à l'évaluation sont conservés pour être déclenchés.
function makeDom(initial = {}) {
  const els = {}, handlers = {}, base = fakeDocument();
  const get = id => (els[id] ??= {
    id, value: initial[id] ?? '', options: [], disabled: false, title: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { (handlers[id] ??= {})[type] = fn; },
    focus() {}, select() {}, click() { handlers[id]?.click?.(); },
  });
  return { els, handlers, document: { ...base, getElementById: get } };
}
const opts = (...values) => values.map(value => ({ value, disabled: false }));

const ACC_EXPORTS = ['ACCOUNT_TYPES', 'ACC_TYPE_CCY', 'ACC_ASSET_TYPES', 'ACC_PEA_TYPES', 'allowedAssetTypes', 'assetTypeError',
  'accTypeViolations', 'syncAccCurrency', 'openRenameAcc', 'openAccModal'];
function loadAccount(dom, extra = {}) {
  return loadClassic('js/modals/account.js', {
    globals: { registerModal() {}, esc: s => String(s), setAccIcon() {}, closeIconPicker() {}, ...(dom ? { document: dom.document } : {}), ...extra },
    exports: ACC_EXPORTS,
  });
}

const PEA = "Plan d'Épargne en Actions (PEA)";
const CTO = 'Compte-Titres Ordinaire';
const rules = loadAccount();

describe('Tables de règles des comptes', () => {
  it('ne référence que des libellés exacts de ACCOUNT_TYPES (une faute de frappe ne désactive pas une règle en silence)', () => {
    const known = new Set(rules.ACCOUNT_TYPES);
    [...Object.keys(rules.ACC_TYPE_CCY), ...Object.keys(rules.ACC_ASSET_TYPES), ...rules.ACC_PEA_TYPES]
      .forEach(label => expect(known.has(label)).toBe(true));
  });

  it('impose l\'euro aux produits français réglementés et le franc suisse au Pilier 3a', () => {
    ['Livret A', 'LDDS', 'LEP', PEA, 'PEA-PME'].forEach(t => expect(rules.ACC_TYPE_CCY[t]).toEqual(['EUR', true]));
    expect(rules.ACC_TYPE_CCY['Pilier 3a']).toEqual(['CHF', true]);
    expect(rules.ACC_TYPE_CCY[CTO]).toEqual(['EUR', false]);
  });
});

describe('Types d\'actifs autorisés', () => {
  const ok = (type, asset, country) => rules.assetTypeError({ type }, asset, country) === '';

  it('limite un compte crypto aux cryptos', () => {
    expect(ok('Crypto / Exchange', 'Crypto')).toBe(true);
    expect(rules.assetTypeError({ type: 'Crypto / Exchange' }, 'Action', 'France')).toBe('Action interdit sur ce type de compte');
  });

  it('interdit la crypto, les obligations et le cash sur un PEA', () => {
    expect(rules.assetTypeError({ type: PEA }, 'Crypto')).toBe('Crypto interdite sur ce type de compte');
    expect(rules.assetTypeError({ type: PEA }, 'Obligation')).toBe('Obligation interdit sur ce type de compte');
    expect(rules.assetTypeError({ type: PEA }, 'Cash')).toBe('Cash interdit sur ce type de compte');
    expect(ok(PEA, 'ETF', 'Irlande')).toBe(true);
  });

  it('n\'accepte une action de PEA que dans l\'Espace économique européen, sans tenir compte de la casse', () => {
    expect(ok(PEA, 'Action', 'France')).toBe(true);
    expect(ok(PEA, 'Action', '  ALLEMAGNE ')).toBe(true);
    expect(rules.assetTypeError({ type: PEA }, 'Action', 'États-Unis')).toBe('PEA : actions européennes uniquement');
    expect(rules.assetTypeError({ type: PEA }, 'Action', '')).toBe('PEA : indique le pays (France ou UE)');
    expect(rules.assetTypeError({ type: PEA }, 'Action', 'Inconnu')).toBe('PEA : indique le pays (France ou UE)');
    expect(rules.assetTypeError({ type: 'PEA-PME' }, 'Action', 'Japon')).toBe('PEA : actions européennes uniquement');
  });

  it('interdit la crypto sur un compte-titres, une assurance-vie, un PER et un Pilier 3a', () => {
    [CTO, 'Assurance-Vie', "Plan d'Épargne Retraite (PER)", 'Pilier 3a'].forEach(t => {
      expect(rules.assetTypeError({ type: t }, 'Crypto')).toBe('Crypto interdite sur ce type de compte');
      expect(ok(t, 'Obligation')).toBe(true);
    });
  });

  it('ne restreint ni les types hors table ni les types saisis librement', () => {
    expect(ok('Compte courant', 'Crypto')).toBe(true);
    expect(ok('Mon compte perso', 'Crypto')).toBe(true);
    expect(rules.assetTypeError(null, 'Crypto')).toBe('');
  });

  it('liste les positions qui deviendraient interdites en changeant de type', () => {
    const acc = { holdings: [{ ticker: 'BTC', type: 'Crypto', country: '' }, { ticker: 'MC', type: 'Action', country: 'France' }, { ticker: 'AAPL', type: 'Action', country: 'États-Unis' }] };
    expect(rules.accTypeViolations(acc, PEA).map(h => h.ticker)).toEqual(['BTC', 'AAPL']);
    expect(rules.accTypeViolations(acc, CTO).map(h => h.ticker)).toEqual(['BTC']);
    expect(rules.accTypeViolations(acc, 'Crypto / Exchange').map(h => h.ticker)).toEqual(['MC', 'AAPL']);
    expect(rules.accTypeViolations(acc, 'Compte courant')).toEqual([]);
  });
});

describe('Devise selon le type de compte', () => {
  function setup(typeValue, curValue) {
    const d = makeDom({ t: typeValue, c: curValue });
    const cur = d.document.getElementById('c');
    cur.options = opts('EUR', 'USD', 'CHF', 'GBP');
    return { ...loadAccount(d), cur };
  }

  it('à la création, impose et verrouille la devise d\'un PEA', () => {
    const { syncAccCurrency, cur } = setup(PEA, 'USD');
    syncAccCurrency('t', 'c', true);
    expect(cur.value).toBe('EUR');
    expect(cur.disabled).toBe(true);
  });

  it('à la création, propose seulement la devise par défaut d\'un compte-titres', () => {
    const { syncAccCurrency, cur } = setup(CTO, 'USD');
    syncAccCurrency('t', 'c', true);
    expect(cur.value).toBe('EUR');
    expect(cur.disabled).toBe(false);
  });

  it('à la création, impose le franc suisse au Pilier 3a', () => {
    const { syncAccCurrency, cur } = setup('Pilier 3a', 'EUR');
    syncAccCurrency('t', 'c', true);
    expect(cur.value).toBe('CHF');
    expect(cur.disabled).toBe(true);
  });

  it('sur un compte existant, ne change jamais la devise', () => {
    const { syncAccCurrency, cur } = setup(PEA, 'USD');
    syncAccCurrency('t', 'c', false);
    expect(cur.value).toBe('USD');
    expect(cur.disabled).toBe(false);
  });

  it('sur un compte existant, verrouille seulement si la devise est déjà celle du type', () => {
    const { syncAccCurrency, cur } = setup(PEA, 'EUR');
    syncAccCurrency('t', 'c', false);
    expect(cur.value).toBe('EUR');
    expect(cur.disabled).toBe(true);
  });

  it('déverrouille la devise pour un type libre', () => {
    const { syncAccCurrency, cur } = setup('__other__', 'USD');
    cur.disabled = true;
    syncAccCurrency('t', 'c', true);
    expect(cur.disabled).toBe(false);
    expect(cur.value).toBe('USD');
  });
});

describe('Modification d\'un compte', () => {
  let S, dom, toasts, api, saved;
  beforeEach(() => {
    S = { screen: 'dashboard', accounts: [{ id: 'a', name: 'Courtier', type: CTO, currency: 'EUR', icon: '📊', bank: '', holdings: [{ id: 'h1', ticker: 'BTC', type: 'Crypto', country: '' }], cashflows: [] }] };
    dom = makeDom();
    toasts = []; saved = 0;
    api = loadAccount(dom, { S, toast: m => toasts.push(m), accTotal: () => 0, saveAccounts: () => { saved++; }, refreshMain() {}, renderScreen() {} });
  });
  function submit(typeValue, name = 'Courtier') {
    api.openRenameAcc('a', name);
    dom.els['rename-acc-type'].value = typeValue;
    dom.els['rename-acc-currency'].value = 'EUR';
    dom.handlers['rename-acc-submit'].click();
  }

  it('refuse un type qui rendrait une position interdite, sans rien modifier', () => {
    submit(PEA, 'Nouveau nom');
    expect(toasts).toEqual(['Type incompatible avec : BTC']);
    expect(S.accounts[0].type).toBe(CTO);
    expect(S.accounts[0].name).toBe('Courtier');
    expect(saved).toBe(0);
  });

  it('accepte un type sans restriction', () => {
    submit('Compte courant', 'Nouveau nom');
    expect(S.accounts[0].type).toBe('Compte courant');
    expect(S.accounts[0].name).toBe('Nouveau nom');
    expect(saved).toBe(1);
  });

  it('laisse modifier un compte déjà non conforme tant que son type ne change pas', () => {
    S.accounts[0].type = PEA;
    submit(PEA, 'Renommé');
    expect(S.accounts[0].name).toBe('Renommé');
    expect(toasts).toEqual(['Compte mis à jour ✓']);
  });
});

describe('Ajout et modification d\'une position', () => {
  let S, dom, toasts, pos;
  const TYPES = ['Action', 'ETF', 'Obligation', 'Cash', 'Crypto'];
  beforeEach(() => {
    S = { screen: 'dashboard', accounts: [
      { id: 'pea', type: PEA, holdings: [] },
      { id: 'cto', type: CTO, holdings: [] },
      { id: 'cry', type: 'Crypto / Exchange', holdings: [] },
    ] };
    dom = makeDom();
    toasts = [];
    dom.document.getElementById('pos-type').options = opts(...TYPES);
    dom.document.getElementById('eh-type').options = opts(...TYPES);
    const rulesApi = loadAccount(dom);
    pos = loadClassic('js/modals/position.js', {
      globals: {
        document: dom.document, S, toast: m => toasts.push(m), registerModal() {},
        allowedAssetTypes: rulesApi.allowedAssetTypes, assetTypeError: rulesApi.assetTypeError,
        toRefCcy: v => v, accTotal: () => 0, renderHoldsHTML() {}, refreshMain() {}, renderScreen() {}, saveAccounts() {}, recalcHolding() {},
        SECURITIES_DB: {}, ISIN_MAP: {}, setSelectValue() {}, resolveTickerOnline: async () => null, resolveIsinOnline: async () => null,
      },
      exports: ['openPosModal', 'openEditHolding', '_applyAssetTypeRules'],
    });
  });
  function add(accId, { type, country = '', ticker = 'XYZ' }) {
    pos.openPosModal(accId);
    dom.els['pos-ticker'].value = ticker;
    dom.els['pos-qty'].value = '2'; dom.els['pos-pru'].value = '10';
    dom.els['pos-type'].value = type; dom.els['pos-country'].value = country;
    dom.els['pos-currency'].value = 'EUR'; dom.els['pos-sector'].value = 'Autre';
    dom.handlers['pos-submit'].click();
  }

  it('grise les types interdits à l\'ouverture et présélectionne le premier autorisé', () => {
    pos.openPosModal('cry');
    expect(dom.els['pos-type'].value).toBe('Crypto');
    expect(dom.els['pos-type'].options.filter(o => !o.disabled).map(o => o.value)).toEqual(['Crypto']);
    pos.openPosModal('pea');
    expect(dom.els['pos-type'].options.filter(o => o.disabled).map(o => o.value)).toEqual(['Obligation', 'Cash', 'Crypto']);
    expect(dom.els['pos-type'].value).toBe('Action');
  });

  it('refuse une crypto sur un PEA et une action sur un compte crypto', () => {
    add('pea', { type: 'Crypto' });
    add('cry', { type: 'Action', country: 'France' });
    expect(toasts).toEqual(['Crypto interdite sur ce type de compte', 'Action interdit sur ce type de compte']);
    expect(S.accounts.map(a => a.holdings.length)).toEqual([0, 0, 0]);
  });

  it('refuse une action de PEA hors Espace économique européen ou sans pays', () => {
    add('pea', { type: 'Action', country: 'États-Unis' });
    add('pea', { type: 'Action', country: '' });
    expect(toasts).toEqual(['PEA : actions européennes uniquement', 'PEA : indique le pays (France ou UE)']);
    expect(S.accounts[0].holdings).toHaveLength(0);
  });

  it('enregistre une action européenne sur un PEA et une crypto sur un compte crypto', () => {
    add('pea', { type: 'Action', country: 'France', ticker: 'MC' });
    add('cry', { type: 'Crypto', ticker: 'BTC' });
    expect(S.accounts[0].holdings.map(h => h.ticker)).toEqual(['MC']);
    expect(S.accounts[2].holdings.map(h => h.ticker)).toEqual(['BTC']);
  });

  function edit(accId, holdId, changes) {
    pos.openEditHolding(accId, holdId);
    Object.entries(changes).forEach(([id, v]) => { dom.els[id].value = v; });
    dom.els['eh-price'].value = '';
    dom.handlers['eh-submit'].click();
  }

  it('refuse un pays interdit en modification sans toucher au titre (ni au ticker)', () => {
    S.accounts[0].holdings.push({ id: 'h', ticker: 'MC', name: 'LVMH', type: 'Action', country: 'France', currency: 'EUR', sector: 'Luxe', transactions: [] });
    edit('pea', 'h', { 'eh-ticker': 'NEW', 'eh-country': 'États-Unis' });
    expect(toasts).toEqual(['PEA : actions européennes uniquement']);
    expect(S.accounts[0].holdings[0].ticker).toBe('MC');
    expect(S.accounts[0].holdings[0].country).toBe('France');
  });

  it('laisse modifier un titre déjà non conforme tant que son type et son pays ne changent pas', () => {
    S.accounts[0].holdings.push({ id: 'h', ticker: 'BTC', name: 'Bitcoin', type: 'Crypto', country: 'Inconnu', currency: 'USD', sector: 'Crypto', transactions: [] });
    edit('pea', 'h', { 'eh-name': 'Bitcoin renommé', 'eh-country': 'Inconnu' });
    expect(S.accounts[0].holdings[0].name).toBe('Bitcoin renommé');
    expect(toasts).toEqual(['BTC mis à jour ✓']);
  });

  it('conserve la valeur courante du type d\'un titre existant en grisant les types interdits', () => {
    S.accounts[0].holdings.push({ id: 'h', ticker: 'BTC', name: 'Bitcoin', type: 'Crypto', country: 'Inconnu', currency: 'USD', sector: 'Crypto', transactions: [] });
    pos.openEditHolding('pea', 'h');
    expect(dom.els['eh-type'].value).toBe('Crypto');
    expect(dom.els['eh-type'].options.find(o => o.value === 'Crypto').disabled).toBe(true);
  });
});
