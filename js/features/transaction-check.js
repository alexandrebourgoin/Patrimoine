// Contrôle chronologique des mouvements d'un titre : aucune vente ne doit dépasser la quantité détenue À SA DATE,
// que ce soit à l'ajout, à la modification ou à la suppression d'un mouvement (supprimer un achat peut rendre une vente
// ultérieure impossible). Fonctions pures : elles reçoivent la liste des mouvements et renvoient un message d'erreur ou null.
// L'ordre rejoué est celui de recalcHolding (PU.sortTx : à date égale, achats avant ventes, ordre de saisie conservé).
// Un historique DÉJÀ incohérent (anciennes données) ne bloque pas les autres modifications : seule une NOUVELLE vente
// excessive est refusée.
// Dépend de PU (utils.js) et, à l'appel seulement, de fmtDate (mon-patrimoine.js).

const _txQty = q => (Math.round(q * 1e6) / 1e6).toString();
const _txKey = v => v.date + '|' + v.qty;

// Première vente excessive introduite par le changement (absente de l'historique avant), ou null
function txNewOversell(before, after) {
  const known = new Set(PU.oversells(before).map(_txKey));
  return PU.oversells(after).find(v => !known.has(_txKey(v))) || null;
}
function _txError(before, after, prefix) {
  const v = txNewOversell(before, after);
  return v ? `${prefix} : la vente du ${fmtDate(v.date)} (${_txQty(v.qty)}) dépasserait les ${_txQty(v.held)} titre(s) détenus à cette date` : null;
}

function txCheckAdd(list, tx) { return _txError(list, [...list, tx], 'Vente impossible'); }
function txCheckEdit(list, idx, tx) { return _txError(list, list.map((t, i) => (i === idx ? tx : t)), 'Modification impossible'); }
function txCheckDelete(list, idx) { return _txError(list, list.filter((_, i) => i !== idx), 'Suppression impossible'); }
