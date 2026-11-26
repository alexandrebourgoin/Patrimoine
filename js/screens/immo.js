// Écrans « Immobilier » : liste des biens (#s-immo) et fiche d'un bien (#s-immodetail), formulaire (#im-*) et tableau d'amortissement (#ima-*).
// Calculs : js/features/realestate-calc.js (purs) ; données : js/features/realestate-storage.js (une clé par mode démo / réel).
// Ici : rendu et événements uniquement. Les écrans et feuilles sont déclarés dans mon-patrimoine.html.
// Le bien affiché sur la fiche est S.immoId. Le patrimoine immobilier n'est pas (encore) intégré au patrimoine total.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre ses bindings dans SCREEN_BIND.

// ═══════════════════════════════════════════════
// DONNÉES
// ═══════════════════════════════════════════════
let _imError = '';
const _imToday = () => _dayKey(Date.now());
function imStore() { return createImmoStore(localStorage, S.isDemo ? 'demo' : 'real'); }
// Lecture protégée : l'erreur est affichée à l'écran, jamais remplacée par une liste vide enregistrée
function imRead() {
  try { const l = imStore().read(); _imError = ''; return l; }
  catch (e) { _imError = (e && e.message) || 'Données illisibles'; return []; }
}
// Renvoie false (et prévient) si l'écriture est refusée : données illisibles ou quota plein
function imSave(list) {
  try { imStore().save(list); _imError = ''; return true; }
  catch (e) { toast('Enregistrement impossible : ' + ((e && e.message) || 'erreur')); return false; }
}
function _imLegacy(list) {
  if (_imError || list.length) return null;
  try { const l = imStore().readLegacy(); return l.length ? l : null; } catch (e) { return null; }
}
// Après toute modification des biens : réaffiche la liste ET la fiche (un retour hiérarchique ne re-rend pas l'écran précédent)
// ainsi que l'Accueil et l'Analyse, qui affichent le patrimoine net (immobilier inclus)
function _imRefresh() {
  renderScreen('immo');
  if (S.screen === 'immodetail') renderScreen('immodetail');
  renderScreen('dashboard');
  renderScreen('analysis');
}

// ═══════════════════════════════════════════════
// RENDU
// ═══════════════════════════════════════════════
function _imRow(k, v, strong) { return `<div class="im-row${strong ? ' strong' : ''}"><span class="im-k">${k}</span><span class="t-num im-v">${v}</span></div>`; }
function _imSigned(v) { return `<span class="${v < 0 ? 't-loss' : 't-gain'}">${v >= 0 ? '+' : '−'}${masked(Math.abs(v))}</span>`; }
const _imBanner = () => _imError
  ? `<div class="oa-banner err">Données illisibles : ${esc(_imError)}. Rien n'est modifié ni supprimé ; l'enregistrement est bloqué tant que ces données ne sont pas corrigées.</div>`
  : '';

function renderImmo() {
  const list = imRead(), today = _imToday(), tot = immoTotals(list, today);
  const legacy = _imLegacy(list);
  const legacyCard = legacy
    ? `<div class="oa-banner"><div style="font-size:13px;font-weight:700">Anciens biens détectés</div>
      <div class="t-sm" style="margin-top:4px">${legacy.length} bien${legacy.length > 1 ? 's' : ''} enregistré${legacy.length > 1 ? 's' : ''} avant la séparation démo / réel. Ils ne sont attribués à aucun mode automatiquement.</div>
      <button class="form-submit" data-imlegacy="1" style="margin:10px 0 0;height:40px">Copier dans le mode ${S.isDemo ? 'démo' : 'réel'}</button></div>`
    : '';
  const tiles = list.map(p => {
    const c = immoCalc(p, today);
    return `<button type="button" class="acc-card tap im-tile" data-imopen="${esc(p.id)}">
      <div class="row gap12">
        <div class="acc-icon" style="background:var(--card2)">⌂</div>
        <div class="flex1" style="min-width:0"><div class="im-name">${esc(p.name)}</div><div class="t-sm">${esc(IMMO_KINDS[p.kind])}${c.share < 1 ? ` · ma part ${p.share} %` : ''}</div></div>
        <div class="col right gap4"><span class="t-num" style="font-weight:800">${masked(c.myEquity)}</span><span class="t-sm">Valeur nette${c.share < 1 || c.myDebt !== c.debt ? ' (ma part)' : ''}</span></div>
      </div>
      ${c.loan ? `<div class="acc-bar" style="margin-top:12px"><div class="acc-bar-fill" style="width:${Math.max(0, Math.min(100, c.loan.pct))}%"></div></div>
      <div class="t-sm" style="margin-top:4px">Crédit remboursé : ${c.loan.pct.toFixed(1)} %</div>` : ''}
    </button>`;
  }).join('');
  return `${moduleBarHTML('immo', "Sélectionne un bien pour consulter sa fiche. Ni loyers, ni fiscalité.")}
  <div style="padding:12px 20px">
    ${_imBanner()}${legacyCard}
    ${list.length ? `<div class="t-label">Patrimoine immobilier net</div>
    <div class="t-num" style="font-size:28px;font-weight:800">${masked(tot.equity)}</div>
    <div class="t-sm">Valeur brute ${masked(tot.value)} · Crédit restant ${masked(tot.debt)}</div>` : ''}
    <button class="form-submit" data-imnew="1">+ Ajouter un bien</button>
  </div>
  <div class="col gap12 px" style="padding-bottom:100px">${tiles || '<div class="t-sm" style="text-align:center;padding:20px">Aucun bien. Ajoute ta résidence principale ou un bien locatif.</div>'}</div>`;
}

