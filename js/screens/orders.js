// Écran « Ordres » : ordres limites en cours (en haut) et alertes de prix (en bas).
// Nom du module : NAV_CATALOG.orders.label via navLabel(), identique dans la barre du bas, le menu et le titre.
// Données : createOrderAlertStore (js/features/order-alert-storage.js), une clé par mode démo / réel.
// Règles : js/features/order-alert-rules.js (fonctions pures, testées seules). Ici : rendu et événements uniquement.
// Une alerte est « déclenchée » tant que le dernier cours connu est du bon côté du prix ; vérifiée au rendu et à chaque
// actualisation des cours (refreshMain), pas quand l'appli est fermée.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre son binding (SCREEN_BIND) et sa pastille (NAV_BADGES).
// L'écran et ses feuilles sont déclarés dans mon-patrimoine.html (#s-orders, #oa-*).

// ═══════════════════════════════════════════════
// DONNÉES
// ═══════════════════════════════════════════════
let _oaError = '';
function oaStore() { return createOrderAlertStore(localStorage, S.isDemo ? 'demo' : 'real'); }
// Lecture protégée : l'erreur est affichée à l'écran et JAMAIS remplacée par une liste vide enregistrée.
function oaRead() {
  try { const d = oaStore().read(); _oaError = ''; return d; }
  catch (e) { _oaError = (e && e.message) || 'Données illisibles'; return { orders: [], alerts: [] }; }
}
// kind : 'orders' | 'alerts'. Renvoie false (et prévient) si l'écriture est refusée : données illisibles ou quota plein.
function oaSave(kind, list) {
  try {
    if (kind === 'orders') oaStore().saveOrders(list); else oaStore().saveAlerts(list);
    _oaError = '';
    return true;
  } catch (e) { toast('Enregistrement impossible : ' + ((e && e.message) || 'erreur')); return false; }
}
const _oaTarget = o => oaFindTarget(S.accounts, o);
const _oaQuoteOf = ticker => oaQuote(S.accounts, S.watchlist, ticker);
function orderAlertBadgeCount() { return oaBadgeCount(S.accounts, S.watchlist, oaRead()); }
NAV_BADGES.orders = orderAlertBadgeCount;

function _oaHintOf(o, h) {
  const ser = o.createdAt ? getHistorySeries(h.ticker) : null;
  return oaPriceHint(o, h.currentPrice, ser, o.createdAt ? _dayKey(o.createdAt) : null);
}
function _oaHintText(hint, h) {
  if (hint.source === 'current') return `Le cours actuel (${maskedNative(hint.price, h.currency)}) a atteint ton prix limite : l'ordre a probablement été exécuté.`;
  return `Clôture du ${fmtDate(hint.day)} à ${maskedNative(hint.price, hint.currency || h.currency)} : le prix limite a pu être atteint.`;
}
// Anciennes données (avant la séparation démo / réel) : proposées seulement si le mode courant est vide
function _oaLegacy(data) {
  if (_oaError || data.orders.length || data.alerts.length) return null;
  try {
    const l = oaStore().readLegacy();
    return (l.orders.length || l.alerts.length) ? l : null;
  } catch (e) { return null; }
}

