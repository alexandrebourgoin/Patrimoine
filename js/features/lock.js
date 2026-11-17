// Verrouillage d accès : code PIN (PBKDF2) + biométrie WebAuthn.
// Dépend, À L APPEL seulement, de S, saveSettings, toast… (mon-patrimoine.js) et des éléments #lock-overlay / #newcode-sheet.
// Garde-fous à ne pas casser : voir popstate / keydown (isLocked, _lockState) dans mon-patrimoine.js.

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// SÉCURITÉ — verrouillage par code PIN + biométrie (WebAuthn)
//
// Portée : c'est un VERROU D'ACCÈS, pas un chiffrement. Il empêche
// quelqu'un qui a le téléphone déverrouillé d'ouvrir l'appli ; les
// données restent en clair dans localStorage.
// Le code n'est jamais stocké : seul un dérivé PBKDF2-SHA256 (150k
// itérations, sel aléatoire de 16 octets) l'est. crypto.subtle n'existe
// qu'en contexte sécurisé (https / localhost) → le verrou y est conditionné.
// ═══════════════════════════════════════════════
const LOCK_LEN  = 6;         // longueur du code
const LOCK_ITER = 150000;    // itérations PBKDF2

let _lockedNow  = false;     // l'appli est-elle verrouillée maintenant ?
let _lockState  = null;      // session de saisie en cours : { mode, buf, first, after }
let _lockHidTs  = 0;         // horodatage du passage en arrière-plan
let _lockTimer  = null;      // timer du compte à rebours de pénalité
let _lockPending = null;     // action différée jusqu'au déverrouillage
let _bioOk      = false;     // capteur biométrique disponible (sondé à l'init)

function cryptoOk()  { return !!(window.crypto && window.crypto.subtle && window.isSecureContext); }
function lockArmed() { return !!(S.lockEnabled && S.lockHash && S.lockSalt); }
function isLocked()  { return _lockedNow; }

// ── Helpers crypto ──
function _hex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function _randHex(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return _hex(a); }
async function _pinHash(pin, saltHex) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(saltHex), iterations: LOCK_ITER, hash: 'SHA-256' }, key, 256);
  return _hex(bits);
}
// Comparaison à temps constant (les deux dérivés font la même longueur)
function _eqConst(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ── Helpers WebAuthn (biométrie) ──
function _b64u(buf) {
  const a = new Uint8Array(buf); let s = '';
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function _unb64u(str) {
  const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}
async function bioAvailable() {
  try {
    if (!window.PublicKeyCredential || !window.isSecureContext) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) { return false; }
}
// Enregistre une clé liée au capteur de l'appareil. Renvoie l'id du credential.
async function bioRegister() {
  const ch  = new Uint8Array(32); crypto.getRandomValues(ch);
  const uid = new Uint8Array(16); crypto.getRandomValues(uid);
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: ch,
    rp:   { name: 'Mon patrimoine', id: location.hostname },
    user: { id: uid, name: 'patrimoine', displayName: (S.user && S.user.name) || 'Moi' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60000, attestation: 'none',
  }});
  if (!cred) throw new Error('no-credential');
  return _b64u(cred.rawId);
}
// Demande une empreinte / un visage. Le navigateur ne rend une assertion que si
// la vérification utilisateur a réussi → assertion obtenue = déverrouillage.
async function bioVerify() {
  if (!S.lockBioId) return false;
  const ch = new Uint8Array(32); crypto.getRandomValues(ch);
  const a = await navigator.credentials.get({ publicKey: {
    challenge: ch, rpId: location.hostname,
    allowCredentials: [{ type: 'public-key', id: _unb64u(S.lockBioId), transports: ['internal'] }],
    userVerification: 'required', timeout: 60000,
  }});
  return !!a;
}

// ── Pénalité anti-force brute (persistée : un rechargement ne la remet pas à zéro) ──
function _lockPenalty(fails) {
  if (fails < 5) return 0;
  if (fails < 7) return 30;
  if (fails < 9) return 60;
  return 300;
}
function _lockBlockedFor() {
  const left = Math.ceil(((S.lockUntil || 0) - Date.now()) / 1000);
  return left > 0 ? left : 0;
}

// ── Rendu de l'overlay ──
const _LOCK_TEXTS = {
  unlock:  ['Mon patrimoine', 'Saisissez votre code'],
  current: ['Code actuel',    'Saisissez votre code actuel'],
  create:  ['Nouveau code',   'Choisissez un code à ' + LOCK_LEN + ' chiffres'],
  confirm: ['Nouveau code',   'Saisissez-le à nouveau'],
};
function _lockPaint(err) {
  const st = _lockState; if (!st) return;
  const t = _LOCK_TEXTS[st.mode] || _LOCK_TEXTS.unlock;
  document.getElementById('lock-title').textContent = t[0];
  document.getElementById('lock-sub').textContent   = t[1];
  document.getElementById('lock-dots').innerHTML =
    Array.from({ length: LOCK_LEN }, (_, i) => '<div class="lock-dot' + (i < st.buf.length ? ' on' : '') + '"></div>').join('');
  document.getElementById('lock-err').textContent = err || '';
  // Empreinte : uniquement pour déverrouiller l'appli
  document.getElementById('lock-bio')
    .classList.toggle('off', !(st.mode === 'unlock' && S.lockBio && S.lockBioId && _bioOk));
  // Annuler : partout sauf sur le verrou d'ouverture (on ne peut pas y échapper)
  document.getElementById('lock-cancel').classList.toggle('off', st.mode === 'unlock');
}
function _lockShake(msg) {
  const ov = document.getElementById('lock-overlay');
  ov.classList.add('shake');
  setTimeout(() => ov.classList.remove('shake'), 400);
  haptic(40);
  if (_lockState) { _lockState.buf = ''; _lockPaint(msg); }
}
function _lockBusy(on) { document.getElementById('lock-pad').classList.toggle('busy', !!on); }

