// ═══════════════════════════════════════════════
// MON PATRIMOINE — point d'entrée. Scripts classiques (pas d'ES modules), chargés dans l'ordre de mon-patrimoine.html :
//   utils.js (PU, fonctions pures) → js/core/dom-guard.js → js/data/*  (tables, démo, changelog)
//   → js/core/{screens,modals,storage,ui,navigation,shell}.js → js/services/* (cours, CSV)
//   → js/features/* (verrou, DCA, assistant, glisser-déposer, graphiques, confidentialité)
//   → js/modals/* → js/screens/* → CE FICHIER.
// Ici : état global S, version, wrappers de formatage/devises, initialisation, retour Android, mise à jour, SW.
// Chaque nouveau fichier de js/ doit être ajouté AU HTML (ordre = dépendances) ET à SHELL de sw.js.
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
const S = {
  screen: 'dashboard',
  stack: ['dashboard'],
  accountId: null,
  holdingId: null,
  theme: 'auto',
  currency: 'EUR',
  privacy: false,
  user: { name: '' },   // saisi dans Réglages > Profil (champ vide par défaut : « Votre nom »)
  accounts: [],
  sort: 'value',
  sortDir: -1,
  search: '',
  histPeriod: '1M',
  targets: { Action: 60, ETF: 25, Obligation: 10, Cash: 5 },
  _histCache: {},
  srchQuery: '',
  srchMode: 'titres',   // 'titres' | 'mouvements'
  watchlist: genDemoWatchlist(),
  lastPriceUpdate: null,
  isDemo: true,   // true = données démo (jamais sauvegardées)
  watchTicker: null,
  watchPeriod: '3M',
  watchSort: 'default',  // 'default' | 'perf_desc' | 'perf_asc'
  stockPeriod: 'MAX',   // '1M' | '3M' | '6M' | '1A' | 'MAX'
  debug: false,
  autoRefresh: false, // auto-refresh au démarrage (désactivé par défaut)
  accountsView: 'list', // 'list' | 'grid' — affichage de l'écran Comptes
  assistantEnabled: true, // affiche le menu Assistant IA (recos locales)
  navItems: ['dashboard','comptes','recherche','analysis'], // raccourcis de la barre du bas (3 à 5)
  bgPrivacy: true,    // masque l'écran quand l'appli passe en arrière-plan
  bgIdle: 0,          // s d'inactivité avant masquage (0 = jamais)
  priceApiKey: '',    // clé Twelve Data (US stocks)
  fmpApiKey:   '',    // clé Financial Modeling Prep (actions EU + US)
  // ── Sécurité (verrouillage d'accès) ──
  lockEnabled: false, // verrou par code activé
  lockHash:   '',     // dérivé PBKDF2 du code (le code lui-même n'est jamais stocké)
  lockSalt:   '',     // sel aléatoire du dérivé
  lockBio:    false,  // déverrouillage biométrique activé
  lockBioId:  '',     // id du credential WebAuthn (base64url)
  lockDelay:  60,     // secondes en arrière-plan avant re-verrouillage (0 = immédiat)
  lockFails:  0,      // essais ratés consécutifs
  lockUntil:  0,      // fin du blocage anti-force brute (timestamp ms)
  dca: { plans: [], goals: [] }, // DCA & objectifs (chargé par loadDca, voir js/features/dca.js)
  _debugLog: [],      // non persisté
  _tdOffset:  0,      // rotation Twelve Data (non persisté)
};


// Le 3e chiffre EST la version du cache du service worker : 1.10.NN ↔ patrimoine-vNN.
// Toute modif de fichier impose de bumper les deux (sw.js + ici) — un écart est signalé
// dans Réglages → À propos, qui affiche le cache réellement servi.
const APP_VERSION = '1.11.119';
const CACHE_NAME  = 'patrimoine-v' + APP_VERSION.split('.')[2];


// ═══════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════
function fmtCur(v) {
  return PU.fmtCur(v, S.currency);
}
function fmtPct(v) { return PU.fmtPct(v); }
function pctClass(v) { return PU.pctClass(v); }
function fmtDate(s) { return PU.fmtDate(s); }
function initials(n) { return PU.initials(n); }
// Observer accounts excluded from total wealth
// Comptes financiers, MA PART (accShare : compte joint) ; base de l'historique à partir de la saisie d'une quote-part
function totalWealth() { return S.accounts.filter(a=>!a.observer).reduce((s,a)=>s+a.value*accShare(a),0); }

// Approximate FX rates for P/L produit display only
const FX_RATES = { EUR:1, USD:1.08, GBP:1.16, CHF:1.05, JPY:163 };

function fmtNative(v, cur) { return PU.fmtNative(v, cur); }

