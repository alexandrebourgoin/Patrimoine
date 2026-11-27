// Comptes liés à un service (E14) : lien discret de la création de compte, fenêtre « Mise à jour automatique »
// (choix du service puis clé), pastille de l'écran du compte, lecture seule, « À surveiller ».
// Services et synchro : js/services/linked.js (registre), js/services/etoro.js… Fenêtre #ls-sheet de mon-patrimoine.html.
// Un compte lié est en lecture seule : ni position, ni mouvement, ni régularisation saisis à la main.
// Dépend, À L'APPEL seulement, de S, esc, toast, go, renderScreen, refreshMain, saveData, timeSince, fetchLivePrices, closeAccModal.

const LINK_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex-shrink:0"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// ── Écran du compte : pastille « eToro · il y a 5 min » (orange en cas d'échec) ──
function linkedChipHTML(acc) {
  const svc = linkedService(acc); if (!svc) return '';
  const s = acc.sync, err = !!s.error;
  return `<div id="js-linked" class="tap" style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;cursor:pointer;${err ? 'background:rgba(245,158,11,.15);color:var(--warn,#b45309)' : 'background:var(--card2);color:var(--text2)'}">${LINK_ICON}${esc(svc.label)} · ${esc(s.lastSync ? timeSince(s.lastSync) : 'jamais synchronisé')}${err ? ' · ⚠' : ''}</div>
    ${err ? `<div class="t-sm" style="margin-top:6px;color:var(--loss)">${esc(s.error)}</div>` : ''}`;
}

// Écran du compte lié : saisies manuelles retirées, positions non modifiables
function bindLinkedAccount(el, acc) {
  const svc = linkedService(acc);
  el.classList.toggle('acc-synced', !!svc);
  if (!svc) return;
  // Ligne « Apport net / Liquidités / Apports » et ligne « Régulariser les liquidités » (les liquidités restent sous le solde)
  ['#js-cf-btn', '#js-ca-btn'].forEach(sel => { const b = el.querySelector(sel); if (b) (b.closest('.row.gap8, div[style*="flex-wrap"]') || b).remove(); });
  el.querySelector('#js-add-hold')?.remove();
  // Pas de relevé : les achats affichés ne seraient que la reconstitution des positions du service
  el.querySelector('#js-mcnt')?.closest('.row')?.remove();
  el.querySelector('#js-moves')?.remove();
  // Capture : le toucher d'une position n'ouvre pas sa fiche (achats / ventes impossibles sur un compte lié)
  el.querySelector('#js-holds')?.addEventListener('click', e => {
    if (!e.target.closest('.hold-item') || e.target.closest('.hold-watch-btn')) return;
    e.stopPropagation(); toast(`Position gérée par ${svc.label} (lecture seule)`);
  }, true);
  el.querySelector('#js-linked')?.addEventListener('click', () => openLinkedSheet({ accId: acc.id }));
}

// ── Fenêtre « Mise à jour automatique » ──
// Création (mode 'pick' puis 'key') : le choix reste en attente (_accLink) jusqu'à « Créer le compte ».
// Compte existant (accId) : directement la clé, avec synchro et suppression de la clé.
let _ls = { accId: null, svcId: null };
let _accLink = null;   // { svcId, keys } choisi dans la création de compte
// Une seule fenêtre à la fois : ouverte depuis la création de compte, la fenêtre remplace la fiche le temps du choix,
// puis la fiche revient telle quelle (valeurs saisies conservées), au choix comme à l'annulation.
const _LS_PARENTS = ['acc-modal-sheet', 'acc-modal-bg'];
let _lsHidden = [];

