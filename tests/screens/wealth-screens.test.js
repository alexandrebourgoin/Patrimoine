import { beforeEach, describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';

// Accueil et Analyse : mêmes agrégats (js/features/wealth.js), chargés pour de vrai.
const calc = loadClassic('js/features/realestate-calc.js', { exports: ['immoCalc'] });
const wealth = loadClassic('js/features/wealth.js', { globals: calc, exports: ['wealthBreakdown', 'analysisData'] });
const TODAY = '2026-11-22';

const prop = (over = {}) => ({ id: 'im1', name: 'Appart', kind: 'main', buyDate: '2025-09-11', price: 100000, notary: 0, works: 0, otherFees: 0, growth: 0, loan: { amount: 90000, rate: 0, years: 10, payment: 0, first: '' }, ...over });
const hold = (over = {}) => ({ ticker: 'MC', type: 'Action', country: 'France', sector: 'Luxe', value: 1000, valueRef: 1000, pnlRef: 100, avgBuyPrice: 100, quantity: 10, currency: 'EUR', ...over });

let S, props;
const globals = () => ({
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
  const render = () => loadClassic('js/screens/dashboard.js', { globals: globals(), exports: ['renderDash'] }).renderDash();

  it('affiche le patrimoine NET (comptes + immobilier − crédits)', () => {
    props = [prop()];
    const html = render();
    const net = wealth.wealthBreakdown(S.accounts, props, TODAY).net;
    expect(html).toContain('Patrimoine net');
    expect(html).toContain(net.toFixed(2) + ' €');
  });
  it('sans bien : le montant est celui des comptes, sans détail brut / crédits', () => {
    const html = render();
    expect(html).toContain('1000.00 €');
    expect(html.includes('Crédits immobiliers')).toBe(false);
  });
  it('avec un bien : brut, crédits et immobilier brut', () => {
    props = [prop()];
    const html = render();
    expect(html).toContain('Patrimoine brut');
    expect(html).toContain('Crédits immobiliers restants');
    expect(html).toContain('Dont immobilier brut');
    expect(html).toContain('1 bien immobilier');
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
