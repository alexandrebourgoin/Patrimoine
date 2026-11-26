import { beforeEach, describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';

// Blocs d'affichage de la performance sur l'écran du compte, avec les VRAIS modules de calcul.
const bench = loadClassic('js/features/benchmark.js', { exports: ['BENCHMARKS', 'accBenchmarkKey', 'benchNeedsFx', 'benchSeries', 'benchRet', 'benchCovers', '_benchTried'] });

const perf = loadClassic('js/features/account-perf.js', { globals: { PU: globalThis.PU }, exports: ['accFlows', 'accPerfInfo', 'accPerfSummary', 'accPerfPct', 'accValueOnDay'] });

describe('écran du compte : performance, poches, indice', () => {
  let S, store, hist, api, qty;
  const acc = (over = {}) => ({ currency: 'EUR', type: 'Compte-Titres', cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 1000 }], holdings: [], value: 1300, ...over });
  beforeEach(() => {
    S = { currency: 'EUR', privacy: false };
    store = new Map(); hist = {}; qty = 0;
    bench._benchTried && Object.keys(bench._benchTried).forEach(k => delete bench._benchTried[k]);
    api = loadClassic('js/screens/account.js', {
      globals: {
        ...bench, ...perf, S, PU: globalThis.PU, SCREEN_BIND: {}, FX_RATES: { EUR: 1, USD: 1.08 },
        localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
        masked: v => v.toFixed(2) + '€', maskedNative: (v, c) => `${v.toFixed(2)} ${c}`, esc: s => String(s), fmtDate: d => d, fmtPct: v => (v >= 0 ? '+' : '') + v.toFixed(2) + ' %', pctClass: v => globalThis.PU ? globalThis.PU.pctClass(v) : (v > 0 ? 't-gain' : v < 0 ? 't-loss' : ''),
        getHistorySeries: t => hist[t] || null, toRefCcy: (v, c) => v / ({ EUR: 1, USD: 1.08 }[c] || 1), _dayKey: () => '2026-06-30', _qtyOnDay: () => qty, accCash: () => 0,
      },
      exports: ['accPerfNow', 'accPerfPctNow', 'accPerfCardHTML', 'accCashDetailHTML', 'accBenchHTML', '_perfModeSet'],
    });
  });

  describe('accPerfNow / accPerfPctNow', () => {
    it('résume la performance du compte avec le contexte de l\'appli', () => {
      const { perf, sum } = api.accPerfNow(acc());
      expect(perf.net).toBe(1000);
      expect(sum.all.pct).toBeCloseTo(30, 8);
    });
    it('la liste des comptes affiche le même pourcentage que l\'écran, dans le mode mémorisé', () => {
      api._perfModeSet('all');
      expect(api.accPerfPctNow(acc())).toBeCloseTo(30, 8);
    });
    it('null sans apport', () => expect(api.accPerfPctNow(acc({ cashflows: [] }))).toBeNull());
  });

  describe('carte de performance', () => {
    const held = () => acc({ holdings: [{ ticker: 'X', currency: 'EUR', currentPrice: 100 }] });
    it('YTD par défaut, avec les boutons de bascule ; valeur au 31 décembre approximative sans historique de cours', () => {
      qty = 10;   // 10 titres détenus au 31/12 : valeur de départ 1 000 (cours actuel faute d'historique)
      const { perf, sum } = api.accPerfNow(held());
      const html = api.accPerfCardHTML(held(), perf, sum);
      expect(html).toContain('Performance YTD');
      expect(html).toContain('Depuis le 1er janvier');
      expect(html).toContain('approximatif');
      expect(html).toContain('+30.00 %');   // (1300 − 1000) / 1000
      expect(html).toContain('data-pm="all"');
    });
    it('YTD sans base de calcul : la carte et sa bascule restent, avec « — » (on peut revenir à l\'historique)', () => {
      const { perf, sum } = api.accPerfNow(acc());   // aucun titre détenu au 31/12, aucun flux depuis : base nulle
      const html = api.accPerfCardHTML(acc(), perf, sum);
      expect(html).toContain('Performance YTD');
      expect(html).toContain('—');
      expect(html).toContain('data-pm="all"');
    });
    it('historique : date de début et performance annuelle', () => {
      api._perfModeSet('all');
      const { perf, sum } = api.accPerfNow(acc());
      const html = api.accPerfCardHTML(acc(), perf, sum);
      expect(html).toContain('Performance historique');
      expect(html).toContain('Depuis le 2024-01-01');
      expect(html).toContain('/ an');
    });
    it('rien sans performance calculable', () => expect(api.accPerfCardHTML(acc(), null, null)).toBe(''));
  });

  describe('poches de liquidités et cumuls', () => {
    it('plusieurs devises : toutes les poches sont listées dans leur devise', () => {
      const a = acc({ cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 1000, ccy: 'EUR' }], holdings: [{ currency: 'USD', transactions: [{ date: '2024-02-01', type: 'BUY', qty: 10, price: 100 }] }] });
      const html = api.accCashDetailHTML(a, api.accPerfNow(a).perf);
      expect(html).toContain('Poches de liquidités');
      expect(html).toContain('1000.00 EUR');
      expect(html).toContain('-1000.00 USD');
    });
    it('une seule poche dans la devise du compte : pas de ligne de poches', () => {
      const html = api.accCashDetailHTML(acc(), api.accPerfNow(acc()).perf);
      expect(html.includes('Poches de liquidités')).toBe(false);
    });
    it('cumul des apports et retraits', () => {
      const a = acc({ cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 1000 }, { date: '2024-02-01', type: 'WIT', amount: 200 }] });
      const html = api.accCashDetailHTML(a, api.accPerfNow(a).perf);
      expect(html).toContain('Apports cumulés <b class="t-num">1000.00€');
      expect(html).toContain('Retraits cumulés <b class="t-num">200.00€');
    });
  });

  describe('comparaison à l\'indice', () => {
    const pea = () => acc({ type: "Plan d'Épargne en Actions (PEA)" });
    const render = a => { const { perf, sum } = api.accPerfNow(a); return api.accBenchHTML(a, perf, sum); };
    it('sans indice : simple puce « Comparer à un indice »', () => expect(render(acc())).toContain('Comparer à un indice'));
    it('indice par défaut selon le type de compte (PEA → CAC 40), chargement annoncé tant que la série manque', () => {
      const html = render(pea());
      expect(html).toContain('Indice : CAC 40');
      expect(html).toContain("chargement de l'indice…");
    });
    it('après un échec de téléchargement : « indice indisponible »', () => {
      bench._benchTried['CAC40|2024-01-01'] = true;
      expect(render(pea())).toContain('indice indisponible pour le moment');
    });
    it('série disponible : tableau compte / indice / écart en points', () => {
      hist['IDX:CAC40'] = { series: [{ d: '2024-01-01', c: 100 }, { d: '2025-12-31', c: 110 }, { d: '2026-06-30', c: 120 }] };
      const html = render(pea());
      expect(html).toContain('Écart');
      expect(html).toContain('+20.00 %');                // indice depuis le début
      expect(html).toContain('+30.00 %');                // compte depuis le début
      expect(html).toContain('+10.0 pts');
      expect(html).toContain('indice dans sa devise');
    });
    it('compte sans apport : invitation à en ajouter', () => {
      const a = pea(); a.cashflows = [];
      expect(render(a)).toContain('Ajoute un apport pour comparer');
    });
    it('série qui ne remonte pas jusqu\'au début : mention « disponible depuis le … seulement »', () => {
      bench._benchTried['CAC40|2024-01-01'] = true;
      hist['IDX:CAC40'] = { series: [{ d: '2025-06-01', c: 100 }, { d: '2026-06-30', c: 120 }] };
      expect(render(pea())).toContain('historique de l\'indice disponible depuis le 2025-06-01 seulement');
    });
  });
});
