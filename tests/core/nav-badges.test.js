import { describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

// Pastilles de la barre du bas et du tiroir : une seule source (NAV_BADGES + navBadgeCount de js/core/shell.js).
function shell(S, extra = {}) {
  return loadClassic('js/core/shell.js', {
    globals: { S, assistantAlertCount: () => 3, NAV_SCREENS: ['dashboard', 'comptes', 'recherche', 'analysis'], ...extra },
    exports: ['NAV_BADGES', 'NAV_CATALOG', 'navBadgeCount', 'renderNav', 'drawerRow'],
  });
}

describe('navBadgeCount', () => {
  it('0 pour un raccourci sans pastille', () => {
    expect(shell({}).navBadgeCount('comptes')).toBe(0);
  });
  it('assistant : alertes importantes seulement s\'il est activé', () => {
    expect(shell({ assistantEnabled: true }).navBadgeCount('assistant')).toBe(3);
    expect(shell({ assistantEnabled: false }).navBadgeCount('assistant')).toBe(0);
  });
  it('utilise la fonction enregistrée par un module dans NAV_BADGES', () => {
    const sh = shell({});
    sh.NAV_BADGES.orders = () => 8;
    expect(sh.navBadgeCount('orders')).toBe(8);
  });
});

describe('raccourci « Ordres »', () => {
  it('est dans le catalogue (libellé court pour la barre) et rangé comme écran', () => {
    const sh = shell({});
    expect(sh.NAV_CATALOG.orders).toEqual({ label: 'Ordres', kind: 'screen' });
  });
  it('le menu utilise le même libellé « Ordres » que la barre du bas et affiche la pastille', () => {
    const sh = shell({ screen: 'dashboard', navItems: [] });
    sh.NAV_BADGES.orders = () => 12;
    const html = sh.drawerRow('orders');
    expect(html).toContain('<span class="dr-lbl">Ordres</span>');
    expect(html).toContain('dr-pill">9+<');
  });
  it('la barre du bas affiche la pastille (plafonnée à 9+), et aucune quand le compteur est nul', () => {
    const nav = { innerHTML: '', classList: { toggle() {} }, addEventListener() {} };
    const doc = { getElementById: id => (id === 'nav' ? nav : { addEventListener() {}, classList: { toggle() {} } }), querySelectorAll: () => [], addEventListener() {} };
    const S = { screen: 'dashboard', navItems: ['dashboard', 'comptes', 'orders'], assistantEnabled: false, privacy: false };
    const sh = shell(S, { document: doc });
    sh.NAV_BADGES.orders = () => 8;
    sh.renderNav();
    expect(nav.innerHTML).toContain('<span class="nav-badge">8</span>');
    sh.NAV_BADGES.orders = () => 25;
    sh.renderNav();
    expect(nav.innerHTML).toContain('<span class="nav-badge">9+</span>');
    sh.NAV_BADGES.orders = () => 0;
    sh.renderNav();
    expect(nav.innerHTML).not.toContain('nav-badge');
  });
});
