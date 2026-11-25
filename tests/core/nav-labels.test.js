import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadClassic } from '../helpers/load-classic.js';

// Un seul libellé par module : NAV_CATALOG.<clé>.label, repris par la barre du bas, le menu et le titre de l'écran.
const S = { screen: 'dashboard', navItems: [], privacy: false, assistantEnabled: true };
const sh = loadClassic('js/core/shell.js', {
  globals: { S, assistantAlertCount: () => 0, NAV_SCREENS: ['dashboard', 'comptes', 'recherche', 'analysis'] },
  exports: ['NAV_CATALOG', 'drawerRow', 'navLabel', 'moduleBarHTML'],
});
const titleOf = file => (readFileSync(file, 'utf8').match(/<div class="t-title">([^<]*)<\/div>/) || [])[1];

describe('libellés des modules', () => {
  it('le menu affiche exactement le libellé de la barre du bas, pour chaque raccourci', () => {
    for (const key of Object.keys(sh.NAV_CATALOG)) {
      expect(sh.drawerRow(key)).toContain(`<span class="dr-lbl">${sh.navLabel(key)}</span>`);
    }
  });
  it('« Masquer » devient « Afficher » quand les montants sont masqués, dans la barre comme dans le menu', () => {
    S.privacy = true;
    expect(sh.drawerRow('privacy')).toContain('<span class="dr-lbl">Afficher</span>');
    S.privacy = false;
  });
  it.each([
    ['dca', 'js/features/dca.js'],
    ['orders', 'js/screens/orders.js'],
    ['assistant', 'js/screens/assistant.js'],
    ['settings', 'js/screens/settings.js'],
    ['immo', 'js/screens/immo.js'],
  ])('le titre de l\'écran %s vient de moduleBarHTML(clé) → navLabel : aucun nom écrit en dur', (key, file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).toContain(`moduleBarHTML('${key}'`);
    expect(src).not.toMatch(/<div class="t-title">/);
  });
  it('moduleBarHTML affiche le libellé du catalogue', () => {
    expect(sh.moduleBarHTML('orders')).toContain('<div class="top-bar-title">Ordres</div>');
  });
  it('aucun alias de libellé dans le menu (drawerRow passe par navLabel)', () => {
    const src = readFileSync('js/core/shell.js', 'utf8');
    const row = src.slice(src.indexOf('function drawerRow'), src.indexOf('function renderDrawer'));
    expect(row).toContain('navLabel(key)');
    expect(row).not.toMatch(/'(Ordres et alertes|DCA & objectifs|Assistant IA|Actualiser les cours|Masquer les montants)'/);
  });
});

describe('titres des écrans principaux', () => {
  it('Comptes, Recherche et Analyse affichent leur nom ; l\'Accueil garde « Mon patrimoine »', () => {
    const shell = loadClassic('js/core/shell.js', { globals: { S, assistantAlertCount: () => 0 }, exports: ['renderTopBar'] });
    expect(shell.renderTopBar()).toContain('<div class="top-bar-title">Mon patrimoine</div>');
    expect(shell.renderTopBar('', 'Analyse')).toContain('<div class="top-bar-title">Analyse</div>');
    expect(readFileSync('js/screens/accounts.js', 'utf8')).toContain("navLabel('comptes'))");
    expect(readFileSync('js/screens/search.js', 'utf8')).toContain("renderTopBar('', navLabel('recherche'))");
    expect(readFileSync('js/screens/analysis.js', 'utf8')).toContain("renderTopBar('', navLabel('analysis'))");
    expect(readFileSync('js/screens/dashboard.js', 'utf8')).not.toContain('navLabel(\'dashboard\')');
  });
});
