import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadClassic, fakeDocument } from '../helpers/load-classic.js';

// Échappement HTML : ticker, type, pays, secteur et clés API viennent de la saisie, d'un CSV ou d'une sauvegarde
// restaurée. Ils ne doivent jamais arriver bruts dans un innerHTML (sinon un fichier piégé exécute du JS).

const EVIL = '<img src=x onerror=alert(1)>';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const noRawTag = html => expect(html).not.toContain('<img');

const hold = (o = {}) => ({
  id: 'h1', ticker: EVIL, name: 'Nom', type: EVIL, country: EVIL, sector: EVIL, currency: 'EUR',
  quantity: 1, currentPrice: 10, value: 10, valueRef: 10, pnl: 0, pnlPct: 0, transactions: [], ...o,
});

describe('rendu avec des valeurs hostiles', () => {
  it('ligne de recherche (srchRow) : ticker et type échappés', () => {
    const { srchRow } = loadClassic('js/screens/search.js', {
      globals: { S: {}, esc, masked: v => String(v), fmtPct: v => String(v), SCREEN_BIND: {}, NAV_CATALOG: {} },
      exports: ['srchRow'],
    });
    noRawTag(srchRow(hold(), { id: 'a1', name: 'Compte' }));
  });

  it('carte « Titres suivis » (renderWatchlistCard) : ticker échappé, y compris dans les attributs data-', () => {
    const S = { watchlist: [{ ticker: EVIL, name: 'Nom', price: 10, change1d: 1, currency: 'EUR' }] };
    const { renderWatchlistCard } = loadClassic('js/screens/dashboard.js', {
      globals: { S, esc, fmtNative: v => String(v), SECURITIES_DB: {}, SCREEN_BIND: {}, NAV_CATALOG: {} },
      exports: ['renderWatchlistCard'],
    });
    noRawTag(renderWatchlistCard());
  });

  it('liste des positions d\'un compte (renderHoldsHTML) : ticker et type échappés', () => {
    const el = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null, addEventListener() {} };
    const S = { search: '', sort: 'value', sortDir: -1, accounts: [], moves: [] };
    const { renderHoldsHTML } = loadClassic('js/screens/account.js', {
      globals: {
        S, esc, masked: v => String(v), fmtPct: v => String(v), fmtNative: v => String(v), pctClass: () => '', priceStale: () => false,
        priceAgeLabel: () => '', renderMovesHTML() {}, _qtyOnDay: () => 0, isSavingsAccount: () => false, SCREEN_BIND: {}, NAV_CATALOG: {},
        document: { ...fakeDocument(), getElementById: id => (id === 'js-holds' ? el : fakeDocument().getElementById(id)) },
      },
      exports: ['renderHoldsHTML'],
    });
    renderHoldsHTML({ id: 'a1', name: 'Compte', value: 10, holdings: [hold()] });
    noRawTag(el.innerHTML);
  });
});

// Garde-fou sur le source : ces motifs ne doivent pas revenir sans esc().
describe('garde-fou source', () => {
  const read = f => readFileSync(f, 'utf8');
  const files = ['js/screens/account.js', 'js/screens/search.js', 'js/screens/dashboard.js', 'js/screens/stock.js', 'js/screens/settings.js'];

  it('aucun ticker tronqué ni data-ticker brut dans un gabarit', () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/\$\{\s*(h|w)\.ticker\.slice\(/);
      expect(src, f).not.toMatch(/data-(watch|wdel)="\$\{\s*w\.ticker\s*\}"/);
    }
  });
  it('type, pays, secteur et devise de titre toujours échappés', () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/\$\{\s*h\.(type|country|sector)\s*\}/);
    }
    expect(read('js/screens/stock.js')).not.toMatch(/\$\{\s*hCur\s*\}<\/span>/);
  });
  it('clés API des réglages échappées dans value=""', () => {
    const src = read('js/screens/settings.js');
    expect(src).not.toMatch(/value="\$\{\s*S\.(priceApiKey|fmpApiKey)/);
    expect(src).toContain("esc(S.priceApiKey||'')");
    expect(src).toContain("esc(S.fmpApiKey||'')");
  });
});
