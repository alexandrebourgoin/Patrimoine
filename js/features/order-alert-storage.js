// Stockage des ordres limites et des alertes de prix : une clé localStorage par mode (démo / réel), comme le DCA.
//   patrimoine-orders-alerts-demo | patrimoine-orders-alerts-real  →  { orders: [...], alerts: [...] }
// Module sans dépendance (le « localStorage » est injecté) : testable seul.
// Règle de sécurité : des données illisibles ou invalides font LEVER une erreur à la lecture ET à l'écriture.
// On ne remplace jamais silencieusement par une liste vide (ce serait perdre les ordres de l'utilisateur).
// Anciennes clés (avant la séparation démo / réel) : patrimoine-orders et patrimoine-alerts, jamais supprimées ;
// leur reprise dans un mode est explicite (importLegacy).

const STORE_ORDERS_ALERTS_PREFIX = 'patrimoine-orders-alerts-';
const STORE_ORDERS_LEGACY = 'patrimoine-orders';
const STORE_ALERTS_LEGACY = 'patrimoine-alerts';

const _oaPositive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
const _oaId = v => typeof v === 'string' && v !== '';
const _oaOptTime = v => v === undefined || (typeof v === 'number' && Number.isFinite(v));

// Un ordre : { id, accId, holdId, type:'BUY'|'SELL', qty>0, limit>0, createdAt?, updatedAt? }
function oaValidOrder(o) {
  return !!o && typeof o === 'object'
    && _oaId(o.id) && (_oaId(o.accId) || typeof o.accId === 'number') && (_oaId(o.holdId) || typeof o.holdId === 'number')
    && (o.type === 'BUY' || o.type === 'SELL') && _oaPositive(o.qty) && _oaPositive(o.limit)
    && _oaOptTime(o.createdAt) && _oaOptTime(o.updatedAt);
}
// Une alerte : { id, ticker, name?, dir:'above'|'below', price>0, createdAt? }
function oaValidAlert(a) {
  return !!a && typeof a === 'object'
    && _oaId(a.id) && _oaId(a.ticker) && (a.dir === 'above' || a.dir === 'below') && _oaPositive(a.price)
    && (a.name === undefined || typeof a.name === 'string') && _oaOptTime(a.createdAt);
}

function _oaCheckList(list, valid, label) {
  if (!Array.isArray(list)) throw new Error(`${label} : liste attendue`);
  const seen = new Set();
  list.forEach((x, i) => {
    if (!valid(x)) throw new Error(`${label} n°${i + 1} invalide`);
    if (seen.has(x.id)) throw new Error(`${label} : identifiant en double (${x.id})`);
    seen.add(x.id);
  });
  return list;
}
function _oaParse(raw, label) {
  try { return JSON.parse(raw); } catch (e) { throw new Error(`${label} : JSON invalide`); }
}

function createOrderAlertStore(storage, mode) {
  if (mode !== 'demo' && mode !== 'real') throw new Error('Mode inconnu : ' + mode);
  const key = STORE_ORDERS_ALERTS_PREFIX + mode;

  function read() {
    const raw = storage.getItem(key);
    if (raw === null || raw === undefined) return { orders: [], alerts: [] };
    const d = _oaParse(raw, 'Ordres et alertes');
    if (!d || typeof d !== 'object') throw new Error('Ordres et alertes : format inattendu');
    return {
      orders: _oaCheckList(d.orders, oaValidOrder, 'Ordre').map(o => ({ ...o })),
      alerts: _oaCheckList(d.alerts, oaValidAlert, 'Alerte').map(a => ({ ...a })),
    };
  }
  // Les deux listes sont toujours écrites ensemble : on relit d'abord (lève si corrompu) pour garder l'autre liste.
  function write(orders, alerts) {
    _oaCheckList(orders, oaValidOrder, 'Ordre');
    _oaCheckList(alerts, oaValidAlert, 'Alerte');
    storage.setItem(key, JSON.stringify({ orders, alerts }));
  }
  function saveOrders(orders) { write(orders, read().alerts); }
  function saveAlerts(alerts) { write(read().orders, alerts); }

  function readLegacy() {
    const part = (k, valid, label) => {
      const raw = storage.getItem(k);
      return raw === null || raw === undefined ? [] : _oaCheckList(_oaParse(raw, label), valid, label);
    };
    return { orders: part(STORE_ORDERS_LEGACY, oaValidOrder, 'Anciens ordres'), alerts: part(STORE_ALERTS_LEGACY, oaValidAlert, 'Anciennes alertes') };
  }
  // Copie les anciennes données dans CE mode. Refuse sans confirmation explicite et si le mode contient déjà des données.
  // Les anciennes clés ne sont jamais modifiées.
  function importLegacy({ confirmMode } = {}) {
    if (confirmMode !== true) throw new Error('Confirmation du mode requise');
    const cur = read();
    if (cur.orders.length || cur.alerts.length) throw new Error('Ce mode contient déjà des ordres ou des alertes');
    const l = readLegacy();
    write(l.orders, l.alerts);
    return { orders: l.orders.length, alerts: l.alerts.length };
  }
  function clear() { storage.removeItem(key); }

  return { key, read, saveOrders, saveAlerts, readLegacy, importLegacy, clear };
}
