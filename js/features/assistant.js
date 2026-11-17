// Moteur de recommandations de l Assistant IA (100 % local, déterministe) — fonctions pures sur S.
// analyzePortfolio(S) ne dépend que de son argument et de FX/devise via S ; assistantAlertCount() lit S global.

// ── ASSISTANT IA (moteur de recommandations local) ──
// Analyse 100% déterministe, hors-ligne, aucune donnée envoyée.
// Renvoie une liste de recos triées par sévérité (3 = important, 2 = à surveiller, 1 = suggestion).
function analyzePortfolio(S) {
  const recos = [];
  const accs = S.accounts.filter(a => !a.observer);
  const all  = accs.flatMap(a => a.holdings.map(h => ({ h, acc: a })));
  const vOf  = h => (h.valueRef ?? h.value ?? 0);
  const cashTot = accs.reduce((s, a) => s + accCash(a), 0); // liquidités non investies
  const tot  = all.reduce((s, x) => s + vOf(x.h), 0) + cashTot;
  if (!all.length || tot <= 0) return recos;
  const appCcy = S.currency || 'EUR';
  const pct = v => (v / tot) * 100;

  // 1. Concentration par titre (agrégé par ticker, tous comptes confondus)
  const byTicker = {};
  all.forEach(({ h, acc }) => {
    const k = h.ticker || h.name || '?';
    if (!byTicker[k]) byTicker[k] = { val: 0, name: h.name || k, accId: acc.id, holdId: h.id, n: 0 };
    byTicker[k].val += vOf(h); byTicker[k].n++;
  });
  Object.values(byTicker).forEach(t => {
    const w = pct(t.val);
    const link = t.n === 1 ? { accId: t.accId, holdId: t.holdId } : {};
    if (w >= 25) recos.push({ sev: 3, icon: '⚠️', title: `Surexposition : ${t.name}`,
      detail: `Ce titre pèse ${w.toFixed(0)} % du portefeuille. Une forte baisse aurait un impact majeur — envisagez d'alléger ou de diversifier.`, ...link });
    else if (w >= 15) recos.push({ sev: 2, icon: '📊', title: `Forte pondération : ${t.name}`,
      detail: `${w.toFixed(0)} % du portefeuille concentré sur une seule ligne. À surveiller.`, ...link });
  });

  // 2. Nombre de lignes
  const nLignes = Object.keys(byTicker).length;
  if (nLignes < 5) recos.push({ sev: 2, icon: '🧩', title: 'Portefeuille peu diversifié',
    detail: `Seulement ${nLignes} ligne${nLignes > 1 ? 's' : ''} en portefeuille. Multiplier les positions réduit le risque spécifique.` });

  // 3. Concentration sectorielle
  const bySec = {};
  all.forEach(({ h }) => { const k = h.sector || 'Autre'; bySec[k] = (bySec[k] || 0) + vOf(h); });
  const topSec = Object.entries(bySec).sort((a, b) => b[1] - a[1])[0];
  if (topSec && pct(topSec[1]) >= 40) recos.push({ sev: 2, icon: '🏭', title: `Concentration sectorielle : ${topSec[0]}`,
    detail: `${pct(topSec[1]).toFixed(0)} % de l'exposition sur un seul secteur. Diversifier les secteurs lisse la performance.` });

  // 4. Diversification géographique
  const byGeo = {};
  all.forEach(({ h }) => { const k = h.country || 'Autre'; byGeo[k] = (byGeo[k] || 0) + vOf(h); });
  const topGeo = Object.entries(byGeo).sort((a, b) => b[1] - a[1])[0];
  if (topGeo && pct(topGeo[1]) >= 60) recos.push({ sev: 1, icon: '🌍', title: `Exposition géographique : ${topGeo[0]}`,
    detail: `${pct(topGeo[1]).toFixed(0)} % concentré sur une zone. Une exposition internationale diversifie le risque pays.` });

  // 5. Exposition au risque de change
  const byCcy = {};
  all.forEach(({ h }) => { const k = h.currency || appCcy; byCcy[k] = (byCcy[k] || 0) + vOf(h); });
  const foreign = Object.entries(byCcy).filter(([k]) => k !== appCcy).reduce((s, [, v]) => s + v, 0);
  if (pct(foreign) >= 40) recos.push({ sev: 2, icon: '💱', title: 'Exposition au risque de change',
    detail: `${pct(foreign).toFixed(0)} % du portefeuille est libellé hors ${appCcy}. Les variations de change affectent directement sa valeur.` });

  // 6. Fortes moins-values vs PRU
  all.filter(({ h }) => (h.pnlPct ?? 0) <= -20).sort((a, b) => (a.h.pnlPct ?? 0) - (b.h.pnlPct ?? 0)).slice(0, 3)
    .forEach(({ h, acc }) => recos.push({ sev: 2, icon: '📉', title: `Forte moins-value : ${h.name || h.ticker}`,
      detail: `${fmtPct(h.pnlPct ?? 0)} vs PRU. Réévaluez la thèse d'investissement ou envisagez un arbitrage.`, accId: acc.id, holdId: h.id }));

  // 7. Fortes plus-values vs PRU
  all.filter(({ h }) => (h.pnlPct ?? 0) >= 50).sort((a, b) => (b.h.pnlPct ?? 0) - (a.h.pnlPct ?? 0)).slice(0, 2)
    .forEach(({ h, acc }) => recos.push({ sev: 1, icon: '🚀', title: `Belle plus-value : ${h.name || h.ticker}`,
      detail: `${fmtPct(h.pnlPct ?? 0)} vs PRU. Vous pourriez sécuriser une partie des gains.`, accId: acc.id, holdId: h.id }));

  // 8. Allocation vs objectifs
  const byType = {};
  all.forEach(({ h }) => { const k = h.type || 'Autre'; byType[k] = (byType[k] || 0) + vOf(h); });
  Object.entries(S.targets || {}).forEach(([type, target]) => {
    const cur = pct(byType[type] || 0);
    const d = cur - target;
    if (Math.abs(d) >= 15) recos.push({ sev: 1, icon: '🎯', title: `Allocation ${type} hors objectif`,
      detail: `Actuel ${cur.toFixed(0)} % vs objectif ${target} % (${d > 0 ? '+' : ''}${d.toFixed(0)} pts) — ${d > 0 ? 'surpondéré' : 'sous-pondéré'}.` });
  });

  // 9. Liquidités dormantes
  const cashW = pct((byType['Cash'] || 0) + cashTot);
  if (cashW >= 15) recos.push({ sev: 1, icon: '💰', title: 'Liquidités importantes',
    detail: `${cashW.toFixed(0)} % en cash. Des liquidités dormantes perdent de la valeur avec l'inflation — envisagez de les investir.` });

  // 10. Watchlist — mouvements notables du jour
  (S.watchlist || []).filter(w => Math.abs(w.change1d ?? 0) >= 3).slice(0, 3).forEach(w => {
    const up = (w.change1d ?? 0) >= 0;
    recos.push({ sev: 1, icon: up ? '📈' : '📉', title: `Suivi : ${w.name || w.ticker} ${fmtPct(w.change1d ?? 0)}`,
      detail: `Mouvement notable aujourd'hui sur un titre de votre liste de suivi.` });
  });

  recos.sort((a, b) => b.sev - a.sev);
  return recos;
}

// Nombre de recommandations « importantes » (sévérité 3) — pour la pastille du bouton ✨.
// Recalculé à chaque rendu de la barre (donc après chaque refreshMain / actualisation des cours).
function assistantAlertCount() {
  if (!S.assistantEnabled) return 0;
  try { return analyzePortfolio(S).filter(r => r.sev === 3).length; }
  catch(e) { return 0; }
}
