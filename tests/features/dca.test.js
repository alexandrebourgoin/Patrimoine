import { beforeEach, describe, expect, it } from 'vitest';
import { loadClassic, fakeDocument } from '../helpers/load-classic.js';

// Stockage, formulaires et écran DCA (js/features/dca.js), avec les VRAIS modules de calcul et de résolution.
const CALC = ['dcaYmd', 'dcaParseYmd', 'dcaValidYmd', 'dcaPlanAt', 'dcaOccurrences', 'dcaStats', 'dcaNormalizeWeights', 'dcaWeightsToAmounts',
  'dcaAmountsToWeights', 'dcaIsIsin', 'dcaResolveLine', 'dcaBuildLines', 'dcaPlanError', 'dcaGoalError', 'dcaCapitalProjection', 'dcaGoalCalc',
  'dcaDataError', 'dcaProjectionSettings', 'dcaProjectionBase', 'dcaProjectionRows', 'DCA_RETURN_MIN', 'DCA_RETURN_MAX'];
const calc = loadClassic('js/features/dca-calc.js', { exports: CALC });

// Corps de la modale : champs par sélecteur, lignes de répartition
function makeModal() {
  const fields = { '#dca-budget': { value: '' }, '#dca-day': { value: '5' }, '#dca-from': { value: '2026-11-24' }, '#dca-total': { textContent: '', style: {} },
    '#dg-name': { value: '' }, '#dg-target': { value: '' }, '#dg-date': { value: '' }, '#dg-start': { value: '' }, '#dg-rate': { value: '' } };
  const rows = [];
  const body = {
    innerHTML: '',
    querySelector: sel => fields[sel] || null,
    querySelectorAll: sel => (sel === '.dca-line' ? rows.map(r => ({ querySelector: s => r[s] })) : sel === '.dl-w' ? rows.map(r => r['.dl-w']) : []),
  };
  const setLines = list => { rows.length = 0; list.forEach(([t, w]) => rows.push({ '.dl-t': { value: t }, '.dl-w': { value: String(w) }, '.dl-c': { value: '#3B82F6' } })); };
  return { body, fields, rows, setLines };
}
function makeDom(modal) {
  const base = fakeDocument(), handlers = {};
  const el = id => (id === 'dca-modal-body' ? Object.assign(modal.body, { addEventListener(t, f) { (handlers[id] ??= {})[t] = f; } })
    : { classList: { add() {}, remove() {} }, addEventListener(t, f) { (handlers[id] ??= {})[t] = f; } });
  return { handlers, document: { ...base, getElementById: el } };
}
function memoryStorage() {
  const data = new Map();
  return { data, getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); } };
}
const click = target => ({ target: { closest: sel => (target[sel] ? target[sel] : null) } });