// ═══════════════════════════════════════════════
// RENDU
// ═══════════════════════════════════════════════
function _oaRow(k, v) {
  return `<div class="oa-row"><span class="oa-k">${k}</span><span class="oa-v">${v}</span></div>`;
}
function _oaOrderCard(o, { acc, h }) {
  const buy = o.type === 'BUY', hint = _oaHintOf(o, h);
  return `<div class="oa-card">
    <div class="oa-head">
      <div class="oa-title">${esc(h.ticker)} <span class="oa-side ${buy ? 'buy' : 'sell'}">${buy ? 'Achat limite' : 'Vente limite'}</span></div>
      <div class="t-sm">${o.createdAt ? esc(new Date(o.createdAt).toLocaleDateString('fr-FR')) : ''}</div>
    </div>
    <div class="t-sm" style="margin-top:2px">${esc(acc.icon || '')} ${esc(acc.name)}</div>
    <div style="margin-top:8px;font-size:14px">${oaFmtQty(o.qty)} × ${maskedNative(o.limit, h.currency)} = <b>${maskedNative(o.qty * o.limit, h.currency)}</b></div>
    <div class="t-sm" style="margin-top:2px">Cours actuel : ${maskedNative(h.currentPrice, h.currency)}</div>
    ${hint.hit ? `<div class="oa-warn">⚠ ${_oaHintText(hint, h)}</div>` : ''}
    <div class="oa-actions">
      <button class="form-submit" data-oexec="${esc(o.id)}" style="margin:0;flex:2;height:42px">Exécuté ✓</button>
      <button class="confirm-cancel oa-btn" data-oedit="${esc(o.id)}">Modifier</button>
      <button class="confirm-cancel oa-btn" data-ocancel="${esc(o.id)}">Annuler</button>
    </div>
  </div>`;
}
function _oaAlertCard({ a, q, hit }) {
  const above = a.dir === 'above';
  return `<div class="oa-card${hit ? ' hit' : ''}">
    <div class="oa-head">
      <div class="oa-title">${esc(a.ticker)} <span class="oa-name">${esc(a.name || '')}</span></div>
      <span class="oa-pill${hit ? ' hit' : ''}">${hit ? 'Déclenchée' : 'En attente'}</span>
    </div>
    <div style="margin-top:8px;font-size:14px">Cours ${above ? '≥' : '≤'} <b>${maskedNative(a.price, q ? q.ccy : 'EUR')}</b></div>
    <div class="t-sm" style="margin-top:2px">${q ? 'Cours actuel : ' + maskedNative(q.p, q.ccy) : 'Cours actuel inconnu (titre absent des comptes et du suivi)'}</div>
    <div style="margin-top:10px"><button class="confirm-cancel oa-btn" data-adel="${esc(a.id)}" style="flex:none;padding:0 18px">Supprimer</button></div>
  </div>`;
}
function renderOrders() {
  const data = oaRead();
  const rows = data.orders.map(o => ({ o, r: _oaTarget(o) })).filter(x => x.r);
  const orphans = data.orders.length - rows.length;
  const alerts = data.alerts.map(a => { const q = _oaQuoteOf(a.ticker); return { a, q, hit: oaAlertTriggered(a, q) }; })
    .sort((x, y) => (y.hit - x.hit) || ((x.a.createdAt || 0) - (y.a.createdAt || 0)));
  const nHit = alerts.filter(x => x.hit).length;
  const legacy = _oaLegacy(data);
  const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
  const banner = _oaError
    ? `<div class="oa-banner err">Données illisibles : ${esc(_oaError)}. Rien n'est modifié ni supprimé ; l'enregistrement est bloqué tant que ces données ne sont pas corrigées.</div>`
    : '';
  const legacyCard = legacy
    ? `<div class="oa-banner">
      <div style="font-size:13px;font-weight:700">Anciennes données détectées</div>
      <div class="t-sm" style="margin-top:4px">${plural(legacy.orders.length, 'ordre')} et ${plural(legacy.alerts.length, 'alerte')}, enregistrés avant la séparation démo / réel. Ils ne sont attribués à aucun mode automatiquement.</div>
      <button class="form-submit" data-olegacy="1" style="margin:10px 0 0;height:40px">Copier dans le mode ${S.isDemo ? 'démo' : 'réel'}</button>
    </div>`
    : '';
  const orphanNote = orphans
    ? `<div class="t-sm" style="margin:0 0 10px">${plural(orphans, 'ordre')} sans compte ou titre correspondant (supprimés ?) <span class="tap" data-opurge="1" style="color:var(--accent);font-weight:700;cursor:pointer">Nettoyer</span></div>`
    : '';
  return `${backBarHTML()}
  <div class="settings-top" style="padding-top:4px">
    <div class="t-title">${navLabel('orders')}</div>
    <div class="t-sm" style="margin-top:2px">Suivi manuel : aucun ordre n'est passé par l'application</div>
  </div>
  <div style="padding:4px 16px 110px">
    ${banner}${legacyCard}
    <div class="oa-h">Ordres en cours <span class="t-sm" style="font-weight:600">(${rows.length})</span></div>
    <div class="t-sm" style="margin-bottom:10px">Ordres limites passés chez ton courtier. Confirme l'exécution ici pour ajouter le mouvement au compte.</div>
    <button class="form-submit" data-onew="1" style="margin:0 0 12px">+ Nouvel ordre limite</button>
    ${orphanNote}${rows.map(({ o, r }) => _oaOrderCard(o, r)).join('') || '<div class="t-sm" style="text-align:center;padding:16px 0">Aucun ordre en cours.</div>'}
    <div style="height:1px;background:var(--border);margin:24px 0 18px"></div>
    <div class="oa-h">Alertes de prix <span class="t-sm" style="font-weight:600">(${alerts.length}${nHit ? ` · ${plural(nHit, 'déclenchée')}` : ''})</span></div>
    <div class="t-sm" style="margin-bottom:10px">Vérifiées à l'ouverture de l'écran et à chaque actualisation des cours (pas quand l'appli est fermée). La pastille de la barre du bas additionne les ordres en cours et les alertes déclenchées.</div>
    <button class="form-submit" data-anew="1" style="margin:0 0 12px">+ Nouvelle alerte</button>
    ${alerts.map(_oaAlertCard).join('') || '<div class="t-sm" style="text-align:center;padding:16px 0">Aucune alerte.</div>'}
  </div>`;
}

