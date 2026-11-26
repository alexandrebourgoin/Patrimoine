import { beforeEach, describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic, fakeDocument } from '../helpers/load-classic.js';

// Modales de compte et de position avec les VRAIES règles (js/features/account-rules.js).
const rules = loadClassic('js/features/account-rules.js', {
  exports: ['ACCOUNT_TYPES', 'ACCOUNT_TYPE_GROUPS', 'accountRulesProblems', 'allowedAssetTypes', 'assetTypeError', 'accTypeViolations', 'accCurrencyForType', 'assetTypeOptions', 'accJointAllowed', 'accTypeLimitError', 'accTypeLimitProblems', 'accDefaultName'],
});
const cashPockets = loadClassic('js/features/cash-pockets.js', { globals: { PU: globalThis.PU }, exports: ['cfStampCcy'] });
const taxEnv = loadClassic('js/features/tax-envelope.js', { exports: ['TAX_ENVELOPES', 'taxEnvelopeProblems'] });
const accPerf = loadClassic('js/features/account-perf.js', { globals: { PU: globalThis.PU }, exports: ['accFlows'] });
const savings = loadClassic('js/features/savings.js', { globals: { ...taxEnv, ...accPerf },
  exports: ['SAVINGS_RATES', 'isSavingsType', 'isSavingsAccount', 'savingsRateInput', 'savingsOpeningFlows', 'savingsSummary', 'savingsCeiling', 'savingsDepositError'] });
const PEA = "Plan d'Épargne en Actions (PEA)", CTO = 'Compte-Titres Ordinaire';

const opts = (...values) => values.map(value => ({ value, disabled: false }));
function makeDom() {
  const els = {}, handlers = {}, base = fakeDocument();
  const get = id => (els[id] ??= {
    id, value: '', options: [], disabled: false, title: '', innerHTML: '', textContent: '', classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { (handlers[id] ??= {})[type] = fn; }, focus() {}, select() {},
  });
  return { els, handlers, document: { ...base, getElementById: get } };
}

