import { describe, it, expect } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';
import { LOAN } from '../helpers/loan.js';

const H = loadClassic('js/features/home-watch.js', { exports: ['HOME_WATCH', 'homeWatchItems', 'homeWatchLoanDue', '_hwAddDays'] });

describe('À surveiller : registre', () => {
  it('limite le nombre d éléments et ignore les éléments sans texte ou sans cible', () => {
    const src = { a: () => Array.from({ length: 9 }, (_, i) => ({ level: 'info', text: 'x' + i, go: 'dca' })), b: () => [{ level: 'alert', go: 'orders' }, null, { text: 'sans cible' }] };
    const it = H.homeWatchItems(src, 6);
    expect(it).toHaveLength(6);
    expect(it[0]).toEqual({ key: 'a', level: 'info', text: 'x0', go: 'dca' });
  });
  it('niveau inconnu traité comme une information', () => {
    expect(H.homeWatchItems({ a: () => [{ level: '??', text: 'b', go: 'x' }, { level: 'soon', text: 'a', go: 'x' }] }).map(x => x.text)).toEqual(['a', 'b']);
  });
  it('ajout de jours au-delà d un changement de mois et d année', () => {
    expect(H._hwAddDays('2026-12-28', 10)).toBe('2027-01-07');
  });
});

describe('À surveiller : échéances de crédits', () => {
  it('retient les prochaines échéances dans le délai, assurance comprise', () => {
    const s = LOAN.loanSchedule({ amount: 12000, rate: 0, years: 1, insurance: 5 }, '2026-01-05', '2026-11-26');
    const far = LOAN.loanSchedule({ amount: 12000, rate: 0, years: 1 }, '2026-01-20', '2026-11-26');
    const done = LOAN.loanSchedule({ amount: 1200, rate: 0, years: 1 }, '2024-01-01', '2026-11-26');
    const due = H.homeWatchLoanDue([{ name: 'Auto', schedule: s, go: 'credits' }, { name: 'Loin', schedule: far }, { name: 'Fini', schedule: done }, { name: 'Vide', schedule: null }], '2026-11-26', 10);
    expect(due).toEqual([{ name: 'Auto', schedule: s, go: 'credits', date: '2026-12-05', amount: 1005 }]);
  });
});
