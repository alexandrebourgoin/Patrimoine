// Mise à jour de l application : « Rechercher une mise à jour » (forceAppUpdate) + enregistrement du service worker.
// Le service worker sert les fichiers de l app depuis le cache de SA version (cache-first, voir sw.js) : une nouvelle
// version n apparaît donc quand le nouveau service worker s installe. forceAppUpdate vérifie la version en ligne en
// contournant tous les caches (requête avec paramètre + no-store, que le SW laisse passer au réseau), compare à
// APP_VERSION (mon-patrimoine.js) et, si elle diffère, désinscrit le SW, vide ses caches et recharge.
// localStorage (comptes, réglages, DCA) n est pas touché.

let _updating = false;
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
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map(r => r.unregister()));
    for (const k of await caches.keys()) await caches.delete(k);
  } catch (e) {}
  toast(remote ? `Mise à jour ${APP_VERSION} → ${remote}…` : 'Version en ligne illisible — rechargement…');
  setTimeout(() => location.reload(), 700);
}

// ═══════════════════════════════════════════════
// SERVICE WORKER (PWA)
// ═══════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[SW] Registered, scope:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}
