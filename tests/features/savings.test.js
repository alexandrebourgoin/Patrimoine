import { describe, it, expect } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';

const taxEnv = loadClassic('js/features/tax-envelope.js', { exports: ['TAX_ENVELOPES'] });
const accPerf = loadClassic('js/features/account-perf.js', { globals: { PU: globalThis.PU }, exports: ['accFlows'] });
const R = loadClassic('js/features/account-rules.js', { exports: ['ACCOUNT_TYPES', 'assetTypeError', 'accTypeViolations', 'assetTypeOptions'] });
const SV = loadClassic('js/features/savings.js', {
  globals: { ...taxEnv, ...accPerf },
  exports: ['SAVINGS_TYPES', 'SAVINGS_RATES', 'isSavingsAccount', 'savingsView', 'savingsSummary', 'savingsCeiling', 'savingsDepositError', 'savingsOpeningFlows', 'savingsRateInput'],
});
const cf = (type, amount, date = '2026-01-01') => ({ id: type + amount, type, amount, date, ccy: 'EUR' });
const livret = (type, cashflows = [], o = {}) => ({ id: 'l', type, currency: 'EUR', value: 0, holdings: [], cashflows, ...o });

describe('livrets : types et règles', () => {
  it('tous les types d épargne existent dans la liste des comptes', () => {
    expect(SV.SAVINGS_TYPES.filter(t => !R.ACCOUNT_TYPES.includes(t))).toEqual([]);
  });
  it('aucun titre sur un livret : toute position est refusée, passer un compte-titres en livret est bloqué s il a des titres', () => {
    expect(R.assetTypeError({ type: 'LDDS' }, 'ETF')).toBe('Pas de titres sur ce type de compte : saisis les versements, retraits et intérêts');
    expect(R.assetTypeError({ type: 'Livret A' }, 'Cash')).not.toBe('');
    expect(R.accTypeViolations({ type: 'Compte-Titres Ordinaire', holdings: [{ ticker: 'CW8', type: 'ETF' }] }, 'Livret A')).toHaveLength(1);
    expect(R.assetTypeOptions('LEP', ['Action', 'ETF'], 'Action', false)).toEqual({ disabled: ['Action', 'ETF'], value: 'Action' });
  });
  it('taux réglementés proposés (novembre 2026) ; saisie du taux', () => {
    expect(SV.SAVINGS_RATES).toEqual({ 'Livret A': 1.7, 'LDDS': 1.7, 'LEP': 2.5 });
    expect(SV.savingsRateInput('')).toEqual({ rate: null });
    expect(SV.savingsRateInput('1,7')).toEqual({ rate: 1.7 });
    expect(SV.savingsRateInput('abc').error).toBeTruthy();
    expect(SV.savingsRateInput('25').error).toBeTruthy();
  });
  it('affichage livret seulement sans titres (anciennes saisies conservées)', () => {
    expect(SV.savingsView(livret('LDDS'))).toBe(true);
    expect(SV.savingsView(livret('LDDS', [], { holdings: [{ ticker: 'X' }] }))).toBe(false);
    expect(SV.savingsView(livret('Compte-Titres Ordinaire'))).toBe(false);
  });
});

describe('livrets : plafond de versements', () => {
  it('versements − retraits, intérêts exclus : 12 000 € versés au plus sur un LDDS, les intérêts au-delà', () => {
    const a = livret('LDDS', [cf('DEP', 12000), cf('INT', 204)], { value: 12204 });
    expect(SV.savingsDepositError(a, 1)).toMatch(/^Plafond de versements LDDS \(12.000 €\) : il reste 0 €/);
    a.cashflows.push(cf('WIT', 500));
    expect(SV.savingsDepositError(a, 500)).toBe('');
    expect(SV.savingsDepositError(a, 500.01)).not.toBe('');
  });
  it('pas de plafond sur un compte courant ; pas de contrôle hors livrets (PEA : versements suivis à part)', () => {
    expect(SV.savingsDepositError(livret('Compte courant', [cf('DEP', 1e6)]), 1e6)).toBe('');
    expect(SV.savingsDepositError(livret("Plan d'Épargne en Actions (PEA)", [cf('DEP', 150000)]), 1)).toBe('');
  });
  it('création avec un solde : au-delà du plafond, la différence est comptée comme intérêts', () => {
    expect(SV.savingsOpeningFlows('LDDS', 12500)).toEqual([{ type: 'DEP', amount: 12000 }, { type: 'INT', amount: 500 }]);
    expect(SV.savingsOpeningFlows('Livret A', 5000)).toEqual([{ type: 'DEP', amount: 5000 }]);
    expect(SV.savingsOpeningFlows('Compte courant', 50000)).toEqual([{ type: 'DEP', amount: 50000 }]);
    expect(SV.savingsOpeningFlows('LEP', 0)).toEqual([]);
  });
});

describe('livrets : synthèse', () => {
  it('versé, retiré, intérêts reçus, intérêts annuels estimés au taux du compte', () => {
    const s = SV.savingsSummary(livret('Livret A', [cf('DEP', 10000), cf('WIT', 1000), cf('INT', 150)], { value: 9150, rate: 1.7 }));
    expect(s).toMatchObject({ balance: 9150, dep: 10000, wit: 1000, net: 9000, interest: 150, rate: 1.7 });
    expect(s.yearly).toBeCloseTo(155.55, 6);
    expect(SV.savingsSummary(livret('Livret A')).yearly).toBeNull();
  });
  it('les intérêts entrent dans le solde (liquidités) mais pas dans les apports de la performance', () => {
    const a = livret('LDDS', [cf('DEP', 1000), cf('INT', 17)]);
    expect(globalThis.PU.accCashByCcy(a).EUR).toBe(1017);
    expect(accPerf.accFlows(a, v => v).map(f => f.amt)).toEqual([1000]);
  });
});