describe('modale de compte : devise et type', () => {
  let S, dom, toasts, api, calls;
  const setup = (accounts = []) => {
    S = { currency: 'EUR', screen: 'comptes', accounts };
    dom = makeDom(); toasts = []; calls = { main: 0, saved: 0 };
    for (const id of ['acc-currency', 'rename-acc-currency']) dom.els[id] = { ...dom.document.getElementById(id), options: opts('EUR', 'USD', 'CHF', 'GBP', 'JPY') };
    api = loadClassic('js/modals/account.js', {
      globals: {
        ...rules, ...cashPockets, ...taxEnv, ...savings, S, document: dom.document, PU: globalThis.PU, esc: s => String(s), setAccIcon() {}, closeIconPicker() {}, toast: m => toasts.push(m),
        refreshMain() { calls.main++; }, saveAccounts() { calls.saved++; }, accTotal: () => 1, renderScreen() {}, _dayKey: () => '2026-11-24',
        registerModal() {}, openConfirm() {}, back() {}, go() {}, iconHtml: s => s,
      },
      exports: ['openAccModal', 'openRenameAcc', 'syncAccCurrency'],
    });
  };
  const chooseType = (selId, type) => { dom.els[selId].value = type; dom.els[selId].onchange(); };

  it('rappel de l enveloppe fiscale sous la date d ouverture, selon le type choisi', () => {
    setup(); api.openAccModal();
    expect(dom.els['acc-type-env'].textContent).toBe('');
    chooseType('acc-type', PEA);
    expect(dom.els['acc-type-env'].textContent).toMatch(/^PEA : fiscalité allégée après 5 ans, comptés depuis la date d'ouverture \(1er versement\) · plafond de versements 150.000 €\.$/);
    chooseType('acc-type', 'Livret A');
    expect(dom.els['acc-type-env'].textContent).toMatch(/^Livret A : plafond de versements 22.950 €\.$/);
  });
  it('création : par défaut compte-titres en euros, devise modifiable', () => {
    setup(); api.openAccModal();
    expect(dom.els['acc-currency'].value).toBe('EUR');
    expect(dom.els['acc-currency'].disabled).toBe(false);
  });
  it('création : choisir un PEA impose et verrouille l\'euro, même si une autre devise était sélectionnée', () => {
    setup(); api.openAccModal();
    dom.els['acc-currency'].value = 'USD';
    chooseType('acc-type', PEA);
    expect(dom.els['acc-currency'].value).toBe('EUR');
    expect(dom.els['acc-currency'].disabled).toBe(true);
    expect(dom.els['acc-currency'].title).toBe('Devise imposée par le type de compte');
  });
  it('création : Pilier 3a → francs suisses ; revenir à un compte-titres déverrouille', () => {
    setup(); api.openAccModal();
    chooseType('acc-type', 'Pilier 3a');
    expect(dom.els['acc-currency']).toMatchObject({ value: 'CHF', disabled: true });
    chooseType('acc-type', CTO);
    expect(dom.els['acc-currency']).toMatchObject({ value: 'EUR', disabled: false, title: '' });
  });
  it('création : types regroupés par catégorie, sans « Autre… » ni SCPI / métaux / compte courant / compte à terme', () => {
    setup(); api.openAccModal();
    const html = dom.els['acc-type'].innerHTML;
    expect([...html.matchAll(/<optgroup label="([^"]+)">/g)].map(m => m[1])).toEqual(['Bourse et crypto', 'Assurance-vie et retraite', 'Livrets et épargne logement']);
    for (const gone of ['Autre…', 'SCPI', 'Métaux', 'Compte courant', 'Compte à terme']) expect(html.includes(gone)).toBe(false);
    expect(html.indexOf('LDDS')).toBeGreaterThan(html.indexOf('Épargne disponible'));
  });
  it('modification d un compte d un type retiré : son type est conservé dans « Type actuel »', () => {
    setup([{ id: 'a1', name: 'SCPI', type: 'SCPI / Immobilier', currency: 'EUR', holdings: [], cashflows: [] }]);
    api.openRenameAcc('a1', 'SCPI');
    expect(dom.els['rename-acc-type'].innerHTML.startsWith('<optgroup label="Type actuel"><option value="SCPI / Immobilier">')).toBe(true);
    expect(dom.els['rename-acc-type'].value).toBe('SCPI / Immobilier');
  });
  it('modification : la devise du compte n\'est jamais changée par le type, et seulement verrouillée si elle est déjà imposée', () => {
    setup([{ id: 'a1', name: 'PEA', type: CTO, currency: 'USD', holdings: [], cashflows: [] }]);
    api.openRenameAcc('a1', 'PEA');
    chooseType('rename-acc-type', PEA);
    expect(dom.els['rename-acc-currency']).toMatchObject({ value: 'USD', disabled: false });
    dom.els['rename-acc-currency'].value = 'EUR';
    chooseType('rename-acc-type', PEA);
    expect(dom.els['rename-acc-currency'].disabled).toBe(true);
  });

  describe('modification d\'un compte : enregistrement', () => {
    const acc = (over = {}) => ({ id: 'a1', name: 'Mon compte', type: CTO, currency: 'EUR', holdings: [], cashflows: [], ...over });
    const edit = (a, { type = a.type, name = 'Mon compte', currency = a.currency, start = '' } = {}) => {
      setup([a]);
      api.openRenameAcc('a1', a.name);
      dom.els['rename-acc-input'].value = name;
      dom.els['rename-acc-type'].value = type;
      dom.els['rename-acc-currency'].value = currency;
      dom.els['rename-acc-start'].value = start;
      dom.handlers['rename-acc-submit'].click();
    };
    it('refuse un type qui rendrait interdites des positions existantes, sans rien modifier', () => {
      const a = acc({ holdings: [{ ticker: 'BTC', type: 'Crypto', country: '' }, { ticker: 'AAPL', type: 'Action', country: 'États-Unis' }] });
      edit(a, { type: PEA });
      expect(toasts.at(-1)).toBe('Type incompatible avec : BTC, AAPL');
      expect(a.type).toBe(CTO);
      expect(calls.saved).toBe(0);
    });
    it('accepte un type compatible', () => {
      const a = acc({ holdings: [{ ticker: 'MC', type: 'Action', country: 'France' }] });
      edit(a, { type: PEA });
      expect(a.type).toBe(PEA);
      expect(toasts.at(-1)).toBe('Compte mis à jour ✓');
    });
    it('un compte déjà non conforme reste modifiable tant que son type ne change pas', () => {
      const a = acc({ type: PEA, holdings: [{ ticker: 'BTC', type: 'Crypto', country: '' }] });
      edit(a, { name: 'Renommé' });
      expect(a.name).toBe('Renommé');
      expect(toasts.at(-1)).toBe('Compte mis à jour ✓');
    });
    it('enregistre la date d\'ouverture, la retire si le champ est vidé, refuse une date future', () => {
      const a = acc();
      edit(a, { start: '2022-05-15' });
      expect(a.startDate).toBe('2022-05-15');
      edit(a, { start: '' });
      expect(a.startDate).toBeUndefined();
      edit(a, { start: '2027-01-01' });
      expect(toasts.at(-1)).toBe("La date d'ouverture ne peut pas être dans le futur");
    });
    it('changer la devise du compte conserve la devise des anciens apports (migration avant le changement)', () => {
      const a = acc({ cashflows: [{ id: 'c1', date: '2024-01-01', type: 'DEP', amount: 1000 }, { id: 'c2', date: '2024-02-01', type: 'DEP', amount: 5, ccy: 'GBP' }] });
      edit(a, { currency: 'USD' });
      expect(a.currency).toBe('USD');
      expect(a.cashflows.map(c => c.ccy)).toEqual(['EUR', 'GBP']);
    });
  });

  describe('création d\'un compte : enregistrement', () => {
    it('enregistre le type, la devise imposée et la date d\'ouverture', () => {
      setup(); api.openAccModal();
      chooseType('acc-type', PEA);
      dom.els['acc-name'].value = 'Mon PEA'; dom.els['acc-start'].value = '2023-03-01';
      dom.handlers['acc-submit'].click();
      expect(S.accounts[0]).toMatchObject({ name: 'Mon PEA', type: PEA, currency: 'EUR', startDate: '2023-03-01' });
    });
    it('refuse une date d\'ouverture dans le futur', () => {
      setup(); api.openAccModal();
      dom.els['acc-name'].value = 'X'; dom.els['acc-start'].value = '2027-01-01';
      dom.handlers['acc-submit'].click();
      expect(S.accounts).toEqual([]);
      expect(toasts.at(-1)).toBe("La date d'ouverture ne peut pas être dans le futur");
    });
    it('sans nom : nom proposé selon le type et la banque, numéroté s il existe déjà', () => {
      setup([{ id: 'x', name: 'Compte-titres Boursorama', type: CTO, holdings: [], cashflows: [] }]); api.openAccModal();
      dom.els['acc-bank'].value = 'Boursorama';
      dom.handlers['acc-bank'].input();
      expect(dom.els['acc-name'].placeholder).toBe('Compte-titres Boursorama 2');
      dom.handlers['acc-submit'].click();
      expect(S.accounts[1].name).toBe('Compte-titres Boursorama 2');
    });
    it('un seul PEA et un seul Livret A : le second est refusé ; un compte observateur n est pas compté', () => {
      setup([{ id: 'p', name: 'PEA', type: PEA, holdings: [], cashflows: [] }]); api.openAccModal();
      chooseType('acc-type', PEA);
      dom.handlers['acc-submit'].click();
      expect(S.accounts).toHaveLength(1);
      expect(toasts.at(-1)).toBe(`Un seul compte « ${PEA} » par personne : tu en as déjà un`);
      dom.handlers['acc-obs-tog'].click();   // compte observateur (le PEA de quelqu'un d'autre)
      dom.handlers['acc-submit'].click();
      expect(S.accounts).toHaveLength(2);
    });
    it('PEA, livret : pas de part (compte joint impossible) ; compte-titres : part enregistrée', () => {
      setup(); api.openAccModal();
      chooseType('acc-type', PEA);
      dom.els['acc-share'].value = '50';
      dom.handlers['acc-submit'].click();
      expect('share' in S.accounts[0]).toBe(false);
      api.openAccModal();
      chooseType('acc-type', CTO);
      dom.els['acc-share'].value = '50';
      dom.handlers['acc-submit'].click();
      expect(S.accounts[1].share).toBe(50);
    });
    it('sans date : pas de champ startDate', () => {
      setup(); api.openAccModal();
      dom.els['acc-name'].value = 'X';
      dom.handlers['acc-submit'].click();
      expect('startDate' in S.accounts[0]).toBe(false);
    });
  });
});

describe('modale de position : types d\'actifs du compte', () => {
  let S, dom, toasts, api, acc;
  beforeEach(() => {
    acc = { id: 'a1', name: 'PEA', type: PEA, currency: 'EUR', holdings: [], value: 0 };
    S = { screen: 'comptes', accounts: [acc] };
    dom = makeDom(); toasts = [];
    const types = () => opts('Action', 'ETF', 'Obligation', 'Cash', 'Crypto');
    for (const id of ['pos-type', 'eh-type']) dom.els[id] = { ...dom.document.getElementById(id), options: types(), value: 'Action' };
    api = loadClassic('js/modals/position.js', {
      globals: {
        ...rules, S, document: dom.document, SECURITIES_DB: {}, toast: m => toasts.push(m), esc: s => String(s), toRefCcy: v => v, accTotal: () => 1,
        refreshMain() {}, saveAccounts() {}, recalcHolding() {}, renderHoldsHTML() {}, renderScreen() {}, registerModal() {}, fetchTickerPrice() {}, resolveTickerOnline: async () => null,
        resolveIsinOnline: async () => null, setSelectValue() {}, ISIN_MAP: {},
      },
      exports: ['openPosModal', 'openEditHolding'],
    });
  });
  const fill = ({ ticker = 'MC', type = 'Action', country = 'France' } = {}) => {
    api.openPosModal('a1');
    Object.assign(dom.els['pos-ticker'], { value: ticker }); dom.els['pos-qty'].value = '1'; dom.els['pos-pru'].value = '10';
    dom.els['pos-type'].value = type; dom.els['pos-country'].value = country; dom.els['pos-currency'].value = 'EUR'; dom.els['pos-sector'].value = 'Luxe';
    dom.handlers['pos-submit'].click();
  };

  it('à l\'ouverture sur un PEA : obligations, cash et crypto grisés', () => {
    api.openPosModal('a1');
    expect(dom.els['pos-type'].options.filter(o => o.disabled).map(o => o.value)).toEqual(['Obligation', 'Cash', 'Crypto']);
    expect(dom.els['pos-type'].value).toBe('Action');
  });
  it('sur un compte sans restriction : rien n\'est grisé', () => {
    acc.type = 'SCPI / Immobilier';
    api.openPosModal('a1');
    expect(dom.els['pos-type'].options.some(o => o.disabled)).toBe(false);
  });
  it('refuse une action américaine sur un PEA et une crypto, sans rien ajouter', () => {
    fill({ country: 'États-Unis' });
    expect(toasts.at(-1)).toBe('PEA : actions européennes uniquement');
    fill({ type: 'Crypto' });
    expect(toasts.at(-1)).toBe('Crypto interdite sur ce type de compte');
    expect(acc.holdings).toEqual([]);
  });
  it('un pays absent est refusé sur un PEA (« Inconnu » par défaut, jamais accepté en silence)', () => {
    fill({ country: '' });
    expect(toasts.at(-1)).toBe('PEA : indique le pays (France ou UE)');
    expect(acc.holdings).toEqual([]);
  });
  it('accepte une action française', () => {
    fill();
    expect(acc.holdings).toHaveLength(1);
    expect(toasts.at(-1)).toBe('MC ajouté ✓');
  });
  describe('modification d\'un titre', () => {
    const edit = (h, { type = h.type, country = h.country } = {}) => {
      acc.holdings = [h];
      api.openEditHolding('a1', h.id);
      dom.els['eh-type'].value = type; dom.els['eh-country'].value = country; dom.els['eh-sector'].value = 'Autre'; dom.els['eh-price'].value = '';
      dom.handlers['eh-submit'].click();
    };
    const hold = (over = {}) => ({ id: 'h1', ticker: 'MC', name: 'LVMH', type: 'Action', country: 'France', currency: 'EUR', sector: 'Luxe', currentPrice: 1, quantity: 1, transactions: [], ...over });
    it('à l\'ouverture, la valeur actuelle est conservée même si elle est interdite (titre ancien)', () => {
      acc.holdings = [hold({ type: 'Crypto' })];
      api.openEditHolding('a1', 'h1');
      expect(dom.els['eh-type'].value).toBe('Crypto');
      expect(dom.els['eh-type'].options.find(o => o.value === 'Crypto').disabled).toBe(true);
    });
    it('refuse de passer à une combinaison interdite', () => {
      const h = hold();
      edit(h, { country: 'Japon' });
      expect(toasts.at(-1)).toBe('PEA : actions européennes uniquement');
      expect(h.country).toBe('France');
    });
    it('un titre déjà non conforme reste modifiable tant que type et pays ne changent pas', () => {
      const h = hold({ type: 'Crypto', country: '' });
      edit(h);
      expect(h.name).toBe('LVMH');
      expect(toasts.some(m => /interdit/.test(m))).toBe(false);
      expect(h.type).toBe('Crypto');
    });
    it('accepte une modification conforme', () => {
      const h = hold();
      edit(h, { country: 'Allemagne' });
      expect(h.country).toBe('Allemagne');
    });
  });
});
