import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadClassic } from '../helpers/load-classic.js';

const T = loadClassic('js/core/themes.js', { exports: ['THEMES', 'THEME_KEYS', 'THEME_BG', 'THEME_CHART_MAP', 'resolveTheme', 'themePalette'] });
const css = readFileSync('mon-patrimoine.css', 'utf8');

describe('thèmes', () => {
  it('six choix : Auto, Clair, Sombre, Sable, Émeraude, Graphite', () => {
    expect(T.THEME_KEYS).toEqual(['auto', 'light', 'dark', 'sable', 'emeraude', 'graphite']);
  });
  it('chaque thème supplémentaire a son bloc CSS complet, sa couleur de fond et ses couleurs de graphiques', () => {
    for (const k of ['sable', 'emeraude', 'graphite']) {
      const m = css.match(new RegExp(`\\[data-theme="${k}"\\]\\{([^}]*)\\}`));
      expect(m, k).toBeTruthy();
      for (const v of ['--bg', '--card', '--card2', '--border', '--accent', '--text', '--text2', '--text3', '--gain', '--loss']) expect(m[1], `${k} ${v}`).toContain(v + ':');
      expect(T.THEME_BG[k]).toMatch(/^#/);
      expect(Object.keys(T.THEME_CHART_MAP[k]).length).toBeGreaterThan(8);
    }
  });
  it('« Auto » suit le système ; une clé inconnue retombe sur le sombre', () => {
    expect(T.resolveTheme('auto', true)).toBe('dark');
    expect(T.resolveTheme('auto', false)).toBe('light');
    expect(T.resolveTheme('sable', true)).toBe('sable');
    expect(T.resolveTheme('n-importe', false)).toBe('dark');
  });
  it('recoloration des palettes : couleurs connues remplacées, inconnues conservées, tableau ou objet', () => {
    const map = T.THEME_CHART_MAP.graphite;
    expect(T.themePalette(['#4F8EF7', '#123456'], map)).toEqual(['#8B7CF6', '#123456']);
    expect(T.themePalette({ Bourse: '#4f8ef7' }, map)).toEqual({ Bourse: '#8B7CF6' });
    expect(T.themePalette({ Bourse: '#4F8EF7' }, undefined)).toEqual({ Bourse: '#4F8EF7' });
  });
  it('le thème choisi est appliqué avant le premier affichage (pré-boot de mon-patrimoine.html)', () => {
    const html = readFileSync('mon-patrimoine.html', 'utf8');
    expect(html).toContain("['sable','emeraude','graphite'].indexOf(s.theme)");
  });
});
