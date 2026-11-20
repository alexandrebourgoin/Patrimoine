import { describe, it, expect, vi } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

// Environnement de formulaire simulé ; les fonctions métier viennent du vrai module.
function formFixture({ budget = '100', entries = [['AAA', '100']] } = {}) {
  const state = { dca: { plans: [], goals: [] }, accounts: [], watchlist: [], isDemo: true };
  const fields = {
    '#dca-budget': { value: budget },
    '#dca-day': { value: '5' },
    '#dca-from': { value: '2026-01-01' },
    '#dca-total': { textContent: '', style: {} },
  };
  const rows = entries.map(([ticker, value]) => {
    const inputs = { '.dl-t': { value: ticker }, '.dl-w': { value }, '.dl-c': { value: '#3B82F6' } };
    return { querySelector: selector => inputs[selector] };
  });
  const handlers = {};
  const body = {
    innerHTML: '',
    querySelector: selector => fields[selector] || null,
    querySelectorAll: selector => selector === '.dca-line' ? rows : selector === '.dl-w' ? rows.map(row => row.querySelector('.dl-w')) : [],
    addEventListener: (event, callback) => { handlers[event] = callback; },
  };
  const overlay = { classList: { add() {}, remove() {} }, addEventListener() {} };
  const storage = new Map();
  const toast = vi.fn();
  const api = loadClassic('js/features/dca.js', {
    globals: {
      S: state,
      document: { getElementById: id => id === 'dca-modal-body' ? body : overlay },
      registerModal() {},
      SECURITIES_DB: { AAA: { name: 'Titre A' }, BBB: { name: 'Titre B' }, CCC: { name: 'Titre C' } },
      ISIN_MAP: { FR0000000001: { ticker: 'AAA', name: 'Titre A' } },
      esc: value => String(value ?? ''),
      masked: value => String(value),
      fmtCur: value => String(value),
      toast,
      renderScreen: vi.fn(),
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    },
    exports: ['openDcaPlanModal', 'saveDcaPlan'],
  });
  api.openDcaPlanModal();
  function switchMode(mode) {
    handlers.click({ target: { closest: selector => selector === '[data-dmode]' ? { dataset: { dmode: mode } } : null } });
  }
  return { api, state, fields, rows, body, toast, switchMode };
}

describe('Saisie du plan DCA', () => {
  it('refuse une conversion sans budget sans effacer le formulaire', () => {
    const f = formFixture({ budget: '' });
    const before = f.body.innerHTML;
    f.switchMode('amt');
    expect(f.body.innerHTML).toBe(before);
    expect(f.toast).toHaveBeenCalledWith(expect.stringMatching(/budget/i));
    f.fields['#dca-budget'].value = '100';
    f.api.saveDcaPlan();
    expect(f.state.dca.plans[0].lines[0].weight).toBe(100);
  });

  it('accepte un écart d’un centime en montants et normalise les poids à 100 %', () => {
    const f = formFixture({ entries: [['AAA', '34'], ['BBB', '33'], ['CCC', '33']] });
    f.switchMode('amt');
    f.rows.forEach(row => { row.querySelector('.dl-w').value = '33.33'; });
    f.api.saveDcaPlan();
    expect(f.state.dca.plans).toHaveLength(1);
    expect(f.state.dca.plans[0].lines.reduce((sum, line) => sum + line.weight, 0)).toBeCloseTo(100, 10);
  });

  it('refuse un écart supérieur à un centime', () => {
    const f = formFixture();
    f.switchMode('amt');
    f.rows[0].querySelector('.dl-w').value = '99.98';
    f.api.saveDcaPlan();
    expect(f.state.dca.plans).toHaveLength(0);
  });

  it('refuse les poids négatifs même lorsque leur total vaut 100 %', () => {
    const f = formFixture({ entries: [['AAA', '-10'], ['BBB', '110']] });
    f.api.saveDcaPlan();
    expect(f.state.dca.plans).toHaveLength(0);
  });

  it('refuse le doublon entre un ISIN localement résolu et son ticker', () => {
    const f = formFixture({ entries: [['FR0000000001', '50'], ['AAA', '50']] });
    f.api.saveDcaPlan();
    expect(f.state.dca.plans).toHaveLength(0);
    expect(f.toast).toHaveBeenCalledWith(expect.stringMatching(/deux fois|doublon/i));
  });
});
