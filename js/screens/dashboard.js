// Écran Accueil (dashboard) : rendu + cartes Grandes classes / Évolution / Titres suivis + binding.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre son binding dans SCREEN_BIND (js/core/screens.js, chargé avant).

// ── DASHBOARD ──
function renderDash() {
  const w=totalWealth();   // comptes financiers : base de la variation du jour (l'immobilier n'a pas de variation quotidienne)
  const wl=wealthNow();    // patrimoine net = comptes financiers + immobilier − crédits restants
  const wChg=(S.accounts.length&&w>0)?S.accounts.filter(a=>!a.observer).reduce((s,a)=>s+(a.change1d??0)*(a.value/w),0):0;
  const allH=S.accounts.filter(a=>!a.observer).flatMap(a=>a.holdings); // cohérent avec totalWealth()
  const totPnl=allH.reduce((s,h)=>s+(h.pnlRef??h.pnl??0),0);
  const totInv=allH.reduce((s,h)=>s+toRefCcy((h.avgBuyPrice||0)*(h.quantity||0),h.currency||'EUR'),0);
  const totPnlPct=totInv>0?(totPnl/totInv)*100:0;
  const spark=sparkData(w*.86,28,.022); spark[spark.length-1]=w;

  const wealthDisplay = S.privacy
    ? '<span style="font-size:28px;letter-spacing:4px;color:rgba(255,255,255,.6)">● ● ●</span>'
    : `<div class="wealth-amount t-num">${fmtCur(wl.net)}</div>`;
  const wlRow=(k,v)=>`<div class="wl-row dark"><span>${k}</span><span class="t-num">${masked(v)}</span></div>`;
  const wlDetail=homeWealthRowsHTML(wl);   // lignes cliquables vers Comptes / Immobilier / Crédits (js/screens/home-links.js)
  const nAcc=S.accounts.filter(a=>!a.observer).length;
  return `<div class="dash-top">
    ${renderTopBar(`
      <div id="js-privacy-btn" class="top-btn tap" title="Masquer les montants" style="color:${S.privacy?'var(--accent)':'var(--text2)'}">
        ${S.privacy
          ? `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`
          : `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`
        }
      </div>
    `)}
  </div>
    <div class="wealth-card anim">
    <div class="wealth-label">Patrimoine net</div>
    ${wealthDisplay}
    ${wlDetail}
    <div class="row gap8" style="margin:8px 0 0">
      <div class="badge ${wChg>=0?'up':'dn'}">${wChg>=0?'▲':'▼'} ${Math.abs(wChg).toFixed(2)}%</div>
      <span style="font-size:12px;color:rgba(255,255,255,.75)">Comptes financiers aujourd'hui · ${S.accounts.length} compte${S.accounts.length>1?'s':''}${wl.count?` · ${wl.count} bien${wl.count>1?'s':''} immobilier${wl.count>1?'s':''}`:''}</span>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:6px">
      P&amp;L des positions financières&nbsp;·&nbsp;<span style="font-weight:700;color:${totPnl>=0?'rgba(110,255,200,1)':'rgba(255,150,150,1)'}">${S.privacy?'● ● ●':(totPnl>=0?'+':'')+fmtCur(totPnl)+'&nbsp;('+fmtPct(totPnlPct)+')'}</span>
    </div>
    ${S.lastPriceUpdate?`<div style="font-size:10px;color:rgba(255,255,255,.28);margin-top:5px">Cours · ${timeSince(S.lastPriceUpdate)}</div>`:''}
  </div>
  ${renderHistCard()}
  ${renderPocketCard()}
  ${homeWatchHTML()}
  ${renderWatchlistCard()}`;
}

// ── GRANDES CLASSES D'ACTIFS (même calcul que l'Analyse : analysisNow().byPocket, immobilier net compris) ──
function renderPocketCard() {
  const segs = buildSegs(analysisNow().byPocket, POCKET_C);
  if (!segs.length) return '';
  return `<div class="pocket-card tap anim" id="js-pocket-card" title="Ouvrir l'Analyse">
    <div class="pocket-head"><span>Grandes classes d'actifs</span><span class="pocket-more">Analyse →</span></div>
    ${donutBlock('', segs)}
  </div>`;
}

