// Ecran « Non synchro » : positions dont la date de cotation est inconnue ou trop ancienne (regles : priceStale, js/services/prices.js).
// Depend, A L APPEL seulement, de S et des helpers ; enregistre son binding (SCREEN_BIND) et sa pastille (NAV_BADGES).
// L'ecran est declare dans mon-patrimoine.html (#s-stale).

NAV_BADGES.stale = () => staleHoldings().length;
// Accueil « À surveiller » (registre HOME_WATCH, js/features/home-watch.js), s'il est présent
if (typeof HOME_WATCH !== 'undefined') HOME_WATCH.stale = () => {
  const n = staleHoldings().length;
  return n ? [{ level: 'alert', go: 'stale', text: `${n} position${n > 1 ? 's' : ''} non synchronisée${n > 1 ? 's' : ''}`, sub: 'Cours inconnu ou trop ancien' }] : [];
};

// Un seuil peut être franchi sans aucune action : pastille et écran recalculés au retour sur l'app et toutes les 10 min.
function refreshStaleBadge() {
  if (typeof document !== 'undefined' && document.hidden) return;
  renderNav();
  if (S.screen === 'stale') renderScreen('stale');
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', refreshStaleBadge);
  setInterval(refreshStaleBadge, 10 * 60 * 1000);
}

function renderStale() {
  const list = staleHoldings();
  const rows = list.map(({acc,h}) => `<div class="tap" data-sacc="${esc(String(acc.id))}" data-shold="${esc(String(h.id))}" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer">
      <div class="ticker">${esc(String(h.ticker||'').slice(0,4))}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.name)}</div>
        <div class="t-sm">${esc(acc.name)} · ${esc(h.type)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:12px;font-weight:700;color:var(--loss)">${priceAgeLabel(h.quoteAt)}</div>
        <div class="t-sm">${maskedNative(h.currentPrice, h.currency||'EUR')}</div>
      </div>
    </div>`).join('');
  const empty = S.isDemo ? 'Indisponible en mode démo.' : 'Tous les cours sont à jour ✓';
  return `${moduleBarHTML('stale', "Positions dont la date de cotation est inconnue ou remonte à plus de 4 jours (actions, ETF, obligations) ou de 24 h (cryptos)")}
  <div style="padding:4px 16px 110px">
    <button class="form-submit" data-srefresh="1" style="margin:0 0 14px">Actualiser les cours</button>
    ${rows ? `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden">${rows}</div>`
           : `<div class="t-sm" style="text-align:center;padding:30px 0">${empty}</div>`}
  </div>`;
}

SCREEN_BIND.stale = function (el) {
  el.querySelector('#js-back')?.addEventListener('click', back);
  el.onclick = e => {
    if (e.target.closest('[data-srefresh]')) {
      (async () => {
        try { await fetchLivePrices(); }
        finally { if (S.screen === 'stale') renderScreen('stale'); renderNav(); }
      })().catch(() => toast('Actualisation impossible'));
      return;
    }
    const row = e.target.closest('[data-shold]'); if (!row) return;
    const acc = S.accounts.find(a => String(a.id) === row.dataset.sacc);
    const h = acc && acc.holdings.find(x => String(x.id) === row.dataset.shold);
    if (!h) return;
    S.accountId = acc.id; S.holdingId = h.id;
    go('stock');
  };
};
