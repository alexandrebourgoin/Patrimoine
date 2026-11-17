import { describe, it, expect, vi } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const { SCREEN_BIND, bindEvents } = loadClassic('js/core/screens.js', { exports: ['SCREEN_BIND', 'bindEvents'] });

describe('bindEvents (registre des écrans)', () => {
  it('appelle le binder enregistré avec (el, id)', () => {
    const fn = vi.fn(); const el = {};
    SCREEN_BIND.demo = fn;
    bindEvents('demo', el);
    expect(fn).toHaveBeenCalledWith(el, 'demo');
  });
  it('écran sans binder (ex. dca, géré à part) → sans effet, sans erreur', () => {
    expect(() => bindEvents('inconnu', {})).not.toThrow();
  });
});
