import { beforeEach, describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const calc = loadClassic('js/features/dca-calc.js', { exports: ['dcaIsIsin', 'dcaResolveLine'] });
const ISIN_A = 'IE00B4L5Y983', ISIN_B = 'FR0000120073';
const line = (ticker, extra = {}) => ({ ticker, name: ticker, weight: 50, color: '#1', ...extra });

describe('dcaResolveIsins', () => {
  let S, toasts, saves, renders, resolver, api;
  // Un module neuf par test : la mémoire « déjà tenté » est propre à chaque test
  beforeEach(() => {
    S = { isDemo: false, screen: 'dca', dca: { plans: [{ from: '2024-01-01', budget: 100, day: 5, lines: [line(ISIN_A, { isin: ISIN_A, resolved: false }), line('MC')] }], goals: [] } };
    toasts = []; saves = 0; renders = [];
    resolver = async isin => ({ ticker: 'IWDA', name: 'iShares World', yahooSymbol: 'IWDA.AS', currency: 'EUR' });
    api = () => loadClassic('js/features/dca-isin.js', {
      globals: { ...calc, S, toast: m => toasts.push(m), saveDca() { saves++; }, renderScreen: id => renders.push(id), resolveIsinOnline: isin => resolver(isin) },
      exports: ['dcaResolveIsins'],
    });
  });

  it('résout un ISIN : ticker, nom, devise, symbole ; sauvegarde ; réaffiche l\'écran ; prévient', async () => {
    const r = await api().dcaResolveIsins();
    expect(r).toMatchObject({ resolved: 1, conflicts: 0, failed: 0, cancelled: false });
    expect(S.dca.plans[0].lines[0]).toMatchObject({ ticker: 'IWDA', name: 'iShares World', resolved: true, yahooSymbol: 'IWDA.AS', currency: 'EUR', isin: ISIN_A });
    expect(saves).toBe(1);
    expect(renders).toEqual(['dca']);
    expect(toasts.at(-1)).toBe('1 titre(s) reconnu(s) · 0 doublon(s) refusé(s) · 0 recherche(s) infructueuse(s)');
  });

  it('résout le même ISIN dans tous les plans de l\'historique', async () => {
    S.dca.plans.push({ from: '2025-01-01', budget: 100, day: 5, lines: [line(ISIN_A, { isin: ISIN_A, resolved: false })] });
    expect((await api().dcaResolveIsins()).resolved).toBe(2);
    expect(S.dca.plans.every(p => p.lines[0].ticker === 'IWDA')).toBe(true);
  });

  it('refuse un doublon : le titre résolu figure déjà dans le plan, la ligne est laissée telle quelle', async () => {
    resolver = async () => ({ ticker: 'MC', name: 'LVMH' });
    const r = await api().dcaResolveIsins();
    expect(r).toMatchObject({ resolved: 0, conflicts: 1 });
    expect(S.dca.plans[0].lines[0].ticker).toBe(ISIN_A);
    expect(saves).toBe(0);
    expect(toasts.at(-1)).toContain('1 doublon(s) refusé(s)');
  });

  it('compte un échec (erreur réseau ou réponse vide), sans rien modifier', async () => {
    resolver = async () => { throw new Error('réseau'); };
    expect(await api().dcaResolveIsins(true)).toMatchObject({ resolved: 0, failed: 1 });
    resolver = async () => null;
    expect(await api().dcaResolveIsins(true)).toMatchObject({ failed: 1 });
    resolver = async () => ({ ticker: '   ' });
    expect(await api().dcaResolveIsins(true)).toMatchObject({ failed: 1 });
    expect(S.dca.plans[0].lines[0].ticker).toBe(ISIN_A);
  });

  it('une seule tentative automatique par ISIN ; la synchronisation manuelle (force) retente', async () => {
    let calls = 0;
    resolver = async () => { calls++; return null; };
    const a = api();
    await a.dcaResolveIsins(); await a.dcaResolveIsins();
    expect(calls).toBe(1);
    await a.dcaResolveIsins(true);
    expect(calls).toBe(2);
  });

  it('rien à résoudre : silencieux en automatique, message en manuel', async () => {
    S.dca.plans[0].lines[0] = line('IWDA', { isin: ISIN_A, resolved: true });
    const a = api();
    await a.dcaResolveIsins();
    expect(toasts).toEqual([]);
    await a.dcaResolveIsins(true);
    expect(toasts).toEqual(['Aucun ISIN à résoudre']);
  });

  it('service de résolution absent : indisponible, message seulement en manuel', async () => {
    const a = loadClassic('js/features/dca-isin.js', { globals: { ...calc, S, toast: m => toasts.push(m), saveDca() {}, renderScreen() {} }, exports: ['dcaResolveIsins'] });
    expect(await a.dcaResolveIsins()).toMatchObject({ unavailable: true });
    expect(toasts).toEqual([]);
    await a.dcaResolveIsins(true);
    expect(toasts).toEqual(['Résolution en ligne indisponible']);
  });

  it('une résolution déjà en cours n\'est pas relancée', async () => {
    let release;
    resolver = () => new Promise(res => { release = () => res({ ticker: 'IWDA' }); });
    const a = api();
    const first = a.dcaResolveIsins();
    expect(await a.dcaResolveIsins(true)).toMatchObject({ pending: true });
    release();
    expect((await first).resolved).toBe(1);
  });

  it('bascule démo ↔ réel pendant la requête : la réponse tardive est ignorée, rien n\'est écrit', async () => {
    let release;
    resolver = () => new Promise(res => { release = () => res({ ticker: 'IWDA' }); });
    const a = api();
    const pending = a.dcaResolveIsins();
    S.isDemo = true; S.dca = { plans: [], goals: [] };   // bascule de mode : S.dca est remplacé
    release();
    const r = await pending;
    expect(r.cancelled).toBe(true);
    expect(saves).toBe(0);
    expect(S.dca.plans).toEqual([]);
  });

  it('l\'écran n\'est réaffiché que si l\'utilisateur est sur l\'écran DCA', async () => {
    S.screen = 'dashboard';
    await api().dcaResolveIsins();
    expect(renders).toEqual([]);
  });

  it('plusieurs ISIN : chacun est traité', async () => {
    S.dca.plans[0].lines = [line(ISIN_A, { isin: ISIN_A, resolved: false }), line(ISIN_B, { isin: ISIN_B, resolved: false })];
    resolver = async isin => ({ ticker: isin === ISIN_A ? 'IWDA' : 'AI' });
    expect(await api().dcaResolveIsins()).toMatchObject({ resolved: 2 });
    expect(S.dca.plans[0].lines.map(l => l.ticker)).toEqual(['IWDA', 'AI']);
  });
});
