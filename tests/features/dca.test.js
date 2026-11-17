import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

// S est injecté par référence : chaque test fixe S.dca.plans avant d'appeler le vrai code.
const S = { dca: { plans: [], goals: [] }, accounts: [], watchlist: [], isDemo: true };
const { dcaPlanAt, dcaOccurrences, dcaStats, dcaGoalCalc } = loadClassic('js/features/dca.js', {
  globals: { S, toRefCcy: v => v, masked: v => String(v), toast() {} },
  exports: ['dcaPlanAt', 'dcaOccurrences', 'dcaStats', 'dcaGoalCalc'],
});

// Budget 100 €/mois le 5 à partir du 10/01/2024, puis 200 €/mois le 31 à partir du 01/04/2024.
const P0 = { from: '2024-01-10', budget: 100, day: 5,  lines: [] };
const P1 = { from: '2024-04-01', budget: 200, day: 31, lines: [] };

beforeEach(() => { S.dca = { plans: [P0, P1], goals: [] }; });
afterEach(() => { vi.useRealTimers(); });

describe('dcaPlanAt', () => {
  it('renvoie le dernier plan dont la date d\'effet est passée', () => {
    expect(dcaPlanAt('2024-03-01')).toBe(P0);
    expect(dcaPlanAt('2024-04-01')).toBe(P1);
    expect(dcaPlanAt('2030-01-01')).toBe(P1);
  });
  it('null avant le premier plan', () => {
    expect(dcaPlanAt('2023-12-31')).toBeNull();
  });
});

describe('dcaOccurrences', () => {
  it('aucune échéance sans plan', () => {
    S.dca.plans = [];
    expect(dcaOccurrences('2030-01-01')).toEqual([]);
  });
  it('saute le mois de départ si le jour d\'échéance précède la date d\'effet', () => {
    // 05/01 < 10/01 → pas d'échéance en janvier ; la 1re est le 05/02
    const dates = dcaOccurrences('2024-06-30').map(o => o.date);
    expect(dates[0]).toBe('2024-02-05');
  });
  it('change de stratégie à la date d\'effet du plan suivant, et cale le jour 31 sur la fin du mois', () => {
    const occ = dcaOccurrences('2024-06-30');
    expect(occ.map(o => o.date)).toEqual(['2024-02-05', '2024-03-05', '2024-04-30', '2024-05-31', '2024-06-30']);
    expect(occ.map(o => o.plan.budget)).toEqual([100, 100, 200, 200, 200]);
  });
  it('borne supérieure incluse, exclue le lendemain', () => {
    expect(dcaOccurrences('2024-06-30').at(-1).date).toBe('2024-06-30');
    expect(dcaOccurrences('2024-06-29').at(-1).date).toBe('2024-05-31');
  });
  it('février d\'une année non bissextile : jour 31 → 28', () => {
    S.dca.plans = [{ from: '2025-01-01', budget: 50, day: 31, lines: [] }];
    expect(dcaOccurrences('2025-03-01').map(o => o.date)).toEqual(['2025-01-31', '2025-02-28']);
  });
});

describe('dcaStats', () => {
  it('cumul théorique des échéances passées + 12 prochaines échéances projetées', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15, 12)); // 15/06/2024
    const st = dcaStats();
    expect(st.today).toBe('2024-06-15');
    expect(st.cumul).toBe(100 + 100 + 200 + 200);          // 05/02, 05/03, 30/04, 31/05
    expect(st.current).toBe(P1);
    expect(st.next.date).toBe('2024-06-30');
    expect(st.proj).toHaveLength(12);
    expect(st.proj[0]).toEqual({ date: '2024-06-30', budget: 200, cumul: 800 });
    expect(st.proj[11]).toEqual({ date: '2025-05-31', budget: 200, cumul: 3000 });
  });
});

describe('dcaGoalCalc', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2025, 0, 15, 12)); }); // 15/01/2025

  it('sans rendement : versement mensuel nécessaire = reste / nb de mois', () => {
    const r = dcaGoalCalc({ date: '2026-01-15', target: 12000, start: 0, rate: 0 }, 100);
    expect(r.n).toBe(12);
    expect(r.proj).toBe(1200);
    expect(r.need).toBe(1000);
    expect(r.pct).toBe(0);
    expect(r.ok).toBe(false);
  });
  it('avec rendement : intérêts composés mensuels (12 %/an = 1 %/mois)', () => {
    const r = dcaGoalCalc({ date: '2026-01-15', target: 2000, start: 1000, rate: 12 }, 0);
    expect(r.proj).toBeCloseTo(1126.83, 1);
    expect(r.pct).toBe(50);
  });
  it('échéance dépassée : 0 mois, pas de versement nécessaire', () => {
    const r = dcaGoalCalc({ date: '2025-01-14', target: 5000, start: 300, rate: 0 }, 100);
    expect(r.n).toBe(0);
    expect(r.need).toBeNull();
    expect(r.proj).toBe(300);
  });
  it('objectif déjà atteint : pct plafonné à 100 et ok = true', () => {
    const r = dcaGoalCalc({ date: '2026-01-15', target: 12000, start: 15000, rate: 0 }, 0);
    expect(r.pct).toBe(100);
    expect(r.ok).toBe(true);
  });
});
