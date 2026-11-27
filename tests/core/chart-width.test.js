// Largeur des graphiques (accueil, titre suivi, fiche titre) : jamais nulle ni négative
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadClassic } from '../helpers/load-classic.js';

const make = (innerWidth, clientWidth = 0) => loadClassic('js/core/ui.js', {
  globals: { window: { innerWidth }, document: { documentElement: { clientWidth } } },
  exports: ['chartWidth'],
});

describe('largeur des graphiques', () => {
  it('écran normal : largeur plafonnée à 480, moins la marge', () => {
    expect(make(390).chartWidth(72)).toBe(318);
    expect(make(1200).chartWidth(72)).toBe(408);
    expect(make(390).chartWidth()).toBe(390);
  });
  it('fenêtre sans taille (démarrage, arrière-plan) : 390 px par défaut, jamais négatif', () => {
    expect(make(0).chartWidth(72)).toBe(318);
    expect(make(0, 360).chartWidth(72)).toBe(288);
    expect(make(100).chartWidth(72)).toBe(160);
  });
  it('plus aucun calcul direct sur innerWidth dans les écrans à graphique', () => {
    for (const f of ['js/screens/dashboard.js', 'js/screens/watch.js', 'js/screens/stock.js']) {
      expect(readFileSync(f, 'utf8')).not.toContain('innerWidth');
    }
  });
});
