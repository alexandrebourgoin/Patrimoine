import { describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

// Changer le type d'un compte : raison du refus (choix du type et enregistrement), sinon aucun obstacle
const R = loadClassic('js/features/account-rules.js', { exports: ['ACCOUNT_TYPES', 'accTypeBlockReason'] });
const CTO = 'Compte-Titres Ordinaire';
const h = (ticker, type = 'Action', country = 'France') => ({ ticker, type, country });

describe('accTypeBlockReason', () => {
  it('compte-titres VIDE : tous les types sont possibles (Livret A, PEA, assurance-vie…)', () => {
    const acc = { id: 'a', type: CTO, holdings: [] };
    R.ACCOUNT_TYPES.forEach(t => expect(R.accTypeBlockReason(acc, t, [acc]), t).toBe(''));
  });
  it('compte-titres avec des actions : pas de Livret A ni de crypto, mais PEA (actions françaises) et assurance-vie possibles', () => {
    const acc = { id: 'a', type: CTO, holdings: [h('MC'), h('AI'), h('OR'), h('BNP')] };
    expect(R.accTypeBlockReason(acc, 'Livret A', [acc])).toBe("4 positions non autorisées sur ce type (MC, AI, OR…) : à vendre ou supprimer d'abord");
    expect(R.accTypeBlockReason(acc, 'Crypto / Exchange', [acc])).toMatch(/^4 positions non autorisées/);
    expect(R.accTypeBlockReason(acc, 'Livret A', [acc], true)).toBe('4 positions non autorisées');
    expect(R.accTypeBlockReason(acc, "Plan d'Épargne en Actions (PEA)", [acc])).toBe('');
    expect(R.accTypeBlockReason(acc, 'Assurance-Vie', [acc])).toBe('');
  });
  it("un seul Livret A par personne : refusé s'il en existe déjà un (sauf compte observateur)", () => {
    const acc = { id: 'a', type: CTO, holdings: [] }, la = { id: 'b', type: 'Livret A', holdings: [] };
    expect(R.accTypeBlockReason(acc, 'Livret A', [acc, la])).toMatch(/Un seul compte « Livret A »/);
    expect(R.accTypeBlockReason(acc, 'Livret A', [acc, la], true)).toBe('Nombre maximal atteint');
    expect(R.accTypeBlockReason({ ...acc, observer: true }, 'Livret A', [acc, la])).toBe('');
  });
  it('même type ou type vide : aucun obstacle', () => {
    const acc = { id: 'a', type: CTO, holdings: [h('BTC', 'Crypto', '')] };
    expect(R.accTypeBlockReason(acc, CTO, [acc])).toBe('');
    expect(R.accTypeBlockReason(acc, '', [acc])).toBe('');
  });
});
