// Sauvegarde complète des données : export, restauration, date de la dernière sauvegarde et rappel.
//
// Principe « toujours à jour » : la sauvegarde contient TOUTES les clés localStorage « patrimoine-* », sauf la liste
// d'exclusion ci-dessous (caches recalculables et données techniques). Un nouveau module qui range ses données sous
// ce préfixe est donc sauvegardé et restauré sans rien changer ici. tests/features/backup.test.js vérifie que chaque
// clé « patrimoine-… » du code est soit sauvegardée, soit exclue ici avec une raison.
//
// Réglages : les secrets et les réglages propres à l'appareil (clés d'API, code de verrouillage) ne sortent jamais
// dans le fichier ; à la restauration, ceux de l'appareil sont conservés.
// Fonctions pures sur un objet « storage » (localStorage ou faux stockage des tests). L'interface est en bas du fichier.

const BACKUP_APP = 'mon-patrimoine';
const BACKUP_FORMAT = 2;
const BACKUP_PREFIX = 'patrimoine-';
const BACKUP_META_KEY = 'patrimoine-backup-meta';        // { lastBackupAt } : jamais exporté
const BACKUP_REMIND_DAYS = 10;
const BACKUP_EXCLUDE = {
  'patrimoine-prices':  'cache des cours, rechargé en ligne',
  'patrimoine-history': 'cache des historiques de cours, rechargé en ligne',
  'patrimoine-bglog':   'journal de débogage',
  'patrimoine-version': 'dernière version vue (fenêtre Nouveautés)',
  [BACKUP_META_KEY]:    'date de la dernière sauvegarde de CET appareil',
};
const SETTINGS_PRIVATE_FIELDS = ['priceApiKey', 'fmpApiKey', 'lockEnabled', 'lockHash', 'lockSalt', 'lockBio', 'lockBioId', 'lockDelay', 'lockFails', 'lockUntil'];
const _BK_SETTINGS = 'patrimoine-settings';

function _bkKeys(storage) {
  const out = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(BACKUP_PREFIX) && !(k in BACKUP_EXCLUDE)) out.push(k);
  }
  return out.sort();
}
function _bkJson(raw) { try { return JSON.parse(raw); } catch (e) { return null; } }

// Réglages sans les champs privés. Illisibles : non exportés (null).
function _bkPublicSettings(raw) {
  const s = _bkJson(raw);
  if (!s || typeof s !== 'object') return null;
  SETTINGS_PRIVATE_FIELDS.forEach(f => { delete s[f]; });
  return JSON.stringify(s);
}

function buildBackup(storage, now = Date.now(), appVersion = '') {
  const data = {};
  _bkKeys(storage).forEach(k => {
    const raw = storage.getItem(k);
    if (raw === null) return;
    if (k === _BK_SETTINGS) { const pub = _bkPublicSettings(raw); if (pub !== null) data[k] = pub; return; }
    data[k] = raw;                                   // contenu brut : rien n'est réinterprété ni perdu
  });
  return { app: BACKUP_APP, format: BACKUP_FORMAT, appVersion, exportedAt: new Date(now).toISOString(), data };
}

// Lit le texte d'un fichier de sauvegarde ; lève une Error au message lisible s'il n'est pas utilisable.
function parseBackup(text) {
  const b = _bkJson(text);
  if (!b || typeof b !== 'object') throw new Error('Fichier illisible : ce n\'est pas une sauvegarde JSON');
  if (b.app !== BACKUP_APP || typeof b.data !== 'object' || b.data === null) {
    if (Array.isArray(b.accounts)) throw new Error('Ancien format d\'export (avant la version 1.11.114) : restauration non prise en charge');
    throw new Error('Ce fichier n\'est pas une sauvegarde de Mon patrimoine');
  }
  if (b.format > BACKUP_FORMAT) throw new Error('Sauvegarde faite par une version plus récente de l\'application : mettez-la à jour');
  const keys = Object.keys(b.data);
  if (!keys.length) throw new Error('Sauvegarde vide');
  for (const k of keys) {
    if (!k.startsWith(BACKUP_PREFIX) || typeof b.data[k] !== 'string') throw new Error('Sauvegarde corrompue (' + k + ')');
  }
  return b;
}

// Remplace les données de l'appareil par celles de la sauvegarde. Les clés exclues (caches…) et les réglages privés
// de l'appareil sont conservés. Renvoie le nombre de clés restaurées.
function restoreBackup(storage, backup) {
  const current = _bkJson(storage.getItem(_BK_SETTINGS)) || {};
  _bkKeys(storage).forEach(k => storage.removeItem(k));
  Object.entries(backup.data).forEach(([k, raw]) => {
    if (k in BACKUP_EXCLUDE) return;
    if (k === _BK_SETTINGS) {
      const s = _bkJson(raw) || {};
      SETTINGS_PRIVATE_FIELDS.forEach(f => { if (f in current) s[f] = current[f]; else delete s[f]; });
      storage.setItem(k, JSON.stringify(s));
      return;
    }
    storage.setItem(k, raw);
  });
  return Object.keys(backup.data).length;
}

