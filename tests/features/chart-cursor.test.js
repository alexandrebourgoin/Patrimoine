import { describe, it, expect } from 'vitest';

describe('curseur des courbes : une seule implémentation', () => {
  it('Accueil et titre suivi passent par _bindChartCursor (plus de copie du calcul)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('js/features/charts.js', 'utf8');
    expect((src.match(/^  _bindChartCursor\(svg, pts, \{$/gm) || [])).toHaveLength(2);
    expect((src.match(/const relX = /g) || [])).toHaveLength(1);
  });
});
