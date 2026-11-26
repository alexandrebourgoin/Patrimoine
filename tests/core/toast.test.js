import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadClassic } from '../helpers/load-classic.js';

const U = loadClassic('js/core/ui.js', { exports: ['toastDuration'] });

describe('messages (toast)', () => {
  it('un message long s affiche plus longtemps, dans une limite', () => {
    expect(U.toastDuration('Compte créé ✓')).toBe(2400);
    expect(U.toastDuration('x'.repeat(140))).toBe(2400 + 100 * 50);
    expect(U.toastDuration('x'.repeat(1000))).toBe(8000);
  });
  it('le message passe à la ligne et tient dans la largeur de l écran', () => {
    const rule = readFileSync('mon-patrimoine.css', 'utf8').match(/#toast\{[^}]*\}/)[0];
    expect(rule).toContain('white-space:normal');
    expect(rule).toContain('max-width:calc(100vw - 32px)');
    expect(rule.includes('nowrap')).toBe(false);
  });
});