// Après toute modification : réaffiche l'écran (s'il est ouvert) et la pastille de la barre
function _oaRefresh() {
  if (S.screen === 'orders') renderScreen('orders');
  renderNav();
}

SCREEN_BIND.orders = function (el) {
  el.querySelector('#js-back')?.addEventListener('click', back);
  el.onclick = e => {
    const on = sel => e.target.closest(sel);
    if (on('[data-onew]')) return openOaOrder();
    if (on('[data-anew]')) return openOaAlert();
    let t;
    if ((t = on('[data-oexec]'))) return openOaExec(t.dataset.oexec);
    if ((t = on('[data-oedit]'))) return openOaOrder(t.dataset.oedit);
    if ((t = on('[data-ocancel]'))) {
      if (oaSave('orders', oaRead().orders.filter(o => o.id !== t.dataset.ocancel))) { _oaRefresh(); toast('Ordre annulé'); }
      return;
    }
    if ((t = on('[data-adel]'))) {
      if (oaSave('alerts', oaRead().alerts.filter(a => a.id !== t.dataset.adel))) { _oaRefresh(); toast('Alerte supprimée'); }
      return;
    }
    if (on('[data-opurge]')) {
      if (oaSave('orders', oaRead().orders.filter(o => _oaTarget(o)))) _oaRefresh();
      return;
    }
    if (on('[data-olegacy]')) {
      const mode = S.isDemo ? 'démo' : 'réel';
      openConfirm(`Copier les anciens ordres et alertes dans le mode ${mode} ? Les anciennes données sont conservées.`, () => {
        try { oaStore().importLegacy({ confirmMode: true }); }
        catch (err) { toast('Reprise impossible : ' + ((err && err.message) || 'erreur')); return; }
        _oaRefresh();
        toast('Anciennes données copiées ✓');
      });
    }
  };
};

