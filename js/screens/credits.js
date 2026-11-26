// Écrans « Crédits » (liste des autres crédits) et fiche d'un crédit, formulaire de saisie.
// Calculs et stockage : js/features/credits.js. Tableau d'amortissement : js/features/loan-amort.js.
// Dépend, À L'APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre ses bindings (SCREEN_BIND).

// Lecture : crRead() / crStore() (js/features/credits.js)
function crSave(list) {
  try { crStore().save(list); return true; }
  catch (e) { toast('Enregistrement impossible : ' + ((e && e.message) || 'erreur')); return false; }
}
const _crToday = () => _dayKey(Date.now());
function _crRefresh() { ['credits', 'creditdetail', 'dashboard', 'analysis'].forEach(id => { if (document.getElementById('s-' + id)) renderScreen(id); }); }
// Accueil « À surveiller » : échéances des 10 prochains jours (autres crédits et crédits immobiliers)
HOME_WATCH.credits = () => {
  const today = _crToday();
  const loans = [
    ...crRead().map(c => ({ name: c.name || CREDIT_KINDS[c.kind], schedule: creditSchedule(c, today), go: 'credits' })),
    ...imRead().flatMap(p => immoLoanSchedules(p, today).map(({ L, s }) => ({ name: L.label || p.name, schedule: s, go: 'immo' }))),
  ];
  return homeWatchLoanDue(loans, today, 10).map(l => ({ level: 'soon', when: l.date, go: l.go, text: `Échéance « ${l.name} » le ${fmtDate(l.date)}`, sub: masked(l.amount) + ' assurance comprise' }));
};

function renderCredits() {
  const list = crRead(), today = _crToday(), T = creditTotals(list, today);
  const rows = list.map(c => {
    const s = creditSchedule(c, today), k = creditShare(c);
    return `<button type="button" class="acc-card tap im-tile" data-cropen="${esc(c.id)}">
      <div class="row gap12" style="align-items:center">
        <div class="acc-icon" style="background:var(--card2)">💳</div>
        <div class="flex1" style="min-width:0"><div class="im-name">${esc(c.name || CREDIT_KINDS[c.kind])}</div>
          <div class="t-sm">${esc(CREDIT_KINDS[c.kind])}${k < 1 ? ` · ma part ${c.debtShare} %` : ''}</div></div>
        <div class="col right gap4"><span class="t-num" style="font-weight:800">${masked(s ? s.remaining : 0)}</span><span class="t-sm">restant dû</span></div>
      </div>
      ${s ? `<div class="acc-bar" style="margin-top:12px"><div class="acc-bar-fill" style="width:${Math.min(100, s.pct).toFixed(1)}%"></div></div>
      <div class="t-sm" style="margin-top:4px">${s.next ? `${masked(s.pmt + s.ins)}/mois · fin ${fmtDate(s.end)}` : 'Remboursé ✓'}</div>` : ''}
    </button>`;
  }).join('');
  const banner = crReadError() ? `<div class="oa-banner err">Données illisibles : ${esc(crReadError())}. Rien n'est modifié ni supprimé.</div>` : '';
  return `${moduleBarHTML('credits', 'Crédits à la consommation, auto, travaux… Les crédits immobiliers sont dans la fiche de chaque bien.')}
  <div style="padding:12px 20px 110px">
    ${banner}
    ${list.length ? `<div class="t-label">Capital restant dû${T.myRemaining < T.remaining - 0.005 ? ' (ma part)' : ''}</div>
    <div class="t-num" style="font-size:28px;font-weight:800">${masked(T.myRemaining)}</div>
    <div class="t-sm">Mensualités en cours : ${masked(T.myMonthly)}/mois${T.myRemaining < T.remaining - 0.005 ? ` · total à 100 % : ${masked(T.remaining)}` : ''}</div>` : ''}
    <button class="form-submit" data-crnew="1" style="margin:14px 0">+ Ajouter un crédit</button>
    <div class="col gap12">${rows || '<div class="oa-empty">Aucun crédit. Ajoute un crédit à la consommation, auto ou travaux pour le suivre ici.</div>'}</div>
  </div>`;
}

function renderCreditDetail() {
  const c = crRead().find(x => x.id === S.creditId);
  const back = backBarHTML('Retour aux crédits');
  if (!c) return `${back}<div class="px t-sm">Crédit introuvable.</div>`;
  const s = creditSchedule(c, _crToday()), k = creditShare(c), r = (a, b, strong) => `<div class="im-row${strong ? ' strong' : ''}"><span>${a}</span><span class="t-num">${b}</span></div>`;
  return `${back}<div class="im-card">
    <div class="im-head"><div class="im-name">💳 ${esc(c.name || CREDIT_KINDS[c.kind])}</div><span class="im-kind">${esc(CREDIT_KINDS[c.kind])}</span></div>
    <div class="t-sm" style="margin:2px 0 8px">Signé le ${fmtDate(c.signDate)}</div>
    ${r('Montant emprunté', masked(c.amount))}
    ${r('Taux · durée', `${String(c.rate || 0).replace('.', ',')} % · ${c.years} an${c.years > 1 ? 's' : ''}`)}
    ${s ? `<div class="im-loan">
      ${r('Remboursé', `${s.pct.toFixed(1)} %`, true)}
      <div class="im-bar"><div style="width:${Math.min(100, s.pct).toFixed(1)}%"></div></div>
      ${r('Capital restant dû', masked(s.remaining))}
      ${r('Mensualité', `${masked(s.pmt + s.ins)}${s.ins > 0.005 ? ` <span class="t-sm">dont assurance ${masked(s.ins)}</span>` : ''}`)}
      ${r('Intérêts payés' + (s.ins > 0.005 ? ' + assurance' : ''), masked(s.interestPaid + s.insPaid))}
      ${s.next ? r('Prochaine échéance', fmtDate(s.next.date)) : ''}
      ${r('Fin du crédit', fmtDate(s.end))}
      <div class="tap im-link" data-cramort="1">Tableau d'amortissement →</div>
      ${s.next ? `<div class="tap im-link" data-crer="1">Simuler un remboursement anticipé →</div>` : ''}
    </div>` : ''}
    ${k < 1 && s ? `<div class="im-sep"></div>${r(`Ma part de la dette (${c.debtShare} %)`, masked(s.remaining * k), true)}` : ''}
    <div class="im-actions">
      <button class="confirm-cancel im-btn" data-credit="1">Modifier</button>
      <button class="confirm-cancel im-btn" data-crdel="1" style="color:var(--loss)">Supprimer</button>
    </div>
  </div>
  <div style="height:100px"></div>`;
}

