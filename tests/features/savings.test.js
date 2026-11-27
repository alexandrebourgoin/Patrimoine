import { describe, it, expect } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';

const taxEnv = loadClassic('js/features/tax-envelope.js', { exports: ['TAX_ENVELOPES'] });
const accPerf = loadClassic('js/features/account-perf.js', { globals: { PU: globalThis.PU }, exports: ['accFlows'] });
const R = loadClassic('js/features/account-rules.js', { exports: ['ACCOUNT_TYPES', 'assetTypeError', 'accTypeViolations', 'assetTypeOptions'] });
const SV = loadClassic('js/features/savings.js', {
  globals: { ...taxEnv, ...accPerf },
  exports: ['SAVINGS_TYPES', 'SAVINGS_RATES', 'isSavingsAccount', 'savingsView', 'savingsSummary', 'savingsCeiling', 'savingsDepositError', 'savingsRoomAt', 'savingsOpeningFlows', 'savingsRateInput'],
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
  it('exemple de Julien : 22 000 € versés le 20/11, 200 € d intérêts le 21/11 → 750 € à verser à partir du 21/11', () => {
    const a = livret('Livret A', [cf('DEP', 22000, '2026-11-20'), cf('INT', 200, '2026-11-21')]);
    expect(SV.savingsRoomAt(a, '2026-11-20')).toBe(950);
    expect(SV.savingsRoomAt(a, '2026-11-22')).toBe(750);
    expect(SV.savingsDepositError(a, 750, v => v, '2026-11-22')).toBe('');
    expect(SV.savingsDepositError(a, 751, v => v, '2026-11-22')).toMatch(/^Plafond Livret A \(22.950 €\) : au 22\/11\/2026, il reste 750 € à verser/);
    expect(SV.savingsDepositError(a, 950, v => v, '2026-11-20')).toBe('');   // avant les intérêts : 950 € possibles ce jour-là
  });
  it('intérêts au-delà du plafond : plus aucun versement ; un retrait libère de la place', () => {
    const a = livret('LDDS', [cf('DEP', 12000), cf('INT', 204)]);
    expect(SV.savingsRoomAt(a, '2026-06-01')).toBe(0);
    expect(SV.savingsDepositError(a, 1, v => v, '2026-06-01')).not.toBe('');
    a.cashflows.push(cf('WIT', 704, '2026-07-01'));
    expect(SV.savingsRoomAt(a, '2026-07-01')).toBe(500);
    expect(SV.savingsDepositError(a, 500, v => v, '2026-07-02')).toBe('');
    expect(SV.savingsDepositError(a, 500.01, v => v, '2026-07-02')).not.toBe('');
  });
  it('un versement antidaté qui ferait dépasser le plafond lors d un versement déjà saisi est refusé', () => {
    const a = livret('LDDS', [cf('DEP', 6000, '2026-01-01'), cf('DEP', 6000, '2026-06-01')]);
    expect(SV.savingsDepositError(a, 100, v => v, '2026-03-01')).toMatch(/versement déjà saisi le 01\/06\/2026/);
  });
  it('pas de plafond sur un compte courant ; pas de contrôle hors livrets (PEA : versements suivis à part)', () => {
    expect(SV.savingsDepositError(livret('Compte courant', [cf('DEP', 1e6)]), 1e6)).toBe('');
    expect(SV.savingsDepositError(livret("Plan d'Épargne en Actions (PEA)", [cf('DEP', 150000)]), 1)).toBe('');
  });
  it('compte courant et épargne suisse : traités comme des comptes de solde (sans titres), sans plafond ni taux proposé', () => {
    ['Compte courant', 'Compte épargne Suisse'].forEach(t => {
      expect(SV.SAVINGS_TYPES, t).toContain(t);
      expect(SV.isSavingsAccount(livret(t)), t).toBe(true);
      expect(SV.savingsView(livret(t)), t).toBe(true);
      expect(SV.savingsCeiling(t), t).toBe(null);
      expect(SV.SAVINGS_RATES[t], t).toBeUndefined();
      expect(SV.savingsDepositError(livret(t, [cf('DEP', 1e6)]), 1e6), t).toBe('');
      expect(SV.savingsOpeningFlows(t, 2000), t).toEqual([{ type: 'DEP', amount: 2000 }]);
    });
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
