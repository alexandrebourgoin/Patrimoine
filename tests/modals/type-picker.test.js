// Choix du type de compte : sections colorées par catégorie, pastille, nom court, précision (taux des livrets), coche
import { describe, it, expect } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const R = loadClassic('js/features/account-rules.js', { exports: ['ACCOUNT_TYPE_GROUPS', 'ACCOUNT_TYPES', 'ACCOUNT_TYPE_INFO', 'accTypeTone', 'accountRulesProblems'] });
const T = loadClassic('js/modals/type-picker.js', {
  globals: { ...R, esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), SAVINGS_RATES: { 'Livret A': 1.7, 'LEP': 2.5 } },
  exports: ['typePickerHTML', 'typePickerButtonHTML', 'accTypeSub', 'accTypeBadgeHTML'],
});

describe('choix du type de compte', () => {
  it('chaque type a nom court et pastille ; une couleur par catégorie', () => {
    expect(R.accountRulesProblems()).toEqual([]);
    expect(R.ACCOUNT_TYPE_GROUPS.map(g => g.tone)).toEqual(['bourse', 'retraite', 'livret']);
    expect(R.accTypeTone('PEA-PME')).toBe('bourse');
    expect(R.accTypeTone('LEP')).toBe('livret');
    expect(R.accTypeTone('SCPI')).toBe('');
  });
  it('sections colorées, nom court et précision, coche sur le type choisi', () => {
    const html = T.typePickerHTML("Plan d'Épargne en Actions (PEA)");
    expect([...html.matchAll(/class="tp-head tp-(\w+)"><span class="tp-dot"><\/span>([^<]+)/g)].map(m => [m[1], m[2]]))
      .toEqual([['bourse', 'Bourse et crypto'], ['retraite', 'Assurance-vie et retraite'], ['livret', 'Livrets et comptes courants']]);
    expect((html.match(/data-type=/g) || []).length).toBe(R.ACCOUNT_TYPES.length);
    expect(html).toMatch(/class="tp-row tp-bourse on" data-type="Plan d&#39;|class="tp-row tp-bourse on" data-type="Plan d'/);
    expect((html.match(/tp-check/g) || []).length).toBe(1);
    expect(html).toContain('<span class="tp-name">PEA</span><span class="tp-sub">Plan d\'épargne en actions</span>');
  });
  it('livrets : taux en vigueur dans la précision', () => {
    expect(T.accTypeSub('Livret A')).toBe('1,7 % · Livret réglementé');
    expect(T.accTypeSub('Livret Jeune')).toBe('12 à 25 ans');
  });
  it('type hors liste (données anciennes) : section « Type actuel » en tête, pastille neutre', () => {
    const html = T.typePickerHTML('SCPI');
    expect(html.indexOf('Type actuel')).toBeLessThan(html.indexOf('Bourse et crypto'));
    expect(html).toContain('class="tp-row tp-autre on" data-type="SCPI"');
    expect(T.accTypeBadgeHTML('SCPI')).toContain('tp-autre');
  });
  it('bouton du formulaire : pastille colorée et nom court', () => {
    const b = T.typePickerButtonHTML('Livret A');
    expect(b).toContain('tp-badge tp-livret');
    expect(b).toContain('<span class="tp-btn-name">Livret A</span>');
  });
});