function lastBackupAt(storage) {
  const t = (_bkJson(storage.getItem(BACKUP_META_KEY)) || {}).lastBackupAt;
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? t : null;
}
function markBackup(storage, now = Date.now()) {
  try { storage.setItem(BACKUP_META_KEY, JSON.stringify({ lastBackupAt: now })); } catch (e) {}
}
// Rappel : jamais sauvegardé, ou dernière sauvegarde de plus de 10 jours (une date future compte comme inconnue).
function backupDue(storage, now = Date.now()) {
  const t = lastBackupAt(storage);
  return t === null || t > now || now - t > BACKUP_REMIND_DAYS * 86400000;
}
function backupAgeLabel(storage, now = Date.now()) {
  const t = lastBackupAt(storage);
  if (t === null || t > now) return 'Jamais sauvegardé sur cet appareil';
  const d = Math.floor((now - t) / 86400000);
  return 'Dernière sauvegarde : ' + (d === 0 ? 'aujourd\'hui' : d === 1 ? 'hier' : 'il y a ' + d + ' jours');
}

// ═══════════════════════════════════════════════
// INTERFACE (dépend, à l'appel seulement, de S, toast, APP_VERSION, openConfirm, registerModal, renderScreen)
// ═══════════════════════════════════════════════

// Destinations proposées pour le fichier de sauvegarde, selon ce que permet l'appareil (env : window / navigator,
// injectable pour les tests). Une fenêtre les liste ; chaque choix est un toucher (les navigateurs l'exigent).
//  - share  : menu de partage du téléphone (OneDrive, Gmail, Drive, Fichiers…). Chrome n'accepte de partager que
//             certains types de fichiers (pas .json) : le fichier part en .txt (même contenu, restaurable tel quel).
//  - folder : « Enregistrer sous » (Chrome / Edge sur ordinateur) : n'importe quel dossier, OneDrive synchronisé compris ;
//             le navigateur rouvre le dernier dossier choisi.
//  - download : téléchargement dans le dossier Téléchargements de l'appareil (toujours possible).
const BACKUP_TARGETS = {
  share:    { label: 'Envoyer ou partager', sub: 'OneDrive, Gmail, Drive, Fichiers…' },
  folder:   { label: 'Choisir un dossier', sub: 'OneDrive ou tout dossier de l\'ordinateur' },
  download: { label: 'Télécharger', sub: 'Dossier Téléchargements de l\'appareil' },
};
function backupFileName(now, ext = 'json') { return `patrimoine-sauvegarde-${new Date(now).toLocaleDateString('sv-SE')}.${ext}`; }
function backupTargets(env = { window: typeof window !== 'undefined' ? window : {}, navigator: typeof navigator !== 'undefined' ? navigator : {} }) {
  const out = [];
  try {
    const probe = typeof File === 'function' ? new File(['{}'], 'test.txt', { type: 'text/plain' }) : null;
    if (probe && typeof env.navigator.share === 'function' && env.navigator.canShare?.({ files: [probe] })) out.push('share');
  } catch (e) {}
  if (typeof env.window.showSaveFilePicker === 'function') out.push('folder');
  out.push('download');
  return out;
}

