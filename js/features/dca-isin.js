// DCA : résolution en ligne des ISIN saisis dans un plan (ISIN → ticker, nom, devise, symbole Yahoo).
// Une tentative automatique par ISIN et par mode durant la session ; une synchronisation manuelle (force) retente les échecs.
// Garanties : un titre déjà présent dans le plan n'est jamais dupliqué (conflit compté, ligne laissée telle quelle) ;
// si l'on bascule démo ↔ réel pendant une requête, la réponse tardive est ignorée (jamais écrite dans l'autre mode).
// Dépend, À L APPEL seulement, de S, toast, saveDca, renderScreen, resolveIsinOnline ; dca-calc.js (dcaIsIsin, dcaResolveLine) chargé avant.

let _dcaResolving = false;
const _dcaIsinTried = new Set();

// → { resolved, conflicts, failed, cancelled } (+ pending si une résolution est déjà en cours, unavailable si le service est absent)
async function dcaResolveIsins(force = false) {
  const result = { resolved: 0, conflicts: 0, failed: 0, cancelled: false };
  if (_dcaResolving) return { ...result, pending: true };
  const data = S.dca, demo = S.isDemo;
  const current = () => S.dca === data && S.isDemo === demo;
  if (typeof resolveIsinOnline !== 'function') {
    if (force) toast('Résolution en ligne indisponible');
    return { ...result, unavailable: true };
  }
  const key = isin => `${demo ? 'demo' : 'real'}:${isin}`;
  const todo = [...new Set(data.plans.flatMap(plan => (plan.lines || [])
    .filter(l => l && dcaIsIsin(l.isin) && !l.resolved).map(l => l.isin)))]
    .filter(isin => force || !_dcaIsinTried.has(key(isin)));
  if (!todo.length) {
    if (force) toast('Aucun ISIN à résoudre');
    return result;
  }
  _dcaResolving = true;
  try {
    for (const isin of todo) {
      if (!current()) { result.cancelled = true; return result; }
      _dcaIsinTried.add(key(isin));
      let info;
      try { info = await resolveIsinOnline(isin); }
      catch (error) {
        if (!current()) { result.cancelled = true; return result; }
        result.failed++;
        continue;
      }
      if (!current()) { result.cancelled = true; return result; }
      if (!info || typeof info.ticker !== 'string' || !info.ticker.trim()) { result.failed++; continue; }
      let changed = false;
      for (const plan of data.plans) {
        const index = (plan.lines || []).findIndex(l => l && l.isin === isin && !l.resolved);
        if (index < 0) continue;
        try {
          plan.lines = dcaResolveLine(plan.lines, index, info);
          result.resolved++;
          changed = true;
        } catch (error) {
          if (error instanceof RangeError) result.conflicts++;
          else result.failed++;
        }
      }
      if (changed) saveDca();   // sauvegarde avant le prochain await, uniquement dans le mode encore actif
    }
    if (result.resolved && S.screen === 'dca') renderScreen('dca');
    if (force || result.resolved || result.conflicts) {
      toast(`${result.resolved} titre(s) reconnu(s) · ${result.conflicts} doublon(s) refusé(s) · ${result.failed} recherche(s) infructueuse(s)`);
    }
    return result;
  } finally { _dcaResolving = false; }
}