// Compte à rebours pendant un blocage
function _lockTick() {
  clearTimeout(_lockTimer);
  const left = _lockBlockedFor();
  if (!left) { _lockBusy(false); if (_lockState) _lockPaint(''); return; }
  _lockBusy(true);
  if (_lockState) _lockPaint('Trop d\'essais — réessayez dans ' + left + ' s');
  _lockTimer = setTimeout(_lockTick, 1000);
}

// ── Ouverture / fermeture d'une session de saisie ──
// mode : 'unlock' (verrou d'ouverture) | 'current' | 'create' | 'confirm'
// after(ok) : rappelé à la fermeture des sessions lancées depuis les Réglages
function _lockOpen(mode, after, next) {
  _lockState = { mode, buf: '', first: '', after: after || null, next: next || null };
  document.documentElement.classList.add('locked');
  _lockPaint('');
  _lockTick();
  if (mode === 'unlock' && S.lockBio && S.lockBioId && _bioOk) setTimeout(_lockBio, 400);
}
function _lockClose(ok) {
  const after = _lockState && _lockState.after;
  _lockState = null;
  clearTimeout(_lockTimer);
  if (!_lockedNow) document.documentElement.classList.remove('locked');
  if (after) after(!!ok);
}

function lockApp() {
  if (!lockArmed() || _lockedNow) return;
  _lockedNow = true;
  _lockOpen('unlock');
}
function unlockApp() {
  _lockedNow = false;
  S.lockFails = 0; S.lockUntil = 0; saveSettings();
  _lockClose(true);
  document.documentElement.classList.remove('locked');
  haptic(12);
  const p = _lockPending; _lockPending = null;
  if (p) setTimeout(p, 400);
}

// ── Saisie ──
async function _lockKey(k) {
  const st = _lockState; if (!st || _lockBlockedFor()) return;
  if (k === 'bio') { _lockBio(); return; }
  if (k === 'del') { st.buf = st.buf.slice(0, -1); _lockPaint(''); haptic(5); return; }
  if (!/^[0-9]$/.test(k) || st.buf.length >= LOCK_LEN) return;
  st.buf += k; haptic(6); _lockPaint('');
  if (st.buf.length === LOCK_LEN) await _lockSubmit();
}

async function _lockSubmit() {
  const st = _lockState; if (!st) return;
  const pin = st.buf;
  _lockBusy(true);
  try {
    // Vérification du code existant (ouverture de l'appli, ou étape préalable
    // avant de changer / désactiver le verrou depuis les Réglages)
    if (st.mode === 'unlock' || st.mode === 'current') {
      const h = await _pinHash(pin, S.lockSalt);
      if (_eqConst(h, S.lockHash)) {
        if (st.mode === 'unlock') { unlockApp(); return; }
        if (st.next === 'off') { _lockClose(true); return; }   // désactivation
        st.mode = 'create'; st.buf = ''; _lockPaint('');       // changement de code
        return;
      }
      S.lockFails = (S.lockFails || 0) + 1;
      const pen = _lockPenalty(S.lockFails);
      S.lockUntil = pen ? Date.now() + pen * 1000 : 0;
      saveSettings();
      _lockShake('Code incorrect');
      if (pen) _lockTick();
      return;
    }
    // Définition d'un nouveau code
    if (st.mode === 'create') { st.first = pin; st.mode = 'confirm'; st.buf = ''; _lockPaint(''); return; }
    if (st.mode === 'confirm') {
      if (pin !== st.first) { st.mode = 'create'; st.first = ''; _lockShake('Les codes ne correspondent pas'); return; }
      const salt = _randHex(16);
      S.lockSalt    = salt;
      S.lockHash    = await _pinHash(pin, salt);
      S.lockEnabled = true;
      S.lockFails   = 0; S.lockUntil = 0;
      saveSettings();
      _lockClose(true);
      return;
    }
  } catch (e) {
    _lockShake('Erreur de sécurité');
  } finally {
    _lockBusy(!!_lockBlockedFor());
  }
}

async function _lockBio() {
  if (!_lockState || _lockState.mode !== 'unlock') return;
  if (!S.lockBio || !S.lockBioId || _lockBlockedFor()) return;
  _lockBusy(true);
  try {
    if (await bioVerify()) { unlockApp(); return; }
    _lockPaint('Empreinte non reconnue');
  } catch (e) {
    // Abandon volontaire (l'utilisateur ferme la fenêtre système) → pas de message
    if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') _lockPaint('Biométrie indisponible');
  } finally {
    _lockBusy(!!_lockBlockedFor());
  }
}