// ═══════════════════════════════════════════════
// NOUVEL ORDRE LIMITE / MODIFICATION
// ═══════════════════════════════════════════════
let _oaType = 'BUY', _oaEditId = null;
const _oaEl = id => document.getElementById(id);
function _oaFillHoldings() {
  const acc = S.accounts.find(a => String(a.id) === _oaEl('oa-order-acc').value);
  const hs = (acc ? acc.holdings : []).filter(h => h.type !== 'Cash');
  _oaEl('oa-order-hold').innerHTML = hs.map(h => `<option value="${esc(String(h.id))}">${esc(h.ticker)} — ${esc(h.name)} (détenu : ${oaFmtQty(oaHeldQty(h))})</option>`).join('') || '<option value="">Aucune position</option>';
}
function _oaSetType(t) {
  _oaType = t;
  document.querySelectorAll('#oa-order-type-btns .type-btn').forEach(b => b.classList.toggle('on', b.dataset.otype === t));
}
// editId : ordre à modifier (champs préremplis), sinon nouvel ordre
function openOaOrder(editId) {
  const accs = oaOrderableAccounts(S.accounts);
  if (!accs.length) { toast('Aucune position sur laquelle passer un ordre'); return; }
  const o = editId ? oaRead().orders.find(x => x.id === editId) : null;
  if (editId && !o) { toast('Ordre introuvable'); return; }
  _oaEditId = o ? o.id : null;
  _oaSetType(o ? o.type : 'BUY');
  _oaEl('oa-order-acc').innerHTML = accs.map(a => `<option value="${esc(String(a.id))}">${esc(a.icon || '')} ${esc(a.name)}</option>`).join('');
  if (o) _oaEl('oa-order-acc').value = String(o.accId);
  _oaFillHoldings();
  if (o) _oaEl('oa-order-hold').value = String(o.holdId);
  _oaEl('oa-order-qty').value = o ? o.qty : '';
  _oaEl('oa-order-limit').value = o ? o.limit : '';
  _oaEl('oa-order-title').textContent = o ? "Modifier l'ordre" : 'Nouvel ordre limite';
  _oaEl('oa-order-submit').textContent = o ? 'Enregistrer les modifications' : "Enregistrer l'ordre";
  _oaEl('oa-order-bg').classList.add('show');
  _oaEl('oa-order-sheet').classList.add('show');
}
function closeOaOrder() {
  _oaEl('oa-order-bg').classList.remove('show');
  _oaEl('oa-order-sheet').classList.remove('show');
}
function oaSubmitOrder() {
  const acc = S.accounts.find(a => String(a.id) === _oaEl('oa-order-acc').value);
  const h = acc ? acc.holdings.find(x => String(x.id) === _oaEl('oa-order-hold').value) : null;
  const qty = parseFloat(_oaEl('oa-order-qty').value), limit = parseFloat(_oaEl('oa-order-limit').value);
  const err = oaOrderError({ hasTarget: !!(acc && h), type: _oaType, qty, limit, held: h ? oaHeldQty(h) : 0 });
  if (err) { toast(err); return; }
  const all = oaRead().orders;
  const i = _oaEditId ? all.findIndex(o => o.id === _oaEditId) : -1;
  if (i >= 0) all[i] = { ...all[i], accId: acc.id, holdId: h.id, type: _oaType, qty, limit, updatedAt: Date.now() };
  else all.push({ id: oaNewId('o'), accId: acc.id, holdId: h.id, type: _oaType, qty, limit, createdAt: Date.now() });
  if (!oaSave('orders', all)) return;
  closeOaOrder();
  _oaRefresh();
  toast(i >= 0 ? 'Ordre modifié ✓' : 'Ordre limite enregistré ✓');
}
_oaEl('oa-order-bg').addEventListener('click', closeOaOrder);
_oaEl('oa-order-close').addEventListener('click', closeOaOrder);
_oaEl('oa-order-acc').addEventListener('change', _oaFillHoldings);
_oaEl('oa-order-type-btns').addEventListener('click', e => { const b = e.target.closest('[data-otype]'); if (b) _oaSetType(b.dataset.otype); });
_oaEl('oa-order-submit').addEventListener('click', oaSubmitOrder);