SCREEN_BIND.credits = function (el) {
  el.onclick = e => {
    if (e.target.closest('[data-crnew]')) return openCreditForm();
    const t = e.target.closest('[data-cropen]');
    if (t) { S.creditId = t.dataset.cropen; go('creditdetail'); }
  };
};
SCREEN_BIND.creditdetail = function (el) {
  el.querySelector('#js-back')?.addEventListener('click', back);
  el.onclick = e => {
    const c = crRead().find(x => x.id === S.creditId);
    if (e.target.closest('[data-credit]')) return openCreditForm(S.creditId);
    if (e.target.closest('[data-cramort]') && c) return openLoanAmort(esc(c.name || CREDIT_KINDS[c.kind]), creditSchedule(c, _crToday()));
    if (e.target.closest('[data-crer]') && c) return openEarlyRepay(esc(c.name || CREDIT_KINDS[c.kind]), c, loanAddMonths(c.signDate, 1), 'conso');   // js/screens/early-repay.js
    if (e.target.closest('[data-crdel]') && c) {
      openConfirm(`Supprimer le crédit « ${c.name || CREDIT_KINDS[c.kind]} » ?`, () => {
        if (!crSave(crRead().filter(x => x.id !== c.id))) return;
        S.creditId = null; _crRefresh(); back(); toast('Crédit supprimé');
      });
    }
  };
};

// ═══════════════════════════════════════════════
// FORMULAIRE (création / modification)
// ═══════════════════════════════════════════════
let _crEditId = null;
const _crEl = id => document.getElementById(id);
const _crNumOf = id => parseFloat(String(_crEl(id).value).replace(',', '.'));
function crReadForm() {
  const n = id => { const v = _crNumOf(id); return Number.isFinite(v) ? v : 0; };
  const share = _crNumOf('cr-share');
  return {
    name: _crEl('cr-name').value.trim(), kind: _crEl('cr-kind').value, amount: n('cr-amount'), rate: n('cr-rate'), years: n('cr-years'),
    signDate: _crEl('cr-sign').value, first: _crEl('cr-first').value || '', insurance: n('cr-ins'),
    debtShare: Number.isFinite(share) ? share : 100,
  };
}
function _crPreview() {
  const c = crReadForm(), el = _crEl('cr-prev');
  const s = c.signDate && c.amount > 0 && c.years > 0 ? creditSchedule(c, _crToday()) : null;
  el.innerHTML = s ? `Mensualité : <b>${masked(s.pmt)}</b>${c.insurance > 0 ? ` + assurance ${masked(c.insurance)}` : ''} sur ${s.n} mois · coût des intérêts ${masked(s.rows.reduce((t, r) => t + r.interest, 0))} · fin ${fmtDate(s.end)}` : '';
}
function openCreditForm(id) {
  const c = id ? crRead().find(x => x.id === id) : null;
  if (id && !c) { toast('Crédit introuvable'); return; }
  _crEditId = c ? c.id : null;
  const set = (i, v) => { _crEl(i).value = v === undefined || v === null ? '' : v; };
  _crEl('cr-title').textContent = c ? 'Modifier le crédit' : 'Nouveau crédit';
  set('cr-name', c ? c.name : ''); _crEl('cr-kind').value = c ? c.kind : 'conso';
  set('cr-amount', c ? c.amount : ''); set('cr-rate', c ? c.rate : ''); set('cr-years', c ? c.years : '');
  set('cr-sign', c ? c.signDate : ''); set('cr-first', c ? c.first : ''); set('cr-ins', c && c.insurance ? c.insurance : '');
  set('cr-share', c ? (c.debtShare ?? 100) : 100);
  _crPreview();
  _crEl('cr-bg').classList.add('show'); _crEl('cr-sheet').classList.add('show');
}
function closeCreditForm() {
  _crEl('cr-bg').classList.remove('show'); _crEl('cr-sheet').classList.remove('show');
  _crEditId = null;
}
function saveCreditForm() {
  const c = crReadForm(), err = creditFormError(c);
  if (err) { toast(err); return; }
  if (!c.name) c.name = CREDIT_KINDS[c.kind];
  const all = crRead(), i = _crEditId ? all.findIndex(x => x.id === _crEditId) : -1;
  if (i >= 0) all[i] = { ...all[i], ...c, id: _crEditId };
  else all.push({ id: 'cr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ...c });
  if (!crSave(all)) return;
  closeCreditForm(); _crRefresh(); toast('Crédit enregistré ✓');
}
_crEl('cr-bg').addEventListener('click', closeCreditForm);
_crEl('cr-close').addEventListener('click', closeCreditForm);
_crEl('cr-sheet').addEventListener('input', _crPreview);
_crEl('cr-save').addEventListener('click', saveCreditForm);
registerModal('cr-sheet', closeCreditForm);
