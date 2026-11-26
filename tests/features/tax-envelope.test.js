import { describe, it, expect } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';
import { LOAN } from '../helpers/loan.js';

const P = loadClassic('js/features/account-perf.js', { globals: { PU: globalThis.PU }, exports: ['accFlows', '_apDay'] });
const R = loadClassic('js/features/account-rules.js', { exports: ['ACCOUNT_TYPES'] });
const T = loadClassic('js/features/tax-envelope.js', {
  globals: { ...LOAN, accFlows: P.accFlows, _apDay: P._apDay },
  exports: ['TAX_ENVELOPES', 'taxEnvelopeProblems', 'taxEnvelopeInfo', 'taxMilestonesSoon'],
});
const PEA = "Plan d'Épargne en Actions (PEA)";
const dep = (date, amount) => ({ date, type: 'DEP', amount });
const wit = (date, amount) => ({ date, type: 'WIT', amount });
const acc = (type, cashflows = [], o = {}) => ({ id: 'a1', type, currency: 'EUR', value: 0, holdings: [], cashflows, ...o });
const ctx = (today, accounts) => ({ today, conv: v => v, accounts });

describe('enveloppes fiscales : table', () => {
  it('tous les types de la table existent dans la liste des comptes', () => {
    expect(T.taxEnvelopeProblems(R.ACCOUNT_TYPES)).toEqual([]);
    expect(T.taxEnvelopeProblems(['Livret A'])).toContain(PEA);
  });
  it('plafonds officiels (service-public.gouv.fr, nov. 2026)', () => {
    expect(T.TAX_ENVELOPES[PEA].ceiling).toBe(150000);
    expect(T.TAX_ENVELOPES['PEA-PME'].shared.total).toBe(225000);
    expect(T.TAX_ENVELOPES['Livret A'].ceiling).toBe(22950);
    expect(T.TAX_ENVELOPES['LDDS'].ceiling).toBe(12000);
    expect(T.TAX_ENVELOPES['LEP'].ceiling).toBe(10000);
    expect(T.TAX_ENVELOPES['Assurance-Vie'].years).toBe(8);
  });
  it('type sans enveloppe : null', () => {
    expect(T.taxEnvelopeInfo(acc('Compte-Titres Ordinaire'), ctx('2026-11-26'))).toBeNull();
    expect(T.taxEnvelopeInfo(acc('Mon type libre'), ctx('2026-11-26'))).toBeNull();
  });
});

describe('enveloppes fiscales : jalon de durée', () => {
  it('PEA : 5 ans depuis la date d ouverture, jours restants', () => {
    const m = T.taxEnvelopeInfo(acc(PEA, [], { startDate: '2022-03-15' }), ctx('2026-11-26')).milestone;
    expect(m.date).toBe('2027-03-15');
    expect(m.reached).toBe(false);
    expect(m.daysLeft).toBe(109);
    expect(m.auto).toBe(false);
    expect(m.text).toMatch(/clôture/);
  });
  it('sans date d ouverture : 1er versement connu ; atteint → texte « après »', () => {
    const m = T.taxEnvelopeInfo(acc('Assurance-Vie', [dep('2018-06-01', 1000), dep('2017-02-10', 500)]), ctx('2026-11-26')).milestone;
    expect(m.start).toBe('2017-02-10');
    expect(m.date).toBe('2025-02-10');
    expect(m.reached).toBe(true);
    expect(m.auto).toBe(true);
    expect(m.text).toMatch(/4 600/);
  });
  it('29 février → 28 février', () => {
    expect(T.taxEnvelopeInfo(acc(PEA, [], { startDate: '2024-02-29' }), ctx('2026-01-01')).milestone.date).toBe('2029-02-28');
  });
  it('aucune date connue : jalon sans date', () => {
    const m = T.taxEnvelopeInfo(acc(PEA), ctx('2026-11-26')).milestone;
    expect(m.date).toBeNull();
  });
});

describe('enveloppes fiscales : plafonds', () => {
  it('PEA : versements cumulés (un retrait ne libère pas de plafond)', () => {
    const c = T.taxEnvelopeInfo(acc(PEA, [dep('2020-01-01', 100000), wit('2026-01-01', 30000)]), ctx('2026-11-26')).ceiling;
    expect(c.used).toBe(100000);
    expect(c.left).toBe(50000);
    expect(c.over).toBe(false);
  });
  it('livret : le solde (intérêts compris) occupe le plafond ; dépassement possible par les intérêts', () => {
    expect(T.taxEnvelopeInfo(acc('LDDS', [dep('2020-01-01', 12000), wit('2021-01-01', 2000)], { value: 10150 }), ctx('2026-11-26')).ceiling).toMatchObject({ left: 1850, basis: 'balance' });
    const c = T.taxEnvelopeInfo(acc('Livret A', [], { value: 23500 }), ctx('2026-11-26')).ceiling;
    expect(c.used).toBe(23500);
    expect(c.over).toBe(true);
    expect(c.pct).toBe(100);
  });
  it('PEA-PME : plafond commun de 225 000 € diminué des versements PEA', () => {
    const pea = acc(PEA, [dep('2020-01-01', 150000)], { id: 'p1' });
    const pme = acc('PEA-PME', [dep('2021-01-01', 50000)], { id: 'p2' });
    const c = T.taxEnvelopeInfo(pme, ctx('2026-11-26', [pea, pme])).ceiling;
    expect(c.amount).toBe(75000);
    expect(c.left).toBe(25000);
    expect(c.sharedNote).toMatch(/déduit/);
  });
  it('assurance-vie : pas de plafond', () => {
    expect(T.taxEnvelopeInfo(acc('Assurance-Vie', [dep('2020-01-01', 1)]), ctx('2026-11-26')).ceiling).toBeNull();
  });
});

describe('enveloppes fiscales : jalons proches', () => {
  it('ne retient que les jalons non atteints dans le délai', () => {
    const list = [acc(PEA, [], { id: 'a', startDate: '2022-01-10' }), acc(PEA, [], { id: 'b', startDate: '2023-06-01' }), acc(PEA, [], { id: 'c', startDate: '2020-01-01' })];
    expect(T.taxMilestonesSoon(list, ctx('2026-11-26'), 90).map(x => x.acc.id)).toEqual(['a']);
  });
});
