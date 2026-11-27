// Ecran « Non synchro » : positions dont la date de cotation est inconnue ou trop ancienne (regles : priceStale, js/services/prices.js).
// Depend, A L APPEL seulement, de S et des helpers ; enregistre son binding (SCREEN_BIND) et sa pastille (NAV_BADGES).
// L'ecran est declare dans mon-patrimoine.html (#s-stale) ; fenêtre « Trouver le cours » : #sym-sheet (même fichier).

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

// Ligne d'action sous chaque position : cotation déjà choisie (à changer) ou à trouver
function staleSymbolHint(ticker) {
  const u = typeof symbolUser === 'function' ? symbolUser(ticker) : null;
  return u ? 'Cotation choisie : ' + esc(u.label || u.yahoo || u.cg) + ' · changer' : 'Trouver le cours ›';
}

function renderStale() {
  const list = staleHoldings();
  const rows = list.map(({acc,h}) => `<div class="tap" data-sacc="${esc(String(acc.id))}" data-shold="${esc(String(h.id))}" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer">
      <div class="ticker">${esc(String(h.ticker||'').slice(0,4))}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.name)}</div>
        <div class="t-sm">${esc(acc.name)} · ${esc(h.type)}</div>
        <div class="t-sm" style="color:var(--accent);font-weight:700;margin-top:2px">${staleSymbolHint(h.ticker)}</div>
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
    if (h) openSymbolSheet(acc, h);
  };
};

// ── Fenêtre « Trouver le cours » : choisir la cotation d'un titre, pour toute l'app ──
// Recherche (proxy des cours / CoinGecko), choix d'une cotation → mémorisée pour le ticker (js/features/symbols.js),
// valable pour toutes les positions de ce ticker (tous comptes), la liste de suivi et les historiques ; puis actualisation.
// Sans cotation en ligne (ex. fonds de 3e pilier) : cours saisi à la main pour toutes ces positions.
let _sym = null;   // { accId, holdingId, ticker, crypto, currency, results }
function _symHoldings(ticker) { return S.accounts.flatMap(a => a.holdings.filter(h => h.ticker === ticker)); }
function _symShow(on) {
  document.getElementById('sym-bg').classList.toggle('show', on);
  document.getElementById('sym-sheet').classList.toggle('show', on);
}
function openSymbolSheet(acc, h) {
  _sym = { accId: acc.id, holdingId: h.id, ticker: h.ticker, crypto: h.type === 'Crypto', currency: h.currency || 'EUR', results: [] };
  const n = _symHoldings(h.ticker).length;
  document.getElementById('sym-title').textContent = h.name || h.ticker;
  document.getElementById('sym-sub').textContent = `${h.ticker} · ${n > 1 ? n + ' positions' : '1 position'} · le choix vaut pour toute l'app`;
  document.getElementById('sym-q').value = symbolQuery(h);
  document.getElementById('sym-manual').value = '';
  document.getElementById('sym-manual-ccy').textContent = _sym.currency;
  document.getElementById('sym-manual-box').classList.toggle('hidden', _sym.crypto);
  document.getElementById('sym-list').innerHTML = '';
  _symShow(true);
  symbolSheetSearch();
}
function closeSymbolSheet() { _symShow(false); _sym = null; }

function symbolResultsHTML(list, holdingCcy) {
  if (!list.length) return '<div class="t-sm" style="padding:14px 0">Aucun résultat. Essayez le nom, le ticker ou l\'ISIN, ou saisissez le cours à la main.</div>';
  // Même devise que la position d'abord : une autre devise fausserait la valeur (prix d'achat dans la devise d'origine)
  const sorted = list.slice().sort((a, b) => (b.currency === holdingCcy) - (a.currency === holdingCcy) || (b.price != null) - (a.price != null));
  return sorted.map((c, i) => {
    const other = c.currency && c.currency !== holdingCcy;
    return `<button type="button" class="sym-res" data-sym="${esc(c.id)}">
      <span class="sym-txt"><span class="sym-name">${esc(c.name)}</span>
        <span class="sym-sub">${esc([c.kind === 'yahoo' ? c.id : '', c.place, c.currency].filter(Boolean).join(' · '))}</span>
        ${other ? `<span class="sym-warn">Coté en ${esc(c.currency)}, votre position est en ${esc(holdingCcy)}</span>` : ''}</span>
      <span class="sym-price">${c.price != null ? esc(fmtNative(c.price, c.currency || holdingCcy)) : '—'}</span>
    </button>`;
  }).join('');
}
async function symbolSheetSearch() {
  if (!_sym) return;
  const q = document.getElementById('sym-q').value.trim(), ref = _sym, list = document.getElementById('sym-list');
  if (!q) { list.innerHTML = ''; return; }
  list.innerHTML = '<div class="t-sm" style="padding:14px 0">Recherche…</div>';
  try {
    const res = await symbolSearch(q, ref.crypto);
    if (_sym !== ref) return;   // fenêtre fermée ou rouverte entre-temps
    ref.results = res;
    list.innerHTML = symbolResultsHTML(res, ref.currency);
  } catch (e) {
    if (_sym === ref) list.innerHTML = `<div class="t-sm" style="padding:14px 0;color:var(--loss)">${esc(e.message || 'Recherche impossible')}</div>`;
  }
}
async function symbolSheetPick(id) {
  const ref = _sym; if (!ref) return;
  const c = ref.results.find(x => x.id === id); if (!c) return;
  symbolSet(ref.ticker, c.kind === 'cg' ? { cg: c.id, label: c.name } : { yahoo: c.id, label: [c.id, c.place, c.currency].filter(Boolean).join(' · ') });
  // Une cotation choisie remplace un cours saisi à la main, partout
  _symHoldings(ref.ticker).forEach(h => { delete h.manualPrice; });
  saveAccounts();
  closeSymbolSheet();
  toast(`${ref.ticker} : cotation ${c.kind === 'cg' ? c.name : c.id} retenue, actualisation…`);
  try { await fetchLivePrices(); } finally { if (S.screen === 'stale') renderScreen('stale'); renderNav(); }
}
function symbolSheetManual() {
  const ref = _sym; if (!ref) return;
  const v = parseFloat(String(document.getElementById('sym-manual').value).replace(',', '.'));
  if (!(v > 0)) { toast('Saisissez un cours supérieur à 0'); return; }
  _symHoldings(ref.ticker).forEach(h => { h.currentPrice = v; h.manualPrice = true; recalcHolding(h); });
  S.accounts.forEach(a => { a.value = accTotal(a); });
  saveAccounts();
  closeSymbolSheet();
  refreshMain();
  toast(`${ref.ticker} : cours saisi à la main (${fmtNative(v, ref.currency)})`);
  if (S.screen === 'stale') renderScreen('stale');
  renderNav();
}
if (typeof document !== 'undefined' && document.getElementById?.('sym-sheet')) {
  document.getElementById('sym-go').addEventListener('click', symbolSheetSearch);
  document.getElementById('sym-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); symbolSheetSearch(); } });
  document.getElementById('sym-list').addEventListener('click', e => { const b = e.target.closest('[data-sym]'); if (b) symbolSheetPick(b.dataset.sym); });
  document.getElementById('sym-manual-ok').addEventListener('click', symbolSheetManual);
  document.getElementById('sym-open').addEventListener('click', () => {
    const ref = _sym; if (!ref) return;
    closeSymbolSheet(); S.accountId = ref.accId; S.holdingId = ref.holdingId; go('stock');
  });
  document.getElementById('sym-bg').addEventListener('click', closeSymbolSheet);
  document.getElementById('sym-close').addEventListener('click', closeSymbolSheet);
  registerModal('sym-sheet', closeSymbolSheet);
}