// ── WATCHLIST CARD ──
function renderWatchlistCard() {
  if (!S.watchlist.length) return '';

  // Tri
  const sortMode = S.watchSort || 'default';
  const sorted = [...S.watchlist].sort((a, b) => {
    if (sortMode === 'perf_desc') return b.change1d - a.change1d;
    if (sortMode === 'perf_asc')  return a.change1d - b.change1d;
    return 0;
  });
  const sortLabel = {default:'—', perf_desc:'▲ Perf', perf_asc:'▼ Perf'}[sortMode];

  const rows = sorted.map(w => {
    const cur   = w.currency || SECURITIES_DB[w.ticker]?.currency || 'EUR';
    const delta = w.price * w.change1d / 100;
    const up    = w.change1d >= 0;
    return `<div class="watch-item tap" data-watch="${w.ticker}">
      <div class="watch-tick">${w.ticker.slice(0,4)}</div>
      <div class="flex1 col gap4" style="min-width:0">
        <div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(w.name)}</div>
        <div class="t-sm">${fmtNative(w.price, cur)}</div>
      </div>
      <div class="col right gap4" style="align-items:flex-end">
        <div class="badge ${up?'up':'dn'}">${up?'▲':'▼'} ${Math.abs(w.change1d).toFixed(2)}%</div>
        <div style="font-size:11px;font-weight:600;color:${up?'var(--gain)':'var(--loss)'}">${up?'+':''}${fmtNative(Math.abs(delta), cur)}</div>
      </div>
      <div class="hold-del-btn tap" data-wdel="${w.ticker}" style="width:28px;height:28px;border-radius:8px;margin-left:6px;flex-shrink:0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </div>
    </div>`;
  }).join('');

  return `<div class="watch-card anim">
    <div class="watch-head">
      <div style="font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--text2)">Titres suivis</div>
      <div class="row gap8" style="align-items:center">
        <div id="js-watch-sort" class="tap" style="font-size:11px;font-weight:700;color:var(--accent);background:var(--accent-dim);border:1px solid var(--accent);padding:1px 8px;border-radius:6px;cursor:pointer" title="Trier">${sortLabel}</div>
        <div style="font-size:12px;font-weight:600;color:var(--text2);background:var(--card2);border:1px solid var(--border);padding:1px 9px;border-radius:20px">${S.watchlist.length}</div>
        <div class="hold-add-btn" id="js-watch-add" style="width:28px;height:28px;border-radius:8px">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </div>
      </div>
    </div>
    ${rows}
  </div>`;
}

// ── HISTORY CARD ──
function renderHistCard() {
  if (!S.accounts.length) return '';
  const periods = ['1S','1M','3M','1A'];
  const pills = periods.map(p => `<div class="hperiod${p===S.histPeriod?' on':''}" data-period="${p}">${p}</div>`).join('');
  const pts = genHistData(S.histPeriod);
  const chartW = Math.min(window.innerWidth, 480) - 72;
  const pct = ((pts[pts.length-1] - pts[0]) / pts[0] * 100);
  const color = pct >= 0 ? 'var(--gain)' : 'var(--loss)';
  const _real = !!pts.real;
  const _chip = `<span style="font-size:10px;font-weight:600;white-space:nowrap;color:${_real?'var(--gain)':'var(--text3)'}" title="${_real?'Historique réel — reconstitué à partir de vos cours et transactions, affiné chaque jour':'Courbe estimée — récupérez l’historique de vos titres pour la fiabiliser'}">${_real?'● réel':'○ estimé'}</span>`;
  return `<div class="hist-card anim">
    <div class="hist-head">
      <div class="row gap8" style="align-items:center"><div style="font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--text2)">${imRead().length?'Évolution des comptes financiers':'Évolution du patrimoine'}</div>${_chip}</div>
      <div class="hist-periods">${pills}</div>
    </div>
    <div class="hist-wrap" id="js-hist-wrap">
      ${histSvg(pts, chartW, 80)}
      <div class="hist-tip" id="js-hist-tip"></div>
    </div>
    <div class="hist-range">
      <span>${masked(pts[0])}</span>
      <span style="font-weight:700;color:${color}">${pct>=0?'+':''}${pct.toFixed(2)}%</span>
      <span>${masked(pts[pts.length-1])}</span>
    </div>
  </div>`;
}


