import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Écran d'un compte : la rangée « P&L Total / Performance / Variation J » est retirée (demande du 25/11/2026) :
// elle doublonnait la carte Performance (pondérée des flux, YTD / historique), qui reste la seule mesure affichée.
const src = readFileSync('js/screens/account.js', 'utf8');
const hero = src.slice(src.indexOf('function renderAccount'), src.indexOf('function renderHoldsHTML'));

describe('en-tête de l\'écran Compte', () => {
  it('n\'affiche plus P&L Total, Performance (rangée) ni Variation J', () => {
    expect(hero).not.toContain('P&amp;L Total');
    expect(hero).not.toContain('Variation J');
    expect(hero).not.toContain('class="stat-row"');
  });
  it('garde la valeur, le détail titres / liquidités, la carte Performance et l\'indice', () => {
    expect(hero).toContain('accHeroValHTML(acc)');
    expect(hero).toContain('de liquidités');
    expect(hero).toContain('accPerfCardHTML(acc,perf,sum)');
    expect(hero).toContain('accBenchHTML(acc,perf,sum)');
  });
  it('aucun style ni sélecteur orphelin', () => {
    expect(readFileSync('mon-patrimoine.css', 'utf8')).not.toMatch(/\.stat-(row|box)/);
    expect(readFileSync('js/services/prices.js', 'utf8')).not.toContain('.stat-box');
  });
});
