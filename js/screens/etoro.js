// Compte eToro synchronisé (E14) : bandeau de l'écran du compte, fenêtre de connexion / clés, synchro automatique.
// Appels et conversion : js/services/etoro.js. Fenêtre #et-sheet de mon-patrimoine.html.
// Un compte synchronisé est en lecture seule : ni position, ni mouvement, ni régularisation saisis à la main.
// Dépend, À L'APPEL seulement, de S, esc, masked, toast, go, renderScreen, refreshMain, saveData, timeSince.

let _etAccId = null;   // null = création d'un compte ; sinon : réglages du compte existant

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
      <div id="js-etoro-keys" class="tap" style="${_CHIP}">Clés et relais</div>
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
  el.querySelector('#js-etoro-sync')?.addEventListener('click', async () => {
    toast('Synchronisation eToro…');
    await etoroSync(acc);
    renderScreen('account');
  });
  el.querySelector('#js-etoro-keys')?.addEventListener('click', () => openEtoroSheet(acc.id));
}

// ── Fenêtre : connecter un compte (accId absent) ou régler ses clés / son relais ──
function openEtoroSheet(accId) {
  _etAccId = accId || null;
  const acc = accId && S.accounts.find(a => a.id === accId);
  const keys = acc ? etoroKeys(acc.id) : null;
  document.getElementById('et-title').textContent = acc ? 'Réglages eToro' : 'Connecter un compte eToro';
  document.getElementById('et-name-row').classList.toggle('hidden', !!acc);
  document.getElementById('et-name').value = acc ? acc.name : 'eToro';
  document.getElementById('et-api').value = '';
  document.getElementById('et-user').value = '';
  document.getElementById('et-api').placeholder = keys ? 'Actuelle : ' + etoroMask(keys.apiKey) : 'Clé publique (API key)';
  document.getElementById('et-user').placeholder = keys ? 'Actuelle : ' + etoroMask(keys.userKey) : 'Clé utilisateur (User key)';
  document.getElementById('et-proxy').value = (acc && acc.sync && acc.sync.proxy) || '';
  document.getElementById('et-del').classList.toggle('hidden', !keys);
  document.getElementById('et-submit').textContent = acc ? 'Tester et enregistrer' : 'Connecter';
  document.getElementById('et-bg').classList.add('show');
  document.getElementById('et-sheet').classList.add('show');
}
function closeEtoroSheet() {
  document.getElementById('et-bg').classList.remove('show');
  document.getElementById('et-sheet').classList.remove('show');
  _etAccId = null;
}
// Lecture du formulaire : une clé laissée vide garde la clé actuelle (réglages d'un compte existant)
function _etForm(acc) {
  const cur = acc ? etoroKeys(acc.id) : null;
  const apiKey = document.getElementById('et-api').value.trim() || (cur && cur.apiKey) || '';
  const userKey = document.getElementById('et-user').value.trim() || (cur && cur.userKey) || '';
  const proxy = document.getElementById('et-proxy').value.trim();
  if (!apiKey || !userKey) return { error: 'Saisis la clé publique et la clé utilisateur' };
  if (proxy && !/^https:\/\/[^\s]+$/i.test(proxy)) return { error: 'Le relais doit être une adresse https://' };
  return { keys: { apiKey, userKey }, proxy };
}
async function submitEtoroSheet() {
  const acc = _etAccId && S.accounts.find(a => a.id === _etAccId);
  const f = _etForm(acc);
  if (f.error) return toast(f.error);
  const btn = document.getElementById('et-submit'); btn.disabled = true; btn.textContent = 'Connexion à eToro…';
  try {
    if (acc) {
      const prevProxy = acc.sync.proxy;
      acc.sync.proxy = f.proxy || undefined;
      if (!(await etoroSync(acc, { keys: f.keys }))) { acc.sync.proxy = prevProxy; return; }
      etoroKeysSave(acc.id, f.keys);
      closeEtoroSheet(); renderScreen('account');
      return;
    }
    const name = document.getElementById('et-name').value.trim() || 'eToro';
    const id = 'acc_' + Date.now().toString(36);
    const fresh = { id, name, type: 'Compte-Titres Ordinaire', bank: 'eToro', icon: '🌐', iconBg: 'rgba(0,214,143,.13)', currency: 'USD',
      value: 0, change1d: 0, holdings: [], cashflows: [], observer: false, sync: { provider: 'etoro', ...(f.proxy ? { proxy: f.proxy } : {}) } };
    // Le compte n'est créé que si eToro répond : la connexion sert de test
    if (!(await etoroSync(fresh, { keys: f.keys, quiet: true }))) return toast(fresh.sync.error);
    etoroKeysSave(id, f.keys);
    S.accounts.push(fresh); saveData();
    closeEtoroSheet(); refreshMain();
    S.accountId = id; go('account');
    toast(`Compte « ${name} » connecté ✓`);
  } finally { btn.disabled = false; btn.textContent = acc ? 'Tester et enregistrer' : 'Connecter'; }
}
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
// Lien « Connecter un compte eToro » de la fenêtre de création de compte
document.getElementById('acc-etoro-link')?.addEventListener('click', () => { closeAccModal(); openEtoroSheet(null); });
registerModal('et-sheet', closeEtoroSheet);

// Accueil « À surveiller » (sous garde) : synchro en échec ou de plus de 24 h
if (typeof HOME_WATCH !== 'undefined') HOME_WATCH.etoro = () => S.accounts
  .filter(a => a.sync && a.sync.provider === 'etoro' && (a.sync.error || !a.sync.lastSync || Date.now() - a.sync.lastSync > 24 * 3600 * 1000))
  .map(a => ({ level: 'alert', go: 'account', accountId: a.id, text: `« ${a.name} » non synchronisé avec eToro`, sub: a.sync.error || 'Dernière synchro de plus de 24 h' }));
