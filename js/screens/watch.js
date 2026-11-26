// Écran d un titre suivi (watchlist) : graphique, performances + binding.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre son binding dans SCREEN_BIND (js/core/screens.js, chargé avant).

// ── WATCHSTOCK ──
function renderWatchStock() {
  const watch = S.watchlist.find(w => w.ticker === S.watchTicker);
  if (!watch) return backBarHTML();

  const period  = S.watchPeriod || '3M';
  const periods = ['1S','1M','3M','6M','1A'];
  const chartW  = Math.min(window.innerWidth, 480);

  // History for selected period (chart display)
  const {pts, startDate} = genWatchHistory(watch.ticker, watch.price, period);

  // Full 1-year history → performance metrics + 52-week range
  const {pts: fullPts} = genWatchHistory(watch.ticker, watch.price, '1A');
  const n = fullPts.length; // 365
  const today = new Date(); today.setHours(0,0,0,0);
  const ytdDays = Math.max(1, Math.round((today - new Date(today.getFullYear(), 0, 1)) / 86400000));
  const perf = (daysBack) => {
    const i = Math.max(0, n - 1 - Math.min(daysBack, n - 1));
    return (fullPts[n-1] - fullPts[i]) / fullPts[i] * 100;
  };
  const perfYTD = perf(ytdDays);
  const perf1M  = perf(30);
  const perf3M  = perf(90);
  const perf6M  = perf(182);
  const high52  = Math.max(...fullPts);
  const low52   = Math.min(...fullPts);

  const up    = watch.change1d >= 0;
  const delta = watch.price * watch.change1d / 100;
  const sec   = SECURITIES_DB[watch.ticker];
  const secInfo = sec ? `${sec.type} · ${sec.country} · ${sec.sector}` : '';
  const wCur  = watch.currency || sec?.currency || 'EUR';

  const _whist = getHistorySeries(watch.ticker);
  const _wChip = `<span style="font-size:11px;font-weight:600;white-space:nowrap;color:${_whist?'var(--gain)':'var(--text3)'}" title="${_whist?('Historique réel · '+timeSince(_whist.fetchedAt)):'Courbe estimée — touchez l’icône historique pour récupérer les vrais cours'}">${_whist?'● réel':'○ estimé'}</span>`;

  const periodPct = (pts[pts.length-1] - pts[0]) / pts[0] * 100;

  const perfBox = (label, val) => {
    const pos = val >= 0;
    return `<div class="metric">
      <div class="t-label">${label}</div>
      <div class="metric-val ${pos?'t-gain':'t-loss'} t-num">${pos?'+':''}${val.toFixed(2)}%</div>
    </div>`;
  };

  return `${backBarHTML('Titres suivis')}

  <div class="stock-hero" style="padding-bottom:10px;border-bottom:none">
    <div class="stock-ticker-badge">${esc(watch.ticker)}</div>
    <div style="font-size:19px;font-weight:800;letter-spacing:-.4px">${esc(watch.name)}</div>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="stock-price t-num" style="margin:0">${fmtNative(watch.price, wCur)}</div>
      <div id="js-watch-ticker-refresh" class="tap" style="width:34px;height:34px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text2);flex-shrink:0" title="Actualiser ce titre">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
      </div>
      <div id="js-watch-ticker-history" class="tap" style="width:34px;height:34px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text2);flex-shrink:0" title="Reprendre l’historique réel des cours">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
      </div>
    </div>
    <div class="row gap8" style="align-items:center;flex-wrap:wrap">
      <div class="badge ${up?'up':'dn'}">${up?'▲':'▼'} ${Math.abs(watch.change1d).toFixed(2)}%</div>
      <span style="font-size:13px;font-weight:700;color:${up?'var(--gain)':'var(--loss)'}">${up?'+':''}${fmtNative(Math.abs(delta), wCur)}</span>
      ${secInfo?`<span class="t-sm">${secInfo}</span>`:''}
      ${_wChip}
    </div>
  </div>

  <div style="display:flex;gap:6px;padding:10px 20px 8px;overflow-x:auto">
    ${periods.map(p=>`<div class="hperiod${p===period?' on':''}" data-wperiod="${p}">${p}</div>`).join('')}
  </div>

  <div style="position:relative" id="js-watch-chart-wrap">
    ${watchChartSvg(pts, chartW, 140, wCur)}
    <div id="watch-chart-tip" class="stock-chart-tip" style="position:absolute;top:4px;left:0"></div>
  </div>

  <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 20px 14px">
    <span id="js-watch-date-start" style="font-size:11px;color:var(--text3)">${startDate.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</span>
    <span id="js-watch-period-perf" style="font-size:13px;font-weight:800;color:${periodPct>=0?'var(--gain)':'var(--loss)'}">${periodPct>=0?'+':''}${periodPct.toFixed(2)}%</span>
    <span style="font-size:11px;color:var(--text3)">${today.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</span>
  </div>

  <div class="t-section" style="padding:0 20px 8px">Performances</div>
  <div class="metrics">
    ${perfBox('YTD', perfYTD)}
    ${perfBox('1 mois', perf1M)}
    ${perfBox('3 mois', perf3M)}
    ${perfBox('6 mois', perf6M)}
    <div class="metric">
      <div class="t-label">52 sem. haut</div>
      <div class="metric-val t-num">${fmtNative(high52, wCur)}</div>
    </div>
    <div class="metric">
      <div class="t-label">52 sem. bas</div>
      <div class="metric-val t-num">${fmtNative(low52, wCur)}</div>
    </div>
  </div>

  <div style="padding:16px 20px 48px">
    <div class="tap" id="js-watch-remove" style="display:flex;align-items:center;justify-content:center;gap:8px;background:var(--loss-dim);color:var(--loss);border:1px solid var(--loss);border-radius:12px;padding:13px;font-size:14px;font-weight:700">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>
      Retirer de la liste de suivi
    </div>
  </div>`;
}


