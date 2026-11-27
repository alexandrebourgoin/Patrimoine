import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../utils.js';                         // expose globalThis.PU (comme dans le navigateur)
import { loadClassic } from '../helpers/load-classic.js';

const S = { isDemo: false, _histCache: {}, total: 0, wealth: [] };
const { sparkData, sparkSvg, donutSvg, genHistData, histSvg, _ptsFromRealSeries } =
  loadClassic('js/features/charts.js', {
    globals: {
      S, totalWealth: () => S.total, loadWealth: () => S.wealth,
      _dayKey: d => globalThis.PU.dayKey(d), fmtCur: v => String(v),
    },
    exports: ['sparkData', 'sparkSvg', 'donutSvg', 'genHistData', 'histSvg', '_ptsFromRealSeries'],
  });

// « Aujourd'hui » figé au 15/06/2024 (heure locale) : les fenêtres de dates sont donc déterministes.
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2024, 5, 15, 12));
  Object.assign(S, { isDemo: false, _histCache: {}, total: 150, wealth: [] });
});
afterEach(() => { vi.useRealTimers(); });

describe('genHistData — courbe d\'évolution du patrimoine', () => {
  it('série réelle : forward-fill jour par jour, début comblé, dernier point ancré sur la valeur live', () => {
    // fenêtre 1S = 09/06 → 15/06 ; snapshots le 10/06 (100) et le 13/06 (120)
    S.wealth = [{ d: '2024-06-10', v: 100 }, { d: '2024-06-13', v: 120 }];
    const pts = genHistData('1S');
    expect([...pts]).toEqual([100, 100, 100, 100, 120, 120, 150]);
    expect(pts.real).toBe(true);
  });
  it('reprend la dernière valeur connue AVANT la fenêtre', () => {
    S.wealth = [{ d: '2024-06-01', v: 80 }, { d: '2024-06-14', v: 90 }];
    expect([...genHistData('1S')]).toEqual([80, 80, 80, 80, 80, 90, 150]);
  });
  it('périodes : 1S=7, 1M=30, 3M=90, 1A=365 points ; période inconnue → 30', () => {
    S.wealth = [{ d: '2024-06-10', v: 100 }, { d: '2024-06-13', v: 120 }];
    expect(genHistData('1S')).toHaveLength(7);
    expect(genHistData('1M')).toHaveLength(30);
    expect(genHistData('3M')).toHaveLength(90);
    expect(genHistData('1A')).toHaveLength(365);
    expect(genHistData('???')).toHaveLength(30);
  });
  it('moins de 2 snapshots → repli synthétique (pas de drapeau « real »), ancré sur le total', () => {
    S.wealth = [{ d: '2024-06-10', v: 100 }];
    const pts = genHistData('1M');
    expect(pts).toHaveLength(30);
    expect(pts.real).toBeUndefined();
    expect(pts[29]).toBe(150);
  });
  it('mode démo : ignore le store réel (ne mélange pas total démo + points réels)', () => {
    S.isDemo = true;
    S.wealth = [{ d: '2024-06-10', v: 100 }, { d: '2024-06-13', v: 120 }];
    const pts = genHistData('1S');
    expect(pts.real).toBeUndefined();
    expect(pts[6]).toBe(150);
  });
  it('la courbe synthétique est mise en cache (stable d\'un rendu à l\'autre)', () => {
    const a = genHistData('3M');
    expect(genHistData('3M')).toBe(a);
  });
});

describe('_ptsFromRealSeries — forward-fill d\'une série de clôtures', () => {
  const start = new Date(2024, 5, 9);   // 09/06 00:00 local
  it('weekends/jours sans clôture = dernière clôture ; début comblé ; dernier point = cours live', () => {
    const hist = { series: [{ d: '2024-06-10', c: 10 }, { d: '2024-06-12', c: 12 }] };
    expect(_ptsFromRealSeries(hist, start, 5, 99)).toEqual([10, 10, 10, 12, 99]);
  });
  it('utilise la clôture précédant la fenêtre pour les premiers jours', () => {
    const hist = { series: [{ d: '2024-06-01', c: 5 }, { d: '2024-06-12', c: 12 }] };
    expect(_ptsFromRealSeries(hist, start, 5, 99)).toEqual([5, 5, 5, 12, 99]);
  });
});

