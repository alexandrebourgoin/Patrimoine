import { describe, it, expect, beforeEach } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

// Le moteur reçoit S en argument ; seuls accCash et fmtPct sont des globales de l'appli (injectées ici).
const fmtPct = v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' %';
const GS = {}; // « S » global lu par assistantAlertCount()
const { analyzePortfolio, assistantAlertCount } = loadClassic('js/features/assistant.js', {
  globals: { S: GS, accCash: a => a.cash || 0, fmtPct },
  exports: ['analyzePortfolio', 'assistantAlertCount'],
});

// Une ligne : secteur et pays distincts par ticker (aucune règle de concentration ne se déclenche par hasard).
const mk = (ticker, val, o = {}) => ({
  id: 'h-' + ticker, ticker, name: ticker, valueRef: val,
  sector: 'S-' + ticker, country: 'C-' + ticker, currency: 'EUR', type: 'Action', pnlPct: 0, ...o,
});
const pf = (holdings, extra = {}) =>
  ({ currency: 'EUR', targets: {}, watchlist: [], accounts: [{ id: 'acc1', holdings }], ...extra });
// 6 lignes, total 102 : A = 29,4 % (≥ 25 → sévérité 3), B = 15,7 % (≥ 15 → sévérité 2), les autres 13,7 %.
const base = () => [mk('A', 30), mk('B', 16), mk('C', 14), mk('D', 14), mk('E', 14), mk('F', 14)];
const titles = r => r.map(x => x.title);

describe('analyzePortfolio — cas limites', () => {
  it('portefeuille vide ou sans valeur → aucune reco', () => {
    expect(analyzePortfolio(pf([]))).toEqual([]);
    expect(analyzePortfolio(pf([mk('Z', 0)]))).toEqual([]);
  });
  it('ignore les comptes « observateur » (hors patrimoine)', () => {
    const S = pf(base());
    S.accounts.unshift({ id: 'o', observer: true, holdings: [mk('BIG', 1000)] });
    expect(titles(analyzePortfolio(S))).toEqual(titles(analyzePortfolio(pf(base()))));
  });
});

describe('analyzePortfolio — concentration', () => {
  it('surexposition (≥ 25 %, sév. 3) et forte pondération (≥ 15 %, sév. 2), triées par sévérité', () => {
    const r = analyzePortfolio(pf(base()));
    expect(titles(r)).toEqual(['Surexposition : A', 'Forte pondération : B']);
    expect(r.map(x => x.sev)).toEqual([3, 2]);
    expect(r[0].detail).toContain('29 %');
  });
  it('lien vers la ligne (accId/holdId) quand le titre n\'est que dans un compte', () => {
    const [a] = analyzePortfolio(pf(base()));
    expect(a.accId).toBe('acc1');
    expect(a.holdId).toBe('h-A');
  });
  it('agrège un même ticker sur plusieurs comptes, sans lien direct', () => {
    const others = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'].map(t => mk(t, 10));
    const S = pf([mk('X', 15, { id: 'x1' }), ...others], {
      accounts: [
        { id: 'acc1', holdings: [mk('X', 15, { id: 'x1', sector: 'Tech', country: 'USA' }), ...others] },
        { id: 'acc2', holdings: [mk('X', 15, { id: 'x2', sector: 'Tech', country: 'USA' })] },
      ],
    });
    const r = analyzePortfolio(S);
    expect(titles(r)).toEqual(['Surexposition : X']);   // 15 + 15 = 30 % de 100
    expect('accId' in r[0]).toBe(false);
  });
  it('une seule ligne : surexposition + manque de diversification + secteur + zone', () => {
    const r = analyzePortfolio(pf([mk('X', 100)]));
    expect(titles(r)).toEqual([
      'Surexposition : X', 'Portefeuille peu diversifié',
      'Concentration sectorielle : S-X', 'Exposition géographique : C-X',
    ]);
    expect(r.map(x => x.sev)).toEqual([3, 2, 2, 1]);
  });
});

describe('analyzePortfolio — autres règles', () => {
  it('risque de change : ≥ 40 % hors devise de l\'appli', () => {
    const h = base(); h[0].currency = 'USD'; h[1].currency = 'USD';   // 46 / 102 = 45 %
    expect(titles(analyzePortfolio(pf(h)))).toContain('Exposition au risque de change');
  });
  it('forte moins-value (≤ -20 %) et belle plus-value (≥ +50 %), avec lien', () => {
    const h = base(); h[4].pnlPct = -25; h[5].pnlPct = 60;
    const r = analyzePortfolio(pf(h));
    const loss = r.find(x => x.title === 'Forte moins-value : E');
    const gain = r.find(x => x.title === 'Belle plus-value : F');
    expect(loss).toMatchObject({ sev: 2, accId: 'acc1', holdId: 'h-E' });
    expect(gain).toMatchObject({ sev: 1, accId: 'acc1', holdId: 'h-F' });
  });
  it('écart à l\'objectif d\'allocation ≥ 15 points (sur- et sous-pondéré)', () => {
    const r = analyzePortfolio(pf(base(), { targets: { Action: 60, ETF: 25 } }));
    expect(r.find(x => x.title === 'Allocation Action hors objectif').detail).toContain('surpondéré');
    expect(r.find(x => x.title === 'Allocation ETF hors objectif').detail).toContain('sous-pondéré');
  });
  it('liquidités importantes (≥ 15 % avec le cash non investi du compte)', () => {
    const S = pf(['A', 'B', 'C', 'D', 'E'].map(t => mk(t, 14)));     // 70 de titres
    S.accounts[0].cash = 30;                                          // + 30 de cash → 30 %
    expect(titles(analyzePortfolio(S))).toEqual(['Liquidités importantes']);
  });
  it('watchlist : mouvements ≥ 3 % du jour, 3 au maximum', () => {
    const S = pf(base(), { watchlist: [
      { ticker: 'T', name: 'Tesla', change1d: 5 }, { name: 'Calme', change1d: 1 },
      { ticker: 'N', name: 'Nvidia', change1d: -4 }, { name: 'W3', change1d: 3 }, { name: 'W4', change1d: -9 },
    ] });
    const suivi = analyzePortfolio(S).filter(x => x.title.startsWith('Suivi'));
    expect(titles(suivi)).toEqual([`Suivi : Tesla ${fmtPct(5)}`, `Suivi : Nvidia ${fmtPct(-4)}`, `Suivi : W3 ${fmtPct(3)}`]);
    expect(suivi.map(x => x.icon)).toEqual(['📈', '📉', '📈']);
  });
  it('trié par sévérité décroissante', () => {
    const h = base(); h[4].pnlPct = -25; h[5].pnlPct = 60;
    const sev = analyzePortfolio(pf(h, { targets: { Action: 60 } })).map(x => x.sev);
    expect(sev).toEqual([...sev].sort((a, b) => b - a));
  });
});

describe('assistantAlertCount (pastille ✨)', () => {
  beforeEach(() => { for (const k of Object.keys(GS)) delete GS[k]; });
  it('0 si l\'assistant est désactivé', () => {
    Object.assign(GS, pf(base()), { assistantEnabled: false });
    expect(assistantAlertCount()).toBe(0);
  });
  it('compte les recos de sévérité 3', () => {
    Object.assign(GS, pf(base()), { assistantEnabled: true });
    expect(assistantAlertCount()).toBe(1);   // Surexposition : A
  });
  it('0 plutôt qu\'une exception si les données sont inutilisables', () => {
    Object.assign(GS, { assistantEnabled: true, accounts: null });
    expect(assistantAlertCount()).toBe(0);
  });
});