// Convert amount from native currency to app currency using FX_RATES
// FX_RATES[X] = "units of X per EUR", so to convert X→EUR: amount / FX_RATES[X]
function toRefCcy(amount, fromCcy) { return PU.toRefCcy(amount, fromCcy, FX_RATES, S.currency); }
// Sum holdings values converted to app currency
function accSum(holdings) { return PU.accSum(holdings); }
// Liquidités non investies du compte (devise appli) — apports nets − achats nets.
// `upTo` borne le calcul à une date passée (reconstruction de l'historique).
function accCash(acc, upTo) { return PU.accCash(acc, FX_RATES, S.currency, upTo); }
// Solde du compte = valeur des titres + liquidités. À utiliser partout où `acc.value` est (re)calculé.
function accTotal(acc) { return PU.accTotal(acc, FX_RATES, S.currency); }

function computeRealizedPnL(h) { return PU.computeRealizedPnL(h); }

function recalcHolding(h) { return PU.recalcHolding(h, FX_RATES, S.currency); }

function masked(v) { return S.privacy?'<span class="prv">● ● ●</span>':fmtCur(v); }
function maskedNative(v,cur) { return S.privacy?'<span class="prv">● ● ●</span>':fmtNative(v,cur); }
// Échappement innerHTML — implémentation dans utils.js
function esc(s) { return PU.esc(s); }

// ═══════════════════════════════════════════════
// INIT — charge les données puis dessine l'appli (les modules ci-dessus sont déjà évalués)
// ═══════════════════════════════════════════════
const _hasData=loadData();
loadDca();
_bgPrivacySync();   // le pré-script a lu localStorage ; on repart de l'état chargé
_idleReset();       // arme le masquage par inactivité (no-op si S.bgIdle=0)
// Si aucune donnée ou en mode démo → régénérer les données d'exemple (jamais persistées)
if(!_hasData || S.isDemo) S.accounts=genDemo();
// Première ouverture : sauvegarder les préférences par défaut
if(!_hasData) saveData();
// Appliquer thème sauvegardé (auto suit le système)
applyTheme(S.theme);
// Appliquer le cache de prix uniquement en mode réel
const _priceCache=loadPrices();
if(_priceCache?.fxRates) {
  Object.assign(FX_RATES, _priceCache.fxRates);
  _fxUpdatedAt = _priceCache.fxUpdatedAt || null;
}
if(_priceCache && !S.isDemo) applyPrices(_priceCache);
// Recalculer les soldes : le `acc.value` stocké peut dater d'avant la prise en compte des liquidités
S.accounts.forEach(a => { a.value = accTotal(a); });
// Historique du patrimoine : reconstruire le passé manquant puis figer le point du jour (mode réel)
if(!S.isDemo) { backfillWealthHistory(); snapshotWealth(); }
['dashboard','comptes','recherche','analysis'].forEach(renderScreen);
renderNav();
document.getElementById('nav').classList.remove('hidden');
// Sécurité : sonder le capteur biométrique, puis armer le verrou s'il est configuré
bioAvailable().then(v => {
  _bioOk = v;
  if (_lockState) {                    // overlay déjà affiché → révéler le bouton empreinte
    _lockPaint('');
    if (_lockState.mode === 'unlock' && S.lockBio && S.lockBioId) _lockBio();
  }
});
if (lockArmed()) lockApp();
else document.documentElement.classList.remove('locked');
// Suivre les changements du thème système (uniquement en mode auto)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{
  if(S.theme==='auto') applyTheme('auto');
});
// Auto-refresh au démarrage (uniquement si activé dans les réglages)
if (S.autoRefresh && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const _stale = !S.lastPriceUpdate || (Date.now() - S.lastPriceUpdate > 15 * 60 * 1000);
  if (_stale) setTimeout(fetchLivePrices, 800);
}
// Popup changelog si nouvelle version
try {
  if (localStorage.getItem(STORE_VERSION) !== APP_VERSION) {
    // La version suit le cache : un simple bump technique n'a pas forcément de notes.
    // Sans entrée, on enregistre la version sans afficher une fenêtre vide.
    if (!(CHANGELOG[APP_VERSION] || []).length) {
      localStorage.setItem(STORE_VERSION, APP_VERSION);
    } else {
      const _showCl = () => openChangelogModal(true);
      if (isLocked()) _lockPending = _showCl;   // différé jusqu'au déverrouillage
      else setTimeout(_showCl, 600);
    }
  }
} catch(e) {}

// Rappel de sauvegarde si la dernière date de plus de 10 jours (js/features/backup.js) : attend le déverrouillage
// et la fermeture de la fenêtre Nouveautés.
setTimeout(maybeRemindBackup, 1500);

// Retour Android + Échap : js/core/back-handler.js. Mise à jour + enregistrement du service worker : js/core/app-update.js.
