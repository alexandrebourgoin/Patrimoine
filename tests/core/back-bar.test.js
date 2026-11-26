import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadClassic } from '../helpers/load-classic.js';

// Écrans secondaires (Ordres, Immobilier, DCA, Assistant, Réglages, Compte, fiche titre, titre suivi) :
// la barre « Retour » doit toujours proposer le menu burger, comme la barre du haut des écrans principaux.
const S = { assistantEnabled: false };
const shell = loadClassic('js/core/shell.js', {
  globals: { S, assistantAlertCount: () => 0 },
  exports: ['backBarHTML', 'burgerBtnHTML', 'renderTopBar'],
});

describe('barre « Retour » des écrans secondaires', () => {
  it('contient le lien retour (id js-back) et le bouton burger (id js-burger-btn)', () => {
    const html = shell.backBarHTML();
    expect(html).toContain('id="js-back"');
    expect(html).toContain('Retour');
    expect(html).toContain('id="js-burger-btn"');
  });
  it('accepte un libellé de retour (nom du compte, « Retour aux biens »)', () => {
    expect(shell.backBarHTML('Retour aux biens')).toContain('Retour aux biens');
  });
  it('même bouton burger que la barre du haut, pastille de l\'assistant comprise', () => {
    S.assistantEnabled = true;
    const sh = loadClassic('js/core/shell.js', {
      globals: { S, assistantAlertCount: () => 3 },
      exports: ['backBarHTML', 'renderTopBar'],
    });
    expect(sh.backBarHTML()).toContain('<span class="assistant-badge">3</span>');
    expect(sh.renderTopBar()).toContain('<span class="assistant-badge">3</span>');
    S.assistantEnabled = false;
  });
  it.each([
    'js/screens/account.js', 'js/screens/stock.js', 'js/screens/watch.js', 'js/screens/immo.js',
  ])('écran de détail %s : barre « Retour » + burger (backBarHTML)', (f) => {
    const src = readFileSync(f, 'utf8');
    expect(src).toContain('backBarHTML(');
    expect(src).not.toContain('class="back tap"');
  });
  it.each([
    ['orders', 'js/screens/orders.js'], ['immo', 'js/screens/immo.js'], ['dca', 'js/features/dca.js'],
    ['assistant', 'js/screens/assistant.js'], ['settings', 'js/screens/settings.js'], ['stale', 'js/screens/stale.js'], ['credits', 'js/screens/credits.js'],
  ])('écran de module %s : nom du module + burger, sans « Retour » (moduleBarHTML)', (key, f) => {
    const src = readFileSync(f, 'utf8');
    expect(src).toContain(`moduleBarHTML('${key}'`);
    expect(src).not.toContain('class="back tap"');
  });
  it('moduleBarHTML : titre du module et burger, aucun lien retour', () => {
    const sh = loadClassic('js/core/shell.js', { globals: { S, assistantAlertCount: () => 0 }, exports: ['moduleBarHTML'] });
    const html = sh.moduleBarHTML('immo', 'Sous-titre');
    expect(html).toContain('<div class="top-bar-title">Immobilier</div>');
    expect(html).toContain('id="js-burger-btn"');
    expect(html).toContain('<div class="module-sub">Sous-titre</div>');
    expect(html).not.toContain('js-back');
  });
});

describe('barre du bas sur les écrans de module', () => {
  const S2 = { assistantEnabled: true, navItems: ['dashboard', 'comptes', 'orders'] };
  const sh = loadClassic('js/core/shell.js', {
    globals: { S: S2, assistantAlertCount: () => 0, NAV_SCREENS: ['dashboard', 'comptes', 'recherche', 'analysis'] },
    exports: ['navVisibleFor'],
  });
  it('visible sur un module même absent des raccourcis (DCA, Immobilier, Réglages…)', () => {
    for (const k of ['dca', 'immo', 'settings', 'assistant', 'orders']) expect(sh.navVisibleFor(k)).toBe(true);
  });
  it('visible sur les écrans principaux, masquée sur les écrans de détail', () => {
    expect(sh.navVisibleFor('dashboard')).toBe(true);
    for (const k of ['account', 'stock', 'watchstock', 'immodetail']) expect(sh.navVisibleFor(k)).toBe(false);
  });
});
