import { beforeEach, describe, expect, it } from 'vitest';
import { loadClassic, fakeDocument } from '../helpers/load-classic.js';
import { LOAN } from '../helpers/loan.js';

const CALC = ['IMMO_KINDS', 'immoValid', 'immoFormError', 'immoLoan', 'immoCalc', 'immoTotals', 'immoAge', 'immoNotaryEstimate'];
const calc = loadClassic('js/features/realestate-calc.js', { globals: LOAN, exports: CALC });
const { createImmoStore } = loadClassic('js/features/realestate-storage.js', { globals: { immoValid: calc.immoValid }, exports: ['createImmoStore'] });

function makeDom() {
  const els = {}, handlers = {}, base = fakeDocument();
  const get = id => (els[id] ??= {
    id, value: '', innerHTML: '', textContent: '', disabled: false,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { (handlers[id] ??= {})[type] = fn; },
  });
  return { els, handlers, document: { ...base, getElementById: get } };
}
function memoryStorage() {
  const data = new Map();
  return { data, getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); } };
}
const clickOn = (attr, value = '1') => ({ target: { closest: sel => (sel === `[${attr}]` ? { dataset: { [attr.replace('data-', '')]: value } } : null) } });
const prop = (over = {}) => ({ id: 'im1', name: 'Appart', kind: 'main', buyDate: '2025-09-11', price: 100000, notary: 8000, works: 0, otherFees: 0, growth: 2, loan: null, ...over });

