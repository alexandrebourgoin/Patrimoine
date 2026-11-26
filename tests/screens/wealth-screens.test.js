import { beforeEach, describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';
import { LOAN } from '../helpers/loan.js';

// Accueil et Analyse : mêmes agrégats (js/features/wealth.js), chargés pour de vrai.
const calc = loadClassic('js/features/realestate-calc.js', { globals: LOAN, exports: ['immoCalc'] });
const wealth = loadClassic('js/features/wealth.js', { globals: calc, exports: ['wealthBreakdown', 'analysisData'] });
const TODAY = '2026-11-22';
// Couleurs, segments et donut + légende : partagés par l'Analyse et l'Accueil (js/features/charts.js)
const charts = loadClassic('js/features/charts.js', {
  globals: { esc: s => globalThis.PU.esc(s), masked: v => v.toFixed(2) },
  exports: ['buildSegs', 'donutBlock', 'POCKET_C', 'ASSET_C', 'ACCTYPE_C', 'SEC_C'],
});

const prop = (over = {}) => ({ id: 'im1', name: 'Appart', kind: 'main', buyDate: '2025-09-11', price: 100000, notary: 0, works: 0, otherFees: 0, growth: 0, loan: { amount: 90000, rate: 0, years: 10, payment: 0, first: '' }, ...over });
const hold = (over = {}) => ({ ticker: 'MC', type: 'Action', country: 'France', sector: 'Luxe', value: 1000, valueRef: 1000, pnlRef: 100, avgBuyPrice: 100, quantity: 10, currency: 'EUR', ...over });

let S, props;
const globals = () => ({
  ...charts,
  S,
  imRead: () => props,
  _dayKey: () => TODAY,
  accCash: () => 0,
  wealthNow: () => wealth.wealthBreakdown(S.accounts, props, TODAY),
  analysisNow: () => wealth.analysisData(S.accounts, props, TODAY, () => 0),
  masked: v => v.toFixed(2), esc: s => globalThis.PU.esc(s), fmtCur: v => v.toFixed(2) + ' €', fmtPct: v => v.toFixed(2) + ' %',
  timeSince: () => 'à l\'instant', toRefCcy: v => v, sparkData: () => [1, 2], totalWealth: () => S.accounts.filter(a => !a.observer).reduce((s, a) => s + a.value, 0),
  renderTopBar: () => '<TOPBAR/>', genHistData: () => Object.assign([100, 110], { real: true }), histSvg: () => '<svg/>',
  donutSvg: () => '<svg/>', SCREEN_BIND: {}, renderDcaProjectionNow: () => '<PROJECTION/>',
});
beforeEach(() => {
  S = { privacy: false, lastPriceUpdate: null, targets: {}, watchlist: [], histPeriod: '1M', accounts: [{ id: 'a', name: 'PEA', type: 'Plan d\'Épargne en Actions (PEA)', value: 1000, change1d: 1, holdings: [hold()] }] };
  props = [];
});

describe('Analyse', () => {
  const render = () => loadClassic('js/screens/analysis.js', { globals: globals(), exports: ['renderAnalysis'] }).renderAnalysis();

  it('la synthèse vient APRÈS la barre du haut (et non plus injectée avant elle)', () => {
    props = [prop()];
    const html = render();
    expect(html.indexOf('<TOPBAR/>')).toBeGreaterThanOrEqual(0);
    expect(html.indexOf('<TOPBAR/>')).toBeLessThan(html.indexOf('Patrimoine net'));
  });
  it('une seule carte de synthèse, intitulée « Patrimoine net » ; plus de carte « Comptes financiers » affichant le net', () => {
    props = [prop()];
    const html = render();
    expect(html.match(/Patrimoine net/g)).toHaveLength(1);
    expect(html.includes('Comptes financiers</div>')).toBe(false);
  });
  it('avec un bien : brut, crédits restants, immobilier brut et comptes financiers sont affichés avec les bons montants', () => {
    props = [prop()];
    const html = render();
    expect(html).toContain('Patrimoine brut</span><span class="t-num">101000.00');
    expect(html).toContain('Crédits immobiliers restants</span><span class="t-num">');
    expect(html).toContain('Dont immobilier brut</span><span class="t-num">100000.00');
    expect(html).toContain('Dont comptes financiers</span><span class="t-num">1000.00');
    expect(html).toContain('1 bien immobilier');
  });
  it('sans bien : pas de lignes brut / crédits', () => {
    const html = render();
    expect(html.includes('Crédits immobiliers')).toBe(false);
    expect(html).toContain('Dont comptes financiers');
  });
  it('contient les répartitions et les objectifs repliés', () => {
    const html = render();
    for (const t of ['Grandes classes', "Par type d'actif", 'Par type de compte', 'Répartition géographique', 'Par secteur', "Objectifs d'allocation"])
      expect(html).toContain(t);
    expect(html).toContain('<details');
    expect(html).toContain('<PROJECTION/>');           // projection du patrimoine, déplacée depuis le DCA
    expect(html).not.toContain('DCA et projection');   // ancien lien supprimé
  });
  it('légende des donuts : le montant est sous le nom (aucune troncature de nom à cause du montant)', () => {
    const html = render();
    expect(html).toContain('class="leg-line"><span class="leg-name">Bourse</span>');
  });
  it('liste en barres : au plus 7 lignes + « Autres »', () => {
    S.accounts[0].holdings = Array.from({ length: 10 }, (_, i) => hold({ country: 'Pays' + i, valueRef: 100 - i }));
    S.accounts[0].value = 1000;
    const html = render();
    expect((html.match(/class="bar-name"/g) || []).length).toBeGreaterThanOrEqual(8);   // géographie : 7 + Autres (+ secteurs)
    expect(html).toContain('<span class="bar-name">Autres</span>');
  });
  it('patrimoine net négatif (crédits supérieurs aux actifs) : l\'analyse reste affichée, la classe négative est signalée', () => {
    props = [prop({ loan: { amount: 300000, rate: 2, years: 20, payment: 0, first: '' } })];
    const html = render();
    expect(html.includes('Aucune donnée</div>\n    </div>')).toBe(false);
    expect(html).toContain('Grandes classes');
    expect(html).toMatch(/Immobilier : -?−?\d.*net \(crédits supérieurs à la valeur\)/);
  });
  it('aucune donnée : message vide avec la barre du haut', () => {
    S.accounts = [];
    const html = render();
    expect(html).toContain('Aucune donnée');
    expect(html).toContain('<TOPBAR/>');
  });
  it('nom de compte / titre HTML échappé', () => {
    S.accounts[0].type = '<img onerror=x>';
    expect(render().includes('<img onerror=x>')).toBe(false);
  });
});

describe('Accueil', () => {
  // Lignes cliquables et bloc « À surveiller » : vrais modules (js/features/home-watch.js, js/screens/home-links.js)
  let HW;
  const links = () => {
    const hw = loadClassic('js/features/home-watch.js', { exports: ['HOME_WATCH', 'homeWatchItems'] });
    Object.assign(hw.HOME_WATCH, HW);
    return loadClassic('js/screens/home-links.js', { globals: { ...globals(), ...hw }, exports: ['homeWealthRowsHTML', 'homeWatchHTML', 'bindHomeLinks'] });
  };
  beforeEach(() => { HW = {}; });
  const render = () => loadClassic('js/screens/dashboard.js', { globals: { ...globals(), ...links() }, exports: ['renderDash'] }).renderDash();

  it('camembert des grandes classes d\'actifs (mêmes chiffres que l\'Analyse), qui ouvre l\'Analyse', () => {
    props = [prop()];
    const html = render();
    expect(html).toContain('Grandes classes d\'actifs');
    expect(html).toContain('id="js-pocket-card"');
    expect(html).toContain('<span class="leg-name">Bourse</span>');
    expect(html).toContain('<span class="leg-name">Immobilier</span>');   // immobilier net compris, comme l'Analyse
    expect(html.indexOf('Grandes classes')).toBeGreaterThan(html.indexOf('Patrimoine net'));
    expect(html.indexOf('Grandes classes')).toBeGreaterThan(html.indexOf('hist-card'));   // après l'évolution
  });
  it('sans aucune valeur : pas de camembert vide', () => {
    S.accounts = [];
    expect(render()).not.toContain('Grandes classes');
  });

  it('affiche le patrimoine NET (comptes + immobilier − crédits)', () => {
    props = [prop()];
    const html = render();
    const net = wealth.wealthBreakdown(S.accounts, props, TODAY).net;
    expect(html).toContain('Patrimoine net');
    expect(html).toContain(net.toFixed(2) + ' €');
  });
  it('sans bien : le montant est celui des comptes ; lignes Comptes / Immobilier / Autres crédits cliquables, pas de crédits immobiliers', () => {
    const html = render();
    expect(html).toContain('1000.00 €');
    expect(html.includes('Crédits immobiliers')).toBe(false);
    expect(html).toContain('data-wgo="comptes"');
    expect(html).toContain('data-wgo="immo"');
    expect(html).toContain('data-wgo="credits"');
  });
  it('avec un bien : comptes, immobilier (ma part) et crédits immobiliers, chacun vers son module', () => {
    props = [prop()];
    const html = render();
    expect(html).toMatch(/data-wgo="comptes"[^>]*><span>Comptes financiers<\/span><span class="t-num">1000.00/);
    expect(html).toMatch(/data-wgo="immo"[^>]*><span>Immobilier \(ma part\)<\/span><span class="t-num">100000.00/);
    expect(html).toMatch(/data-wgo="immo"[^>]*><span>Crédits immobiliers<\/span><span class="t-num">−/);
    expect(html).toContain('1 bien immobilier');
  });
  it('« À surveiller » : absent sans élément ; trié alerte > échéance proche > info ; une source en erreur est ignorée', () => {
    expect(render().includes('À surveiller')).toBe(false);
    HW = {
      a: () => [{ level: 'info', text: 'Info', go: 'dca' }],
      b: () => { throw new Error('panne'); },
      c: () => [{ level: 'soon', when: '2026-12-05', text: 'Échéance B', go: 'credits' }, { level: 'soon', when: '2026-12-01', text: 'Échéance A', go: 'immo' }],
      d: () => [{ level: 'alert', text: 'Alerte <b>', go: 'orders' }],
    };
    const html = render();
    expect(html).toContain('À surveiller');
    const order = ['Alerte &lt;b&gt;', 'Échéance A', 'Échéance B', 'Info'].map(t => html.indexOf(t));
    expect(order.every(i => i > 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    // ordre de l'accueil : patrimoine, évolution, puis « À surveiller »
    expect(html.indexOf('Patrimoine net')).toBeLessThan(html.indexOf('hist-card'));
    expect(html.indexOf('hist-card')).toBeLessThan(html.indexOf('À surveiller'));
  });
  it('toucher une ligne ou un élément ouvre son module ; un compte précis s ouvre directement', () => {
    HW = { t: () => [{ level: 'info', text: 'PEA 5 ans', go: 'account', accountId: 'a' }] };
    const calls = [];
    const L = loadClassic('js/screens/home-links.js', {
      globals: { ...globals(), ...(() => { const hw = loadClassic('js/features/home-watch.js', { exports: ['HOME_WATCH', 'homeWatchItems'] }); Object.assign(hw.HOME_WATCH, HW); return hw; })(),
        runShortcut: k => calls.push(['module', k]), go: k => calls.push(['go', k, S.accountId]) },
      exports: ['bindHomeLinks'],
    });
    const mk = data => { const o = { dataset: data, on: null, addEventListener: (t, f) => { o.on = f; } }; return o; };
    const rows = [mk({ wgo: 'immo' })], items = [mk({ hw: '0' })];
    L.bindHomeLinks({ querySelectorAll: sel => (sel === '[data-wgo]' ? rows : items) });
    S.accountId = null;
    rows[0].on(); items[0].on();
    expect(calls).toEqual([['module', 'immo'], ['go', 'account', 'a']]);
  });
  it('conserve la variation du jour et le P&L avec son pourcentage (rien de supprimé)', () => {
    const html = render();
    expect(html).toContain('▲ 1.00%');
    expect(html).toContain('P&amp;L des positions financières');
    expect(html).toMatch(/\(\+?\d+\.\d\d %\)/);
  });
  it('conserve la fraîcheur des cours quand elle est connue', () => {
    S.lastPriceUpdate = Date.now();
    expect(render()).toContain('Cours · à l\'instant');
  });
  it('mode confidentialité : le montant net n\'apparaît pas', () => {
    S.privacy = true;
    props = [prop()];
    const html = render();
    const net = wealth.wealthBreakdown(S.accounts, props, TODAY).net;
    expect(html.includes(net.toFixed(2))).toBe(false);
  });
  it('la courbe s\'intitule « Évolution du patrimoine » sans bien, « Évolution des comptes financiers » dès qu\'il y a un bien (elle est financière)', () => {
    expect(render()).toContain('Évolution du patrimoine');
    props = [prop()];
    const html = render();
    expect(html).toContain('Évolution des comptes financiers');
    expect(html.includes('Évolution du patrimoine')).toBe(false);
  });
});

describe('Comptes : liste lisible', () => {
  it('type abrégé (abréviation entre parenthèses), part du patrimoine légendée', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('js/screens/accounts.js', 'utf8');
    const { accTypeShort, accSubtitle } = loadClassic('js/screens/accounts.js', { globals: { SCREEN_BIND: {}, esc: s => String(s) }, exports: ['accTypeShort', 'accSubtitle'] });
    expect(accSubtitle({ name: 'PEA', type: "Plan d'Épargne en Actions (PEA)", bank: 'Boursorama', holdings: [1, 2] })).toBe('2 valeurs · Boursorama');
    expect(accSubtitle({ name: 'Mon épargne', type: 'Assurance-Vie', bank: '', holdings: [1] })).toBe('Assurance-Vie · 1 valeur');
    expect(accTypeShort("Plan d'Épargne en Actions (PEA)")).toBe('PEA');
    expect(accTypeShort('Assurance-Vie')).toBe('Assurance-Vie');
    expect(accTypeShort('')).toBe('');
    expect(src).toContain('% du patrimoine financier</span>');
  });
});