// ═══════════════════════════════════════════════
// EXÉCUTION D'UN ORDRE : récapitulatif, puis ajout du mouvement au compte
// ═══════════════════════════════════════════════
let _oaExecId = null;
function openOaExec(id) {
  const o = oaRead().orders.find(x => x.id === id), r = o && _oaTarget(o);
  if (!r) { toast('Ordre introuvable'); return; }
  _oaExecId = id;
  const { acc, h } = r, hint = _oaHintOf(o, h);
  _oaEl('oa-exec-body').innerHTML = `
    <div class="oa-head" style="margin-bottom:12px">
      <div class="modal-title" style="margin-bottom:0">Confirmer l'exécution</div>
      <div id="oa-exec-close" class="oa-x">✕</div>
    </div>
    ${hint.hit ? `<div class="oa-warn" style="margin:0 0 10px">⚠ ${_oaHintText(hint, h)}</div>` : ''}
    ${_oaRow('Compte', `${esc(acc.icon || '')} ${esc(acc.name)}${acc.type ? ' · ' + esc(acc.type) : ''}`)}
    ${_oaRow('Titre', `${esc(h.ticker)} — ${esc(h.name)}`)}
    ${_oaRow('Sens', o.type === 'BUY' ? 'Achat' : 'Vente')}
    ${_oaRow('Quantité', oaFmtQty(o.qty))}
    ${_oaRow('Prix limite', maskedNative(o.limit, h.currency))}
    <div class="form-row" style="margin-top:12px">
      <div class="form-field"><div class="form-label">Prix d'exécution</div><input class="form-input" type="number" id="oa-exec-price" min="0" step="any" inputmode="decimal" value="${o.limit}"></div>
      <div class="form-field"><div class="form-label">Date</div><input class="form-input" type="date" id="oa-exec-date" value="${_dayKey(Date.now())}"></div>
    </div>
    <div id="oa-exec-calc"></div>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="confirm-cancel" id="oa-exec-cancel" style="flex:1;height:46px;border-radius:12px;font-weight:700;cursor:pointer">Retour</button>
      <button class="form-submit" id="oa-exec-ok" style="flex:2;height:46px;margin:0">Confirmer et ajouter</button>
    </div>`;
  _oaExecUpdate();
  _oaEl('oa-exec-bg').classList.add('show');
  _oaEl('oa-exec-sheet').classList.add('show');
}
function closeOaExec() {
  _oaEl('oa-exec-bg').classList.remove('show');
  _oaEl('oa-exec-sheet').classList.remove('show');
}
function _oaExecUpdate() {
  const o = oaRead().orders.find(x => x.id === _oaExecId), r = o && _oaTarget(o);
  const box = _oaEl('oa-exec-calc');
  if (!r || !box) return;
  const price = parseFloat(_oaEl('oa-exec-price').value) || 0;
  const held = oaHeldQty(r.h), after = oaQtyAfter(o, held);
  box.innerHTML = _oaRow('Montant', maskedNative(o.qty * price, r.h.currency))
    + _oaRow('Quantité détenue', `${oaFmtQty(held)} → <b>${oaFmtQty(after)}</b>`)
    + (after < -OA_EPS ? '<div style="color:var(--loss);font-size:12px;font-weight:600;margin-top:6px">La quantité détenue est insuffisante pour cette vente.</div>' : '');
}
function oaExecute() {
  const o = oaRead().orders.find(x => x.id === _oaExecId), r = o && _oaTarget(o);
  if (!r) { toast('Ordre introuvable'); return; }
  const { acc, h } = r;
  const price = parseFloat(_oaEl('oa-exec-price').value);
  const date = _oaEl('oa-exec-date').value || _dayKey(Date.now());
  const tx = { date, type: o.type, qty: o.qty, price };
  const err = oaExecutionError(o, oaHeldQty(h), price) || txCheckAdd(h.transactions, tx);   // quantité totale, puis chronologie à la date choisie
  if (err) { toast(err); return; }
  // Le mouvement n'est conservé que si l'ordre a pu être retiré de la liste : jamais de mouvement sans suppression de l'ordre
  h.transactions.push(tx);
  if (!oaSave('orders', oaRead().orders.filter(x => x.id !== o.id))) { h.transactions.pop(); return; }
  recalcHolding(h);
  acc.value = accTotal(acc);
  closeOaExec();
  if (document.querySelector('#s-account #js-holds')) renderHoldsHTML(acc);
  if (S.screen === 'stock') renderScreen('stock');
  refreshMain();   // réaffiche aussi l'écran Ordres et la pastille
  toast((o.type === 'BUY' ? 'Achat' : 'Vente') + ' ajouté sur ' + acc.name + ' ✓');
}
_oaEl('oa-exec-bg').addEventListener('click', closeOaExec);
_oaEl('oa-exec-body').addEventListener('click', e => {
  if (e.target.closest('#oa-exec-ok')) oaExecute();
  else if (e.target.closest('#oa-exec-cancel') || e.target.closest('#oa-exec-close')) closeOaExec();
});
_oaEl('oa-exec-body').addEventListener('input', _oaExecUpdate);

