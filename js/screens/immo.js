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
        <div class="flex1" style="min-width:0"><div class="im-name">${esc(p.name)}</div><div class="t-sm">${esc(IMMO_KINDS[p.kind])}</div></div>
        <div class="col right gap4"><span class="t-num" style="font-weight:800">${masked(c.equity)}</span><span class="t-sm">Valeur nette</span></div>
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

function _imLoanBlock(p, c) {
  const L = c.loan, pay = p.loan.payment > 0 ? p.loan.payment : L.pmt, hasIns = L.ins > 0.005;
  return `<div class="im-loan">
    <div class="im-row strong"><span>Crédit remboursé</span><span class="t-num">${L.pct.toFixed(1)} %</span></div>
    <div class="im-bar"><div style="width:${Math.min(100, L.pct).toFixed(1)}%"></div></div>
    ${_imRow('Capital remboursé', `${masked(L.repaid)} <span class="t-sm">/ ${masked(p.loan.amount)}</span>`)}
    ${_imRow('Capital restant dû', masked(L.remaining))}
    ${_imRow('Mensualité', `${masked(pay)}${hasIns ? ` <span class="t-sm">dont assurance ≈ ${masked(L.ins)}</span>` : ''}`)}
    ${_imRow('Intérêts payés' + (hasIns ? ' + assurance' : ''), masked(L.interestPaid + L.insPaid))}
    ${L.next ? _imRow('Prochaine échéance', fmtDate(L.next.date)) : ''}
    ${_imRow('Fin du prêt', fmtDate(L.end))}
    ${L.warn ? `<div class="t-sm" style="color:var(--loss);margin-top:4px">La mensualité saisie est inférieure à la mensualité calculée (${masked(L.pmt)}) : vérifie le taux ou la durée.</div>` : ''}
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
    ${_imRow('Patrimoine net du bien' + (L ? ' <span class="t-sm">(valeur − capital restant dû)</span>' : ''), masked(c.equity), true)}
    <div class="im-actions">
      <button class="confirm-cancel im-btn" data-imedit="1">Modifier</button>
      ${L ? '<button class="confirm-cancel im-btn" data-imamort="1">Tableau d\'amortissement</button>' : ''}
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
    if (e.target.closest('[data-imamort]')) return openImmoAmort(S.immoId);
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
  const amt = _imNum('im-l-amt');
  return {
    name: _imEl('im-name').value.trim(), kind: _imEl('im-kind').value, buyDate: _imEl('im-date').value,
    price: _imNum('im-price'), notary: _imNum('im-notary'), works: _imNum('im-works'), otherFees: _imNum('im-other'), growth: _imNum('im-growth'),
    loan: amt > 0 ? { amount: amt, rate: _imNum('im-l-rate'), years: _imNum('im-l-years'), payment: _imNum('im-l-pay'), first: _imEl('im-l-first').value || '' } : null,
  };
}
// Aperçu du crédit pendant la saisie : mensualité théorique et assurance déduite de la mensualité saisie
function _imPreview() {
  const el = _imEl('im-prev'); if (!el) return;
  const p = imReadForm();
  if (!p.buyDate) { el.innerHTML = p.loan ? "Indique la date d'achat pour calculer l'échéancier." : ''; return; }
  const L = immoLoan(p, _imToday());
  if (!L) { el.innerHTML = p.loan ? "Indique la durée du crédit pour calculer l'échéancier." : ''; return; }
  const total = p.price + p.notary + p.works + p.otherFees;
  const financed = total > 0 ? ` · ${(p.loan.amount / total * 100).toFixed(0)} % du coût total financé` : '';
  const ins = p.loan.payment > 0
    ? (L.ins > 0.005 ? ` Assurance déduite : <b>≈ ${masked(L.ins)}</b>/mois.` : (L.warn ? ' <span style="color:var(--loss)">La mensualité saisie est inférieure au calcul : vérifie taux et durée.</span>' : ' Aucune assurance détectée.'))
    : " Saisis ta mensualité totale pour en déduire l'assurance.";
  el.innerHTML = `Mensualité calculée (hors assurance) : <b>${masked(L.pmt)}</b> sur ${L.n} mois${financed}.${ins}`;
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
  const L = p && p.loan;
  set('im-l-amt', L ? L.amount : ''); set('im-l-rate', L ? L.rate : ''); set('im-l-years', L ? L.years : '');
  set('im-l-pay', L ? L.payment : ''); set('im-l-first', L ? L.first : '');
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
  const i = _imEditId ? all.findIndex(x => x.id === _imEditId) : -1;
  if (i >= 0) all[i] = { ...all[i], ...p, id: _imEditId };
  else all.push({ id: 'im' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ...p });
  if (!imSave(all)) return;
  closeImmoForm();
  _imRefresh();
  toast('Bien enregistré ✓');
}
_imEl('im-bg').addEventListener('click', closeImmoForm);
_imEl('im-close').addEventListener('click', closeImmoForm);
_imEl('im-sheet').addEventListener('input', _imPreview);
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
function openImmoAmort(id) {
  const p = imRead().find(x => x.id === id), L = p && immoLoan(p, _imToday());
  if (!L) return;
  const years = {};
  L.rows.forEach(r => { (years[r.date.slice(0, 4)] ||= []).push(r); });
  const body = Object.entries(years).map(([y, rows]) => {
    const cap = rows.reduce((s, r) => s + r.princ, 0), int = rows.reduce((s, r) => s + r.interest, 0), last = rows[rows.length - 1];
    const allPast = rows.every(r => r.past), somePast = rows.some(r => r.past);
    const months = rows.map(r => `<div class="ima-grid ima-m${r.past ? ' past' : ''}${L.next && r.k === L.next.k ? ' next' : ''}"><span>${fmtDate(r.date)}</span><span class="t-num">${masked(r.princ)}</span><span class="t-num">${masked(r.interest)}</span><span class="t-num">${masked(r.bal)}</span></div>`).join('');
    return `<details class="ima-year"${somePast && !allPast ? ' open' : ''}>
      <summary class="ima-grid${allPast ? ' past' : ''}"><b>${esc(y)}${allPast ? ' ✓' : ''}</b><span class="t-num">${masked(cap)}</span><span class="t-num">${masked(int)}</span><span class="t-num">${masked(last.bal)}</span></summary>
      ${months}
    </details>`;
  }).join('');
  _imEl('ima-body').innerHTML = `<div class="oa-head" style="margin-bottom:10px">
      <div class="modal-title" style="margin-bottom:0">Amortissement — ${esc(p.name)}</div>
      <div id="ima-close" class="oa-x">✕</div></div>
    <div class="t-sm" style="margin-bottom:8px">${L.n} échéances · mensualité ${masked(L.pmt)}${L.ins > 0.005 ? ` + assurance ≈ ${masked(L.ins)}` : ''} · échéances passées en gris, prochaine en couleur. Touche une année pour voir les mois.</div>
    <div class="ima-grid ima-head"><span>Date</span><span>Capital</span><span>Intérêts</span><span>Reste dû</span></div>${body}`;
  _imEl('ima-bg').classList.add('show');
  _imEl('ima-sheet').classList.add('show');
}
function closeImmoAmort() {
  _imEl('ima-bg').classList.remove('show');
  _imEl('ima-sheet').classList.remove('show');
}
_imEl('ima-bg').addEventListener('click', closeImmoAmort);
_imEl('ima-body').addEventListener('click', e => { if (e.target.closest('#ima-close')) closeImmoAmort(); });

// Fermées par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('im-sheet', closeImmoForm);
registerModal('ima-sheet', closeImmoAmort);