describe('histSvg', () => {
  it('moins de 2 points → chaîne vide', () => {
    expect(histSvg([], 100, 50)).toBe('');
    expect(histSvg([1], 100, 50)).toBe('');
    expect(histSvg(null, 100, 50)).toBe('');
  });
  it('géométrie : marge 2 px, min en bas / max en haut, aire fermée sur le bas du graphique', () => {
    expect(histSvg([1, 2], 100, 50)).toContain('d="M2.0,48.0L98.0,2.0L98.0,50L2.0,50Z"');
  });
  it('couleur : gain si le dernier point ≥ le premier, perte sinon', () => {
    expect(histSvg([1, 2], 100, 50)).toContain('stroke="var(--gain)"');
    expect(histSvg([2, 1], 100, 50)).toContain('stroke="var(--loss)"');
  });
  it('série plate : pas de NaN (division par une amplitude nulle évitée)', () => {
    expect(histSvg([5, 5, 5], 100, 50)).not.toContain('NaN');
  });
});

describe('donutSvg', () => {
  it('une tranche par segment, avec sa couleur et son décalage cumulé', () => {
    const svg = donutSvg([{ value: 50, color: '#aaa' }, { value: 50, color: '#bbb' }]);
    expect(svg).toContain('stroke="#aaa"');
    expect(svg).toContain('stroke="#bbb"');
    expect(svg).toContain('stroke-dashoffset="-144.51"');      // 2e tranche : moitié de la circonférence 2π·46
  });
  it('tranche minuscule : stroke-dasharray jamais négatif (régression v1.11.89 : donut entier d\'une seule couleur)', () => {
    const svg = donutSvg([{ value: 0.0001, color: '#aaa' }, { value: 100, color: '#bbb' }]);
    expect(svg).not.toMatch(/stroke-dasharray="-/);
    expect(svg).toContain('stroke-dasharray="0.00 ');
  });
  it('total nul (compte sans titres) : pas de NaN', () => {
    expect(donutSvg([{ value: 0, color: '#aaa' }])).not.toContain('NaN');
  });
});

describe('sparkData / sparkSvg', () => {
  it('sparkData : n points (22 par défaut), commence ET finit à la valeur de base', () => {
    const d = sparkData(100);
    expect(d).toHaveLength(22);
    expect(d[0]).toBe(100);
    expect(d[21]).toBe(100);
    expect(sparkData(50, 10)).toHaveLength(10);
  });
  it('sparkSvg : vide sous 2 points ; aire en dégradé seulement si fill', () => {
    expect(sparkSvg([1], 80, 30)).toBe('');
    expect(sparkSvg([1, 2, 3], 80, 30)).toContain('linearGradient');
    expect(sparkSvg([1, 2, 3], 80, 30, '#f00', false)).not.toContain('linearGradient');
    expect(sparkSvg([1, 2, 3], 80, 30, '#f00')).toContain('stroke="#f00"');
  });
});

describe('graphique d\'un titre détenu : étiquettes lisibles', () => {
  const { stockChartSvg } = loadClassic('js/features/charts.js', {
    globals: { S, getHistorySeries: () => null, fmtNative: v => v.toFixed(2) + ' €' },
    exports: ['stockChartSvg'],
  });
  it('PRU annoté à gauche, cours actuel à droite : jamais superposés', () => {
    const h = { ticker: 'MC', currentPrice: 734.2, avgBuyPrice: 682.5, currency: 'EUR', transactions: [{ date: '2024-01-10', type: 'BUY', qty: 1, price: 680 }] };
    const svg = stockChartSvg(h, 360, 120, '1A');
    expect(svg).toMatch(/<text x="4" [^>]*text-anchor="start"[^>]*>PRU 682,50<\/text>/);
    expect(svg).toMatch(/<text x="356" [^>]*text-anchor="end"[^>]*>734\.20 €<\/text>/);
  });
});

describe('chartWidth — largeur d\'un graphique', () => {
  const widthFor = (innerWidth, margin) => loadClassic('js/features/charts.js', {
    globals: { S, window: { innerWidth } }, exports: ['chartWidth'],
  }).chartWidth(margin);

  it('téléphone : largeur de la fenêtre moins la marge ; grand écran : plafonné à 480', () => {
    expect(widthFor(375, 72)).toBe(303);
    expect(widthFor(375)).toBe(375);
    expect(widthFor(1024, 72)).toBe(408);
    expect(widthFor(1024)).toBe(480);
  });
  it('fenêtre pas encore dimensionnée (innerWidth = 0) : jamais de largeur négative ni nulle (régression « -72 »)', () => {
    expect(widthFor(0, 72)).toBe(160);
    expect(widthFor(0)).toBe(160);
    expect(widthFor(undefined, 72)).toBe(160);
    expect(widthFor(100, 72)).toBe(160);
  });
});
