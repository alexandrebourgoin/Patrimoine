import { describe, expect, it } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';
import { LOAN } from '../helpers/loan.js';

const R = loadClassic('js/features/realestate-calc.js', { globals: LOAN,
  exports: ['IMMO_KINDS', 'immoValid', 'immoFormError', 'immoAddMonths', 'immoYearsBetween', 'immoLoan', 'immoLoans', 'immoLoanSchedules', 'immoCalc', 'immoTotals', 'immoAge', 'immoNotaryEstimate'],
});
const prop = (over = {}) => ({ id: 'im1', name: 'Appart', kind: 'main', buyDate: '2025-09-11', price: 100000, notary: 8000, works: 0, otherFees: 0, growth: 2, loan: null, ...over });
const loan = (over = {}) => ({ amount: 90000, rate: 3.5, years: 20, payment: 0, first: '', ...over });

describe('immoAddMonths', () => {
  it('ajoute des mois en gardant le jour', () => expect(R.immoAddMonths('2025-09-11', 1)).toBe('2025-10-11'));
  it('passe l\'année', () => expect(R.immoAddMonths('2025-11-15', 3)).toBe('2026-02-15'));
  it('ramène le 31 à la fin du mois court (années non bissextile / bissextile)', () => {
    expect(R.immoAddMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(R.immoAddMonths('2024-01-31', 1)).toBe('2024-02-29');
  });
  it('0 mois = même date, et nombre de mois négatif possible', () => {
    expect(R.immoAddMonths('2025-09-11', 0)).toBe('2025-09-11');
    expect(R.immoAddMonths('2025-03-31', -1)).toBe('2025-02-28');
  });
});

describe('immoYearsBetween', () => {
  it('un an civil ≈ 1 (365,25 jours par an)', () => expect(R.immoYearsBetween('2025-01-01', '2026-01-01')).toBeCloseTo(365 / 365.25, 6));
  it('jamais négatif (achat dans le futur)', () => expect(R.immoYearsBetween('2030-01-01', '2026-01-01')).toBe(0));
  it('insensible aux changements d\'heure : 7 jours exactement autour du passage à l\'heure d\'été', () => {
    expect(R.immoYearsBetween('2026-03-25', '2026-04-01') * 365.25).toBeCloseTo(7, 9);
  });
});

describe('immoLoan', () => {
  it('sans crédit → null ; montant ou durée nuls → null', () => {
    expect(R.immoLoan(prop(), '2026-11-22')).toBeNull();
    expect(R.immoLoan(prop({ loan: loan({ years: 0 }) }), '2026-11-22')).toBeNull();
    expect(R.immoLoan(prop({ loan: loan({ amount: 0 }) }), '2026-11-22')).toBeNull();
  });
  it('mensualité théorique : 90 000 € à 3,5 % sur 20 ans ≈ 521,96 € (formule : M = C·r / (1 − (1+r)^−n))', () => {
    const r = 0.035 / 12;
    expect(R.immoLoan(prop({ loan: loan() }), '2026-11-22').pmt).toBeCloseTo(90000 * r / (1 - Math.pow(1 + r, -240)), 8);
    expect(R.immoLoan(prop({ loan: loan() }), '2026-11-22').pmt).toBeCloseTo(521.96, 2);
  });
  it('taux nul : remboursement linéaire', () => {
    const L = R.immoLoan(prop({ loan: loan({ rate: 0, years: 10 }) }), '2026-11-22');
    expect(L.pmt).toBeCloseTo(750, 6);
    expect(L.rows[0].interest).toBe(0);
  });
  it('échéancier : 240 lignes, solde final exactement nul, capital total = montant emprunté', () => {
    const L = R.immoLoan(prop({ loan: loan() }), '2026-11-22');
    expect(L.rows).toHaveLength(240);
    expect(L.rows.at(-1).bal).toBe(0);
    expect(L.rows.reduce((s, r) => s + r.princ, 0)).toBeCloseTo(90000, 6);
  });
  it('première échéance = achat + 1 mois par défaut, ou la date saisie', () => {
    expect(R.immoLoan(prop({ loan: loan() }), '2026-11-22').rows[0].date).toBe('2025-10-11');
    expect(R.immoLoan(prop({ loan: loan({ first: '2026-01-05' }) }), '2026-11-22').rows[0].date).toBe('2026-01-05');
  });
  it('échéances passées : datées au plus tard d\'aujourd\'hui (inclus) ; la suivante est la première future', () => {
    const L = R.immoLoan(prop({ loan: loan() }), '2026-11-11');
    expect(L.rows.filter(r => r.past)).toHaveLength(14);
    expect(L.next.date).toBe('2026-12-11');
    expect(R.immoLoan(prop({ loan: loan() }), '2026-11-10').rows.filter(r => r.past)).toHaveLength(13);
  });
  it('assurance = mensualité saisie − mensualité calculée ; jamais négative ; alerte si trop basse', () => {
    const ok = R.immoLoan(prop({ loan: loan({ payment: 560 }) }), '2026-11-22');
    expect(ok.ins).toBeCloseTo(560 - ok.pmt, 6);
    expect(ok.warn).toBe(false);
    const low = R.immoLoan(prop({ loan: loan({ payment: 400 }) }), '2026-11-22');
    expect(low.ins).toBe(0);
    expect(low.warn).toBe(true);
  });
  it('prêt entièrement remboursé : plus d\'échéance à venir, capital restant nul', () => {
    const L = R.immoLoan(prop({ loan: loan() }), '2060-01-01');
    expect(L.next).toBeNull();
    expect(L.remaining).toBeCloseTo(0, 6);
    expect(L.pct).toBeCloseTo(100, 6);
  });
  it('avant la première échéance : rien de remboursé', () => {
    const L = R.immoLoan(prop({ loan: loan() }), '2025-09-12');
    expect(L.repaid).toBe(0);
    expect(L.remaining).toBe(90000);
  });
  it('fin du prêt = dernière échéance', () => {
    expect(R.immoLoan(prop({ loan: loan() }), '2026-11-22').end).toBe('2045-09-11');
  });
});

describe('immoCalc : cas de référence de la fiche (captures du 21-22/11/2026)', () => {
  // Appartement acheté le 11/09/2025 : 455 000 € + notaire 36 400 € + autres frais 600 €, +2 %/an,
  // crédit de 455 000 € à 3,1 % sur 20 ans, mensualité 2 600 € assurance comprise.
  const p = prop({ price: 455000, notary: 36400, otherFees: 600, growth: 2, loan: loan({ amount: 455000, rate: 3.1, years: 20, payment: 2600 }) });
  const c = R.immoCalc(p, '2026-11-22');
  it('coût total = prix + notaire + autres frais (492 000 €)', () => expect(c.cost).toBe(492000));
  it('capital restant dû après 14 échéances = 435 482,62 €', () => expect(c.debt).toBeCloseTo(435482.62, 2));
  it('mensualité hors assurance 2 546,26 € ; assurance 53,74 €', () => {
    expect(c.loan.pmt).toBeCloseTo(2546.26, 2);
    expect(c.loan.ins).toBeCloseTo(53.74, 2);
  });
  it('capital remboursé 19 517,38 € ; intérêts + assurance 16 882,62 €', () => {
    expect(c.loan.repaid).toBeCloseTo(19517.38, 2);
    expect(c.loan.interestPaid + c.loan.insPaid).toBeCloseTo(16882.62, 2);
  });
  it('part remboursée ≈ 4,3 %', () => expect(c.loan.pct).toBeCloseTo(4.29, 2));
  it('valeur estimée ≈ 465 909 € (à un jour près, la capture dépend de l\'heure)', () => expect(Math.abs(c.value - 465909.37)).toBeLessThan(30));
  it('patrimoine net = valeur − capital restant dû ; écart = valeur − coût', () => {
    expect(c.equity).toBeCloseTo(c.value - c.debt, 6);
    expect(c.gap).toBeCloseTo(c.value - 492000, 6);
  });
});

describe('immoCalc : stabilité et cas limites', () => {
  it('valeur identique tout au long d\'une même journée (calcul au jour, pas à la seconde)', () => {
    const p = prop();
    expect(R.immoCalc(p, '2026-11-22').value).toBe(R.immoCalc(p, '2026-11-22').value);
  });
  it('croissance nulle : la valeur reste le prix', () => expect(R.immoCalc(prop({ growth: 0 }), '2030-01-01').value).toBe(100000));
  it('croissance négative : la valeur baisse', () => expect(R.immoCalc(prop({ growth: -2 }), '2030-01-01').value).toBeLessThan(100000));
  it('achat dans le futur : valeur = prix (pas de croissance négative dans le temps)', () => expect(R.immoCalc(prop({ buyDate: '2031-01-01' }), '2026-01-01').value).toBe(100000));
  it('sans crédit : dette nulle, valeur nette = valeur', () => {
    const c = R.immoCalc(prop(), '2026-11-22');
    expect(c.debt).toBe(0);
    expect(c.equity).toBe(c.value);
  });
  it('champs optionnels absents (anciens biens) : traités comme 0', () => {
    const c = R.immoCalc({ id: 'x', name: 'Ancien', kind: 'rental', buyDate: '2025-01-01', price: 50000 }, '2025-01-01');
    expect(c.cost).toBe(50000);
  });
});

describe('immoTotals', () => {
  it('additionne valeur, dette, patrimoine net, coût et écart', () => {
    const list = [prop({ growth: 0 }), prop({ id: 'im2', kind: 'rental', growth: 0, loan: loan({ amount: 50000, rate: 0, years: 10 }) })];
    const t = R.immoTotals(list, '2026-11-22');
    expect(t.value).toBe(200000);
    expect(t.cost).toBe(216000);
    expect(t.equity).toBeCloseTo(t.value - t.debt, 6);
    expect(t.gap).toBeCloseTo(t.value - t.cost, 6);
  });
  it('liste vide → zéros', () => expect(R.immoTotals([], '2026-11-22')).toEqual({ value: 0, debt: 0, equity: 0, cost: 0, gap: 0 }));
});

describe('immoAge / immoNotaryEstimate', () => {
  it('formats', () => {
    expect(R.immoAge(1 + 2 / 12 + 0.01)).toBe('1 an 2 mois');
    expect(R.immoAge(2)).toBe('2 ans');
    expect(R.immoAge(5 / 12 + 0.01)).toBe('5 mois');
    expect(R.immoAge(0.01)).toBe("moins d'un mois");
  });
  it('frais de notaire à 8 %, arrondis', () => {
    expect(R.immoNotaryEstimate(455000)).toBe(36400);
    expect(R.immoNotaryEstimate(100001)).toBe(8000);
  });
});

describe('immoFormError', () => {
  const ok = { kind: 'secondary', buyDate: '2025-09-11', price: 100000, notary: 0, works: 0, otherFees: 0, growth: 2, loan: null };
  it('saisie valide', () => expect(R.immoFormError(ok, [])).toBeNull());
  it('date d\'achat obligatoire et au bon format', () => {
    expect(R.immoFormError({ ...ok, buyDate: '' }, [])).toBe("La date d'achat est obligatoire");
    expect(R.immoFormError({ ...ok, buyDate: '11/09/2025' }, [])).toBe("La date d'achat est obligatoire");
  });
  it('prix d\'achat > 0', () => expect(R.immoFormError({ ...ok, price: 0 }, [])).toBe("Indique le prix d'achat"));
  it('frais négatifs ou non finis refusés, avec le nom du champ', () => {
    expect(R.immoFormError({ ...ok, otherFees: -1 }, [])).toBe('Autres frais : indique un montant positif ou nul');
    expect(R.immoFormError({ ...ok, notary: -5 }, [])).toBe('Frais de notaire : indique un montant positif ou nul');
    expect(R.immoFormError({ ...ok, works: NaN }, [])).toBe('Travaux : indique un montant positif ou nul');
  });
  it('crédit : durée > 0 et taux ≥ 0', () => {
    expect(R.immoFormError({ ...ok, loan: { amount: 1, rate: 3, years: 0 } }, [])).toBe('Indique la durée du crédit');
    expect(R.immoFormError({ ...ok, loan: { amount: 1, rate: -1, years: 5 } }, [])).toBe('Le taux du crédit doit être positif ou nul');
  });
  it('une seule résidence principale : refusée si une autre existe, acceptée sinon', () => {
    expect(R.immoFormError({ ...ok, kind: 'main' }, [{ kind: 'main' }])).toBe('Une résidence principale existe déjà');
    expect(R.immoFormError({ ...ok, kind: 'main' }, [{ kind: 'secondary' }])).toBeNull();
    expect(R.immoFormError({ ...ok, kind: 'secondary' }, [{ kind: 'main' }])).toBeNull();
  });
});

describe('immoValid', () => {
  it('bien valide, avec ou sans crédit, ancien bien sans les champs optionnels', () => {
    expect(R.immoValid(prop())).toBe(true);
    expect(R.immoValid(prop({ loan: loan() }))).toBe(true);
    expect(R.immoValid({ id: 'x', name: 'n', kind: 'rental', buyDate: '2025-01-01', price: 1 })).toBe(true);
  });
  it.each([
    ['null', null], ['sans identifiant', prop({ id: '' })], ['type inconnu', prop({ kind: 'villa' })],
    ['date mal formée', prop({ buyDate: '2025-9-1' })], ['prix nul', prop({ price: 0 })], ['prix texte', prop({ price: '100' })],
    ['frais négatifs', prop({ notary: -1 })], ['croissance infinie', prop({ growth: Infinity })],
    ['crédit sans durée', prop({ loan: loan({ years: 0 }) })], ['première échéance mal formée', prop({ loan: loan({ first: 'demain' }) })],
  ])('refuse : %s', (_, bad) => expect(R.immoValid(bad)).toBe(false));
});

describe('plusieurs crédits par bien', () => {
  const loans = [{ id: 'a', label: 'Prêt principal', amount: 90000, rate: 3.5, years: 20 }, { id: 'b', label: 'PTZ', amount: 20000, rate: 0, years: 10, insurance: 10 }];
  it('immoLoans : liste « loans », ou ancien crédit unique converti', () => {
    expect(R.immoLoans(prop({ loans }))).toHaveLength(2);
    expect(R.immoLoans(prop({ loan: { amount: 1000, rate: 1, years: 1 } }))).toEqual([{ id: 'l1', label: '', amount: 1000, rate: 1, years: 1 }]);
    expect(R.immoLoans(prop())).toEqual([]);
  });
  it('validité : chaque crédit est contrôlé ; « loans » doit être une liste', () => {
    expect(R.immoValid(prop({ loans }))).toBe(true);
    expect(R.immoValid(prop({ loans: [{ amount: 1000, years: 0 }] }))).toBe(false);
    expect(R.immoValid(prop({ loans: [{ ...loans[0], insurance: -1 }] }))).toBe(false);
    expect(R.immoValid(prop({ loans: 'x' }))).toBe(false);
  });
  it('dette et mensualités = somme des crédits ; fin = dernier crédit ; prochaine échéance = la plus proche', () => {
    const p = prop({ buyDate: '2025-01-10', loans });
    const c = R.immoCalc(p, '2026-01-10');
    const one = R.immoLoanSchedules(p, '2026-01-10');
    expect(c.debt).toBeCloseTo(one[0].s.remaining + one[1].s.remaining, 6);
    expect(c.loan.pmt).toBeCloseTo(one[0].s.pmt + one[1].s.pmt, 6);
    expect(c.loan.ins).toBe(10);
    expect(c.loan.end).toBe(one[0].s.end);
    expect(c.loan.count).toBe(2);
  });
  it('formulaire : l\'erreur nomme le crédit concerné quand il y en a plusieurs', () => {
    const p = prop({ loans: [loans[0], { label: 'PTZ', amount: 20000, rate: 0, years: 0 }] });
    expect(R.immoFormError(p, [])).toBe('Crédit 2 (PTZ) : indique la durée du crédit');
  });
});
