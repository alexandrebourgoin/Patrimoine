// Stockage des ordres et alertes, sans accès au DOM ni dépendance à S.
// Le mode est explicite. Une seule clé par mode permet un remplacement cohérent.
// À intégrer au HTML et au SHELL du service worker lors du branchement de la fonctionnalité.
function createOrderAlertStore(storage, mode) {
  if (mode !== 'demo' && mode !== 'real') throw new TypeError('Mode de stockage invalide');
  const key = 'patrimoine-orders-alerts-' + mode;

  function validateList(items, kind) {
    if (!Array.isArray(items)) throw new TypeError('Liste ' + kind + ' invalide');
    const ids = new Set();
    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id)) {
        throw new TypeError('Identifiant ' + kind + ' invalide ou dupliqué');
      }
      ids.add(item.id);
      if (kind === 'orders') {
        const validId = value => (typeof value === 'string' && value.length > 0) || (typeof value === 'number' && Number.isFinite(value));
        if (!validId(item.accId) || !validId(item.holdId) || !['BUY', 'SELL'].includes(item.type) || !Number.isFinite(item.qty) || item.qty <= 0 || !Number.isFinite(item.limit) || item.limit <= 0) {
          throw new TypeError('Ordre invalide');
        }
      } else if (typeof item.ticker !== 'string' || !item.ticker.trim() || !['above', 'below'].includes(item.dir) || !Number.isFinite(item.price) || item.price <= 0) {
        throw new TypeError('Alerte invalide');
      }
    }
  }

  function validate(data) {
    if (!data || data.version !== 1 || data.mode !== mode) throw new TypeError('Version ou mode de sauvegarde incompatible');
    validateList(data.orders, 'orders');
    validateList(data.alerts, 'alerts');
    return data;
  }

  function read() {
    const raw = storage.getItem(key);
    if (raw === null) return { version: 1, mode, orders: [], alerts: [] };
    // Une erreur remonte à l’appelant : aucune réinitialisation ni écriture silencieuse.
    return validate(JSON.parse(raw));
  }

  function write(data) {
    validate(data);
    const raw = JSON.stringify(data);
    // Vérifie également la représentation persistée avant toute écriture.
    validate(JSON.parse(raw));
    storage.setItem(key, raw);
  }

  function saveOrders(orders) {
    const current = read();
    write({ ...current, orders });
  }

  function saveAlerts(alerts) {
    const current = read();
    write({ ...current, alerts });
  }

  function exportData() {
    return JSON.parse(JSON.stringify(read()));
  }

  function importData(data) {
    // L’import complet est validé avant le remplacement du seul mode sélectionné.
    write(data);
  }

  function readLegacy() {
    // Anciennes clés ambiguës : lecture seule, jamais attribution automatique à un mode.
    const orders = JSON.parse(storage.getItem('patrimoine-orders') || '[]');
    const alerts = JSON.parse(storage.getItem('patrimoine-alerts') || '[]');
    validateList(orders, 'orders');
    validateList(alerts, 'alerts');
    return { orders, alerts };
  }

  return { read, saveOrders, saveAlerts, exportData, importData, readLegacy };
}
