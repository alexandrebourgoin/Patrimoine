import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Profil : aucun nom de personne par défaut (l'utilisateur saisit le sien dans Réglages > Profil).
describe('profil par défaut', () => {
  it('nom vide à la première ouverture', () => {
    const src = readFileSync('mon-patrimoine.js', 'utf8');
    expect(src).toMatch(/user: \{ name: '' \}/);
    expect(src).not.toContain('Alexandre Martin');
  });
});