function _lsShow(on) {
  document.getElementById('ls-bg').classList.toggle('show', on);
  document.getElementById('ls-sheet').classList.toggle('show', on);
}
function _lsRow(id, label, sub, opts = {}) {
  return `<div class="tap ls-svc${opts.on ? ' on' : ''}${opts.soon ? ' soon' : ''}" ${id != null ? `data-svc="${esc(id)}"` : ''} style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;border:1px solid ${opts.on ? 'var(--accent)' : 'var(--border)'};margin-bottom:8px;${opts.soon ? 'opacity:.55;cursor:default' : 'cursor:pointer'}">
    <span style="flex:1;min-width:0"><span style="display:block;font-weight:700;font-size:14px">${esc(label)}</span><span class="t-sm" style="display:block">${esc(sub)}</span></span>
    <span class="t-sm" style="font-weight:700">${opts.soon ? 'BIENTÔT' : '›'}</span></div>`;
}
function _lsRender() {
  const acc = _ls.accId && S.accounts.find(a => a.id === _ls.accId);
  const svc = _ls.svcId && LINKED_SERVICES[_ls.svcId];
  const keyMode = !!svc;
  document.getElementById('ls-title').textContent = acc ? svc.label : keyMode ? svc.label : 'Mise à jour automatique';
  // Choix du service (création seulement)
  const list = document.getElementById('ls-list');
  list.classList.toggle('hidden', keyMode);
  if (!keyMode) {
    const cur = _accLink && _accLink.svcId;
    list.innerHTML = `<div class="t-sm" style="margin-bottom:12px">Le solde et les positions viennent du service, en lecture seule : rien n'est saisi à la main sur ce compte.</div>`
      + _lsRow('', 'Aucune', 'Saisie manuelle', { on: !cur })
      + Object.entries(LINKED_SERVICES).map(([id, s]) => _lsRow(id, s.label, s.sub, { on: cur === id })).join('')
      + LINKED_SOON.map(s => _lsRow(null, s.label, s.sub, { soon: true })).join('');
  }
  // Clé
  document.getElementById('ls-key').classList.toggle('hidden', !keyMode);
  if (!keyMode) return;
  const keys = acc ? linkedKeys(acc.id) : (_accLink && _accLink.svcId === _ls.svcId ? _accLink.keys : null);
  document.getElementById('ls-status').innerHTML = acc
    ? `Lecture seule · dernière synchro : <b>${esc(acc.sync.lastSync ? timeSince(acc.sync.lastSync) : 'jamais')}</b>${acc.sync.error ? `<div style="color:var(--loss);margin-top:4px">${esc(acc.sync.error)}</div>` : ''}`
    : '';
  document.getElementById('ls-status').classList.toggle('hidden', !acc);
  document.getElementById('ls-key-label').textContent = svc.keyLabel;
  const inp = document.getElementById('ls-key-input');
  inp.value = '';
  inp.placeholder = keys && keys.userKey ? 'Actuelle : ' + linkedMask(keys.userKey) : svc.keyPlaceholder;
  document.getElementById('ls-help').innerHTML = svc.help;
  document.getElementById('ls-help').classList.add('hidden');
  document.getElementById('ls-ok').textContent = acc ? 'Tester et enregistrer' : 'Valider';
  document.getElementById('ls-back').classList.toggle('hidden', !!acc);
  document.getElementById('ls-sync').classList.toggle('hidden', !acc);
  document.getElementById('ls-del').classList.toggle('hidden', !(acc && keys));
}
function openLinkedSheet({ accId = null, svcId = null } = {}) {
  const acc = accId && S.accounts.find(a => a.id === accId);
  _ls = { accId: acc ? acc.id : null, svcId: acc ? acc.sync.provider : svcId };
  _lsRender();
  _lsHidden = acc ? [] : _LS_PARENTS.map(id => document.getElementById(id)).filter(el => el && el.classList.contains('show'));
  _lsHidden.forEach(el => el.classList.remove('show'));
  const sheet = document.getElementById('ls-sheet'); if (sheet) sheet.scrollTop = 0;
  _lsShow(true);
}
function closeLinkedSheet() {
  _lsShow(false); _ls = { accId: null, svcId: null };
  _lsHidden.forEach(el => el.classList.add('show'));   // la fiche de création revient
  _lsHidden = [];
}

