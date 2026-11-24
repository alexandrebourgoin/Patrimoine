import { describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const D = loadClassic('js/features/dca-calc.js', {
  exports: ['dcaYmd', 'dcaParseYmd', 'dcaValidYmd', 'dcaPlanAt', 'dcaOccurrences', 'dcaStats', 'dcaNormalizeWeights', 'dcaWeightsToAmounts',
    'dcaAmountsToWeights', 'dcaIsIsin', 'dcaResolveLine', 'dcaBuildLines', 'dcaPlanError', 'dcaGoalError', 'dcaCapitalProjection', 'dcaGoalCalc',
    'dcaDataError', 'dcaProjectionSettings', 'dcaProjectionBase', 'dcaProjectionRows'],
});
const sum = a => a.reduce((s, v) => s + v, 0);

// Budget 100 €/mois le 5 à partir du 10/01/2024, puis 200 €/mois le 31 à partir du 01/04/2024.
const P0 = { from: '2024-01-10', budget: 100, day: 5, lines: [] };
const P1 = { from: '2024-04-01', budget: 200, day: 31, lines: [] };
const PLANS = [P0, P1];

describe('dates', () => {
  it('dcaYmd / dcaParseYmd : aller-retour en jour LOCAL', () => {
    expect(D.dcaYmd(new Date(2026, 10, 24, 23, 59))).toBe('2026-11-24');
    expect(D.dcaYmd(D.dcaParseYmd('2024-02-29'))).toBe('2024-02-29');
  });
  it('dcaValidYmd refuse les dates impossibles et les mauvais formats', () => {
    expect(D.dcaValidYmd('2024-02-29')).toBe(true);
    for (const bad of ['2025-02-29', '2024-13-01', '2024-4-1', '', undefined, 'demain']) expect(D.dcaValidYmd(bad), String(bad)).toBe(false);
  });
});

describe('dcaPlanAt', () => {
  it('renvoie le dernier plan dont la date d\'effet est passée', () => {
    expect(D.dcaPlanAt(PLANS, '2024-03-01')).toBe(P0);
    expect(D.dcaPlanAt(PLANS, '2024-04-01')).toBe(P1);
    expect(D.dcaPlanAt(PLANS, '2030-01-01')).toBe(P1);
  });
  it('null avant le premier plan', () => expect(D.dcaPlanAt(PLANS, '2023-12-31')).toBeNull());
});

describe('dcaOccurrences', () => {
  it('aucune échéance sans plan', () => expect(D.dcaOccurrences([], '2030-01-01')).toEqual([]));
  it('saute le mois de départ si le jour d\'échéance précède la date d\'effet', () => {
    expect(D.dcaOccurrences(PLANS, '2024-06-30')[0].date).toBe('2024-02-05');
  });
  it('change de stratégie à la date d\'effet du plan suivant, et cale le jour 31 sur la fin du mois', () => {
    const occ = D.dcaOccurrences(PLANS, '2024-06-30');
    expect(occ.map(o => o.date)).toEqual(['2024-02-05', '2024-03-05', '2024-04-30', '2024-05-31', '2024-06-30']);
    expect(occ.map(o => o.plan.budget)).toEqual([100, 100, 200, 200, 200]);
  });
  it('borne supérieure incluse, exclue le lendemain', () => {
    expect(D.dcaOccurrences(PLANS, '2024-06-30').at(-1).date).toBe('2024-06-30');
    expect(D.dcaOccurrences(PLANS, '2024-06-29').at(-1).date).toBe('2024-05-31');
  });
  it('février d\'une année non bissextile : jour 31 → 28', () => {
    expect(D.dcaOccurrences([{ from: '2025-01-01', budget: 50, day: 31, lines: [] }], '2025-03-01').map(o => o.date)).toEqual(['2025-01-31', '2025-02-28']);
  });
});

describe('dcaStats', () => {
  it('cumul théorique des échéances passées + 12 prochaines échéances projetées', () => {
    const st = D.dcaStats(PLANS, '2024-06-15');
    expect(st.today).toBe('2024-06-15');
    expect(st.cumul).toBe(100 + 100 + 200 + 200);
    expect(st.current).toBe(P1);
    expect(st.next.date).toBe('2024-06-30');
    expect(st.proj).toHaveLength(12);
    expect(st.proj[0]).toEqual({ date: '2024-06-30', budget: 200, cumul: 800 });
    expect(st.proj[11]).toEqual({ date: '2025-05-31', budget: 200, cumul: 3000 });
  });
  it('avant la première date d\'effet : plan courant = premier plan, cumul nul', () => {
    const st = D.dcaStats(PLANS, '2023-06-01');
    expect(st.cumul).toBe(0);
    expect(st.current).toBe(P0);
  });
  it('sans plan : tout est vide', () => {
    expect(D.dcaStats([], '2024-06-15')).toMatchObject({ cumul: 0, next: null, proj: [], current: null });
  });
});

describe('répartition : pourcentages', () => {
  it('somme exactement 100 après normalisation (l\'arrondi est absorbé par la plus grande part)', () => {
    const w = D.dcaNormalizeWeights([33.333, 33.333, 33.334]);
    expect(sum(w)).toBe(100);
  });
  it('accepte un total à 0,01 près, refuse au-delà', () => {
    expect(() => D.dcaNormalizeWeights([50, 49.995])).not.toThrow();
    expect(() => D.dcaNormalizeWeights([50, 49.98])).toThrow('Le total doit faire 100 %');
    expect(() => D.dcaNormalizeWeights([60, 60])).toThrow('Le total doit faire 100 %');
  });
  it.each([[[]], [[NaN, 100]], [[-10, 110]], [[Infinity]], [null]])('valeurs invalides %j', v => expect(() => D.dcaNormalizeWeights(v)).toThrow('Répartition invalide'));
});

describe('répartition : montants', () => {
  it('% → montants au centime', () => expect(D.dcaWeightsToAmounts([50, 45.2, 4.8], 1000)).toEqual([500, 452, 48]));
  it('montants → % : somme exactement 100', () => {
    expect(sum(D.dcaAmountsToWeights([500, 452, 48], 1000))).toBe(100);
    expect(D.dcaAmountsToWeights([500, 452, 48], 1000)).toEqual([50, 45.2, 4.8]);
  });
  it('3 × 33,33 € sur un budget de 100 € : valide (écart d\'un centime toléré), poids sommant 100', () => {
    const w = D.dcaAmountsToWeights([33.33, 33.33, 33.33], 100);
    expect(sum(w)).toBe(100);
    w.forEach(x => expect(x).toBeCloseTo(33.333, 2));
  });
  it('écart de plus d\'un centime refusé', () => {
    expect(() => D.dcaAmountsToWeights([33.33, 33.33, 33.31], 100)).toThrow('Le total des montants doit égaler le budget mensuel');
    expect(() => D.dcaAmountsToWeights([50, 60], 100)).toThrow('Le total des montants');
  });
  it('conversion aller-retour sans perte', () => {
    const w0 = [20, 30, 50], back = D.dcaAmountsToWeights(D.dcaWeightsToAmounts(w0, 777.77), 777.77);
    back.forEach((x, i) => expect(x).toBeCloseTo(w0[i], 1));
    expect(sum(back)).toBe(100);
  });
  it.each([[0], [-5], [NaN], [Infinity], [1e300]])('budget invalide %s', b => {
    expect(() => D.dcaWeightsToAmounts([100], b)).toThrow(RangeError);
    expect(() => D.dcaAmountsToWeights([100], b)).toThrow(RangeError);
  });
  it('montants invalides', () => expect(() => D.dcaAmountsToWeights([NaN, 100], 100)).toThrow('Répartition invalide'));
  it('tous les montants nuls : refusé (le total ne peut pas égaler le budget)', () => expect(() => D.dcaAmountsToWeights([0, 0], 100)).toThrow());
});

describe('ISIN', () => {
  it('format ISIN : 2 lettres, 9 alphanumériques, 1 chiffre', () => {
    expect(D.dcaIsIsin('IE00B4L5Y983')).toBe(true);
    for (const bad of ['MC', 'ie00b4l5y983', 'IE00B4L5Y98', 'IE00B4L5Y98X', '', null]) expect(D.dcaIsIsin(bad), String(bad)).toBe(false);
  });
  const lines = () => [{ ticker: 'IE00B4L5Y983', name: 'x', weight: 50, color: '#1' }, { ticker: 'MC', name: 'LVMH', weight: 50, color: '#2' }];
  it('dcaResolveLine remplace la ligne, marque résolu, garde nom / symbole / devise', () => {
    const r = D.dcaResolveLine(lines(), 0, { ticker: 'iwda', name: 'iShares', yahooSymbol: 'IWDA.AS', currency: 'EUR' });
    expect(r[0]).toMatchObject({ ticker: 'IWDA', name: 'iShares', resolved: true, yahooSymbol: 'IWDA.AS', currency: 'EUR', weight: 50 });
    expect(r[1].ticker).toBe('MC');
  });
  it('refuse un titre déjà présent dans le plan (jamais de doublon), sans modifier les lignes d\'origine', () => {
    const src = lines();
    expect(() => D.dcaResolveLine(src, 0, { ticker: 'MC' })).toThrow('Un titre apparaît deux fois après résolution');
    expect(src[0].ticker).toBe('IE00B4L5Y983');
  });
  it('erreurs : ligne introuvable, ticker vide', () => {
    expect(() => D.dcaResolveLine(lines(), 5, { ticker: 'X' })).toThrow('Ligne introuvable');
    expect(() => D.dcaResolveLine(lines(), 0, { ticker: '  ' })).toThrow('Ticker résolu invalide');
    expect(() => D.dcaResolveLine(lines(), 0, null)).toThrow('Ticker résolu invalide');
  });
});

describe('dcaBuildLines', () => {
  const ctx = (over = {}) => ({ plans: [], securities: { MC: { name: 'LVMH' } }, watchlist: [{ ticker: 'AIR', name: 'Airbus' }], isinMap: {}, ...over });
  it('nom depuis la base, puis les favoris, puis le ticker ; ticker en majuscules', () => {
    const l = D.dcaBuildLines([{ ticker: ' mc ', color: '#1' }, { ticker: 'air', color: '#2' }, { ticker: 'zzz', color: '#3' }], [40, 40, 20], ctx());
    expect(l.map(x => x.name)).toEqual(['LVMH', 'Airbus', 'ZZZ']);
    expect(l.map(x => x.ticker)).toEqual(['MC', 'AIR', 'ZZZ']);
    expect(l.map(x => x.weight)).toEqual([40, 40, 20]);
  });
  it('un ISIN absent de la table est conservé, à résoudre plus tard', () => {
    const l = D.dcaBuildLines([{ ticker: 'IE00B4L5Y983', color: '#1' }], [100], ctx());
    expect(l[0]).toMatchObject({ ticker: 'IE00B4L5Y983', isin: 'IE00B4L5Y983', resolved: false });
  });
  it('un ISIN connu de la table locale est remplacé par son ticker (table au format chaîne ou objet)', () => {
    const a = D.dcaBuildLines([{ ticker: 'IE00B4L5Y983', color: '#1' }], [100], ctx({ isinMap: { IE00B4L5Y983: 'IWDA' } }));
    expect(a[0]).toMatchObject({ ticker: 'IWDA', isin: 'IE00B4L5Y983', resolved: true });
    const b = D.dcaBuildLines([{ ticker: 'IE00B4L5Y983', color: '#1' }], [100], ctx({ isinMap: { IE00B4L5Y983: { ticker: 'IWDA', name: 'World' } } }));
    expect(b[0]).toMatchObject({ ticker: 'IWDA', name: 'World', resolved: true });
  });
  it('reprend l\'historique : un ISIN déjà résolu dans un ancien plan l\'est directement', () => {
    const history = [{ from: '2024-01-01', lines: [{ ticker: 'IWDA', isin: 'IE00B4L5Y983', resolved: true, name: 'World', yahooSymbol: 'IWDA.AS', currency: 'EUR' }] }];
    const l = D.dcaBuildLines([{ ticker: 'IE00B4L5Y983', color: '#1' }], [100], ctx({ plans: history }));
    expect(l[0]).toMatchObject({ ticker: 'IWDA', resolved: true });
  });
  it('un ISIN qui se résout vers un titre déjà dans le plan est refusé', () => {
    expect(() => D.dcaBuildLines([{ ticker: 'IE00B4L5Y983', color: '#1' }, { ticker: 'IWDA', color: '#2' }], [50, 50], ctx({ isinMap: { IE00B4L5Y983: 'IWDA' } })))
      .toThrow('Un titre apparaît deux fois après résolution');
  });
});

describe('validation des formulaires', () => {
  const ok = { budget: 500, day: 5, from: '2026-11-24', lines: [{ ticker: 'MC' }, { ticker: 'AI' }] };
  it('plan valide', () => expect(D.dcaPlanError(ok)).toBeNull());
  it.each([
    ['budget vide', { budget: NaN }, 'Indique un budget mensuel'], ['budget nul', { budget: 0 }, 'Indique un budget mensuel'],
    ['jour 0', { day: 0 }, 'Jour du mois entre 1 et 31'], ['jour 32', { day: 32 }, 'Jour du mois entre 1 et 31'], ['jour décimal', { day: 5.5 }, 'Jour du mois entre 1 et 31'],
    ['jour NaN (champ vide)', { day: NaN }, 'Jour du mois entre 1 et 31'],
    ['date vide', { from: '' }, "Indique une date d'effet valide"], ['31 février', { from: '2026-02-31' }, "Indique une date d'effet valide"],
    ['ticker vide', { lines: [{ ticker: 'MC' }, { ticker: '' }] }, 'Renseigne le ticker ou l’ISIN de chaque ligne'],
    ['doublon', { lines: [{ ticker: 'MC' }, { ticker: 'MC' }] }, 'Un titre apparaît deux fois'],
  ])('refuse : %s', (_, over, msg) => expect(D.dcaPlanError({ ...ok, ...over })).toBe(msg));

  const goal = { name: 'Apport', target: 1000, date: '2030-01-01' };
  it('objectif valide et erreurs', () => {
    expect(D.dcaGoalError(goal)).toBeNull();
    expect(D.dcaGoalError({ ...goal, name: '' })).toBe("Donne un nom à l'objectif");
    expect(D.dcaGoalError({ ...goal, target: NaN })).toBe('Indique un montant cible');
    expect(D.dcaGoalError({ ...goal, date: '' })).toBe('Indique une date cible valide');
  });
});

describe('dcaDataError : données enregistrées', () => {
  const plan = (over = {}) => ({ from: '2024-01-01', budget: 100, day: 5, lines: [{ ticker: 'MC', weight: 100, color: '#1' }], ...over });
  const goal = (over = {}) => ({ id: 'g1', name: 'Apport', target: 1000, date: '2030-01-01', start: 0, rate: 4, ...over });
  it('absent, null ou objet vide : valide', () => {
    for (const ok of [undefined, null, {}, { plans: [], goals: [] }]) expect(D.dcaDataError(ok)).toBeNull();
  });
  it('données complètes valides', () => expect(D.dcaDataError({ plans: [plan()], goals: [goal()], projection: { rl: 2, rr: 7 } })).toBeNull());
  it.each([
    ['chaîne', 'x', 'format inattendu'], ['tableau', [], 'format inattendu'],
    ['plans non liste', { plans: 'x' }, 'liste des plans attendue'], ['objectifs non liste', { goals: {} }, 'liste des objectifs attendue'],
    ['plan nul', { plans: [null] }, 'plan n°1 invalide'],
    ['date d\'effet impossible', { plans: [plan({ from: '2024-02-31' })] }, 'plan n°1 : date d\'effet invalide'],
    ['budget négatif', { plans: [plan({ budget: -1 })] }, 'plan n°1 : budget invalide'],
    ['budget texte', { plans: [plan({ budget: '100' })] }, 'plan n°1 : budget invalide'],
    ['jour 40', { plans: [plan({ day: 40 })] }, 'plan n°1 : jour invalide'],
    ['sans répartition', { plans: [plan({ lines: [] })] }, 'plan n°1 : répartition absente'],
    ['poids négatif', { plans: [plan({ lines: [{ ticker: 'MC', weight: -1 }] })] }, 'plan n°1 : ligne de répartition invalide'],
    ['ticker vide', { plans: [plan({ lines: [{ ticker: '', weight: 100 }] })] }, 'plan n°1 : ligne de répartition invalide'],
    ['second plan invalide', { plans: [plan(), plan({ budget: 0 })] }, 'plan n°2 : budget invalide'],
    ['objectif sans nom', { goals: [goal({ name: undefined })] }, 'objectif n°1 : identifiant ou nom invalide'],
    ['objectif cible nulle', { goals: [goal({ target: 0 })] }, 'objectif n°1 : montant cible invalide'],
    ['objectif date vide', { goals: [goal({ date: '' })] }, 'objectif n°1 : date cible invalide'],
    ['projection nulle', { projection: null }, 'hypothèses de projection invalides'],
  ])('refuse : %s', (_, data, msg) => expect(D.dcaDataError(data)).toBe(msg));
});

describe('dcaCapitalProjection', () => {
  it('taux nul : capital + versements', () => expect(D.dcaCapitalProjection(1000, 100, 0, 12).value).toBe(2200));
  it('effectif : 12 %/an sur un an sans versement = 1 120', () => expect(D.dcaCapitalProjection(1000, 0, 12, 12, 'effective').value).toBeCloseTo(1120, 8));
  it('nominal : 12 %/an = 1 %/mois, sur un an ≈ 1 126,83', () => expect(D.dcaCapitalProjection(1000, 0, 12, 12, 'nominal').value).toBeCloseTo(1126.8250, 3));
  it('versements de fin de mois : 100 €/mois à 12 % nominal sur un an ≈ 1 268,25', () => expect(D.dcaCapitalProjection(0, 100, 12, 12, 'nominal').value).toBeCloseTo(1268.2503, 3));
  it('0 mois : le capital, sans versement', () => expect(D.dcaCapitalProjection(500, 100, 7, 0).value).toBe(500));
  it('rendement négatif : le capital diminue', () => expect(D.dcaCapitalProjection(1000, 0, -10, 12).value).toBeCloseTo(900, 8));
  it('renvoie growth et annuity (utilisés pour le versement nécessaire)', () => {
    const r = D.dcaCapitalProjection(1000, 100, 0, 12);
    expect(r).toMatchObject({ growth: 1, annuity: 12 });
  });
  it('paramètres invalides', () => {
    expect(() => D.dcaCapitalProjection(NaN, 0, 0, 1)).toThrow(TypeError);
    expect(() => D.dcaCapitalProjection(1, 0, 0, 1.5)).toThrow(TypeError);
    expect(() => D.dcaCapitalProjection(1, 0, 0, -1)).toThrow(TypeError);
    expect(() => D.dcaCapitalProjection(1, 0, 0, 1, 'autre')).toThrow('Convention');
    expect(() => D.dcaCapitalProjection(1, 0, -100, 1)).toThrow(RangeError);
    expect(() => D.dcaCapitalProjection(1, 0, -1200, 1, 'nominal')).toThrow(RangeError);
  });
  it('résultat hors limites refusé', () => expect(() => D.dcaCapitalProjection(1e308, 1e308, 50, 12000)).toThrow(RangeError));
});

describe('dcaGoalCalc (aujourd\'hui = 15/01/2025)', () => {
  const T = '2025-01-15';
  it('sans rendement : versement mensuel nécessaire = reste / nb de mois', () => {
    const r = D.dcaGoalCalc({ date: '2026-01-15', target: 12000, start: 0, rate: 0 }, 100, T);
    expect(r).toMatchObject({ n: 12, proj: 1200, need: 1000, pct: 0, ok: false });
  });
  it('avec rendement : intérêts composés mensuels (12 %/an nominal = 1 %/mois)', () => {
    const r = D.dcaGoalCalc({ date: '2026-01-15', target: 2000, start: 1000, rate: 12 }, 0, T);
    expect(r.proj).toBeCloseTo(1126.83, 1);
    expect(r.pct).toBe(50);
  });
  it('versement nécessaire avec rendement : le projeté atteint exactement la cible', () => {
    const g = { date: '2030-01-15', target: 50000, start: 5000, rate: 5 };
    const r = D.dcaGoalCalc(g, 0, T);
    expect(D.dcaGoalCalc(g, r.need, T).proj).toBeCloseTo(50000, 4);
  });
  it('échéance dépassée : 0 mois, pas de versement nécessaire', () => {
    const r = D.dcaGoalCalc({ date: '2025-01-14', target: 5000, start: 300, rate: 0 }, 100, T);
    expect(r).toMatchObject({ n: 0, need: null, proj: 300 });
  });
  it('objectif déjà atteint : pct plafonné à 100 et ok = true', () => {
    expect(D.dcaGoalCalc({ date: '2026-01-15', target: 12000, start: 15000, rate: 0 }, 0, T)).toMatchObject({ pct: 100, ok: true });
  });
  it('capital déjà supérieur à la cible : versement nécessaire nul (jamais négatif)', () => {
    expect(D.dcaGoalCalc({ date: '2026-01-15', target: 100, start: 5000, rate: 0 }, 0, T).need).toBe(0);
  });
});

describe('projection du patrimoine', () => {
  it('réglages : défauts 2 % / 7 %, valeurs hors limites ou invalides écartées', () => {
    expect(D.dcaProjectionSettings(undefined)).toEqual({ rl: 2, rr: 7 });
    expect(D.dcaProjectionSettings({ rl: 1.5, rr: 6 })).toEqual({ rl: 1.5, rr: 6 });
    expect(D.dcaProjectionSettings({ rl: 51, rr: NaN })).toEqual({ rl: 2, rr: 7 });
    expect(D.dcaProjectionSettings({ rl: -50, rr: 50 })).toEqual({ rl: -50, rr: 50 });
  });
  const accs = [
    { value: 1000, observer: false, holdings: [{ type: 'Action', value: 600, valueRef: 600 }, { type: 'Cash', value: 100, valueRef: 100 }] },
    { value: 5000, observer: true, holdings: [] },
    { value: 400, observer: false, holdings: [] },
  ];
  it('base : comptes non observateurs ; liquidités = cash non investi + positions Cash ; le reste = autres actifs', () => {
    const base = D.dcaProjectionBase(accs, a => (a === accs[0] ? 300 : 0));
    expect(base).toEqual({ total: 1400, liquid: 400, risk: 1000 });
  });
  it('base : valeur non finie refusée', () => {
    expect(() => D.dcaProjectionBase([{ value: Infinity, holdings: [] }], () => 0)).toThrow('Valorisation financière invalide');
  });
  it('lignes : 6 horizons, versements = mensuel × mois, scénarios ordonnés prudent ≤ central ≤ optimiste', () => {
    const rows = D.dcaProjectionRows({ total: 11000, liquid: 1000, risk: 10000 }, 500, { rl: 2, rr: 7 });
    expect(rows.map(r => r.years)).toEqual([1, 3, 5, 10, 15, 20]);
    expect(rows[0].contributions).toBe(6000);
    for (const r of rows) { expect(r.prudent).toBeLessThan(r.central); expect(r.central).toBeLessThan(r.optimistic); }
    expect(rows[5].central).toBeGreaterThan(rows[0].central);
  });
  it('à rendement nul partout, le central vaut capital + versements', () => {
    const [r1] = D.dcaProjectionRows({ total: 1000, liquid: 400, risk: 600 }, 100, { rl: 0, rr: 0 });
    expect(r1.central).toBeCloseTo(1000 + 1200 + 0, 6);   // −3 / +3 points écartent prudent et optimiste
  });
  it('sans versement : le versement nul n\'ajoute rien', () => {
    const rows = D.dcaProjectionRows({ total: 1000, liquid: 0, risk: 1000 }, 0, { rl: 2, rr: 7 });
    expect(rows[0].contributions).toBe(0);
    expect(rows[0].central).toBeCloseTo(1070, 6);
  });
  it('budget invalide refusé', () => {
    expect(() => D.dcaProjectionRows({ total: 1, liquid: 0, risk: 1 }, -1, { rl: 2, rr: 7 })).toThrow(TypeError);
    expect(() => D.dcaProjectionRows({ total: 1, liquid: 0, risk: 1 }, NaN, { rl: 2, rr: 7 })).toThrow(TypeError);
  });
  it('le rendement prudent est borné à −50 %', () => {
    expect(() => D.dcaProjectionRows({ total: 1, liquid: 0, risk: 1 }, 0, { rl: 0, rr: -50 })).not.toThrow();
  });
});
