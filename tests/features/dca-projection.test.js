import { describe, it, expect, vi } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

function fixture() {
  const S = { isDemo: false, privacy: false, accounts: [], watchlist: [], dca: { plans: [], goals: [] } };
  const store = new Map();
  const renderScreen = vi.fn(), toast = vi.fn();
  const api = loadClassic('js/features/dca.js', {
    globals: { S, renderScreen, toast, esc: String, fmtCur: String,
      masked: value => S.privacy ? 'MASQUE' : String(value),
      accTotal: account => account.total, accCash: account => account.cash || 0,
      localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
    },
    exports: ['dcaCapitalProjection', 'dcaProjectionSettings', 'dcaProjectionBase', 'dcaProjectionRows', 'renderDcaProjection', 'bindDcaProjection', 'renderDca', 'saveDca', 'loadDca'],
  });
  return { S, store, api, renderScreen, toast };
}

describe('Projection financière DCA', () => {
  it('additionne le capital et les versements à rendement nul', () => {
    const { api } = fixture();
    expect(api.dcaCapitalProjection(1000, 100, 0, 12).value).toBe(2200);
  });
  it('conserve le capital sans échéance future', () => {
    const { api } = fixture();
    expect(api.dcaCapitalProjection(1000, 100, 7, 0)).toEqual({ value: 1000, growth: 1, annuity: 0 });
  });
  it('applique un taux annuel effectif sans versements', () => {
    const { api } = fixture();
    expect(api.dcaCapitalProjection(1000, 0, 7, 12).value).toBeCloseTo(1070, 8);
  });
  it('préserve le taux nominal des objectifs existants', () => {
    const { api } = fixture();
    expect(api.dcaCapitalProjection(1000, 100, 12, 12, 'nominal').value).toBeCloseTo(1000 * 1.01 ** 12 + 100 * (1.01 ** 12 - 1) / 0.01, 8);
    expect(api.dcaCapitalProjection(1000, 0, 12, 12).value).toBeCloseTo(1120, 8);
  });
  it('gère un rendement négatif et un taux presque nul', () => {
    const { api } = fixture();
    expect(api.dcaCapitalProjection(1000, 0, -50, 12).value).toBeCloseTo(500, 8);
    expect(api.dcaCapitalProjection(1000, 100, 1e-12, 12).value).toBeCloseTo(2200, 7);
  });
  it.each([[1000, 100, -100, 12], [1000, 100, NaN, 12], [1000, 100, 7, -1], [1000, 100, 7, 1.5]])('refuse les paramètres invalides %j', (...args) => {
    const { api } = fixture();
    expect(() => api.dcaCapitalProjection(...args)).toThrow();
  });
  it('sépare le cash sans le compter deux fois et exclut les observateurs', () => {
    const { S, api } = fixture();
    S.accounts = [
      { total: 650, cash: 50, holdings: [{ type: 'Cash', value: 80, valueRef: 100 }, { type: 'Action', valueRef: 500 }] },
      { observer: true, total: 9999, cash: 9999, holdings: [] },
    ];
    expect(api.dcaProjectionBase()).toEqual({ total: 650, liquid: 150, risk: 500 });
  });
  it('produit six horizons et des scénarios distincts', () => {
    const { api } = fixture();
    const rows = api.dcaProjectionRows({ liquid: 100, risk: 900 }, 100, { rl: 2, rr: 7 });
    expect(rows.map(row => row.years)).toEqual([1, 3, 5, 10, 15, 20]);
    expect(rows[0].contributions).toBe(1200);
    expect(rows.every(row => row.prudent < row.central && row.central < row.optimistic)).toBe(true);
  });
  it('restaure les hypothèses séparément en réel et en démo', () => {
    const { S, api } = fixture();
    S.dca.projection = { rl: 1, rr: 4 }; api.saveDca();
    S.isDemo = true; api.loadDca();
    expect(api.dcaProjectionSettings()).toEqual({ rl: 2, rr: 7 });
    S.dca.projection = { rl: 3, rr: 8 }; api.saveDca();
    S.isDemo = false; api.loadDca();
    expect(api.dcaProjectionSettings()).toEqual({ rl: 1, rr: 4 });
    S.isDemo = true; api.loadDca();
    expect(api.dcaProjectionSettings()).toEqual({ rl: 3, rr: 8 });
  });
  it('remplace les hypothèses stockées invalides par les valeurs par défaut', () => {
    const { api } = fixture();
    expect(api.dcaProjectionSettings({ rl: Infinity, rr: -90 })).toEqual({ rl: 2, rr: 7 });
  });
  it('affiche la projection même sans plan et masque tous ses montants', () => {
    const { S, api } = fixture();
    S.accounts = [{ total: 12345, cash: 45, holdings: [] }];
    expect(api.renderDca()).toContain('Projection financière');
    expect(api.renderDcaProjection(null)).toContain('projection sans versements');
    S.privacy = true;
    const html = api.renderDcaProjection(null);
    expect(html).toContain('MASQUE');
    expect(html).not.toContain('12345');
  });
  it('ne projette pas les versements d’un plan qui n’a pas encore commencé', () => {
    const { S, api } = fixture();
    S.dca.plans = [{ from: '2999-01-01', day: 5, budget: 100, lines: [] }];
    expect(api.renderDca()).toContain('projection sans versements');
  });
  it('enregistre un changement valide et refuse une valeur hors limites', () => {
    const { S, store, api, renderScreen, toast } = fixture();
    let change;
    const input = { dataset: { dcaReturn: 'rr' }, value: '6,5', addEventListener: (event, fn) => { change = fn; } };
    api.bindDcaProjection({ querySelectorAll: () => [input] });
    change();
    expect(S.dca.projection).toEqual({ rl: 2, rr: 6.5 });
    expect(JSON.parse(store.get('patrimoine-dca-real')).projection.rr).toBe(6.5);
    expect(renderScreen).toHaveBeenCalledWith('dca');
    input.value = '51'; change();
    expect(S.dca.projection.rr).toBe(6.5);
    expect(toast).toHaveBeenCalledWith('Rendement entre -50 et 50 %');
  });
});