// Bien détenu en partie, ou crédit supporté en partie : on affiche aussi « ma part »
const _imPartial = c => c.share < 1 || Math.abs(c.myDebt - c.debt) > 0.005;
// Un bloc par crédit (libellé, remboursé, restant dû, mensualité, fin), puis le total si le bien en a plusieurs
function _imOneLoanHTML(L, s, idx, many) {
  const hasIns = s.ins > 0.005;
  return `<div class="im-loan">
    <div class="im-row strong"><span>${many ? esc(L.label || 'Crédit ' + (idx + 1)) : 'Crédit remboursé'}</span><span class="t-num">${s.pct.toFixed(1)} %</span></div>
    <div class="im-bar"><div style="width:${Math.min(100, s.pct).toFixed(1)}%"></div></div>
    ${_imRow('Capital remboursé', `${masked(s.repaid)} <span class="t-sm">/ ${masked(L.amount)}</span>`)}
    ${_imRow('Capital restant dû', masked(s.remaining))}
    ${_imRow('Mensualité', `${masked(s.pmt + s.ins)}${hasIns ? ` <span class="t-sm">dont assurance ${masked(s.ins)}</span>` : ''}`)}
    ${_imRow('Taux · durée', `${String(L.rate || 0).replace('.', ',')} % · ${L.years} an${L.years > 1 ? 's' : ''}`)}
    ${L.debtShare !== undefined && L.debtShare < 100 ? _imRow(`Ma part de cette dette (${L.debtShare} %)`, masked(s.remaining * L.debtShare / 100)) : ''}
    ${_imRow('Intérêts payés' + (hasIns ? ' + assurance' : ''), masked(s.interestPaid + s.insPaid))}
    ${s.next ? _imRow('Prochaine échéance', fmtDate(s.next.date)) : ''}
    ${_imRow('Fin du prêt', fmtDate(s.end))}
    <div class="tap im-link" data-imamort="${idx}">Tableau d'amortissement →</div>
    ${s.warn ? `<div class="t-sm" style="color:var(--loss);margin-top:4px">La mensualité saisie est inférieure à la mensualité calculée (${masked(s.pmt)}) : vérifie le taux ou la durée.</div>` : ''}
  </div>`;
}
function _imLoanBlock(p, c) {
  const parts = c.loan.parts, many = parts.length > 1;
  const blocks = parts.map(({ L, s }, i) => _imOneLoanHTML(L, s, i, many)).join('');
  if (!many) return blocks;
  const T = c.loan;
  return blocks + `<div class="im-loan">
    <div class="im-row strong"><span>Total des ${parts.length} crédits</span><span class="t-num">${T.pct.toFixed(1)} %</span></div>
    ${_imRow('Capital restant dû', masked(T.remaining))}
    ${_imRow('Mensualités', masked(T.pmt + T.ins))}
    ${_imRow('Fin du dernier crédit', fmtDate(T.end))}
  </div>`;
}
function renderImmoDetail() {
  const p = imRead().find(x => x.id === S.immoId);
  const back = backBarHTML('Retour aux biens');
  if (!p) return `${back}<div class="px t-sm">Bien introuvable.</div>`;
  const c = immoCalc(p, _imToday()), L = c.loan;
  return `${back}<div class="im-card">
    <div class="im-head">
      <div class="im-name">🏠 ${esc(p.name)}</div>
      <span class="im-kind">${esc(IMMO_KINDS[p.kind])}</span>
    </div>
    <div class="t-sm" style="margin:2px 0 8px">Acheté le ${fmtDate(p.buyDate)} · il y a ${immoAge(c.t)}</div>
    ${_imRow("Prix d'achat", masked(p.price))}
    ${p.notary > 0 ? _imRow('Frais de notaire', masked(p.notary)) : ''}
    ${p.otherFees > 0 ? _imRow('Autres frais', masked(p.otherFees)) : ''}
    ${p.works > 0 ? _imRow('Travaux', masked(p.works)) : ''}
    ${_imRow('Coût total', `<b>${masked(c.cost)}</b>`)}
    <div class="im-sep"></div>
    ${_imRow(`Valeur estimée <span class="t-sm">(+${p.growth || 0} %/an)</span>`, `<b>${masked(c.value)}</b>`)}
    ${_imRow('Écart valeur − coût', _imSigned(c.gap))}
    ${L ? _imLoanBlock(p, c) : ''}
    <div class="im-sep"></div>
    ${_imRow('Patrimoine net du bien' + (L ? ' <span class="t-sm">(valeur − capital restant dû)</span>' : ''), masked(c.equity), !_imPartial(c))}
    ${_imPartial(c) ? `${_imRow(`Ma part de propriété (${p.share ?? 100} %)`, masked(c.myValue))}
    ${L ? _imRow('Ma part des crédits', masked(c.myDebt)) : ''}
    ${_imRow('Mon patrimoine net dans ce bien', masked(c.myEquity), true)}` : ''}
    <div class="im-actions">
      <button class="confirm-cancel im-btn" data-imedit="1">Modifier</button>
      <button class="confirm-cancel im-btn" data-imdel="1" style="color:var(--loss)">Supprimer</button>
    </div>
  </div>
  <div style="height:100px"></div>`;
}

