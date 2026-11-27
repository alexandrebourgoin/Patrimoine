// Comptes liés à un service (API) : registre des services, clés sur l'appareil, appels par le proxy des cours, synchro.
// Un service s'inscrit dans LINKED_SERVICES (ex. js/services/etoro.js). Écran et fenêtres : js/screens/linked.js.
// Appels : proxy des cours (PROXY_URL, proxy-worker.js), route ?api=<service>&call=<appel>, seuls les appels déclarés
// dans le proxy passent. Synchro : par le rafraîchissement des cours (fetchLivePrices, js/services/prices.js).
// Les clés ne sont JAMAIS dans les données de l'app : stockage à part (LINKED_KEYS_STORE), hors du préfixe « patrimoine- »,
// donc jamais sauvegardées, exportées ni restaurées. Elles ne quittent l'appareil que vers le proxy, qui les transmet sans les garder.
// Dépend, À L'APPEL seulement, de S, PROXY_URL.

const LINKED_KEYS_STORE = 'mp-api-keys';     // { [accountId]: { …clés du service } } — volontairement hors « patrimoine-* »
const LINKED_SYNC_EVERY_MS = 3600 * 1000;    // au démarrage : synchro si la dernière date de plus d'1 h
// Services disponibles. Chaque entrée :
//   label, sub (ligne d'aide), bank (établissement proposé), currency (devise du compte, imposée),
//   keyLabel, keyPlaceholder, help (HTML : où trouver la clé),
//   keysFrom(saisie) → objet de clés rangé sur l'appareil, keysReady(clés) → bool,
//   sync(acc, { keys, quiet }) → true si réussi (sinon acc.sync.error renseigné), errorText(status) (optionnel)
const LINKED_SERVICES = {};
// Affichés « bientôt » dans le choix du service, sans action
const LINKED_SOON = [{ label: 'Adresse crypto', sub: 'Bitcoin, Ethereum…' }];

function linkedService(acc) { return (acc && acc.sync && LINKED_SERVICES[acc.sync.provider]) || null; }

// ── Clés (sur l'appareil uniquement) ──
function linkedKeysAll(storage = localStorage) {
  try { const o = JSON.parse(storage.getItem(LINKED_KEYS_STORE) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}
function linkedKeys(accId, storage = localStorage) { return linkedKeysAll(storage)[accId] || null; }
function linkedKeysSave(accId, keys, storage = localStorage) {
  const all = linkedKeysAll(storage), clean = {};
  Object.entries(keys || {}).forEach(([k, v]) => { clean[k] = String(v || '').trim(); });
  all[accId] = clean;
  storage.setItem(LINKED_KEYS_STORE, JSON.stringify(all));   // hors sauvegarde : clés d'API (secrets), jamais exportées
}
function linkedKeysDelete(accId, storage = localStorage) {
  const all = linkedKeysAll(storage); delete all[accId];
  storage.setItem(LINKED_KEYS_STORE, JSON.stringify(all));   // hors sauvegarde : clés d'API (secrets), jamais exportées
}
// Clé affichée masquée : 4 premiers et 4 derniers caractères
function linkedMask(k) { k = String(k || ''); return k.length > 10 ? k.slice(0, 4) + '…' + k.slice(-4) : (k ? '••••' : ''); }

// ── Réseau ──
// Message clair pour chaque échec (affiché sur le compte et dans « À surveiller »)
function linkedErrorText(id, status, retryAfter) {
  const s = LINKED_SERVICES[id] || {}, name = s.label || id;
  const own = s.errorText && s.errorText(status);
  if (own) return own;
  if (status === 401) return `Clé refusée par ${name} : vérifie la clé`;
  if (status === 403) return `Accès refusé par ${name} : la clé doit avoir le droit de lecture`;
  if (status === 429) return `Trop de requêtes vers ${name} : réessaie dans ${retryAfter || 60} s`;
  // 0 : réseau coupé, ou proxy des cours pas encore redéployé avec ce service (le pré-vol CORS des clés échoue)
  if (status === 0) return `${name} injoignable : vérifie ta connexion, ou le proxy des cours n'a pas encore ce service`;
  if (status === 400 || status === 404) return `Le proxy des cours ne connaît pas encore ${name} (à redéployer)`;
  return `Erreur ${name} (${status})`;
}
// GET <PROXY_URL>?api=<id>&call=<appel>[&params] avec les en-têtes du service
async function linkedGet(id, call, params, headers) {
  let r;
  try {
    r = await fetch(`${PROXY_URL}?api=${encodeURIComponent(id)}&call=${encodeURIComponent(call)}${params ? '&' + params : ''}`, { headers });
  } catch (e) { const err = new Error(linkedErrorText(id, 0)); err.status = 0; throw err; }
  if (!r.ok) { const err = new Error(linkedErrorText(id, r.status, r.headers.get('Retry-After'))); err.status = r.status; throw err; }
  return r.json();
}

// ── Synchro ──
// Comptes liés à synchroniser au démarrage (dernière synchro de plus d'1 h, ou jamais)
function linkedDue(accounts, now = Date.now()) {
  return (accounts || []).filter(a => linkedService(a) && (!a.sync.lastSync || now - a.sync.lastSync > LINKED_SYNC_EVERY_MS));
}
// Appelé par fetchLivePrices() : synchronise tous les comptes liés → { synced, failed } (nombre de comptes)
async function linkedSyncAll() {
  const out = { synced: 0, failed: 0 };
  if (S.isDemo) return out;
  for (const acc of S.accounts.filter(linkedService)) {
    if (await linkedService(acc).sync(acc, { quiet: true })) out.synced++; else out.failed++;
  }
  return out;
}