// Valider : création → choix gardé en attente ; compte existant → test puis enregistrement de la clé
async function submitLinkedSheet() {
  const svc = LINKED_SERVICES[_ls.svcId]; if (!svc) return;
  const acc = _ls.accId && S.accounts.find(a => a.id === _ls.accId);
  const typed = document.getElementById('ls-key-input').value.trim();
  const cur = acc ? linkedKeys(acc.id) : (_accLink && _accLink.svcId === _ls.svcId ? _accLink.keys : null);
  const keys = typed ? svc.keysFrom(typed) : cur;
  if (!svc.keysReady(keys)) return toast(`${svc.keyLabel} : colle-la avant de valider`);
  if (!acc) { _accLink = { svcId: _ls.svcId, keys }; closeLinkedSheet(); linkedAccSync(); return; }
  const btn = document.getElementById('ls-ok'); btn.disabled = true; btn.textContent = `Connexion à ${svc.label}…`;
  try {
    if (!(await svc.sync(acc, { keys }))) { _lsRender(); return; }
    linkedKeysSave(acc.id, keys);
    closeLinkedSheet(); renderScreen('account');
  } finally { btn.disabled = false; }
}
document.getElementById('ls-list').addEventListener('click', e => {
  const row = e.target.closest('[data-svc]'); if (!row) return;
  const id = row.dataset.svc;
  if (!id) { _accLink = null; closeLinkedSheet(); linkedAccSync(); return; }   // « Aucune »
  _ls.svcId = id; _lsRender();
  setTimeout(() => document.getElementById('ls-key-input').focus(), 50);
});
document.getElementById('ls-back').addEventListener('click', () => { _ls.svcId = null; _lsRender(); });
document.getElementById('ls-help-link').addEventListener('click', () => document.getElementById('ls-help').classList.toggle('hidden'));
document.getElementById('ls-ok').addEventListener('click', submitLinkedSheet);
document.getElementById('ls-bg').addEventListener('click', closeLinkedSheet);
document.getElementById('ls-close').addEventListener('click', closeLinkedSheet);
// Synchroniser : même chemin que le bouton rafraîchir (cours + comptes liés : fetchLivePrices)
document.getElementById('ls-sync').addEventListener('click', async () => { closeLinkedSheet(); await fetchLivePrices(); renderScreen('account'); });
document.getElementById('ls-del').addEventListener('click', () => {
  const acc = _ls.accId && S.accounts.find(a => a.id === _ls.accId); if (!acc) return;
  linkedKeysDelete(acc.id);
  acc.sync.error = 'Clé supprimée de cet appareil : le compte n\'est plus mis à jour'; saveData();
  closeLinkedSheet(); renderScreen('account');
  toast('Clé supprimée de cet appareil');
});
registerModal('ls-sheet', closeLinkedSheet);

// ── Création de compte (js/modals/account.js) : lien discret sous le bouton, ou récap une fois le service choisi ──
function linkedAccReset() { _accLink = null; linkedAccSync(); }
function linkedAccSync() {
  const svc = _accLink && LINKED_SERVICES[_accLink.svcId];
  document.getElementById('acc-link-api').classList.toggle('hidden', !!svc);
  const recap = document.getElementById('acc-link-recap');
  recap.classList.toggle('hidden', !svc);
  if (svc) recap.querySelector('[data-name]').textContent = `${svc.label} · clé collée`;
  const cur = document.getElementById('acc-currency');
  if (svc) cur.value = svc.currency;
  cur.disabled = !!svc;
  document.getElementById('acc-submit').textContent = svc ? 'Connecter et créer le compte' : 'Créer le compte';
}
// Retourne false sans service choisi (création classique). Sinon le compte n'est créé que si le service répond.
async function linkedAccCreate(acc) {
  const svc = _accLink && LINKED_SERVICES[_accLink.svcId]; if (!svc) return false;
  Object.assign(acc, { currency: svc.currency, bank: acc.bank || svc.bank, cashflows: [], sync: { provider: _accLink.svcId } });
  delete acc.rate;
  const btn = document.getElementById('acc-submit'); btn.disabled = true; btn.textContent = `Connexion à ${svc.label}…`;
  try {
    if (!(await svc.sync(acc, { keys: _accLink.keys, quiet: true }))) { toast(acc.sync.error); return true; }
    linkedKeysSave(acc.id, _accLink.keys);
    S.accounts.push(acc); saveData();
    closeAccModal(); refreshMain();
    S.accountId = acc.id; go('account');
    toast(`Compte « ${acc.name} » lié à ${svc.label} ✓`);
    _accLink = null;
    return true;
  } finally { btn.disabled = false; linkedAccSync(); }
}
document.getElementById('acc-link-api').addEventListener('click', () => openLinkedSheet());
document.getElementById('acc-link-edit').addEventListener('click', () => openLinkedSheet({ svcId: _accLink && _accLink.svcId }));
document.getElementById('acc-link-del').addEventListener('click', linkedAccReset);

// Accueil « À surveiller » (sous garde) : synchro en échec ou de plus de 24 h
if (typeof HOME_WATCH !== 'undefined') HOME_WATCH.linked = () => S.accounts
  .filter(a => linkedService(a) && (a.sync.error || !a.sync.lastSync || Date.now() - a.sync.lastSync > 24 * 3600 * 1000))
  .map(a => ({ level: 'alert', go: 'account', accountId: a.id, text: `« ${a.name} » non mis à jour par ${linkedService(a).label}`, sub: a.sync.error || 'Dernière synchro de plus de 24 h' }));
