/* Mon patrimoine – Service Worker
   Stratégie :
   - Fichiers de l'app (SHELL) → CACHE-FIRST dans le cache de CETTE version (patrimoine-vNN).
     Ce cache est rempli d'un bloc à l'installation, avec des requêtes `cache:'reload'` (jamais la copie du
     cache HTTP) : tous les fichiers d'une version viennent du même déploiement, rien n'est mélangé.
     Une nouvelle version n'apparaît que lorsque le nouveau service worker (sw.js, bumpé) s'installe.
   - Un fichier de l'app demandé avec un paramètre (?_=…) ou `cache: no-store | reload` (rechargement forcé,
     « Rechercher une mise à jour ») → réseau direct, le cache est contourné.
   - Google Fonts → cache-first (immuables). Autres origines (proxy cours, CoinGecko, FMP) → jamais interceptées.
   - Autres fichiers de même origine → network-first avec repli sur le cache.
*/

// ⚠️ Ce numéro EST le 3e chiffre de la version applicative : patrimoine-vNN ↔ 1.11.NN.
// Le bumper ici oblige à mettre APP_VERSION à jour dans mon-patrimoine.js (et inversement).
// L'écran Réglages → À propos affiche le cache réellement actif et signale un écart.
const CACHE = 'patrimoine-v115';
const SHELL = [
  './index.html',
  './mon-patrimoine.html',
  './mon-patrimoine.css',
  './mon-patrimoine.js',
  './utils.js',
  './js/core/dom-guard.js',
  './js/data/securities.js',
  './js/data/demo.js',
  './js/data/changelog.js',
  './js/core/screens.js',
  './js/core/modals.js',
  './js/core/storage.js',
  './js/core/themes.js',
  './js/core/ui.js',
  './js/core/navigation.js',
  './js/core/shell.js',
  './js/core/back-handler.js',
  './js/core/app-update.js',
  './js/services/prices.js',
  './js/services/csv-import.js',
  './js/features/lock.js',
  './js/features/dca-calc.js',
  './js/features/dca-isin.js',
  './js/features/dca.js',
  './js/features/order-alert-storage.js',
  './js/features/order-alert-rules.js',
  './js/features/transaction-check.js',
  './js/features/loan-calc.js',
  './js/features/loan-amort.js',
  './js/features/credits.js',
  './js/features/early-repay.js',
  './js/features/realestate-calc.js',
  './js/features/realestate-storage.js',
  './js/features/wealth.js',
  './js/features/account-perf.js',
  './js/features/tax-envelope.js',
  './js/features/savings.js',
  './js/features/home-watch.js',
  './js/features/benchmark.js',
  './js/features/cash-pockets.js',
  './js/features/account-rules.js',
  './js/features/assistant.js',
  './js/features/drag.js',
  './js/features/privacy.js',
  './js/features/charts.js',
  './js/features/chart-fullscreen.js',
  './js/features/backup.js',
  './js/modals/fx.js',
  './js/modals/changelog.js',
  './js/modals/confirm.js',
  './js/modals/watchlist.js',
  './js/modals/account.js',
  './js/modals/type-picker.js',
  './js/modals/position.js',
  './js/modals/order.js',
  './js/modals/cashflow.js',
  './js/modals/cash-adjust.js',
  './js/screens/home-links.js',
  './js/screens/dashboard.js',
  './js/screens/accounts.js',
  './js/screens/search.js',
  './js/screens/account.js',
  './js/screens/savings.js',
  './js/screens/stock.js',
  './js/screens/analysis.js',
  './js/screens/assistant.js',
  './js/screens/settings.js',
  './js/screens/watch.js',
  './js/screens/orders.js',
  './js/screens/stale.js',
  './js/screens/immo.js',
  './js/screens/credits.js',
  './js/screens/early-repay.js',
  './manifest.json',
  './icon.svg'
];

/* ── Install : précache atomique du SHELL (tout ou rien) ── */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await Promise.all(SHELL.map(async rel => {
        const url = new URL(rel, self.registration.scope).href;
        const resp = await fetch(new Request(url, { cache: 'reload' }));   // contourne le cache HTTP
        if (!resp.ok) throw new Error('Précache impossible : ' + rel + ' (' + resp.status + ')');
        await cache.put(url, resp);
      }));
    } catch (err) {
      await caches.delete(CACHE);   // pas de cache à moitié rempli : l'ancienne version reste en service
      throw err;
    }
    await self.skipWaiting();
  })());
});

/* ── Activate : supprime les caches des anciennes versions ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* Clé SHELL (« ./js/core/ui.js ») d'une requête, ou null si elle doit aller au réseau.
   Correspondance sur le CHEMIN exact sous le scope du SW (plus sur le seul nom de fichier :
   account.js existe dans js/screens/ et js/modals/). */
function shellKey(url, req) {
  const scopePath = new URL(self.registration.scope).pathname;          // '/' ou '/depot/'
  if (!url.pathname.startsWith(scopePath)) return null;
  if (req.cache === 'no-store' || req.cache === 'reload') return null;  // rechargement forcé
  if (url.search && req.mode !== 'navigate') return null;               // ?_=… : on veut le réseau
  const key = './' + (url.pathname.slice(scopePath.length) || 'index.html');
  return SHELL.includes(key) ? key : null;
}

/* ── Fetch ── */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Google Fonts – cache-first (fonts don't change) */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
    return;
  }

  /* Autres origines (proxy prix, CoinGecko, FMP…) – réseau direct, jamais de cache. */
  if (url.origin !== self.location.origin) return;

  /* Fichiers de l'app – cache-first dans le cache de la version */
  const key = shellKey(url, req);
  if (key) {
    e.respondWith(shellFirst(req, key));
    return;
  }

  /* Tout le reste – network-first */
  e.respondWith(networkFirst(req));
});

/* ── Strategies ── */

async function shellFirst(req, key) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(new URL(key, self.registration.scope).href);
  return hit || networkFirst(req);        // absent du cache (ne devrait pas arriver) : réseau, avec repli
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const resp = await fetch(req);
  if (resp.ok) {
    const c = await caches.open(CACHE);
    c.put(req, resp.clone());
  }
  return resp;
}

async function networkFirst(req) {
  try {
    const resp = await fetch(req);
    if (resp.ok) {
      const c = await caches.open(CACHE);
      c.put(req, resp.clone());
    }
    return resp;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}
