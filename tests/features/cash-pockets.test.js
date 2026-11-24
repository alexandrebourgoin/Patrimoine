import { describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic } from '../helpers/load-classic.js';

const C = loadClassic('js/features/cash-pockets.js', {
  globals: { PU: globalThis.PU },
  exports: ['cashAdjustRows', 'cashAdjustBalances', 'cashAdjustDateError', 'cashAdjustApply', 'cashAdjustRemove', 'cfStampCcy'],
});

describe('cashAdjustRows', () => {
  it('une ligne par devise utile : devise du compte, devises des titres, poches existantes (valeurs arrondies)', () => {
    const acc = { currency: 'EUR', cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 100.123, ccy: 'CHF' }], holdings: [{ currency: 'USD', transactions: [] }] };
    const rows = C.cashAdjustRows(acc, '2024-06-01', 'EUR');
    expect(rows.map(r => r.ccy).sort()).toEqual(['CHF', 'EUR', 'USD']);
    expect(rows.find(r => r.ccy === 'CHF').val).toBe('100.12');
    expect(rows.find(r => r.ccy === 'EUR').val).toBe('0');
  });
  it('compte sans devise : celle de l\'appli', () => {
    expect(C.cashAdjustRows({ holdings: [] }, '2024-06-01', 'USD').map(r => r.ccy)).toEqual(['USD']);
  });
  it('les poches sont lues à la date demandée', () => {
    const acc = { currency: 'EUR', cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 100 }, { date: '2024-06-01', type: 'DEP', amount: 900 }], holdings: [] };
    expect(C.cashAdjustRows(acc, '2024-03-01', 'EUR')[0].val).toBe('100');
  });
});

describe('cashAdjustBalances', () => {
  it('arrondit au centime, accepte la virgule, un champ vide vaut 0', () => {
    expect(C.cashAdjustBalances([{ ccy: 'EUR', val: '12,345' }, { ccy: 'USD', val: '' }, { ccy: 'CHF', val: ' -5 ' }]).balances).toEqual({ EUR: 12.35, USD: 0, CHF: -5 });
  });
  it('un texte illisible est une erreur nommant la devise (jamais ignoré)', () => {
    expect(C.cashAdjustBalances([{ ccy: 'EUR', val: '1' }, { ccy: 'USD', val: 'abc' }])).toEqual({ error: 'Montant invalide pour USD' });
    expect(C.cashAdjustBalances([{ ccy: 'EUR', val: 'Infinity' }]).error).toBeDefined();
  });
});

describe('cashAdjustDateError', () => {
  it('date valide, passée ou du jour', () => {
    expect(C.cashAdjustDateError('2024-01-01', '2026-11-24')).toBeNull();
    expect(C.cashAdjustDateError('2026-11-24', '2026-11-24')).toBeNull();
  });
  it('futur, vide, mal formé, impossible', () => {
    expect(C.cashAdjustDateError('2026-11-25', '2026-11-24')).toBe('La date ne peut pas être dans le futur');
    for (const bad of ['', undefined, '24/11/2026', '2026-13-01']) expect(C.cashAdjustDateError(bad, '2026-11-24')).toBe('Indique une date valide');
  });
});

describe('cashAdjustApply / cashAdjustRemove', () => {
  const a = (date, id = date) => ({ id, date, balances: {} });
  it('ajoute et trie par date', () => expect(C.cashAdjustApply([a('2024-05-01'), a('2024-01-01')], a('2024-03-01')).map(x => x.date)).toEqual(['2024-01-01', '2024-03-01', '2024-05-01']));
  it('une régularisation à la même date est remplacée (une seule par date)', () => {
    const r = C.cashAdjustApply([a('2024-01-01', 'old')], a('2024-01-01', 'new'));
    expect(r.map(x => x.id)).toEqual(['new']);
  });
  it('liste absente : crée la liste ; la liste d\'origine n\'est pas modifiée', () => {
    expect(C.cashAdjustApply(undefined, a('2024-01-01'))).toHaveLength(1);
    const src = [a('2024-02-01')]; C.cashAdjustApply(src, a('2024-01-01'));
    expect(src).toHaveLength(1);
  });
  it('suppression par identifiant', () => {
    expect(C.cashAdjustRemove([a('2024-01-01', 'x'), a('2024-02-01', 'y')], 'x').map(v => v.id)).toEqual(['y']);
    expect(C.cashAdjustRemove(undefined, 'x')).toEqual([]);
  });
});

describe('cfStampCcy : migration de la devise des anciens apports', () => {
  it('écrit la devise courante du compte sur les apports qui n\'en ont pas, sans toucher les autres', () => {
    const acc = { currency: 'EUR', cashflows: [{ amount: 1 }, { amount: 2, ccy: 'USD' }] };
    C.cfStampCcy(acc);
    expect(acc.cashflows.map(c => c.ccy)).toEqual(['EUR', 'USD']);
  });
  it('après le marquage, changer la devise du compte ne réinterprète plus les apports', () => {
    const acc = { currency: 'EUR', cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 1000 }], holdings: [] };
    const before = PU.accCash(acc, { EUR: 1, USD: 1.08 }, 'EUR');
    C.cfStampCcy(acc);
    acc.currency = 'USD';
    expect(PU.accCash(acc, { EUR: 1, USD: 1.08 }, 'EUR')).toBe(before);
  });
  it('compte sans devise ni apport : sans effet', () => {
    expect(() => C.cfStampCcy({})).not.toThrow();
  });
});