// ═══════════════════════════════════════════════
// NOUVELLE ALERTE DE PRIX
// ═══════════════════════════════════════════════
let _oaDir = 'above';
function _oaTickers() {
  const m = new Map();
  S.accounts.forEach(a => a.holdings.forEach(h => { if (h.type !== 'Cash' && !m.has(h.ticker)) m.set(h.ticker, h.name); }));
  S.watchlist.forEach(w => { if (!m.has(w.ticker)) m.set(w.ticker, w.name); });
  return [...m.entries()];
}
function _oaSetDir(d) {
  _oaDir = d;
  document.querySelectorAll('#oa-alert-dir-btns .type-btn').forEach(b => b.classList.toggle('on', b.dataset.adir === d));
}
function _oaAlertPrefill() {
  const q = _oaQuoteOf(_oaEl('oa-alert-tick').value);
  _oaEl('oa-alert-price').value = q ? q.p : '';
}
function openOaAlert() {
  const ts = _oaTickers();
  if (!ts.length) { toast('Aucun titre : ajoute une position ou un favori'); return; }
  _oaSetDir('above');
  _oaEl('oa-alert-tick').innerHTML = ts.map(([t, n]) => `<option value="${esc(t)}">${esc(t)} — ${esc(n || '')}</option>`).join('');
  _oaAlertPrefill();
  _oaEl('oa-alert-bg').classList.add('show');
  _oaEl('oa-alert-sheet').classList.add('show');
}
function closeOaAlert() {
  _oaEl('oa-alert-bg').classList.remove('show');
  _oaEl('oa-alert-sheet').classList.remove('show');
}
function oaSubmitAlert() {
  const ticker = _oaEl('oa-alert-tick').value;
  const price = parseFloat(_oaEl('oa-alert-price').value);
  if (!ticker) { toast('Titre requis'); return; }
  if (!(price > 0)) { toast('Prix requis'); return; }
  const all = oaRead().alerts;
  if (oaIsDuplicateAlert(all, { ticker, dir: _oaDir, price })) { toast('Cette alerte existe déjà'); return; }
  const q = _oaQuoteOf(ticker);
  all.push({ id: oaNewId('a'), ticker, name: q ? q.name : '', dir: _oaDir, price, createdAt: Date.now() });
  if (!oaSave('alerts', all)) return;
  closeOaAlert();
  _oaRefresh();
  toast('Alerte enregistrée ✓');
}
_oaEl('oa-alert-bg').addEventListener('click', closeOaAlert);
_oaEl('oa-alert-close').addEventListener('click', closeOaAlert);
_oaEl('oa-alert-tick').addEventListener('change', _oaAlertPrefill);
_oaEl('oa-alert-dir-btns').addEventListener('click', e => { const b = e.target.closest('[data-adir]'); if (b) _oaSetDir(b.dataset.adir); });
_oaEl('oa-alert-submit').addEventListener('click', oaSubmitAlert);

// Fermées par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('oa-order-sheet', closeOaOrder);
registerModal('oa-exec-sheet', closeOaExec);
registerModal('oa-alert-sheet', closeOaAlert);