describe('DCA : stockage', () => {
  let S, storage, api, toasts;
  beforeEach(() => {
    S = { isDemo: false, currency: 'EUR', dca: { plans: [], goals: [] }, accounts: [], watchlist: [] };
    storage = memoryStorage(); toasts = [];
    api = () => loadClassic('js/features/dca.js', {
      globals: { ...calc, S, localStorage: storage, SCREEN_BIND: {}, toast: m => toasts.push(m), dcaResolveIsins() {}, esc: s => String(s), masked: v => String(v), accCash: () => 0, toRefCcy: v => v, fmtCur: v => String(v) },
      exports: ['loadDca', 'saveDca', 'dcaKey', 'dcaLoadError', 'dcaCommit', 'renderDca'],
    });
  });
  const plan = (over = {}) => ({ from: '2024-01-01', budget: 100, day: 5, lines: [{ ticker: 'MC', weight: 100, color: '#1' }], ...over });
  it('un slot par mode', () => {
    const a = api();
    expect(a.dcaKey()).toBe('patrimoine-dca-real');
    S.isDemo = true;
    expect(a.dcaKey()).toBe('patrimoine-dca-demo');
  });
  it('charge les plans triés par date d\'effet, les objectifs et les hypothèses de projection (validées)', () => {
    storage.setItem('patrimoine-dca-real', JSON.stringify({
      plans: [{ from: '2025-01-01', budget: 2, day: 1, lines: [{ ticker: 'MC', weight: 100 }] }, { from: '2024-01-01', budget: 1, day: 1, lines: [{ ticker: 'MC', weight: 100 }] }],
      goals: [{ id: 'g1', name: 'Apport', target: 100, date: '2030-01-01' }], projection: { rl: 3, rr: 999 },
    }));
    api().loadDca();
    expect(S.dca.plans.map(p => p.from)).toEqual(['2024-01-01', '2025-01-01']);
    expect(S.dca.goals).toHaveLength(1);
    expect(S.dca.projection).toEqual({ rl: 3, rr: 7 });   // 999 hors limites → défaut
  });
  describe('données illisibles : jamais écrasées', () => {
    const bad = [
      ['JSON corrompu', '{broken', 'JSON invalide'],
      ['plans qui n\'est pas une liste', JSON.stringify({ plans: {}, goals: [] }), 'liste des plans attendue'],
      ['plan sans budget', JSON.stringify({ plans: [{ from: '2024-01-01', day: 5, lines: [{ ticker: 'MC', weight: 100 }] }], goals: [] }), 'plan n°1 : budget invalide'],
      ['objectif sans date', JSON.stringify({ plans: [], goals: [{ id: 'g', name: 'x', target: 10 }] }), 'objectif n°1 : date cible invalide'],
      ['tableau à la racine', '[]', 'format inattendu'],
    ];
    it.each(bad)('%s : état vide, erreur mémorisée, donnée conservée', (_, raw, msg) => {
      storage.setItem('patrimoine-dca-real', raw);
      const a = api();
      a.loadDca();
      expect(S.dca).toEqual({ plans: [], goals: [] });
      expect(a.dcaLoadError()).toBe(msg);
      expect(storage.getItem('patrimoine-dca-real')).toBe(raw);
    });
    it('l\'enregistrement est refusé, prévient, et laisse la donnée d\'origine intacte', () => {
      storage.setItem('patrimoine-dca-real', '{broken');
      const a = api(); a.loadDca();
      S.dca.plans.push(plan());
      expect(a.saveDca()).toBe(false);
      expect(toasts.at(-1)).toBe('Enregistrement impossible : données DCA illisibles (JSON invalide)');
      expect(storage.getItem('patrimoine-dca-real')).toBe('{broken');
    });
    it('dcaCommit : refuse sans modifier l\'état (le plan n\'apparaît pas à l\'écran puis disparaît au rechargement)', () => {
      storage.setItem('patrimoine-dca-real', '{broken');
      const a = api(); a.loadDca();
      let called = false;
      expect(a.dcaCommit(() => { called = true; S.dca.plans.push(plan()); })).toBe(false);
      expect(called).toBe(false);
      expect(S.dca.plans).toEqual([]);
    });
    it('l\'écran affiche un bandeau d\'erreur (avec ou sans plan)', () => {
      storage.setItem('patrimoine-dca-real', '{broken');
      const a = api(); a.loadDca();
      expect(a.renderDca()).toContain('Données DCA illisibles : JSON invalide');
    });
    it('une donnée absente, nulle ou vide n\'est PAS une erreur', () => {
      const a = api();
      a.loadDca(); expect(a.dcaLoadError()).toBe('');
      storage.setItem('patrimoine-dca-real', 'null'); a.loadDca(); expect(a.dcaLoadError()).toBe('');
      storage.setItem('patrimoine-dca-real', '{}'); a.loadDca(); expect(a.dcaLoadError()).toBe('');
    });
    it('l\'erreur disparaît quand la donnée est effacée (Réglages → Réinitialiser) puis rechargée', () => {
      storage.setItem('patrimoine-dca-real', '{broken');
      const a = api(); a.loadDca();
      storage.removeItem('patrimoine-dca-real');
      a.loadDca();
      expect(a.dcaLoadError()).toBe('');
      expect(a.saveDca()).toBe(true);
    });
  });

  describe('écriture', () => {
    it('saveDca renvoie true et écrit', () => {
      S.dca.plans.push(plan());
      expect(api().saveDca()).toBe(true);
      expect(JSON.parse(storage.getItem('patrimoine-dca-real')).plans).toHaveLength(1);
    });
    it('quota plein : renvoie false et prévient (plus d\'échec silencieux)', () => {
      storage.setItem = () => { throw new Error('quota'); };
      expect(api().saveDca()).toBe(false);
      expect(toasts.at(-1)).toBe('Enregistrement impossible : quota');
    });
    it('dcaCommit : applique la modification et l\'enregistre', () => {
      const a = api(); a.loadDca();
      expect(a.dcaCommit(() => { S.dca.plans.push(plan()); })).toBe(true);
      expect(JSON.parse(storage.getItem('patrimoine-dca-real')).plans).toHaveLength(1);
    });
    it('dcaCommit : si l\'enregistrement échoue (quota), l\'état précédent est RESTAURÉ', () => {
      const a = api(); a.loadDca();
      S.dca.goals = [{ id: 'g1', name: 'x', target: 5, date: '2030-01-01' }];
      storage.setItem = () => { throw new Error('quota'); };
      expect(a.dcaCommit(() => { S.dca.plans.push(plan()); S.dca.goals = []; })).toBe(false);
      expect(S.dca.plans).toEqual([]);
      expect(S.dca.goals).toHaveLength(1);
    });
  });
  it('ancien slot unique : migré vers le mode courant puis supprimé, sans écraser un slot existant', () => {
    storage.setItem('patrimoine-dca', JSON.stringify({ plans: [{ from: '2024-01-01', budget: 5, day: 1, lines: [{ ticker: 'MC', weight: 100 }] }], goals: [] }));
    api().loadDca();
    expect(S.dca.plans).toHaveLength(1);
    expect(storage.getItem('patrimoine-dca')).toBeNull();
    storage.setItem('patrimoine-dca', JSON.stringify({ plans: [], goals: [{ id: 'x' }] }));
    api().loadDca();
    expect(S.dca.plans).toHaveLength(1);   // le slot du mode n'a pas été écrasé
  });
  it('saveDca écrit dans le slot du mode courant, projection comprise', () => {
    S.dca = { plans: [], goals: [], projection: { rl: 1, rr: 5 } };
    api().saveDca();
    expect(JSON.parse(storage.getItem('patrimoine-dca-real')).projection).toEqual({ rl: 1, rr: 5 });
  });
});

