// Stockage des biens immobiliers : une clé localStorage par mode (démo / réel), comme le DCA et les ordres.
//   patrimoine-immo-demo | patrimoine-immo-real  →  [ bien, … ]
// Module sans autre dépendance que immoValid (realestate-calc.js, chargé avant) : le « localStorage » est injecté.
// Mêmes garanties que le stockage des ordres : des données illisibles ou invalides font LEVER une erreur à la lecture et à l'écriture,
// jamais remplacées par une liste vide. L'ancienne clé unique patrimoine-immo n'est jamais supprimée ; sa reprise est explicite.

const STORE_IMMO_PREFIX = 'patrimoine-immo-';
const STORE_IMMO_LEGACY = 'patrimoine-immo';

function _imCheckList(list, label) {
  if (!Array.isArray(list)) throw new Error(`${label} : liste attendue`);
  const seen = new Set();
  list.forEach((p, i) => {
    if (!immoValid(p)) throw new Error(`${label} n°${i + 1} invalide`);
    if (seen.has(p.id)) throw new Error(`${label} : identifiant en double (${p.id})`);
    seen.add(p.id);
  });
  return list;
}
function _imParse(raw, label) {
  try { return JSON.parse(raw); } catch (e) { throw new Error(`${label} : JSON invalide`); }
}

function createImmoStore(storage, mode) {
  if (mode !== 'demo' && mode !== 'real') throw new Error('Mode inconnu : ' + mode);
  const key = STORE_IMMO_PREFIX + mode;

  function read() {
    const raw = storage.getItem(key);
    if (raw === null || raw === undefined) return [];
    return _imCheckList(_imParse(raw, 'Biens immobiliers'), 'Bien').map(p => ({ ...p, loan: p.loan ? { ...p.loan } : null, ...(Array.isArray(p.loans) ? { loans: p.loans.map(L => ({ ...L })) } : {}) }));
  }
  // Relit d'abord : des données corrompues déjà enregistrées bloquent l'écriture au lieu d'être écrasées
  function save(list) {
    read();
    _imCheckList(list, 'Bien');
    storage.setItem(key, JSON.stringify(list));
  }
  function readLegacy() {
    const raw = storage.getItem(STORE_IMMO_LEGACY);
    return raw === null || raw === undefined ? [] : _imCheckList(_imParse(raw, 'Anciens biens'), 'Ancien bien');
  }
  // Copie les anciens biens dans CE mode : confirmation explicite requise, refus si le mode contient déjà des biens
  function importLegacy({ confirmMode } = {}) {
    if (confirmMode !== true) throw new Error('Confirmation du mode requise');
    if (read().length) throw new Error('Ce mode contient déjà des biens');
    const l = readLegacy();
    storage.setItem(key, JSON.stringify(_imCheckList(l, 'Bien')));
    return l.length;
  }
  function clear() { storage.removeItem(key); }

  return { key, read, save, readLegacy, importLegacy, clear };
}
