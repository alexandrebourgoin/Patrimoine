import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadClassic } from '../helpers/load-classic.js';

const DAY = 24 * 3600 * 1000;
const NOW = Date.UTC(2026, 10, 24, 12, 0, 0);
const S = { currency: 'EUR', accounts: [], watchlist: [], isDemo: false };
const NAV_BADGES = {};
const SCREEN_BIND = {};
const prices = loadClassic('js/services/prices.js', {
  globals: { S, FX_RATES: { EUR: 1 }, dbgLog() {}, toast() {}, refreshMain() {} },
  exports: ['priceStale', 'staleHoldings', 'priceAgeLabel', 'quoteTime', 'validQuoteTime'],
});
const screen = loadClassic('js/screens/stale.js', {
  globals: {
    S, NAV_BADGES, SCREEN_BIND, staleHoldings: () => prices.staleHoldings(), priceAgeLabel: (t) => prices.priceAgeLabel(t),
    esc: v => String(v ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`),
    maskedNative: (v, c) => `${v} ${c}`, NAV_CATALOG: { stale: { label: 'Non synchro' } },
  },
  exports: ['renderStale'],
});
const h = (o = {}) => ({ id: 'h1', ticker: 'AIR.PA', name: 'Airbus', type: 'Action', quantity: 3, currentPrice: 150, currency: 'EUR', ...o });

afterEach(() => { vi.useRealTimers(); S.accounts = []; S.isDemo = false; });

describe('priceStale', () => {
  it('action : signalée au-delà de 4 jours, pas avant ni à la limite exacte', () => {
    expect(prices.priceStale(h({ quoteAt: NOW - 3.9 * DAY }), NOW)).toBe(false);
    expect(prices.priceStale(h({ quoteAt: NOW - 4 * DAY }), NOW)).toBe(false);
    expect(prices.priceStale(h({ quoteAt: NOW - 4 * DAY - 1 }), NOW)).toBe(true);
  });
  it('crypto : signalée au-delà de 24 h', () => {
    expect(prices.priceStale(h({ type: 'Crypto', quoteAt: NOW - 23 * 3600e3 }), NOW)).toBe(false);
    expect(prices.priceStale(h({ type: 'Crypto', quoteAt: NOW - 25 * 3600e3 }), NOW)).toBe(true);
  });
  it('la date de réception ne remplace pas la date de cotation', () => {
    expect(prices.priceStale(h({ priceAt: NOW, quoteAt: NOW - 6 * DAY }), NOW)).toBe(true);
    expect(prices.priceStale(h({ priceAt: NOW - 9 * DAY, quoteAt: NOW - DAY }), NOW)).toBe(false);
  });
  it('date de cotation absente, invalide ou future : signalée', () => {
    for (const q of [undefined, null, 0, NaN, Infinity, '1700000000000', NOW + DAY]) {
      expect(prices.priceStale(h({ quoteAt: q }), NOW)).toBe(true);
    }
  });
  it('jamais signalé : Cash, position soldée, mode démo, cours manuel', () => {
    expect(prices.priceStale(h({ type: 'Cash' }), NOW)).toBe(false);
    expect(prices.priceStale(h({ quantity: 0 }), NOW)).toBe(false);
    expect(prices.priceStale(h({ manualPrice: true }), NOW)).toBe(false);
    S.isDemo = true;
    expect(prices.priceStale(h(), NOW)).toBe(false);
  });
});

describe('quoteTime', () => {
  it('convertit des secondes Unix valides en millisecondes', () => {
    expect(prices.quoteTime(1700000000)).toBe(1700000000000);
  });
  it('refuse les valeurs absentes, non numériques ou futures', () => {
    for (const v of [undefined, null, '1700000000', NaN, 0, Date.now() / 1000 + 86400]) {
      expect(prices.quoteTime(v)).toBeNull();
    }
  });
});

describe('staleHoldings et priceAgeLabel', () => {
  it('liste tous les comptes, la plus ancienne en premier, date inconnue en tête', () => {
    S.accounts = [
      { id: 'a', holdings: [h({ id: 'x', quoteAt: NOW - 5 * DAY }), h({ id: 'ok', quoteAt: NOW }), h({ id: 'u' })] },
      { id: 'b', observer: true, holdings: [h({ id: 'y', quoteAt: NOW - 9 * DAY })] },
    ];
    expect(prices.staleHoldings(NOW).map(r => r.h.id)).toEqual(['u', 'y', 'x']);
  });
  it('libellés d\'âge', () => {
    expect(prices.priceAgeLabel(undefined, NOW)).toBe('Date de cotation inconnue');
    expect(prices.priceAgeLabel(NOW + DAY, NOW)).toBe('Date de cotation inconnue');
    expect(prices.priceAgeLabel(NOW - 5 * 60e3, NOW)).toBe('il y a 5 min');
    expect(prices.priceAgeLabel(NOW - 30 * 3600e3, NOW)).toBe('il y a 30 h');
    expect(prices.priceAgeLabel(NOW - 5 * DAY, NOW)).toBe('il y a 5 j');
  });
});

describe('écran « Non synchro »', () => {
  it('enregistre sa pastille et son binding', () => {
    expect(typeof NAV_BADGES.stale).toBe('function');
    expect(typeof SCREEN_BIND.stale).toBe('function');
  });
  it('liste les positions concernées avec l\'âge de la cotation, échappées', () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    S.accounts = [{ id: 'a', name: 'PEA <b>', holdings: [h({ quoteAt: NOW - 6 * DAY })] }];
    const html = screen.renderStale();
    expect(html).toContain('<div class="t-title">Non synchro</div>');
    expect(html).toContain('il y a 6 j');
    expect(html).toContain('PEA &#60;b&#62;');
    expect(NAV_BADGES.stale()).toBe(1);
  });
  it('vide : message « à jour », ou « indisponible » en démo', () => {
    expect(screen.renderStale()).toContain('Tous les cours sont à jour');
    S.isDemo = true;
    expect(screen.renderStale()).toContain('Indisponible en mode démo');
  });
});

describe('raccordement', () => {
  const html = readFileSync('mon-patrimoine.html', 'utf8');
  it('écran déclaré, script chargé après shell.js et prices.js, précaché', () => {
    expect(html).toContain('<div id="s-stale"');
    const i = html.indexOf('js/screens/stale.js');
    expect(i).toBeGreaterThan(html.indexOf('js/core/shell.js'));
    expect(i).toBeGreaterThan(html.indexOf('js/services/prices.js'));
    expect(readFileSync('sw.js', 'utf8')).toContain("'./js/screens/stale.js'");
  });
  it('le cache local (applyPrices) ne rafraîchit ni priceAt ni quoteAt', () => {
    const src = readFileSync('js/services/prices.js', 'utf8');
    const apply = src.slice(src.indexOf('function applyPrices'), src.indexOf('function applyPrices') + 400);
    expect(apply).not.toContain('priceAt');
    expect(apply).not.toContain('quoteAt');
    expect((src.match(/priceAt ?= ?Date\.now\(\)/g) || []).length).toBe(3);
    expect((src.match(/quoteAt ?= ?quote(Time\(|At)/g) || []).length).toBe(3);
  });
  it('écran Compte : la ligne d\'une position non synchro est marquée « ⚠ cours obsolète »', () => {
    const src = readFileSync('js/screens/account.js', 'utf8');
    expect(src).toContain('const stale   = priceStale(h);');
    expect(src).toContain("⚠ cours obsolète");
  });
});

describe('cours saisi à la main (h.manualPrice)', () => {
  const S2 = { currency: 'EUR', accounts: [], watchlist: [], isDemo: false };
  const recalc = vi.fn();
  const p2 = loadClassic('js/services/prices.js', {
    globals: { S: S2, FX_RATES: { EUR: 1 }, dbgLog() {}, toast() {}, refreshMain() {}, recalcHolding: recalc, accTotal: () => 0 },
    exports: ['applyPrices', 'isManualPrice', 'priceStale'],
  });
  it('n\'est jamais signalé « Non synchro », même sans date de cotation', () => {
    expect(p2.isManualPrice(h({ manualPrice: true }))).toBe(true);
    expect(p2.isManualPrice(h())).toBe(false);
    expect(p2.priceStale(h({ manualPrice: true }), NOW)).toBe(false);
  });
  it('le cache local (applyPrices) ne remplace pas un cours saisi à la main', () => {
    const manual = h({ id: 'm', manualPrice: true, currentPrice: 99 });
    const live = h({ id: 'l', currentPrice: 99 });
    S2.accounts = [{ id: 'a', holdings: [manual, live] }];
    p2.applyPrices({ prices: { 'AIR.PA': 150 }, updatedAt: NOW });
    expect(manual.currentPrice).toBe(99);
    expect(live.currentPrice).toBe(150);
    expect(recalc).toHaveBeenCalledTimes(1);
  });
  it('l\'actualisation en ligne ignore les cours saisis à la main (globale et titre seul)', () => {
    const src = readFileSync('js/services/prices.js', 'utf8');
    expect(src).toContain('const allH = S.accounts.flatMap(a => a.holdings).filter(h => !isManualPrice(h));');
    const single = src.slice(src.indexOf('async function fetchTickerPrice'), src.indexOf('await _fetchSinglePrice(yhSym, cgId)'));
    expect(single).toContain('if (isManualPrice(h))');
  });
  it('se règle dans la fiche « Modifier » d\'une position, et se retire', () => {
    expect(readFileSync('mon-patrimoine.html', 'utf8')).toContain('id="eh-manual-tog"');
    const src = readFileSync('js/modals/position.js', 'utf8');
    expect(src).toContain("_ehManual=h.manualPrice===true;");
    expect(src).toContain('if(_ehManual) h.manualPrice=true; else delete h.manualPrice;');
  });
});

describe('finitions SPEC-01b', () => {
  it('écran Compte : l\'âge affiché est celui de la cotation (quoteAt), pas de la réception', () => {
    const src = readFileSync('js/screens/account.js', 'utf8');
    expect(src).toContain('priceAgeLabel(h.quoteAt)');
    expect(src).not.toContain('priceAgeLabel(h.priceAt)');
  });
  it('pastille et écran recalculés au retour sur l\'app et périodiquement', () => {
    const listeners = {};
    const renderNav = vi.fn(), renderScreen = vi.fn(), timers = [];
    const S3 = { screen: 'stale', accounts: [], isDemo: false };
    const doc = { hidden: false, addEventListener: (ev, fn) => { listeners[ev] = fn; } };
    loadClassic('js/screens/stale.js', {
      globals: { S: S3, NAV_BADGES: {}, SCREEN_BIND: {}, document: doc, renderNav, renderScreen, setInterval: (fn, ms) => timers.push(ms), staleHoldings: () => [] },
    });
    expect(timers).toEqual([600000]);
    listeners.visibilitychange();
    expect(renderNav).toHaveBeenCalledTimes(1);
    expect(renderScreen).toHaveBeenCalledWith('stale');
    doc.hidden = true; listeners.visibilitychange();
    expect(renderNav).toHaveBeenCalledTimes(1);
  });
});
