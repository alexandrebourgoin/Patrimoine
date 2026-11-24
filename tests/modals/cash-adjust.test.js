import { beforeEach, describe, expect, it } from 'vitest';
import '../../utils.js';
import { loadClassic, fakeDocument } from '../helpers/load-classic.js';

const pockets = loadClassic('js/features/cash-pockets.js', { globals: { PU: globalThis.PU }, exports: ['cashAdjustRows', 'cashAdjustBalances', 'cashAdjustDateError', 'cashAdjustApply', 'cashAdjustRemove'] });

function makeDom() {
  const els = {}, handlers = {}, base = fakeDocument();
  const get = id => (els[id] ??= { id, value: '', innerHTML: '', classList: { add() {}, remove() {} }, addEventListener(t, f) { (handlers[id] ??= {})[t] = f; } });
  return { els, handlers, document: { ...base, getElementById: get } };
}
const hit = map => ({ target: { closest: sel => map[sel] || null } });

describe('Feuille « Régulariser les liquidités »', () => {
  let S, dom, toasts, calls, api, acc;
  beforeEach(() => {
    acc = { id: 'a1', name: 'CTO', currency: 'EUR', cashflows: [{ date: '2024-01-01', type: 'DEP', amount: 1000 }], holdings: [{ currency: 'USD', transactions: [] }], value: 0 };
    S = { screen: 'account', currency: 'EUR', accounts: [acc] };
    dom = makeDom(); toasts = []; calls = { render: [], main: 0 };
    api = loadClassic('js/modals/cash-adjust.js', {
      globals: {
        ...pockets, S, document: dom.document, PU: globalThis.PU, FX_RATES: { EUR: 1, USD: 1.08, GBP: 1.16 },
        _dayKey: () => '2026-11-24', toRefCcy: (v, c) => v / ({ EUR: 1, USD: 1.08, GBP: 1.16 }[c] || 1), esc: s => String(s), masked: v => v.toFixed(2),
        fmtDate: d => d, fmtNative: (v, c) => `${v} ${c}`, toast: m => toasts.push(m), accTotal: a => 1234 + Object.keys(a.cashAdjust || {}).length,
        renderScreen: id => calls.render.push(id), refreshMain() { calls.main++; },
      },
      exports: ['openCashAdjust', 'saveCashAdjust'],
    });
  });
  const fire = (id, type, ev) => dom.handlers[id][type](ev);
  const setRow = (ccy, value) => fire('ca-body', 'input', hit({ '.ca-v': { dataset: { c: ccy }, value } }));
  const save = () => fire('ca-body', 'click', hit({ '#ca-save': {} }));

  it('ouvre avec une ligne par devise utile (compte et titres), valeurs actuelles', () => {
    api.openCashAdjust('a1');
    const html = dom.els['ca-body'].innerHTML;
    expect(html).toContain('Liquidités en EUR');
    expect(html).toContain('Liquidités en USD');
    expect(html).toContain('value="1000"');
    expect(html).toContain('Total :');
  });
  it('enregistre les soldes saisis à la date du jour, recalcule le compte et rafraîchit', () => {
    api.openCashAdjust('a1');
    setRow('EUR', '1500,50'); setRow('USD', '-250');
    save();
    expect(acc.cashAdjust).toHaveLength(1);
    expect(acc.cashAdjust[0]).toMatchObject({ date: '2026-11-24', balances: { EUR: 1500.5, USD: -250 } });
    expect(acc.value).toBe(1235);
    expect(calls.render).toEqual(['account']);
    expect(calls.main).toBe(1);
    expect(toasts.at(-1)).toBe('Liquidités régularisées ✓');
  });
  it('un montant illisible est refusé sans rien enregistrer', () => {
    api.openCashAdjust('a1');
    setRow('USD', 'abc');
    save();
    expect(acc.cashAdjust).toBeUndefined();
    expect(toasts.at(-1)).toBe('Montant invalide pour USD');
  });
  it('une date future est refusée', () => {
    api.openCashAdjust('a1');
    fire('ca-body', 'change', { target: { id: 'ca-date', value: '2027-01-01' } });
    save();
    expect(toasts.at(-1)).toBe('La date ne peut pas être dans le futur');
    expect(acc.cashAdjust).toBeUndefined();
  });
  it('une régularisation à la même date est remplacée, pas dupliquée', () => {
    api.openCashAdjust('a1'); setRow('EUR', '10'); save();
    api.openCashAdjust('a1'); setRow('EUR', '20'); save();
    expect(acc.cashAdjust).toHaveLength(1);
    expect(acc.cashAdjust[0].balances.EUR).toBe(20);
  });
  it('« Ajouter une devise » ajoute une ligne à 0', () => {
    api.openCashAdjust('a1');
    dom.els['ca-add-sel'] = { value: 'GBP' };
    fire('ca-body', 'click', hit({ '#ca-add': {} }));
    expect(dom.els['ca-body'].innerHTML).toContain('Liquidités en GBP');
  });
  it('supprimer une régularisation : retirée, puis la clé disparaît quand la liste est vide', () => {
    acc.cashAdjust = [{ id: 'r1', date: '2025-01-01', balances: { EUR: 5 } }];
    api.openCashAdjust('a1');
    fire('ca-body', 'click', hit({ '[data-cadel]': { dataset: { cadel: 'r1' } } }));
    expect(acc.cashAdjust).toBeUndefined();
    expect(calls.main).toBe(1);
  });
  it('compte introuvable : rien ne s\'ouvre', () => {
    api.openCashAdjust('inconnu');
    expect(dom.els['ca-body'].innerHTML).toBe('');
  });
  it('les régularisations enregistrées sont listées', () => {
    acc.cashAdjust = [{ id: 'r1', date: '2025-01-01', balances: { EUR: 5, USD: 7 } }];
    api.openCashAdjust('a1');
    expect(dom.els['ca-body'].innerHTML).toContain('Régularisations enregistrées');
    expect(dom.els['ca-body'].innerHTML).toContain('5 EUR · 7 USD');
  });
});