SCREEN_BIND.dashboard = function (el, id) {
    bindHomeLinks(el);
    el.querySelector('#js-pocket-card')?.addEventListener('click', () => go('analysis'));
    // History period selector
    el.querySelectorAll('.hperiod').forEach(p=>p.addEventListener('click',()=>{
      S.histPeriod=p.dataset.period;
      const wrap=el.querySelector('#js-hist-wrap');
      if(!wrap) return;
      const pts=genHistData(S.histPeriod);
      const chartW=Math.min(window.innerWidth,480)-72;
      wrap.innerHTML=histSvg(pts,chartW,80)+'<div class="hist-tip" id="js-hist-tip"></div>';
      el.querySelectorAll('.hperiod').forEach(x=>x.classList.toggle('on',x.dataset.period===S.histPeriod));
      const pct=((pts[pts.length-1]-pts[0])/pts[0]*100);
      const color=pct>=0?'var(--gain)':'var(--loss)';
      const rangeEl=el.querySelector('.hist-range');
      if(rangeEl) rangeEl.innerHTML=`<span>${masked(pts[0])}</span><span style="font-weight:700;color:${color}">${pct>=0?'+':''}${pct.toFixed(2)}%</span><span>${masked(pts[pts.length-1])}</span>`;
      initHistChart(el.querySelector('.hist-card'), pts);
      attachChartFs(el.querySelector('#js-hist-wrap'), 'hist');
    }));
    const histCard=el.querySelector('.hist-card');
    if(histCard) initHistChart(histCard, genHistData(S.histPeriod));
    attachChartFs(el.querySelector('#js-hist-wrap'), 'hist');
    el.querySelector('#js-settings-btn')?.addEventListener('click', ()=>go('settings'));
    el.querySelector('#js-assistant-btn')?.addEventListener('click', ()=>go('assistant'));
    el.querySelector('#js-watch-add')?.addEventListener('click', openWatchModal);
    el.querySelector('#js-watch-sort')?.addEventListener('click', () => {
      const modes = ['default','perf_desc','perf_asc'];
      S.watchSort = modes[(modes.indexOf(S.watchSort||'default') + 1) % modes.length];
      renderScreen('dashboard');
    });

    // ── Fraîcheur des cours ──
    function updateFreshDot() {
      const dot = document.getElementById('js-fresh-dot');
      if (!dot) return;
      const age = S.lastPriceUpdate ? Date.now() - S.lastPriceUpdate : Infinity;
      dot.style.background = age < 5*60*1000 ? 'var(--gain)'
                           : age < 60*60*1000 ? '#F59E0B'
                           : 'var(--text3)';
    }
    updateFreshDot();
    // Un seul intervalle, remplacé à chaque re-render (l'ancien visibilitychange tuait le timer
    // au premier changement d'onglet et chaque render en empilait un nouveau)
    clearInterval(el._freshTimer);
    el._freshTimer = setInterval(updateFreshDot, 60*1000);

    // ── Supprimer un titre suivi ──
    el.querySelectorAll('[data-wdel]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const ticker = btn.dataset.wdel;
        haptic(10);
        openConfirm(`Retirer ${ticker} de la liste de suivi ?`, () => {
          const name = S.watchlist.find(w => w.ticker === ticker)?.name || ticker;
          S.watchlist = S.watchlist.filter(w => w.ticker !== ticker);
          saveAccounts();
          refreshMain();
          toast(`${name} retiré des favoris`);
        });
      });
    });
    el.querySelectorAll('[data-watch]').forEach(item => {
      item.addEventListener('click', () => {
        S.watchTicker = item.dataset.watch;
        go('watchstock');
      });
    });
    // Privacy toggle

    el.querySelector('#js-privacy-btn')?.addEventListener('click', togglePrivacy);
};
