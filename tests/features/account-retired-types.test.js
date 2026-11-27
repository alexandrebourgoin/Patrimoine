import { describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

// Migration guidée des comptes dont le type a été retiré de la liste (26/11/2026)
const R = loadClassic('js/features/account-rules.js', {
  exports: ['ACCOUNT_TYPES', 'accTypeRetired', 'accRetiredHint', 'accToReclassify', 'accApplyTypeChange'],
});
const RETIRED = ['SCPI / Immobilier', 'Métaux précieux', 'Compte à terme'];

describe('types retirés', () => {
  it('les trois types retirés et une saisie libre ne sont plus proposés', () => {
    [...RETIRED, 'Tontine familiale'].forEach(t => expect(R.accTypeRetired(t), t).toBe(true));
  });
  it('un type de la liste ou un type vide ne sont pas « retirés »', () => {
    R.ACCOUNT_TYPES.forEach(t => expect(R.accTypeRetired(t), t).toBe(false));
    expect(R.accTypeRetired('')).toBe(false);
    expect(R.accTypeRetired(undefined)).toBe(false);
  });
  it('un conseil adapté par famille de type, un conseil générique sinon', () => {
    expect(R.accRetiredHint('Compte courant')).toMatch(/plus proche/);
    expect(R.accRetiredHint('Compte à terme')).toMatch(/Liquidités/);
    expect(R.accRetiredHint('SCPI / Immobilier')).toMatch(/Immobilier/);
    expect(R.accRetiredHint('Métaux précieux')).toMatch(/Autres/);
    expect(R.accRetiredHint('Tontine familiale')).toMatch(/plus proche/);
  });
});

describe('comptes à reclasser', () => {
  const accs = [
    { id: 'a', type: 'Tontine familiale' },
    { id: 'b', type: 'Livret A' },
    { id: 'c', type: 'SCPI / Immobilier', keepType: 'SCPI / Immobilier' },   // gardé volontairement
    { id: 'd', type: 'Métaux précieux', keepType: 'Tontine familiale' },        // gardé pour un AUTRE type : redemandé
    null,
  ];
  it('liste les comptes à type retiré non gardé', () => expect(R.accToReclassify(accs).map(a => a.id)).toEqual(['a', 'd']));
  it('aucun compte, aucune erreur', () => { expect(R.accToReclassify()).toEqual([]); expect(R.accToReclassify([])).toEqual([]); });
});

describe('changement de type', () => {
  it("retient l'ancien type retiré et oublie le choix « garder »", () => {
    const acc = { type: 'Compte à terme', keepType: 'Compte à terme' };
    R.accApplyTypeChange(acc, 'Livret A');
    expect(acc).toEqual({ type: 'Livret A', formerType: 'Compte à terme' });
    expect(R.accToReclassify([acc])).toEqual([]);
  });
  it("ne note pas d'ancien type quand on passe d'un type de la liste à un autre", () => {
    const acc = { type: 'Compte-Titres Ordinaire' };
    R.accApplyTypeChange(acc, 'Assurance-Vie');
    expect(acc).toEqual({ type: 'Assurance-Vie' });
  });
  it('même type : rien ne change', () => {
    const acc = { type: 'Tontine familiale', keepType: 'Tontine familiale' };
    R.accApplyTypeChange(acc, 'Tontine familiale');
    expect(acc).toEqual({ type: 'Tontine familiale', keepType: 'Tontine familiale' });
  });
});
