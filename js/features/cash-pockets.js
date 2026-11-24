// Liquidités par devise : régularisation (acc.cashAdjust) et devise des apports. Fonctions PURES : aucun accès à S, au DOM ni au stockage.
// Le calcul des poches lui-même est dans utils.js (PU.accCashByCcy / PU.accCash).
//
// Une régularisation = « à cette date, le solde réel de chaque poche est celui-ci » (relevé du courtier) :
//   acc.cashAdjust = [{ id, date:'AAAA-MM-JJ', balances:{ EUR: 1200, USD: -300 } }]  (au plus une par date, triées)
// Elle CORRIGE le niveau de liquidités à partir de cette date. Ce n'est ni un apport ni un retrait : elle n'entre jamais dans les flux
// de la performance (voir account-perf.js), donc ne crée ni gain ni perte.

// Lignes du formulaire : une par devise utile (devise du compte, devises des titres, poches existantes), valeurs actuelles à `date`
function cashAdjustRows(acc, date, appCcy) {
  const pk = PU.accCashByCcy(acc, date);
  const set = new Set([acc.currency || appCcy, ...(acc.holdings || []).map(h => h.currency || 'EUR'), ...Object.keys(pk)]);
  return [...set].map(c => ({ ccy: c, val: String(Math.round((pk[c] || 0) * 100) / 100) }));
}
// Valeurs saisies → soldes arrondis au centime. Un champ vide vaut 0 ; un texte illisible est une erreur (jamais ignoré).
// → { balances } ou { error }
function cashAdjustBalances(rows) {
  const balances = {};
  for (const r of rows) {
    const raw = String(r.val).trim().replace(',', '.');
    const v = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(v)) return { error: `Montant invalide pour ${r.ccy}` };
    balances[r.ccy] = Math.round(v * 100) / 100;
  }
  return { balances };
}
// Date de régularisation : réelle, au format AAAA-MM-JJ, jamais dans le futur
function cashAdjustDateError(date, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || Number.isNaN(Date.parse(date + 'T00:00:00Z'))) return 'Indique une date valide';
  if (date > today) return 'La date ne peut pas être dans le futur';
  return null;
}
// Ajoute la régularisation ; une régularisation existante à la même date est remplacée. Liste triée par date ; l'originale n'est pas modifiée.
function cashAdjustApply(list, adj) {
  return [...(list || []).filter(a => a.date !== adj.date), adj].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}
function cashAdjustRemove(list, id) { return (list || []).filter(a => a.id !== id); }

// Écrit la devise sur les apports / retraits qui n'en ont pas (celle du compte AU MOMENT de l'appel).
// À appeler avant de changer la devise du compte : sinon les anciens apports seraient réinterprétés dans la nouvelle devise.
function cfStampCcy(acc) {
  const ccy = acc.currency || 'EUR';
  (acc.cashflows || []).forEach(c => { if (!c.ccy) c.ccy = ccy; });
}
