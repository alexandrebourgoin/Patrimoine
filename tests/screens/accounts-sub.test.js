// Liste des comptes : sous-titre sans le type (porté par la pastille), sauf type hors liste ; taux pour un livret
import { describe, it, expect } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const A = loadClassic('js/screens/accounts.js', {
  globals: { SCREEN_BIND: {}, ACCOUNT_TYPE_INFO: { 'PEA-PME': {}, 'Livret A': {} }, isSavingsAccount: a => a.type === 'Livret A' },
  exports: ['accListSub'],
});

describe('liste des comptes : sous-titre', () => {
  it('type connu : nombre de valeurs et établissement', () => {
    expect(A.accListSub({ type: 'PEA-PME', holdings: [1, 2], bank: 'Boursorama' })).toBe('2 valeurs · Boursorama');
    expect(A.accListSub({ type: 'PEA-PME', holdings: [1] })).toBe('1 valeur');
  });
  it('livret sans titres : taux', () => {
    expect(A.accListSub({ type: 'Livret A', holdings: [], rate: 1.7, bank: 'BNP' })).toBe('1,7 % · BNP');
  });
  it('type hors liste (données anciennes) : écrit en clair', () => {
    expect(A.accListSub({ type: 'SCPI', holdings: [], bank: 'X' })).toBe('SCPI · 0 valeur · X');
  });
});