SCREEN_BIND.immo = function (el) {
  el.querySelector('#js-back')?.addEventListener('click', back);
  el.onclick = e => {
    if (e.target.closest('[data-imnew]')) return openImmoForm();
    const tile = e.target.closest('[data-imopen]');
    if (tile) { S.immoId = tile.dataset.imopen; go('immodetail'); return; }
    if (e.target.closest('[data-imlegacy]')) {
      const mode = S.isDemo ? 'démo' : 'réel';
      openConfirm(`Copier les anciens biens dans le mode ${mode} ? Les anciennes données sont conservées.`, () => {
        try { imStore().importLegacy({ confirmMode: true }); }
        catch (err) { toast('Reprise impossible : ' + ((err && err.message) || 'erreur')); return; }
        _imRefresh();
        toast('Anciens biens copiés ✓');
      });
    }
  };
};
SCREEN_BIND.immodetail = function (el) {
  el.querySelector('#js-back')?.addEventListener('click', back);
  el.onclick = e => {
    if (e.target.closest('[data-imedit]')) return openImmoForm(S.immoId);
    const am = e.target.closest('[data-imamort]');
    if (am) return openImmoAmort(S.immoId, +am.dataset.imamort || 0);
    if (e.target.closest('[data-imdel]')) {
      const id = S.immoId, p = imRead().find(x => x.id === id);
      openConfirm(`Supprimer le bien "${p ? p.name : ''}" ?`, () => {
        if (!imSave(imRead().filter(x => x.id !== id))) return;
        S.immoId = null;
        _imRefresh();   // le retour ne re-rend pas la liste
        back();
        toast('Bien supprimé');
      });
    }
  };
};

