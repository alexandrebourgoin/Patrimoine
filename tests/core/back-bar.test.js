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
    'js/screens/orders.js', 'js/screens/immo.js', 'js/features/dca.js', 'js/screens/assistant.js',
    'js/screens/settings.js', 'js/screens/account.js', 'js/screens/stock.js', 'js/screens/watch.js',
  ])('%s passe par backBarHTML (aucun lien retour sans burger)', (f) => {
    const src = readFileSync(f, 'utf8');
    expect(src).toContain('backBarHTML(');
    expect(src).not.toContain('class="back tap"');
  });
});
