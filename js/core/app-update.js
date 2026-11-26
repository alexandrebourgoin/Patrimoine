// Mise à jour de l application : « Rechercher une mise à jour » (forceAppUpdate) + enregistrement du service worker.
// Le service worker sert les fichiers de l app depuis le cache de SA version (cache-first, voir sw.js) : une nouvelle
// version n apparaît que quand le nouveau service worker s installe. Il précharge TOUS les fichiers en contournant le
// cache HTTP, puis prend la main (skipWaiting + clients.claim).
//
// Deux causes de « mise à jour qui ne recharge pas correctement », corrigées ici :
//  1. La page ouverte continuait d exécuter l ancien code après l installation du nouveau SW : rien n écoutait
//     controllerchange. → on recharge une fois quand le nouveau SW prend la main (différé si une fenêtre est ouverte).
//  2. « Rechercher une mise à jour » désinscrivait le SW et vidait ses caches avant de recharger : la page se
//     rechargeait alors depuis le cache HTTP du navigateur (GitHub Pages : jusqu à 10 min), d où un mélange de
//     fichiers anciens et nouveaux. → on demande au SW de se mettre à jour (reg.update), il précharge la nouvelle
//     version d un bloc, et on recharge quand il prend la main.
// Le navigateur ne revérifie sw.js qu à la navigation : on le relance aussi au retour sur l app (PWA restée ouverte).
// localStorage (comptes, réglages, DCA, immobilier…) n est jamais touché.

let _updating = false;
let _swReg = null;
let _reloadPending = false;
// Au premier lancement il n y a pas encore de SW : sa prise de contrôle ne doit pas recharger la page.
const _swHadController = typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;

// Une fenêtre de saisie ouverte (modale, tiroir) : on ne recharge pas sous les doigts de l utilisateur.
function _appBusy() {
  return !!document.querySelector('.add-modal.show, [id$="-sheet"].show, .drawer.show, #drawer.show');
}
function _reloadForNewVersion() {
  if (_reloadPending === 'done') return;
  if (_appBusy() && !_updating) { _reloadPending = true; return; }   // rechargé au prochain passage en arrière-plan
  _reloadPending = 'done';
  location.reload();
}

async function forceAppUpdate() {
  if (_updating) return;
  _updating = true;
  toast('Recherche de mise à jour…');
  let remote = null;
  try {
    const r = await fetch('./mon-patrimoine.js?_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    remote = ((await r.text()).match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || null;
  } catch (e) {
    // Hors ligne : on ne touche surtout pas au cache, il sert au fonctionnement sans réseau
    toast('Hors ligne : impossible de vérifier la mise à jour');
    _updating = false;
    return;
  }
  // Même version que celle en ligne : rien à faire, on ne recharge pas pour rien
  if (remote === APP_VERSION) {
    toast(`Déjà à jour (version ${APP_VERSION}) ✓`);
    _updating = false;
    return;
  }
  toast(remote ? `Mise à jour ${APP_VERSION} → ${remote}…` : 'Version en ligne illisible — rechargement…');
  const reg = _swReg || await navigator.serviceWorker?.getRegistration?.().catch(() => null);
  if (!reg) { setTimeout(() => location.reload(), 700); return; }   // pas de SW : simple rechargement
  try {
    await reg.update();                       // installe le nouveau SW ; controllerchange recharge la page
  } catch (e) {
    toast('Mise à jour impossible pour le moment, réessayez');
    _updating = false;
    return;
  }
  // SW déjà à jour (navigateur en avance sur la page) ou installation lente : rechargement de secours
  setTimeout(() => { if (_reloadPending !== 'done') _reloadForNewVersion(); }, 8000);
}

// ═══════════════════════════════════════════════
// SERVICE WORKER (PWA)
// ═══════════════════════════════════════════════
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swHadController || _updating) _reloadForNewVersion();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => { _swReg = reg; console.log('[SW] Registered, scope:', reg.scope); })
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
  document.addEventListener('visibilitychange', () => {
    if (_reloadPending === true && !_appBusy()) { _reloadPending = 'done'; location.reload(); return; }
    if (!document.hidden) _swReg?.update?.().catch(() => {});   // PWA restée ouverte : y a-t-il une nouvelle version ?
  });
}
