import { describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const R = loadClassic('js/features/account-rules.js', {
  exports: ['ACCOUNT_TYPES', 'ACC_TYPE_CCY', 'ACC_ASSET_TYPES', 'ACC_PEA_TYPES', 'PEA_COUNTRIES', 'accountRulesProblems', 'allowedAssetTypes',
    'assetTypeError', 'accTypeViolations', 'accCurrencyForType', 'assetTypeOptions'],
});
const PEA = "Plan d'Épargne en Actions (PEA)", CTO = 'Compte-Titres Ordinaire';

describe('cohérence des tables de règles', () => {
  it('toutes les clés sont des libellés EXACTS de ACCOUNT_TYPES (une faute de frappe ne désactive pas une règle en silence)', () => {
    const known = new Set(R.ACCOUNT_TYPES);
    [...Object.keys(R.ACC_TYPE_CCY), ...Object.keys(R.ACC_ASSET_TYPES), ...R.ACC_PEA_TYPES].forEach(l => expect(known.has(l), l).toBe(true));
    expect(R.accountRulesProblems()).toEqual([]);
  });
  it('accountRulesProblems détecte un libellé inconnu', () => {
    R.ACC_TYPE_CCY['Livret AA'] = ['EUR', true];   // faute de frappe simulée
    try {
      expect(R.accountRulesProblems()).toEqual(["ACC_TYPE_CCY : « Livret AA » n'est pas un type de compte connu"]);
    } finally { delete R.ACC_TYPE_CCY['Livret AA']; }
  });
  it('pas de doublon dans la liste des types', () => expect(new Set(R.ACCOUNT_TYPES).size).toBe(R.ACCOUNT_TYPES.length));
  it('les devises des règles sont des codes à 3 lettres ; un type imposé a toujours sa devise', () => {
    for (const [, [ccy]] of Object.entries(R.ACC_TYPE_CCY)) expect(ccy).toMatch(/^[A-Z]{3}$/);
  });
  it('impose l\'euro aux produits français réglementés et le franc suisse au Pilier 3a', () => {
    ['Livret A', 'LDDS', 'LEP', PEA, 'PEA-PME', "Plan d'Épargne Retraite (PER)"].forEach(t => expect(R.ACC_TYPE_CCY[t]).toEqual(['EUR', true]));
    expect(R.ACC_TYPE_CCY['Pilier 3a']).toEqual(['CHF', true]);
    expect(R.ACC_TYPE_CCY[CTO]).toEqual(['EUR', false]);
  });
});

describe('types d\'actifs autorisés', () => {
  const ok = (type, asset, country) => R.assetTypeError({ type }, asset, country) === '';
  it('limite un compte crypto aux cryptos', () => {
    expect(ok('Crypto / Exchange', 'Crypto')).toBe(true);
    expect(R.assetTypeError({ type: 'Crypto / Exchange' }, 'Action', 'France')).toBe('Action interdit sur ce type de compte');
  });
  it('interdit crypto, obligations et cash sur un PEA ; les ETF y sont acceptés', () => {
    expect(R.assetTypeError({ type: PEA }, 'Crypto')).toBe('Crypto interdite sur ce type de compte');
    expect(R.assetTypeError({ type: PEA }, 'Obligation')).toBe('Obligation interdit sur ce type de compte');
    expect(R.assetTypeError({ type: PEA }, 'Cash')).toBe('Cash interdit sur ce type de compte');
    expect(ok(PEA, 'ETF', 'Irlande')).toBe(true);
  });
  it('une action de PEA doit être européenne, sans tenir compte de la casse ni des espaces', () => {
    expect(ok(PEA, 'Action', 'France')).toBe(true);
    expect(ok(PEA, 'Action', '  ALLEMAGNE ')).toBe(true);
    expect(R.assetTypeError({ type: PEA }, 'Action', 'États-Unis')).toBe('PEA : actions européennes uniquement');
    expect(R.assetTypeError({ type: 'PEA-PME' }, 'Action', 'Japon')).toBe('PEA : actions européennes uniquement');
  });
  it('pays manquant ou « Inconnu » : demande de le préciser (jamais accepté en silence)', () => {
    for (const c of ['', '  ', undefined, null, 'Inconnu', 'inconnu']) expect(R.assetTypeError({ type: PEA }, 'Action', c), String(c)).toBe('PEA : indique le pays (France ou UE)');
  });
  it('le pays n\'est pas contrôlé hors PEA ni pour un ETF de PEA', () => {
    expect(ok(CTO, 'Action', 'États-Unis')).toBe(true);
    expect(ok(PEA, 'ETF', 'États-Unis')).toBe(true);
  });
  it('interdit la crypto sur un compte-titres, une assurance-vie, un PER et un Pilier 3a ; obligations acceptées', () => {
    [CTO, 'Assurance-Vie', "Plan d'Épargne Retraite (PER)", 'Pilier 3a'].forEach(t => {
      expect(R.assetTypeError({ type: t }, 'Crypto')).toBe('Crypto interdite sur ce type de compte');
      expect(ok(t, 'Obligation')).toBe(true);
    });
  });
  it('ne restreint ni les types hors table ni les types saisis librement ni l\'absence de compte', () => {
    expect(ok('SCPI / Immobilier', 'Crypto')).toBe(true);
    expect(ok('Mon compte perso', 'Crypto')).toBe(true);
    expect(R.assetTypeError(null, 'Crypto')).toBe('');
    expect(R.assetTypeError({}, 'Crypto')).toBe('');
  });
  it('allowedAssetTypes : liste ou null', () => {
    expect(R.allowedAssetTypes(PEA)).toEqual(['Action', 'ETF']);
    expect(R.allowedAssetTypes('SCPI / Immobilier')).toBeNull();
    expect(R.allowedAssetTypes(undefined)).toBeNull();
  });
  it('liste des pays éligibles : en minuscules, avec « europe » pour les fonds', () => {
    R.PEA_COUNTRIES.forEach(c => expect(c).toBe(c.toLowerCase()));
    expect(R.PEA_COUNTRIES).toContain('europe');
    expect(R.PEA_COUNTRIES).not.toContain('suisse');
    expect(R.PEA_COUNTRIES).not.toContain('royaume-uni');
  });
});

describe('accTypeViolations : changer de type', () => {
  const acc = { holdings: [{ ticker: 'BTC', type: 'Crypto', country: '' }, { ticker: 'MC', type: 'Action', country: 'France' }, { ticker: 'AAPL', type: 'Action', country: 'États-Unis' }] };
  it('liste les positions qui deviendraient interdites', () => {
    expect(R.accTypeViolations(acc, PEA).map(h => h.ticker)).toEqual(['BTC', 'AAPL']);
    expect(R.accTypeViolations(acc, CTO).map(h => h.ticker)).toEqual(['BTC']);
    expect(R.accTypeViolations(acc, 'Crypto / Exchange').map(h => h.ticker)).toEqual(['MC', 'AAPL']);
    expect(R.accTypeViolations(acc, 'SCPI / Immobilier')).toEqual([]);
  });
  it('compte sans position : aucune violation', () => expect(R.accTypeViolations({}, PEA)).toEqual([]));
});

describe('accCurrencyForType : devise selon le type', () => {
  const avail = ['EUR', 'USD', 'CHF', 'GBP'];
  it('création : impose et verrouille la devise d\'un PEA', () => expect(R.accCurrencyForType(PEA, 'USD', avail, true)).toEqual({ value: 'EUR', locked: true, reason: 'Devise imposée par le type de compte' }));
  it('création : propose seulement la devise par défaut d\'un compte-titres (modifiable)', () => expect(R.accCurrencyForType(CTO, 'USD', avail, true)).toEqual({ value: 'EUR', locked: false, reason: '' }));
  it('création : Pilier 3a en francs suisses', () => expect(R.accCurrencyForType('Pilier 3a', 'EUR', avail, true)).toMatchObject({ value: 'CHF', locked: true }));
  it('création : type libre ou hors table → devise inchangée, rien de verrouillé', () => {
    expect(R.accCurrencyForType('Mon compte', 'USD', avail, true)).toEqual({ value: 'USD', locked: false, reason: '' });
    expect(R.accCurrencyForType('Métaux précieux', 'GBP', avail, true)).toMatchObject({ value: 'GBP', locked: false });
  });
  it('création : la devise du type doit être proposée par le sélecteur, sinon elle est laissée', () => {
    expect(R.accCurrencyForType('Pilier 3a', 'EUR', ['EUR', 'USD'], true)).toMatchObject({ value: 'EUR', locked: false });
  });
  it('compte existant : la devise n\'est JAMAIS changée (elle convertit les apports déjà saisis)', () => {
    expect(R.accCurrencyForType(PEA, 'USD', avail, false)).toMatchObject({ value: 'USD', locked: false });
  });
  it('compte existant : verrouillé seulement si sa devise est déjà celle que le type impose', () => {
    expect(R.accCurrencyForType(PEA, 'EUR', avail, false)).toMatchObject({ value: 'EUR', locked: true });
  });
});

describe('assetTypeOptions : liste des types d\'actifs d\'un formulaire', () => {
  const all = ['Action', 'ETF', 'Obligation', 'Cash', 'Crypto'];
  it('PEA : obligations, cash et crypto grisés, valeur conservée si elle est autorisée', () => {
    expect(R.assetTypeOptions(PEA, all, 'ETF', false)).toEqual({ disabled: ['Obligation', 'Cash', 'Crypto'], value: 'ETF' });
  });
  it('valeur interdite : repli sur le premier type autorisé', () => expect(R.assetTypeOptions(PEA, all, 'Crypto', false).value).toBe('Action'));
  it('keepValue (titre existant) : la valeur courante n\'est pas modifiée même si elle est interdite', () => {
    expect(R.assetTypeOptions(PEA, all, 'Crypto', true)).toEqual({ disabled: ['Obligation', 'Cash', 'Crypto'], value: 'Crypto' });
  });
  it('compte crypto : tout sauf la crypto est grisé', () => expect(R.assetTypeOptions('Crypto / Exchange', all, 'Action', false)).toEqual({ disabled: ['Action', 'ETF', 'Obligation', 'Cash'], value: 'Crypto' }));
  it('type sans restriction : rien n\'est grisé', () => expect(R.assetTypeOptions('SCPI / Immobilier', all, 'Crypto', false)).toEqual({ disabled: [], value: 'Crypto' }));
});
