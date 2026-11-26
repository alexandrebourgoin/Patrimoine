// Accueil cliquable : lignes de la carte « Patrimoine net » qui ouvrent leur module, et bloc « À surveiller ».
// Sources du bloc : HOME_WATCH (js/features/home-watch.js), enregistrées par chaque module. Chargé avant js/screens/dashboard.js.
// Dépend, À L'APPEL seulement, de S, masked, esc, go, runShortcut.

// Lignes de répartition : comptes financiers, immobilier (ma part), crédits immobiliers, autres crédits. wl = wealthNow()
// « Patrimoine brut » (non cliquable) dès qu'une dette est déduite ; « Autres crédits » seulement s'il y en a (comme les crédits immobiliers).
function homeWealthRowsHTML(wl) {
  const row = (label, v, target, neg) => `<div class="wl-row dark wl-link tap" data-wgo="${target}" role="button"><span>${label}</span><span class="t-num">${neg && v > 0.005 ? '−' : ''}${masked(v)} <span class="wl-chev">›</span></span></div>`;
  const hasDebt = wl.count || wl.credits;
  return `<div style="margin-top:10px">
    ${hasDebt ? `<div class="wl-row dark"><span>Patrimoine brut</span><span class="t-num">${masked(wl.gross)}</span></div>` : ''}
    ${row('Comptes financiers', wl.financial, 'comptes')}
    ${row(wl.count ? 'Immobilier (ma part)' : 'Immobilier', wl.property, 'immo')}
    ${wl.count ? row('Crédits immobiliers', wl.debt, 'immo', true) : ''}
    ${wl.credits ? row('Autres crédits', wl.otherDebt || 0, 'credits', true) : ''}
  </div>${homeReadWarningsHTML()}`;
}
// Données de crédits ou de biens illisibles : lues comme une liste vide, donc le net serait faux sans le dire.
// Appelée APRÈS wealthNow() / analysisNow(), qui viennent de relire ces données.
function homeReadWarnings() {
  const out = [];
  if (typeof crReadError === 'function' && crReadError()) out.push({ text: 'Crédits illisibles : le patrimoine net ne déduit pas les autres crédits.', go: 'credits' });
  if (typeof _imError !== 'undefined' && _imError) out.push({ text: "Biens immobiliers illisibles : le patrimoine net ne compte ni l'immobilier ni ses crédits.", go: 'immo' });
  return out;
}
function homeReadWarningsHTML() {
  return homeReadWarnings().map(w => `<div class="wl-warn tap" data-wgo="${w.go}" role="button">⚠ ${esc(w.text)} <span class="wl-chev">›</span></div>`).join('');
}

// Bloc « À surveiller » : rien du tout tant qu'aucune source n'a d'élément
function homeWatchHTML() {
  const items = homeWatchItems(HOME_WATCH);
  if (!items.length) return '';
  const dot = { alert: 'var(--loss)', soon: '#F59E0B', info: 'var(--accent)' };
  return `<div class="watch-card anim" id="js-home-watch">
    <div class="watch-head"><div class="t-label" style="font-size:11px">À surveiller</div></div>
    ${items.map((x, i) => `<div class="hw-item tap" data-hw="${i}" role="button">
      <span class="hw-dot" style="background:${dot[x.level] || dot.info}"></span>
      <div class="flex1" style="min-width:0"><div class="hw-text">${esc(x.text)}</div>${x.sub ? `<div class="t-sm">${esc(x.sub)}</div>` : ''}</div>
      <span class="wl-chev">›</span>
    </div>`).join('')}
  </div>`;
}

// Ouvre la cible d'un élément : un compte précis, ou un module (même transition que la barre du bas)
function homeOpen(target, accountId) {
  if (target === 'account' && accountId) { S.accountId = accountId; go('account'); return; }
  runShortcut(target);
}
function bindHomeLinks(el) {
  el.querySelectorAll('[data-wgo]').forEach(r => r.addEventListener('click', () => homeOpen(r.dataset.wgo)));
  const items = homeWatchItems(HOME_WATCH);
  el.querySelectorAll('[data-hw]').forEach(r => r.addEventListener('click', () => {
    const x = items[+r.dataset.hw]; if (x) homeOpen(x.go, x.accountId);
  }));
}