describe('DCA : formulaire du plan', () => {
  let S, dom, modal, toasts, calls, storage, api;
  beforeEach(() => {
    S = { isDemo: true, currency: 'EUR', privacy: false, screen: 'dca', dca: { plans: [], goals: [] }, accounts: [], watchlist: [] };
    modal = makeModal(); dom = makeDom(modal); toasts = []; calls = { render: 0, resolve: 0 }; storage = memoryStorage();
    api = loadClassic('js/features/dca.js', {
      globals: {
        ...calc, S, document: dom.document, localStorage: storage, SCREEN_BIND: {}, toast: m => toasts.push(m),
        SECURITIES_DB: { MC: { name: 'LVMH' }, AI: { name: 'Air Liquide' } }, ISIN_MAP: {}, esc: s => String(s), masked: v => String(v),
        renderScreen: () => { calls.render++; }, dcaResolveIsins() { calls.resolve++; }, openConfirm() {}, back() {}, toRefCcy: v => v, accCash: () => 0,
      },
      exports: ['openDcaPlanModal', 'saveDcaPlan', 'switchDcaMode', 'readDcaPlanForm'],
    });
  });
  const fill = ({ budget = '1000', day = '5', from = '2026-11-24', lines = [['MC', 50], ['AI', 50]] } = {}) => {
    api.openDcaPlanModal();
    modal.fields['#dca-budget'].value = budget; modal.fields['#dca-day'].value = day; modal.fields['#dca-from'].value = from;
    modal.setLines(lines);
  };

  it('ouvre un brouillon en pourcentages, 100 % sur une ligne vide quand il n\'y a pas de plan', () => {
    api.openDcaPlanModal();
    expect(modal.body.innerHTML).toContain('En %');
    expect(modal.body.innerHTML).toContain('Ticker ou ISIN');
  });

  it('enregistre un plan en % (poids normalisés à 100, noms issus de la base)', () => {
    fill(); api.saveDcaPlan();
    const [p] = S.dca.plans;
    expect(p).toMatchObject({ budget: 1000, day: 5, from: '2026-11-24' });
    expect(p.lines.map(l => [l.ticker, l.name, l.weight])).toEqual([['MC', 'LVMH', 50], ['AI', 'Air Liquide', 50]]);
    expect(toasts.at(-1)).toBe('Plan DCA enregistré ✓');
    expect(calls.render).toBe(1);
  });

  it('enregistre un plan saisi en montants : convertis en % (somme exactement 100), 3 × 33,33 € sur 100 € accepté', () => {
    fill({ budget: '100', lines: [['MC', 33.33], ['AI', 33.33], ['ZZZ', 33.33]] });
    modal.fields['#dca-budget'].value = '100';
    api.switchDcaMode('amt');   // pct → montants (convertit les valeurs saisies)
    modal.setLines([['MC', 33.33], ['AI', 33.33], ['ZZZ', 33.33]]);
    api.saveDcaPlan();
    const w = S.dca.plans[0].lines.map(l => l.weight);
    expect(w.reduce((s, v) => s + v, 0)).toBe(100);
    expect(toasts.at(-1)).toBe('Plan DCA enregistré ✓');
  });

  it.each([
    ['sans budget', { budget: '' }, 'Indique un budget mensuel'],
    ['jour invalide', { day: '40' }, 'Jour du mois entre 1 et 31'],
    ['jour vide (plus remplacé par 1 en silence)', { day: '' }, 'Jour du mois entre 1 et 31'],
    ['date invalide', { from: '2026-02-31' }, "Indique une date d'effet valide"],
    ['total ≠ 100 %', { lines: [['MC', 60], ['AI', 60]] }, 'Le total doit faire 100 %'],
    ['pourcentage vide (plus remplacé par 0 en silence)', { lines: [['MC', ''], ['AI', 100]] }, 'Répartition invalide'],
    ['titre en double', { lines: [['MC', 50], ['MC', 50]] }, 'Un titre apparaît deux fois'],
    ['ticker manquant', { lines: [['MC', 50], ['', 50]] }, 'Renseigne le ticker ou l’ISIN de chaque ligne'],
  ])('refuse : %s — rien n\'est enregistré', (_, over, msg) => {
    fill(over); api.saveDcaPlan();
    expect(toasts.at(-1)).toBe(msg);
    expect(S.dca.plans).toEqual([]);
  });

  it('même date d\'effet : remplace ; autre date : ajoute et conserve l\'historique', () => {
    fill(); api.saveDcaPlan();
    fill({ budget: '2000' }); api.saveDcaPlan();
    expect(S.dca.plans).toHaveLength(1);
    expect(S.dca.plans[0].budget).toBe(2000);
    fill({ from: '2027-01-01' }); api.saveDcaPlan();
    expect(S.dca.plans.map(p => p.from)).toEqual(['2026-11-24', '2027-01-01']);
  });

  it('résolution des ISIN lancée seulement en mode réel', () => {
    fill(); api.saveDcaPlan();
    expect(calls.resolve).toBe(0);
    S.isDemo = false;
    fill({ from: '2027-02-01' }); api.saveDcaPlan();
    expect(calls.resolve).toBe(1);
  });

  describe('bascule % ↔ montants', () => {
    it('sans budget valide : refusée, la saisie n\'est pas effacée', () => {
      fill({ budget: '' });
      api.switchDcaMode('amt');
      expect(toasts.at(-1)).toBe('Indique un budget mensuel avant de convertir');
      expect(modal.rows.map(r => r['.dl-w'].value)).toEqual(['50', '50']);
    });
    it('% → montants : valeurs converties dans le brouillon', () => {
      fill({ budget: '1000' });
      api.switchDcaMode('amt');
      api.readDcaPlanForm();   // relit le formulaire : le HTML est un faux, on vérifie le brouillon via le rendu
      expect(modal.body.innerHTML).toContain('En montant (EUR)');
      expect(modal.body.innerHTML).toContain('value="500"');
    });
    it('montants → % : retour au pourcentage', () => {
      fill({ budget: '1000' });
      api.switchDcaMode('amt');
      modal.setLines([['MC', 700], ['AI', 300]]);
      api.switchDcaMode('pct');
      expect(modal.body.innerHTML).toContain('value="70"');
    });
    it('montants ne totalisant pas le budget : conversion refusée avec le message', () => {
      fill({ budget: '1000' });
      api.switchDcaMode('amt');
      modal.setLines([['MC', 100], ['AI', 100]]);
      api.switchDcaMode('pct');
      expect(toasts.at(-1)).toBe('Le total des montants doit égaler le budget mensuel');
    });
  });
});