// ── Actions depuis les Réglages ──
function lockEnable(done) {
  _lockOpen('create', ok => { if (ok) toast('Verrouillage activé ✓'); done && done(ok); });
}
function lockChange(done) {
  _lockOpen('current', ok => { if (ok) toast('Code modifié ✓'); done && done(ok); }, 'new');
}
function lockDisable(done) {
  _lockOpen('current', ok => {
    if (ok) {
      S.lockEnabled = false; S.lockHash = ''; S.lockSalt = '';
      S.lockBio = false; S.lockBioId = '';
      S.lockFails = 0; S.lockUntil = 0;
      saveSettings();
      toast('Verrouillage désactivé');
    }
    done && done(ok);
  }, 'off');
}

// ── Secours « code oublié » ────────────────────────────────────────────────
// Tire un code ALÉATOIRE, l'affiche une seule fois, n'en garde que le hash.
// Deux conditions cumulées : l'appli doit être DÉVERROUILLÉE (l'écran Réglages
// n'est atteignable qu'après authentification) ET la biométrie doit répondre.
// Lève aussi la pénalité anti-force brute, sinon le nouveau code resterait
// inutilisable pendant le blocage.

// Chiffres uniformes : on rejette les octets ≥ 250 pour éviter le biais du modulo.
function _randomPin(len = LOCK_LEN) {
  let out = '';
  while (out.length < len) {
    const b = new Uint8Array(32); crypto.getRandomValues(b);
    for (const v of b) { if (v < 250) { out += String(v % 10); if (out.length === len) break; } }
  }
  return out;
}

// Le code n'existe que dans le DOM de cette feuille ; elle l'efface en se fermant.
function showNewCode(pin) {
  document.getElementById('newcode-digits').textContent = pin;
  document.getElementById('newcode-bg').classList.add('show');
  document.getElementById('newcode-sheet').classList.add('show');
}
function closeNewCode() {
  document.getElementById('newcode-digits').textContent = '';
  document.getElementById('newcode-bg').classList.remove('show');
  document.getElementById('newcode-sheet').classList.remove('show');
}
// Pas de fermeture au clic sur le fond : le code disparaîtrait sur un tap distrait
document.getElementById('newcode-done').addEventListener('click', closeNewCode);
document.getElementById('newcode-change').addEventListener('click', () => {
  closeNewCode();
  // Directement à la saisie d'un nouveau code : la biométrie vient d'être vérifiée, et
  // redemander le code actuel serait impossible puisqu'on vient d'effacer son affichage.
  _lockOpen('create', ok => { if (ok) toast('Code modifié ✓'); renderScreen('settings'); });
});

async function lockResetCode(done) {
  if (!lockArmed() || isLocked()) return;
  if (!(_bioOk && S.lockBio && S.lockBioId)) { toast('Activez la biométrie pour pouvoir réinitialiser'); return; }
  openConfirm('Tirer un nouveau code au hasard ? Votre empreinte ou votre visage sera demandé, puis le code s\'affichera une seule fois.', async () => {
    try {
      if (!(await bioVerify())) { toast('Biométrie non reconnue'); return; }
    } catch (e) {
      // Abandon volontaire de la fenêtre système → silence, comme au déverrouillage
      if (!e || (e.name !== 'NotAllowedError' && e.name !== 'AbortError')) toast('Biométrie indisponible');
      return;
    }
    let pin = _randomPin();
    try {
      const salt = _randHex(16);
      S.lockSalt  = salt;
      S.lockHash  = await _pinHash(pin, salt);
      S.lockFails = 0; S.lockUntil = 0;
      saveSettings();
      showNewCode(pin);
      done && done();
    } catch (e) { toast('Erreur de sécurité'); }
    finally { pin = null; }
  });
}

// ── Événements de l'overlay (attachés une seule fois) ──
document.getElementById('lock-pad').addEventListener('click', e => {
  const key = e.target.closest('.lock-key'); if (!key) return;
  _lockKey(key.dataset.k);
});
document.getElementById('lock-cancel').addEventListener('click', () => {
  if (_lockState && _lockState.mode !== 'unlock') _lockClose(false);
});
// Clavier physique (desktop)
document.addEventListener('keydown', e => {
  if (!_lockState) return;
  if (/^[0-9]$/.test(e.key))      { e.preventDefault(); _lockKey(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); _lockKey('del'); }
  else if (e.key === 'Escape' && _lockState.mode !== 'unlock') { e.preventDefault(); _lockClose(false); }
}, true);

// ── Re-verrouillage au retour d'arrière-plan ──
document.addEventListener('visibilitychange', () => {
  if (!lockArmed()) return;
  if (document.hidden) { _lockHidTs = Date.now(); return; }
  if (_lockedNow || !_lockHidTs) return;
  if (Date.now() - _lockHidTs >= (S.lockDelay || 0) * 1000) lockApp();
});


// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('newcode-sheet', closeNewCode);