// Enregistre le fichier vers la destination choisie. Renvoie true si c'est fait, false si l'utilisateur a annulé.
async function saveBackupFile(json, now, target) {
  if (target === 'share') {
    const file = new File([json], backupFileName(now, 'txt'), { type: 'text/plain' });
    try { await navigator.share({ files: [file], title: 'Sauvegarde Mon patrimoine' }); return true; }
    catch (e) { if (e?.name === 'AbortError') return false; throw e; }
  }
  const blob = new Blob([json], { type: 'application/json' });
  if (target === 'folder') {
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: backupFileName(now), id: 'patrimoine-sauvegarde',
        types: [{ description: 'Sauvegarde Mon patrimoine', accept: { 'application/json': ['.json'] } }],
      });
      const w = await h.createWritable();
      await w.write(blob); await w.close();
      return true;
    } catch (e) { if (e?.name === 'AbortError') return false; throw e; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = backupFileName(now);
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

// Fenêtre « Sauvegarder mes données » : une ligne par destination possible sur cet appareil.
function backupSheetHTML(targets) {
  return targets.map(t => `<button type="button" class="bk-target" data-target="${t}">
    <span class="bk-name">${BACKUP_TARGETS[t].label}</span><span class="bk-sub">${BACKUP_TARGETS[t].sub}</span></button>`).join('');
}
function runBackup() {
  document.getElementById('bk-list').innerHTML = backupSheetHTML(backupTargets());
  document.getElementById('bk-age').textContent = backupAgeLabel(localStorage);
  document.getElementById('bk-bg').classList.add('show');
  document.getElementById('bk-sheet').classList.add('show');
}
function closeBackupSheet() {
  document.getElementById('bk-bg').classList.remove('show');
  document.getElementById('bk-sheet').classList.remove('show');
}
async function backupTo(target) {
  const now = Date.now();
  const json = JSON.stringify(buildBackup(localStorage, now, APP_VERSION), null, 2);
  let ok;
  try { ok = await saveBackupFile(json, now, target); }
  catch (e) { toast('Enregistrement impossible : ' + (e?.message || e) + '. Essayez « Télécharger ».'); return false; }
  if (!ok) { toast('Sauvegarde annulée'); return false; }
  closeBackupSheet();
  markBackup(localStorage, Date.now());
  toast(target === 'share' ? 'Sauvegarde envoyée ✓' : 'Sauvegarde enregistrée ✓');
  if (S.screen === 'settings') renderScreen('settings');
  return true;
}

// Restauration depuis un fichier choisi par l'utilisateur (input #backup-file de mon-patrimoine.html).
function restoreBackupFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let b;
    try { b = parseBackup(String(reader.result)); }
    catch (e) { toast(e.message); return; }
    const when = b.exportedAt ? new Date(b.exportedAt).toLocaleDateString('fr-FR') : 'date inconnue';
    openConfirm(`Remplacer toutes les données de cet appareil par la sauvegarde du ${when} ? Faites d'abord une sauvegarde si vous voulez garder les données actuelles.`, () => {
      try { restoreBackup(localStorage, b); }
      catch (e) { toast('Restauration impossible : ' + (e?.message || e)); return; }
      toast('Sauvegarde restaurée ✓ — rechargement…');
      setTimeout(() => location.reload(), 700);
    }, 'Restaurer');
  };
  reader.onerror = () => toast('Fichier illisible');
  reader.readAsText(file);
}

// Menu ☰ : date de la dernière sauvegarde, toujours visible (en rouge au-delà de 10 jours) ; un toucher sauvegarde.
function drawerBackupRow() {
  const due = !S.isDemo && backupDue(localStorage);
  return `<div class="dr-row" id="js-drawer-backup"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
    <span class="dr-lbl">Sauvegarder mes données<span class="dr-sub${due ? ' due' : ''}">${backupAgeLabel(localStorage)}</span></span></div>`;
}

// Rappel à l'ouverture (mode réel uniquement) : proposé tant que la dernière sauvegarde a plus de 10 jours.
function openBackupReminder() {
  const t = lastBackupAt(localStorage);
  document.getElementById('backup-remind-msg').textContent = t === null
    ? 'Vous n\'avez encore jamais sauvegardé vos données sur cet appareil. Enregistrez une copie (OneDrive, Drive, Fichiers…) pour ne rien perdre.'
    : `Votre dernière sauvegarde date de ${Math.floor((Date.now() - t) / 86400000)} jours. Enregistrez une nouvelle copie pour ne rien perdre.`;
  document.getElementById('backup-remind-bg').classList.add('show');
  document.getElementById('backup-remind-sheet').classList.add('show');
}
function closeBackupReminder() {
  document.getElementById('backup-remind-bg').classList.remove('show');
  document.getElementById('backup-remind-sheet').classList.remove('show');
}
function maybeRemindBackup(tries = 0) {
  if (S.isDemo || !backupDue(localStorage)) return;
  const busy = document.documentElement.classList.contains('locked') || document.querySelector('.show[id$="-sheet"], #drawer.show');
  if (busy) { if (tries < 40) setTimeout(() => maybeRemindBackup(tries + 1), 1500); return; }   // après la fenêtre en cours
  openBackupReminder();
}
document.getElementById('backup-remind-later')?.addEventListener('click', closeBackupReminder);
document.getElementById('backup-remind-bg')?.addEventListener('click', closeBackupReminder);
document.getElementById('backup-remind-ok')?.addEventListener('click', () => { closeBackupReminder(); runBackup(); });
document.getElementById('bk-list')?.addEventListener('click', e => { const b = e.target.closest('[data-target]'); if (b) backupTo(b.dataset.target); });
document.getElementById('bk-bg')?.addEventListener('click', closeBackupSheet);
document.getElementById('bk-close')?.addEventListener('click', closeBackupSheet);
document.getElementById('backup-file')?.addEventListener('change', e => { restoreBackupFromFile(e.target.files?.[0]); e.target.value = ''; });
registerModal('backup-remind-sheet', closeBackupReminder);
registerModal('bk-sheet', closeBackupSheet);