describe('Écrans Immobilier', () => {
  let S, dom, storage, toasts, calls, api;
  beforeEach(() => {
    S = { isDemo: false, screen: 'immo', immoId: null };
    dom = makeDom(); storage = memoryStorage();
    toasts = []; calls = { render: [], go: [], back: 0, confirm: null };
    api = loadClassic('js/screens/immo.js', {
      globals: {
        ...calc, createImmoStore, document: dom.document, S, localStorage: storage, SCREEN_BIND: {}, registerModal() {},
        toast: m => toasts.push(m), esc: s => String(s), masked: v => v.toFixed(2), fmtDate: d => d, _dayKey: () => '2026-11-22',
        renderScreen: id => calls.render.push(id), go: id => calls.go.push(id), back() { calls.back++; },
        openConfirm: (m, cb) => { calls.confirm = { m, cb }; },
      },
      exports: ['renderImmo', 'renderImmoDetail', 'openImmoForm', 'openImmoAmort', 'SCREEN_BIND'],
    });
  });
  const store = mode => createImmoStore(storage, mode || 'real');
  const bind = id => { const el = { querySelector: () => null }; api.SCREEN_BIND[id](el); return el; };
  const fillForm = (v = {}) => {
    const f = { 'im-name': 'Maison', 'im-kind': 'secondary', 'im-date': '2025-09-11', 'im-price': '100000', 'im-notary': '8000', 'im-works': '', 'im-other': '', 'im-growth': '2',
      'im-l-amt': '', 'im-l-rate': '', 'im-l-years': '', 'im-l-pay': '', 'im-l-first': '', ...v };
    api.openImmoForm();
    Object.entries(f).forEach(([id, value]) => { dom.els[id].value = value; });
  };
  const save = () => dom.handlers['im-save'].click();

  describe('liste', () => {
    it('affiche le patrimoine net, la valeur brute, le crédit restant et une tuile par bien', () => {
      store().save([prop({ growth: 0, loan: { amount: 50000, rate: 0, years: 10, payment: 0, first: '' } })]);
      const html = api.renderImmo();
      expect(html).toContain('Patrimoine immobilier net');
      expect(html).toContain('Valeur brute 100000.00 · Crédit restant');
      expect(html).toContain('data-imopen="im1"');
      expect(html).toContain('Crédit remboursé :');
    });
    it('liste vide : message d\'invitation, sans bloc de totaux à 0,00 €', () => {
      const html = api.renderImmo();
      expect(html).toContain('Aucun bien');
      expect(html).not.toContain('Patrimoine immobilier net');
    });
    it('mode courant uniquement', () => {
      store('demo').save([prop({ id: 'imD', name: 'Bien démo' })]);
      expect(api.renderImmo().includes('imD')).toBe(false);
      S.isDemo = true;
      expect(api.renderImmo()).toContain('data-imopen="imD"');
    });
    it('données corrompues : bandeau d\'erreur, rien d\'effacé', () => {
      storage.setItem('patrimoine-immo-real', '[broken');
      expect(api.renderImmo()).toContain('Données illisibles');
      expect(storage.getItem('patrimoine-immo-real')).toBe('[broken');
    });
    it('toucher une tuile ouvre la fiche du bien', () => {
      bind('immo').onclick(clickOn('data-imopen', 'im1'));
      expect(S.immoId).toBe('im1');
      expect(calls.go).toEqual(['immodetail']);
    });
    it('anciens biens : proposés seulement si le mode est vide, copiés après confirmation', () => {
      storage.setItem('patrimoine-immo', JSON.stringify([prop()]));
      expect(api.renderImmo()).toContain('Anciens biens détectés');
      bind('immo').onclick(clickOn('data-imlegacy'));
      expect(calls.confirm.m).toContain('mode réel');
      expect(store().read()).toHaveLength(0);
      calls.confirm.cb();
      expect(store().read()).toHaveLength(1);
      expect(calls.render).toContain('immo');
      expect(api.renderImmo().includes('Anciens biens détectés')).toBe(false);
    });
  });

  describe('fiche', () => {
    it('affiche prix, notaire, autres frais (sous le notaire), coût total, valeur estimée et patrimoine net', () => {
      store().save([prop({ price: 455000, notary: 36400, otherFees: 600 })]);
      S.immoId = 'im1';
      const html = api.renderImmoDetail();
      expect(html).toContain('Frais de notaire');
      expect(html.indexOf('Autres frais')).toBeGreaterThan(html.indexOf('Frais de notaire'));
      expect(html.indexOf('Autres frais')).toBeLessThan(html.indexOf('Coût total'));
      expect(html).toContain('492000.00');
      expect(html).toContain('Résidence principale');
      expect(html).toContain('Patrimoine net du bien');
    });
    it('lignes facultatives absentes quand elles valent 0', () => {
      store().save([prop()]);
      S.immoId = 'im1';
      const html = api.renderImmoDetail();
      expect(html.includes('Autres frais')).toBe(false);
      expect(html.includes('Travaux')).toBe(false);
    });
    it('bouton « Tableau d\'amortissement » seulement avec un crédit', () => {
      S.immoId = 'im1';
      store().save([prop()]);
      expect(api.renderImmoDetail().includes('data-imamort')).toBe(false);
      store().save([prop({ loan: { amount: 90000, rate: 3.5, years: 20, payment: 560, first: '' } })]);
      const html = api.renderImmoDetail();
      expect(html).toContain('data-imamort');
      expect(html).toContain('dont assurance');
    });
    it('bien introuvable : message', () => {
      S.immoId = 'absent';
      expect(api.renderImmoDetail()).toContain('Bien introuvable');
    });
    it('supprimer : confirmation, puis le bien disparaît, la liste est re-rendue AVANT le retour', () => {
      store().save([prop(), prop({ id: 'im2', kind: 'rental' })]);
      S.immoId = 'im1'; S.screen = 'immodetail';
      bind('immodetail').onclick(clickOn('data-imdel'));
      expect(calls.confirm.m).toContain('Appart');
      calls.confirm.cb();
      expect(store().read().map(p => p.id)).toEqual(['im2']);
      expect(calls.render).toEqual(['immo', 'immodetail', 'dashboard', 'analysis']);   // liste, fiche, puis écrans qui affichent le patrimoine net
      expect(calls.back).toBe(1);
    });
    it('suppression impossible (données corrompues) : rien ne bouge', () => {
      storage.setItem('patrimoine-immo-real', '[broken');
      S.immoId = 'im1';
      bind('immodetail').onclick(clickOn('data-imdel'));
      calls.confirm.cb();
      expect(storage.getItem('patrimoine-immo-real')).toBe('[broken');
      expect(calls.back).toBe(0);
    });
    it('« Modifier » ouvre le formulaire prérempli', () => {
      store().save([prop({ name: 'Mon bien', otherFees: 600 })]);
      S.immoId = 'im1';
      bind('immodetail').onclick(clickOn('data-imedit'));
      expect(dom.els['im-name'].value).toBe('Mon bien');
      expect(dom.els['im-other'].value).toBe(600);
      expect(dom.els['im-title'].textContent).toBe('Modifier le bien');
    });
  });

  describe('formulaire', () => {
    it('enregistre un nouveau bien dans le mode courant et rafraîchit la liste', () => {
      fillForm({ 'im-other': '600' });
      save();
      const [p] = store().read();
      expect({ name: p.name, kind: p.kind, price: p.price, notary: p.notary, otherFees: p.otherFees, growth: p.growth, loan: p.loan })
        .toEqual({ name: 'Maison', kind: 'secondary', price: 100000, notary: 8000, otherFees: 600, growth: 2, loan: null });
      expect(store('demo').read()).toHaveLength(0);
      expect(calls.render).toContain('immo');
      expect(toasts.at(-1)).toBe('Bien enregistré ✓');
    });
    it('nom vide : prend le libellé du type', () => {
      fillForm({ 'im-name': '' }); save();
      expect(store().read()[0].name).toBe('Résidence secondaire');
    });
    it('enregistre le crédit saisi (virgule décimale acceptée)', () => {
      fillForm({ 'im-l-amt': '90000', 'im-l-rate': '3,5', 'im-l-years': '20', 'im-l-pay': '560' }); save();
      expect(store().read()[0].loan).toEqual({ amount: 90000, rate: 3.5, years: 20, payment: 560, first: '' });
    });
    it.each([
      ['sans date', { 'im-date': '' }, "La date d'achat est obligatoire"],
      ['sans prix', { 'im-price': '' }, "Indique le prix d'achat"],
      ['autres frais négatifs', { 'im-other': '-5' }, 'Autres frais : indique un montant positif ou nul'],
      ['crédit sans durée', { 'im-l-amt': '1000' }, 'Indique la durée du crédit'],
    ])('refuse : %s', (_, v, msg) => {
      fillForm(v); save();
      expect(toasts.at(-1)).toBe(msg);
      expect(store().read()).toHaveLength(0);
    });
    it('refuse une seconde résidence principale', () => {
      store().save([prop()]);
      fillForm({ 'im-kind': 'main' }); save();
      expect(toasts.at(-1)).toBe('Une résidence principale existe déjà');
      expect(store().read()).toHaveLength(1);
    });
    it('l\'option « résidence principale » est désactivée si une autre existe, et le type par défaut devient « secondaire »', () => {
      store().save([prop()]);
      api.openImmoForm();
      expect(dom.els['im-kind-main'].disabled).toBe(true);
      expect(dom.els['im-kind'].value).toBe('secondary');
    });
    it('en modifiant LA résidence principale, l\'option reste active', () => {
      store().save([prop()]);
      api.openImmoForm('im1');
      expect(dom.els['im-kind-main'].disabled).toBe(false);
      expect(dom.els['im-kind'].value).toBe('main');
    });
    it('modifier un bien existant ne crée pas de doublon et conserve son identifiant', () => {
      store().save([prop()]);
      api.openImmoForm('im1');
      dom.els['im-price'].value = '120000';
      save();
      const list = store().read();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('im1');
      expect(list[0].price).toBe(120000);
    });
    it('bien à modifier introuvable : prévient', () => {
      api.openImmoForm('absent');
      expect(toasts.at(-1)).toBe('Bien introuvable');
    });
    it('ne remplace pas des données corrompues', () => {
      storage.setItem('patrimoine-immo-real', '[broken');
      fillForm(); save();
      expect(storage.getItem('patrimoine-immo-real')).toBe('[broken');
      expect(toasts.at(-1).startsWith('Enregistrement impossible')).toBe(true);
    });
    it('« Estimer à 8 % » remplit les frais de notaire, et demande d\'abord le prix', () => {
      api.openImmoForm();
      dom.els['im-price'].value = '';
      dom.handlers['im-notary-est'].click();
      expect(toasts.at(-1)).toBe("Saisis d'abord le prix d'achat");
      dom.els['im-price'].value = '455000';
      dom.handlers['im-notary-est'].click();
      expect(dom.els['im-notary'].value).toBe(36400);
    });
    it('aperçu du crédit : mensualité calculée et assurance déduite', () => {
      fillForm({ 'im-l-amt': '90000', 'im-l-rate': '3.5', 'im-l-years': '20', 'im-l-pay': '560' });
      dom.handlers['im-sheet'].input();
      expect(dom.els['im-prev'].innerHTML).toContain('Mensualité calculée');
      expect(dom.els['im-prev'].innerHTML).toContain('Assurance déduite');
    });
  });

  describe('tableau d\'amortissement', () => {
    it('une ligne par année, l\'année en cours dépliée, la prochaine échéance mise en évidence', () => {
      store().save([prop({ loan: { amount: 90000, rate: 3.5, years: 20, payment: 0, first: '' } })]);
      api.openImmoAmort('im1');
      const html = dom.els['ima-body'].innerHTML;
      expect(html).toContain('Amortissement — Appart');
      expect(html).toContain('240 échéances');
      expect(html).toContain('<b>2025 ✓</b>');   // année entièrement remboursée
      expect(html).toContain('<b>2045</b>');     // dernière année : rien de payé
      expect(html).toContain('<details class="ima-year" open>');
      expect(html).toContain('ima-m next');
    });
    it('bien sans crédit : rien n\'est ouvert', () => {
      store().save([prop()]);
      api.openImmoAmort('im1');
      expect(dom.els['ima-body'].innerHTML).toBe('');
    });
  });
});