// ═══════════════════════════════════════════════
// FORMULAIRE (création / modification)
// ═══════════════════════════════════════════════
let _imEditId = null;
const _imEl = id => document.getElementById(id);
function _imNum(id) { return parseFloat(String(_imEl(id).value).replace(',', '.')) || 0; }
// Lit le formulaire. Une valeur non numérique saisie est lue comme 0 (champ vide) : seul « autres frais » négatif est refusé par la validation.
function imReadForm() {
  return {
    name: _imEl('im-name').value.trim(), kind: _imEl('im-kind').value, buyDate: _imEl('im-date').value,
    price: _imNum('im-price'), notary: _imNum('im-notary'), works: _imNum('im-works'), otherFees: _imNum('im-other'), growth: _imNum('im-growth'),
    share: _imPctOf(_imEl('im-share').value), loans: _imReadLoans(),
  };
}
// Pourcentage saisi : vide → non renseigné (100 % implicite) ; sinon le nombre lu (validé ensuite : 1 à 100)
function _imPctOf(v) { const s = String(v ?? '').trim(); if (!s) return undefined; const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : -1; }
// ── Crédits du formulaire : un bloc par crédit (libellé, montant, taux, durée, 1re échéance, assurance €/mois) ──
const _IM_LOAN_FIELDS = [
  ['label', 'Libellé', 'text', 'Prêt principal, PTZ…'], ['amount', 'Montant emprunté', 'number', '90000'],
  ['rate', 'Taux annuel (%)', 'number', '3.5'], ['years', 'Durée (années)', 'number', '20'],
  ['insurance', 'Assurance (€/mois)', 'number', '0'], ['first', 'Première échéance (si différente)', 'date', ''],
  ['debtShare', 'Ma part de cette dette (%)', 'number', 'comme le bien'],
];
function _imLoanFieldsHTML(L, i) {
  const v = k => (L && L[k] !== undefined && L[k] !== null && L[k] !== 0) ? esc(String(L[k])) : '';
  const f = ([k, label, type, ph]) => `<div class="form-field"><div class="form-label">${label}</div><input class="form-input" data-lf="${k}" type="${type}"${type === 'number' ? ' min="0" step="any" inputmode="decimal"' : ''} placeholder="${ph}" value="${v(k)}"></div>`;
  const rows = [];
  for (let k = 0; k < _IM_LOAN_FIELDS.length; k += 2) rows.push(`<div class="form-row">${f(_IM_LOAN_FIELDS[k])}${_IM_LOAN_FIELDS[k + 1] ? f(_IM_LOAN_FIELDS[k + 1]) : ''}</div>`);
  return `<div class="im-loan-form" data-loan="${i}" data-lid="${esc((L && L.id) || '')}">
    <div class="im-loan-form-head"><b>Crédit ${i + 1}</b><span class="tap" data-loan-del="${i}">Retirer</span></div>${rows.join('')}</div>`;
}
function _imRenderLoans(loans) {
  _imEl('im-loans').innerHTML = loans.map(_imLoanFieldsHTML).join('');
}
function _imReadLoans() {
  return [...document.querySelectorAll('#im-loans [data-loan]')].map((b, i) => {
    const g = k => b.querySelector(`[data-lf="${k}"]`).value;
    const n = k => parseFloat(String(g(k)).replace(',', '.')) || 0;
    const L = { id: b.dataset.lid || 'l' + Date.now().toString(36) + i, label: g('label').trim(), amount: n('amount'), rate: n('rate'), years: n('years'), insurance: n('insurance'), first: g('first') || '' };
    const ds = _imPctOf(g('debtShare'));
    if (ds !== undefined) L.debtShare = ds;   // vide : la part du bien s'applique
    return L;
  }).filter(L => L.amount > 0);
}
// Aperçu pendant la saisie : mensualité de chaque crédit, total, part du coût financée
function _imPreview() {
  const el = _imEl('im-prev'); if (!el) return;
  const p = imReadForm();
  if (!p.loans.length) { el.innerHTML = ''; return; }
  if (!p.buyDate) { el.innerHTML = "Indique la date d'achat pour calculer les échéanciers."; return; }
  const parts = immoLoanSchedules(p, _imToday());
  if (parts.length < p.loans.length) { el.innerHTML = 'Indique la durée de chaque crédit pour calculer les échéanciers.'; return; }
  const total = p.price + p.notary + p.works + p.otherFees, borrowed = p.loans.reduce((s, L) => s + L.amount, 0);
  const lines = parts.map(({ L, s }, i) => `${esc(L.label || 'Crédit ' + (i + 1))} : <b>${masked(s.pmt)}</b>/mois sur ${s.n} mois${s.ins > 0.005 ? ` + assurance ${masked(s.ins)}` : ''}`);
  const monthly = parts.reduce((t, x) => t + x.s.pmt + x.s.ins, 0);
  el.innerHTML = lines.join('<br>') + (parts.length > 1 ? `<br>Total : <b>${masked(monthly)}</b>/mois assurance comprise` : '')
    + (total > 0 ? ` · ${(borrowed / total * 100).toFixed(0)} % du coût total financé` : '');
}
function openImmoForm(id) {
  const all = imRead(), p = id ? all.find(x => x.id === id) : null;
  if (id && !p) { toast('Bien introuvable'); return; }
  _imEditId = p ? p.id : null;
  const set = (i, v) => { _imEl(i).value = (v === undefined || v === null || v === 0) ? '' : v; };
  _imEl('im-title').textContent = p ? 'Modifier le bien' : 'Nouveau bien';
  // Une seule résidence principale : l'option est désactivée si une AUTRE en existe déjà
  const mainTaken = all.some(x => x.kind === 'main' && x.id !== _imEditId);
  _imEl('im-kind-main').disabled = mainTaken;
  _imEl('im-kind').value = p ? p.kind : (mainTaken ? 'secondary' : 'main');
  set('im-name', p ? p.name : ''); set('im-date', p ? p.buyDate : ''); set('im-price', p ? p.price : '');
  set('im-notary', p ? p.notary : ''); set('im-other', p ? p.otherFees : ''); set('im-works', p ? p.works : '');
  _imEl('im-growth').value = p ? (p.growth ?? '') : 2;
  _imEl('im-share').value = p && p.share !== undefined ? p.share : '';
  // Ancienne saisie « mensualité totale » : convertie en assurance mensuelle (mensualité − mensualité calculée)
  const loans = p ? immoLoanSchedules(p, _imToday()).map(({ L, s }) => ({ ...L, insurance: L.insurance > 0 ? L.insurance : +s.ins.toFixed(2) })) : [];
  _imRenderLoans(loans);
  _imPreview();
  _imEl('im-bg').classList.add('show');
  _imEl('im-sheet').classList.add('show');
}
function closeImmoForm() {
  _imEl('im-bg').classList.remove('show');
  _imEl('im-sheet').classList.remove('show');
  _imEditId = null;
}
function saveImmoForm() {
  const p = imReadForm();
  const all = imRead();
  const others = all.filter(x => x.id !== _imEditId);
  const err = immoFormError(p, others);
  if (err) { toast(err); return; }
  if (!p.name) p.name = IMMO_KINDS[p.kind];
  p.loans = p.loans.map(({ payment, ...L }) => L);
  if (p.share === undefined || p.share === 100) delete p.share;   // 100 % : rien à enregistrer   // format « loans » : l'ancienne mensualité totale est remplacée par l'assurance
  const i = _imEditId ? all.findIndex(x => x.id === _imEditId) : -1;
  if (i >= 0) { const { loan, share, ...prev } = all[i]; all[i] = { ...prev, ...p, id: _imEditId }; }
  else all.push({ id: 'im' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ...p });
  if (!imSave(all)) return;
  closeImmoForm();
  _imRefresh();
  toast('Bien enregistré ✓');
}
_imEl('im-bg').addEventListener('click', closeImmoForm);
_imEl('im-close').addEventListener('click', closeImmoForm);
_imEl('im-sheet').addEventListener('input', _imPreview);
_imEl('im-loan-add').addEventListener('click', () => {
  const n = document.querySelectorAll('#im-loans [data-loan]').length;
  _imEl('im-loans').insertAdjacentHTML('beforeend', _imLoanFieldsHTML(null, n));
  _imEl('im-loans').lastElementChild.querySelector('[data-lf="label"]').focus();
});
_imEl('im-loans').addEventListener('click', e => {
  const del = e.target.closest('[data-loan-del]'); if (!del) return;
  del.closest('[data-loan]').remove();
  [...document.querySelectorAll('#im-loans [data-loan]')].forEach((b, i) => { b.dataset.loan = i; b.querySelector('b').textContent = 'Crédit ' + (i + 1); });
  _imPreview();
});
_imEl('im-notary-est').addEventListener('click', () => {
  const price = _imNum('im-price');
  if (!(price > 0)) { toast("Saisis d'abord le prix d'achat"); return; }
  _imEl('im-notary').value = immoNotaryEstimate(price);
  _imPreview();
});
_imEl('im-save').addEventListener('click', saveImmoForm);

// ═══════════════════════════════════════════════
// TABLEAU D'AMORTISSEMENT : une ligne par année, dépliable en échéances mensuelles
// ═══════════════════════════════════════════════
function openImmoAmort(id, idx = 0) {
  const p = imRead().find(x => x.id === id), part = p && immoLoanSchedules(p, _imToday())[idx];
  if (!part) return;
  openLoanAmort(esc(p.name) + (immoLoans(p).length > 1 ? ' · ' + esc(part.L.label || 'Crédit ' + (idx + 1)) : ''), part.s);   // js/features/loan-amort.js
}

// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('im-sheet', closeImmoForm);
