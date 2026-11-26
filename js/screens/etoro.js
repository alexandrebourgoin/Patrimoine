// Compte eToro synchronisé (E14) : bandeau de l'écran du compte, option « Lier à une API » de la création de compte, réglages des clés.
// Appels et conversion : js/services/etoro.js. Fenêtre #et-sheet de mon-patrimoine.html.
// Un compte synchronisé est en lecture seule : ni position, ni mouvement, ni régularisation saisis à la main.
// Dépend, À L'APPEL seulement, de S, esc, masked, toast, go, renderScreen, refreshMain, saveData, timeSince.

let _etAccId = null;   // compte dont la fenêtre « Réglages eToro » est ouverte

// Bandeau sous la valeur du compte : dernière synchro, erreur éventuelle, boutons
function etoroBannerHTML(acc) {
  if (!acc || !acc.sync || acc.sync.provider !== 'etoro') return '';
  const s = acc.sync, when = s.lastSync ? timeSince(s.lastSync) : 'jamais';
  return `<div id="js-etoro" style="margin-top:12px;padding:12px 14px;border-radius:14px;background:var(--card2)">
    <div class="t-label">Synchronisé avec eToro · lecture seule</div>
    <div class="t-sm" style="margin-top:4px">Dernière synchro : <b>${esc(when)}</b>${s.equityUSD != null ? ` · solde eToro ${esc(fmtNative(s.equityUSD, 'USD'))}` : ''}</div>
    ${s.error ? `<div class="t-sm" style="margin-top:4px;color:var(--loss);font-weight:700">⚠ ${esc(s.error)}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <div id="js-etoro-sync" class="tap" style="${_CHIP}">Synchroniser</div>
      <div id="js-etoro-keys" class="tap" style="${_CHIP}">Clés API</div>
    </div>
  </div>`;
}

// Écran du compte synchronisé : saisies manuelles retirées, positions non modifiables
function bindEtoroAccount(el, acc) {
  const synced = !!(acc && acc.sync && acc.sync.provider === 'etoro');
  el.classList.toggle('acc-synced', synced);
  if (!synced) return;
  // Ligne « Apport net / Liquidités / Apports » et ligne « Régulariser les liquidités » (les liquidités restent sous le solde)
  ['#js-cf-btn', '#js-ca-btn'].forEach(sel => { const b = el.querySelector(sel); if (b) (b.closest('.row.gap8, div[style*="flex-wrap"]') || b).remove(); });
  el.querySelector('#js-add-hold')?.remove();
  // Pas de relevé : les achats affichés ne seraient que la reconstitution des positions eToro
  el.querySelector('#js-mcnt')?.closest('.row')?.remove();
  el.querySelector('#js-moves')?.remove();
  // Capture : le toucher d'une position n'ouvre pas sa fiche (achats / ventes impossibles sur un compte synchronisé)
  el.querySelector('#js-holds')?.addEventListener('click', e => {
    if (!e.target.closest('.hold-item') || e.target.closest('.hold-watch-btn')) return;
    e.stopPropagation(); toast('Position gérée par eToro (lecture seule)');
  }, true);
  // Même chemin que le bouton rafraîchir : cours + comptes liés (fetchLivePrices, js/services/prices.js)
  el.querySelector('#js-etoro-sync')?.addEventListener('click', async () => {
    await fetchLivePrices();
    renderScreen('account');
  });
  el.querySelector('#js-etoro-keys')?.addEventListener('click', () => openEtoroSheet(acc.id));
}

// ── Fenêtre « Réglages eToro » d'un compte déjà lié : clés API ──
function openEtoroSheet(accId) {
  const acc = S.accounts.find(a => a.id === accId); if (!acc) return;
  _etAccId = acc.id;
  const keys = etoroKeys(acc.id);
  document.getElementById('et-api').value = keys ? '' : ETORO_PUBLIC_KEY;   // clé publique commune, pré-remplie
  document.getElementById('et-user').value = '';
  document.getElementById('et-api').placeholder = keys ? 'Actuelle : ' + etoroMask(keys.apiKey) : ETORO_PUBLIC_KEY;
  document.getElementById('et-user').placeholder = keys ? 'Actuelle : ' + etoroMask(keys.userKey) : 'Clé utilisateur (User key)';
  document.getElementById('et-del').classList.toggle('hidden', !keys);
  document.getElementById('et-bg').classList.add('show');
  document.getElementById('et-sheet').classList.add('show');
}
function closeEtoroSheet() {
  document.getElementById('et-bg').classList.remove('show');
  document.getElementById('et-sheet').classList.remove('show');
  _etAccId = null;
}
// Lecture des champs clés (préfixe : 'et' = réglages, 'acc-et' = création de compte).
// Une clé laissée vide garde la clé actuelle du compte.
function etoroFormRead(prefix, acc) {
  const cur = acc ? etoroKeys(acc.id) : null;
  const apiKey = document.getElementById(prefix + '-api').value.trim() || (cur && cur.apiKey) || '';
  const userKey = document.getElementById(prefix + '-user').value.trim() || (cur && cur.userKey) || '';
  if (!apiKey || !userKey) return { error: 'Saisis la clé publique et la clé utilisateur eToro' };
  return { keys: { apiKey, userKey } };
}
async function submitEtoroSheet() {
  const acc = _etAccId && S.accounts.find(a => a.id === _etAccId); if (!acc) return;
  const f = etoroFormRead('et', acc);
  if (f.error) return toast(f.error);
  const btn = document.getElementById('et-submit'); btn.disabled = true; btn.textContent = 'Connexion à eToro…';
  try {
    delete acc.sync.proxy;   // ancien relais séparé : abandonné, tout passe par le proxy des cours
    if (!(await etoroSync(acc, { keys: f.keys }))) return;
    etoroKeysSave(acc.id, f.keys);
    closeEtoroSheet(); renderScreen('account');
  } finally { btn.disabled = false; btn.textContent = 'Tester et enregistrer'; }
}

// ── Création de compte (js/modals/account.js) : option « Lier à une API », pour tous les types ──
function accSyncReset() {
  document.getElementById('acc-sync').value = '';
  document.getElementById('acc-et-api').value = ETORO_PUBLIC_KEY;
  document.getElementById('acc-et-user').value = '';
  accSyncToggle();
}
function accSyncToggle() {
  const on = document.getElementById('acc-sync').value === 'etoro';
  document.getElementById('acc-sync-box').classList.toggle('hidden', !on);
  const cur = document.getElementById('acc-currency');
  if (on) cur.value = 'USD';   // eToro tient ses comptes en dollars
  cur.disabled = on;
  document.getElementById('acc-submit').textContent = on ? 'Connecter et créer le compte' : 'Créer le compte';
}
// Retourne false si aucune API n'est choisie (création classique). Sinon le compte n'est créé que si eToro répond.
async function accSyncCreate(acc) {
  if (document.getElementById('acc-sync').value !== 'etoro') return false;
  const f = etoroFormRead('acc-et', null);
  if (f.error) { toast(f.error); return true; }
  Object.assign(acc, { currency: 'USD', bank: acc.bank || 'eToro', sync: { provider: 'etoro' } });
  const btn = document.getElementById('acc-submit'); btn.disabled = true; btn.textContent = 'Connexion à eToro…';
  try {
    if (!(await etoroSync(acc, { keys: f.keys, quiet: true }))) { toast(acc.sync.error); return true; }
    etoroKeysSave(acc.id, f.keys);
    S.accounts.push(acc); saveData();
    closeAccModal(); refreshMain();
    S.accountId = acc.id; go('account');
    toast(`Compte « ${acc.name} » connecté à eToro ✓`);
    return true;
  } finally { btn.disabled = false; accSyncToggle(); }
}
document.getElementById('acc-sync').addEventListener('change', accSyncToggle);
document.getElementById('et-bg').addEventListener('click', closeEtoroSheet);
document.getElementById('et-close').addEventListener('click', closeEtoroSheet);
document.getElementById('et-submit').addEventListener('click', submitEtoroSheet);
document.getElementById('et-del').addEventListener('click', () => {
  if (!_etAccId) return;
  etoroKeysDelete(_etAccId);
  const acc = S.accounts.find(a => a.id === _etAccId);
  if (acc) { acc.sync.error = 'Clés API supprimées de cet appareil : le compte n\'est plus synchronisé'; saveData(); }
  closeEtoroSheet(); renderScreen('account');
  toast('Clés supprimées de cet appareil');
});
registerModal('et-sheet', closeEtoroSheet);

// Accueil « À surveiller » (sous garde) : synchro en échec ou de plus de 24 h
if (typeof HOME_WATCH !== 'undefined') HOME_WATCH.etoro = () => S.accounts
  .filter(a => a.sync && a.sync.provider === 'etoro' && (a.sync.error || !a.sync.lastSync || Date.now() - a.sync.lastSync > 24 * 3600 * 1000))
  .map(a => ({ level: 'alert', go: 'account', accountId: a.id, text: `« ${a.name} » non synchronisé avec eToro`, sub: a.sync.error || 'Dernière synchro de plus de 24 h' }));
