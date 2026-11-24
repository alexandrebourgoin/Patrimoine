// Feuille « Régulariser les liquidités » : plusieurs poches (devises) fixées à une même date. Corrige le niveau de liquidités,
// sans effet sur la performance (ce n'est ni un apport ni un retrait). Règles : js/features/cash-pockets.js (pures).
// Feuille déclarée dans mon-patrimoine.html (#ca-*). Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js.

let _ca = null;   // { accId, date, rows:[{ccy, val}] }
const _caEl = id => document.getElementById(id);

function openCashAdjust(accId) {
  const acc = S.accounts.find(a => a.id === accId); if (!acc) return;
  const date = _dayKey(Date.now());
  _ca = { accId, date, rows: cashAdjustRows(acc, date, S.currency) };
  renderCashAdjust();
  _caEl('ca-bg').classList.add('show');
  _caEl('ca-sheet').classList.add('show');
}
function closeCashAdjust() {
  _caEl('ca-bg').classList.remove('show');
  _caEl('ca-sheet').classList.remove('show');
  _ca = null;
}
function _caTotal() {
  return _ca.rows.reduce((s, r) => { const v = Number(String(r.val).trim().replace(',', '.')); return s + (Number.isFinite(v) ? toRefCcy(v, r.ccy) : 0); }, 0);
}
function renderCashAdjust() {
  const acc = S.accounts.find(a => a.id === (_ca && _ca.accId)); if (!acc) return;
  const adjs = [...(acc.cashAdjust || [])].sort((a, b) => b.date.localeCompare(a.date));
  const free = Object.keys(FX_RATES).filter(c => !_ca.rows.some(r => r.ccy === c));
  const rows = _ca.rows.map(r => `<div class="form-row"><div class="form-field"><div class="form-label">Liquidités en ${esc(r.ccy)}</div><input class="form-input ca-v" data-c="${esc(r.ccy)}" type="number" step="any" inputmode="decimal" value="${esc(r.val)}"></div></div>`).join('');
  const list = adjs.length ? `<div class="t-label" style="margin:16px 0 4px">Régularisations enregistrées</div>` + adjs.map(a =>
    `<div class="tx-item" style="padding:8px 0"><div class="flex1 col gap4" style="min-width:0"><div style="font-size:13px;font-weight:700">${fmtDate(a.date)}</div>
      <div class="t-sm">${Object.entries(a.balances || {}).map(([c, v]) => esc(fmtNative(v, c))).join(' · ')}</div></div>
      <div class="tx-del-btn" data-cadel="${esc(a.id)}" title="Supprimer"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></div></div>`).join('') : '';
  _caEl('ca-body').innerHTML = `<div class="oa-head" style="margin-bottom:12px">
    <div class="modal-title" style="margin-bottom:0">Régulariser les liquidités</div><div id="ca-close" class="oa-x">✕</div></div>
    <div class="t-sm" style="margin-bottom:12px">Indique, pour une même date, le solde réel de chaque poche de liquidités (relevé du courtier). Cela corrige le niveau de liquidités du compte ; ce n'est ni un apport ni un retrait.</div>
    <div class="form-row"><div class="form-field"><div class="form-label">Date</div><input class="form-input" type="date" id="ca-date" value="${esc(_ca.date)}"></div></div>
    ${rows}
    ${free.length ? `<div style="display:flex;gap:8px;align-items:center;margin:4px 0 10px"><select class="form-input" id="ca-add-sel" style="flex:1;cursor:pointer">${free.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select><div id="ca-add" class="tap oa-chip">+ Ajouter une devise</div></div>` : ''}
    <div class="t-sm" style="margin-bottom:10px">Total : <b id="ca-tot" class="t-num">${masked(_caTotal())}</b> (devise de l'appli)</div>
    <button class="form-submit" id="ca-save">Enregistrer</button>${list}`;
}
function saveCashAdjust() {
  const acc = S.accounts.find(a => a.id === (_ca && _ca.accId)); if (!acc) return;
  const dateErr = cashAdjustDateError(_ca.date, _dayKey(Date.now()));
  if (dateErr) { toast(dateErr); return; }
  const r = cashAdjustBalances(_ca.rows);
  if (r.error) { toast(r.error); return; }
  acc.cashAdjust = cashAdjustApply(acc.cashAdjust, { id: 'ca_' + Date.now().toString(36), date: _ca.date, balances: r.balances });
  acc.value = accTotal(acc);
  closeCashAdjust();
  if (S.screen === 'account') renderScreen('account');
  refreshMain();
  toast('Liquidités régularisées ✓');
}
_caEl('ca-bg').addEventListener('click', closeCashAdjust);
_caEl('ca-body').addEventListener('click', e => {
  if (!_ca) return;
  if (e.target.closest('#ca-close')) return closeCashAdjust();
  if (e.target.closest('#ca-add')) {
    const v = _caEl('ca-add-sel').value;
    if (v) { _ca.rows.push({ ccy: v, val: '0' }); renderCashAdjust(); }
    return;
  }
  if (e.target.closest('#ca-save')) return saveCashAdjust();
  const d = e.target.closest('[data-cadel]');
  if (d) {
    const acc = S.accounts.find(a => a.id === _ca.accId); if (!acc) return;
    acc.cashAdjust = cashAdjustRemove(acc.cashAdjust, d.dataset.cadel);
    if (!acc.cashAdjust.length) delete acc.cashAdjust;
    acc.value = accTotal(acc);
    renderCashAdjust();
    if (S.screen === 'account') renderScreen('account');
    refreshMain();
  }
});
_caEl('ca-body').addEventListener('input', e => {
  const i = e.target.closest('.ca-v'); if (!i || !_ca) return;
  const r = _ca.rows.find(x => x.ccy === i.dataset.c); if (r) r.val = i.value;
  const el = _caEl('ca-tot');
  if (el) el.innerHTML = masked(_caTotal());
});
_caEl('ca-body').addEventListener('change', e => {
  if (e.target.id !== 'ca-date' || !_ca) return;
  const acc = S.accounts.find(a => a.id === _ca.accId); if (!acc) return;
  _ca.date = e.target.value || _ca.date;
  _ca.rows = cashAdjustRows(acc, _ca.date, S.currency);
  renderCashAdjust();
});
registerModal('ca-sheet', closeCashAdjust);