SCREEN_BIND.watchstock = function (el, id) {
    el.querySelector('#js-back')?.addEventListener('click', back);
    el.querySelector('#js-watch-ticker-refresh')?.addEventListener('click', () => {
      if (S.watchTicker) fetchWatchPrice(S.watchTicker);
    });
    el.querySelector('#js-watch-ticker-history')?.addEventListener('click', () => {
      if (S.watchTicker) fetchWatchHistory(S.watchTicker);
    });

    // Period selector: swap chart + labels in-place
    el.querySelectorAll('[data-wperiod]').forEach(btn => btn.addEventListener('click', () => {
      S.watchPeriod = btn.dataset.wperiod;
      el.querySelectorAll('[data-wperiod]').forEach(b => b.classList.toggle('on', b.dataset.wperiod === S.watchPeriod));
      const watch = S.watchlist.find(w => w.ticker === S.watchTicker);
      if (!watch) return;
      const chartW = Math.min(window.innerWidth, 480);
      const {pts, startDate} = genWatchHistory(watch.ticker, watch.price, S.watchPeriod);
      const wCur = watch.currency || SECURITIES_DB[watch.ticker]?.currency || 'EUR';
      const wrap = el.querySelector('#js-watch-chart-wrap');
      if (wrap) {
        wrap.innerHTML = watchChartSvg(pts, chartW, 140, wCur) +
          '<div id="watch-chart-tip" class="stock-chart-tip" style="position:absolute;top:4px;left:0"></div>';
        initWatchChart(wrap, pts, startDate, wCur);
        attachChartFs(wrap, 'watch');
      }
      const pct = (pts[pts.length-1] - pts[0]) / pts[0] * 100;
      const perfEl = el.querySelector('#js-watch-period-perf');
      if (perfEl) {
        perfEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        perfEl.style.color = pct >= 0 ? 'var(--gain)' : 'var(--loss)';
      }
      const dateStartEl = el.querySelector('#js-watch-date-start');
      if (dateStartEl) dateStartEl.textContent = startDate.toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'});
    }));

    // Init chart on load
    const watch = S.watchlist.find(w => w.ticker === S.watchTicker);
    if (watch) {
      const wrap = el.querySelector('#js-watch-chart-wrap');
      if (wrap) {
        const {pts, startDate} = genWatchHistory(watch.ticker, watch.price, S.watchPeriod || '3M');
        const wCur = watch.currency || SECURITIES_DB[watch.ticker]?.currency || 'EUR';
        initWatchChart(wrap, pts, startDate, wCur);
        attachChartFs(wrap, 'watch');
      }
    }

    // Remove from watchlist
    el.querySelector('#js-watch-remove')?.addEventListener('click', () => {
      openConfirm(`Retirer ${S.watchTicker} de la liste de suivi ?`, () => {
        const name = S.watchlist.find(w => w.ticker === S.watchTicker)?.name || S.watchTicker;
        S.watchlist = S.watchlist.filter(w => w.ticker !== S.watchTicker);
        saveData();
        back();
        refreshMain();
        toast(`${name} retiré de la liste`);
      });
    });
};
