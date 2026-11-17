// Plein écran des graphiques (overlay #chart-fs-overlay, re-rendu aux dimensions pixel du viewport).
// Dépend de charts.js (histSvg, stockChartSvg, watchChartSvg, init*Chart, gen*) — chargé juste avant.
// ⚠ Le 1er rendu est synchrone (pas de requestAnimationFrame : throttlé en arrière-plan → overlay vide).

// ── FULLSCREEN CHART ──
// Configs par type : recalculent les données depuis l'état S (jamais de closure stale).
// render(w,h) -> markup SVG + tooltip dimensionné en pixels (viewBox == pixels => interactivité OK).
// init(container) -> réattache l'interactivité sur le SVG du conteneur.
function _chartFsConfig(type) {
  if (type === 'hist') {
    return {
      title: 'Évolution du patrimoine',
      render: (w, h) => histSvg(genHistData(S.histPeriod), w, h) + '<div class="hist-tip"></div>',
      init: (c) => initHistChart(c, genHistData(S.histPeriod)),
    };
  }
  if (type === 'stock') {
    const acc = S.accounts.find(a => a.id === S.accountId);
    const h = acc?.holdings.find(x => x.id === S.holdingId);
    if (!h) return null;
    const period = S.stockPeriod || 'MAX';
    return {
      title: `${h.ticker} · ${h.name}`,
      render: (w, ch) => stockChartSvg(h, w, ch, period) + '<div class="stock-chart-tip"></div>',
      init: (c) => initStockChart(c, h),
    };
  }
  if (type === 'watch') {
    const watch = S.watchlist.find(w => w.ticker === S.watchTicker);
    if (!watch) return null;
    const wCur = watch.currency || SECURITIES_DB[watch.ticker]?.currency || 'EUR';
    const period = S.watchPeriod || '3M';
    return {
      title: `${watch.ticker} · ${watch.name}`,
      render: (w, h) => {
        const { pts } = genWatchHistory(watch.ticker, watch.price, period);
        return watchChartSvg(pts, w, h, wCur) + '<div id="watch-chart-tip" class="stock-chart-tip"></div>';
      },
      init: (c) => {
        const { pts, startDate } = genWatchHistory(watch.ticker, watch.price, period);
        initWatchChart(c, pts, startDate, wCur);
      },
    };
  }
  return null;
}

function openChartFullscreen(type) {
  const cfg = _chartFsConfig(type);
  if (!cfg) return;
  let ov = document.getElementById('chart-fs-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'chart-fs-overlay';
    ov.className = 'chart-fs-overlay';
    ov.innerHTML = `<div class="chart-fs-bar">
        <span class="chart-fs-title" id="chart-fs-title"></span>
        <button class="chart-fs-close" id="chart-fs-close" aria-label="Fermer">✕</button>
      </div>
      <div class="chart-fs-body" id="chart-fs-body"></div>`;
    document.body.appendChild(ov);
  }
  const body = ov.querySelector('#chart-fs-body');
  ov.querySelector('#chart-fs-title').textContent = cfg.title;

  function paint() {
    // viewBox == pixels affichés => les fonctions init() existantes mappent correctement le curseur.
    const w = Math.max(220, body.clientWidth - 16);
    const isLandscape = body.clientWidth > body.clientHeight;
    const h = isLandscape
      ? Math.max(160, body.clientHeight - 16)
      : Math.max(180, Math.min(body.clientHeight - 16, Math.round(w * 0.72)));
    body.innerHTML = cfg.render(w, h);
    cfg.init(body);
  }
  let rt;
  function onResize() { clearTimeout(rt); rt = setTimeout(paint, 120); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function close() {
    ov.classList.remove('show');
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    body.innerHTML = '';
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  }

  ov.querySelector('#chart-fs-close').onclick = close;
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKey);
  ov.classList.add('show');
  paint(); // rendu synchrone : la lecture de clientWidth force le layout (pas de dépendance à rAF)

  // Plein écran réel + paysage : best-effort (Android). Sans effet sur iOS, l'overlay CSS suffit.
  // Le redimensionnement déclenché re-render le graphique aux bonnes dimensions via onResize.
  try {
    const rfs = ov.requestFullscreen || ov.webkitRequestFullscreen;
    if (rfs) {
      Promise.resolve(rfs.call(ov)).then(() => {
        try { const p = screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (e) {}
      }).catch(() => {});
    }
  } catch (e) {}
}

// Ajoute (ou rafraîchit) le bouton plein écran en bas à droite d'un conteneur de graphique.
function attachChartFs(wrap, type) {
  if (!wrap) return;
  let btn = wrap.querySelector('.chart-fs-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'chart-fs-btn';
    btn.title = 'Plein écran';
    btn.setAttribute('aria-label', 'Plein écran');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
    wrap.appendChild(btn);
  }
  btn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    try { haptic(4); } catch (err) {}
    openChartFullscreen(type);
  };
}