describe('DCA : écran et projection', () => {
  let S, dom, toasts, saves, renders, api;
  const today = () => {
    const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  beforeEach(() => {
    S = { isDemo: true, currency: 'EUR', privacy: false, screen: 'dca', accounts: [{ id: 'a', value: 10000, holdings: [{ type: 'Action', value: 10000 }] }], watchlist: [],
      dca: { plans: [{ from: '2020-01-01', budget: 500, day: 5, lines: [{ ticker: 'MC', name: 'LVMH', weight: 100, color: '#3B82F6' }] }], goals: [] } };
    dom = makeDom(makeModal()); toasts = []; saves = 0; renders = 0;
    api = loadClassic('js/features/dca.js', {
      globals: {
        ...calc, S, document: dom.document, localStorage: memoryStorage(), SCREEN_BIND: {}, toast: m => toasts.push(m), esc: s => String(s), masked: v => `${Math.round(v)}€`,
        fmtCur: v => `${v}€`, toRefCcy: v => v, accCash: () => 0, SECURITIES_DB: {}, renderScreen: () => { renders++; }, dcaResolveIsins() {}, openConfirm() {}, back() {},
      },
      exports: ['renderDca', 'bindDcaProjection', 'renderDcaProjection', 'SCREEN_BIND'],
    });
  });

  it('sans plan : invite à configurer, objectifs visibles ; la projection est dans l\'Analyse, plus ici', () => {
    S.dca.plans = [];
    const html = api.renderDca();
    expect(html).toContain('Aucun plan DCA');
    expect(html).not.toContain('Projection du patrimoine');
    const proj = api.renderDcaProjection(null);
    expect(proj).toContain('Aucun plan en vigueur : projection sans versements.');
    expect(proj).toContain('Créer un plan DCA →');
  });
  it('avec un plan : rythme, répartition, graphique, historique (sans projection)', () => {
    const html = api.renderDca();
    for (const t of ['Mon rythme', 'Prochaine répartition', 'Et dans 12 échéances ?', 'Historique des stratégies']) expect(html).toContain(t);
    expect(html).not.toContain('Projection du patrimoine');
  });
  it('projection : 6 horizons jusqu\'à 20 ans et lien vers le plan DCA', () => {
    const html = api.renderDcaProjection(S.dca.plans[0]);
    expect(html).toContain('Projection du patrimoine');
    expect((html.match(/class="dca-proj-row"/g) || [])).toHaveLength(6);
    expect(html).toContain('20 ans');
    expect(html).toContain('data-go-dca="1"');
    expect(html).toContain('Modifier le plan DCA →');
  });
  it('la projection porte sur le patrimoine FINANCIER (immobilier exclu, rappelé dans la note)', () => {
    const html = api.renderDcaProjection(S.dca.plans[0]);
    expect(html).toContain('Patrimoine financier actuel');
    expect(html).toContain('10000€');
    expect(html).toContain("l'immobilier sont exclus");
  });
  it('mode confidentialité : aucun montant de projection affiché', () => {
    S.privacy = true;
    const html = api.renderDcaProjection(S.dca.plans[0]);
    expect(html).toContain('● ● ●');
    expect(html).not.toMatch(/\d{2,3}\s?\d{3}\s€/);
  });
  it('bouton « Résoudre les ISIN » seulement s\'il reste un ISIN non résolu', () => {
    expect(api.renderDca().includes('js-dca-sync')).toBe(false);
    S.dca.plans[0].lines[0] = { ticker: 'IE00B4L5Y983', isin: 'IE00B4L5Y983', resolved: false, weight: 100, color: '#1' };
    expect(api.renderDca()).toContain('js-dca-sync');
  });
  it('objectifs : statut calculé par rapport à la date du jour', () => {
    S.dca.goals = [{ id: 'g1', name: 'Apport', target: 1000, date: `${new Date().getFullYear() + 5}-06-15`, start: 0, rate: 0 }];
    const html = api.renderDca();
    expect(html).toContain('Sur la bonne voie');
    expect(html).toContain('Apport');
  });

  describe('hypothèses de rendement', () => {
    const input = (key, value) => {
      let onChange; const attrs = { 'data-dca-return': key };
      const el = { dataset: { dcaReturn: key }, value, addEventListener: (_, f) => { onChange = f; } };
      api.bindDcaProjection({ querySelectorAll: () => [el] });
      return { el, change: () => onChange() };
    };
    it('une valeur valide est enregistrée avec les données DCA et l\'écran est redessiné', () => {
      const i = input('rr', '6,5'); i.change();
      expect(S.dca.projection).toEqual({ rl: 2, rr: 6.5 });
      expect(renders).toBe(1);
    });
    it.each([['150'], ['-51'], [''], ['abc']])('valeur invalide « %s » : refusée, champ remis à l\'ancienne valeur', v => {
      const i = input('rl', v); i.change();
      expect(S.dca.projection).toBeUndefined();
      expect(i.el.value).toBe(2);
      expect(toasts.at(-1)).toBe('Rendement entre -50 et 50 %');
    });
    it('les bornes −50 et 50 sont acceptées', () => {
      input('rl', '-50').change(); input('rr', '50').change();
      expect(S.dca.projection).toEqual({ rl: -50, rr: 50 });
    });
    it('une clé inconnue est ignorée', () => {
      input('zz', '5').change();
      expect(S.dca.projection).toBeUndefined();
    });
    it('les hypothèses enregistrées sont utilisées par la projection', () => {
      S.dca.projection = { rl: 1, rr: 5 };
      const html = api.renderDcaProjection(S.dca.plans[0]);
      expect(html).toContain('Liquidités : 1 %');
      expect(html).toContain('central 5 %');
      expect(html).toContain('prudent 2 %');
    });
  });

  it('le binding de l\'écran est enregistré dans SCREEN_BIND (plus de cas particulier dans renderScreen)', () => {
    expect(typeof api.SCREEN_BIND.dca).toBe('function');
  });
});
