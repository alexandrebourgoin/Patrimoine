// Écran d un titre détenu : graphique, ordres, actions + binding.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre son binding dans SCREEN_BIND (js/core/screens.js, chargé avant).

// ── STOCK ──
function renderStock() {
  const acc=S.accounts.find(a=>a.id===S.accountId); if(!acc) return '';
  const h=acc.holdings.find(h=>h.id===S.holdingId); if(!h) return '';
  const hCur=h.currency||'EUR';
  const fmt=v=>maskedNative(v,hCur);
  const fmtE=v=>masked(v); // account currency
  const invested=h.avgBuyPrice*h.quantity;
  const pnl=h.value-invested;
  const pnlPct=invested>0?(pnl/invested)*100:0;
  const chartW=chartWidth();

  const divTotal=h.transactions.filter(t=>t.type==='DIV').reduce((s,t)=>s+t.qty*t.price,0);
  const realizedPnL=computeRealizedPnL(h);

  // P/L produit (FX-neutral, in native currency)
  const showProduit=hCur!==S.currency;
  const pnlProduit=(h.currentPrice-h.avgBuyPrice)*h.quantity; // in native currency
  // Note : sans FX historique aux dates d'achat, un « effet change » n'est pas calculable
  // (pnl et pnlProduit sont identiques par construction) — on affiche le P&L converti à la place.
  const pnlRefDisp=h.pnlRef ?? toRefCcy(pnlProduit,hCur);

  const txs=[...h.transactions].map((tx,idx)=>({tx,idx})).reverse().map(({tx,idx})=>{
    const tot=tx.qty*tx.price;
    const isDiv=tx.type==='DIV';
    const isBuy=tx.type==='BUY';
    const dot=isDiv?'DIV':isBuy?'ACH':'VTE';
    const cls=isDiv?'div':isBuy?'buy':'sell';
    const subLabel=`${tx.qty} × ${fmtNative(tx.price,hCur)}`;
    const valCls=isDiv?'t-gain':isBuy?'t-loss':'t-gain';
    const sign=isDiv?'+':isBuy?'-':'+';
    const typeLabel=isDiv?'Dividende':isBuy?'Achat':'Vente';
    return `<div class="tx-item" data-txidx="${idx}">
      <div class="tx-dot ${cls}">${dot}</div>
      <div class="flex1 col gap4">
        <div style="font-size:13px;font-weight:600">${fmtDate(tx.date)}</div>
        <div class="t-sm">${subLabel}</div>
      </div>
      <div class="col right gap4" style="margin-right:8px">
        <div style="font-size:14px;font-weight:800" class="${valCls} t-num">${sign}${maskedNative(tot,hCur)}</div>
        <div class="t-sm">${typeLabel}</div>
      </div>
      <div class="tx-edit-btn tap" data-txidx="${idx}" title="Modifier">✏️</div>
      <div class="tx-del-btn tap" data-txidx="${idx}" title="Supprimer">🗑</div>
    </div>`;
  }).join('');

  const _isWatched = !!S.watchlist.find(w => w.ticker === h.ticker);
  const _hist = getHistorySeries(h.ticker);
  const _histChip = `<span style="font-size:10px;font-weight:600;white-space:nowrap;color:${_hist?'var(--gain)':'var(--text3)'}" title="${_hist?('Historique réel · '+timeSince(_hist.fetchedAt)):'Courbe estimée — touchez l’icône historique pour récupérer les vrais cours'}">${_hist?'● réel':'○ estimé'}</span>`;
  return `${backBarHTML(esc(acc.name))}
  <div class="stock-hero" style="border-bottom:none;padding-bottom:8px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div>
        <div class="stock-ticker-badge">${esc(h.ticker)}${showProduit?` <span style="font-size:10px;opacity:.7">${hCur}</span>`:''}</div>
        <div style="font-size:19px;font-weight:800;letter-spacing:-.4px">${esc(h.name)}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;margin-top:4px">
        <div id="js-edit-holding" class="tap" style="width:36px;height:36px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text2)" title="Modifier ce titre">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </div>
        <div id="js-watch-toggle" class="tap" style="width:36px;height:36px;border-radius:50%;background:${_isWatched?'rgba(245,158,11,.15)':'var(--card2)'};border:1px solid ${_isWatched?'#F59E0B':'var(--border)'};display:flex;align-items:center;justify-content:center" title="${_isWatched?'Retirer des favoris':'Ajouter aux favoris'}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${_isWatched?'#F59E0B':'none'}" stroke="${_isWatched?'#F59E0B':'var(--text2)'}" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
      <div class="stock-price t-num" style="margin:0">${fmtNative(h.currentPrice,hCur)}</div>
      <div id="js-ticker-refresh" class="tap" style="width:34px;height:34px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text2);flex-shrink:0" title="Actualiser ce titre">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
      </div>
      <div id="js-ticker-history" class="tap" style="width:34px;height:34px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text2);flex-shrink:0" title="Reprendre l’historique réel des cours">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
      </div>
    </div>
    <div class="row gap8" style="margin-top:4px">
      <div class="badge ${pnl>=0?'up':'dn'}">${pnl>=0?'▲':'▼'} ${Math.abs(pnlPct).toFixed(2)}%</div>
      <span class="t-sm">${h.type} · ${h.country} · ${h.sector}</span>
    </div>
  </div>
  <div class="stock-chart-wrap" id="js-stock-chart-wrap" style="padding:8px 0 0">
    ${stockChartSvg(h,chartW,120,S.stockPeriod||'MAX')}
    <div class="stock-chart-tip" id="js-stock-chart-tip"></div>
  </div>
  <div style="display:flex;align-items:center;padding:6px 16px 2px;gap:6px;overflow-x:auto">
    ${['1M','3M','6M','1A','MAX'].map(p=>`<div class="hperiod${(S.stockPeriod||'MAX')===p?' on':''}" data-speriod="${p}">${p}</div>`).join('')}
  </div>
  <div style="display:flex;align-items:center;padding:5px 16px 10px;gap:10px">
    <div style="width:14px;height:0;border-top:2px dashed #2563eb;opacity:.8"></div><span style="font-size:10px;color:var(--text3)">PRU</span>
    <div style="width:10px;height:2px;background:var(--gain);border-radius:1px;opacity:.8"></div><span style="font-size:10px;color:var(--text3)">Achat</span>
    <div style="width:10px;height:2px;background:var(--loss);border-radius:1px;opacity:.8"></div><span style="font-size:10px;color:var(--text3)">Vente</span>
    ${_histChip}
    <div style="flex:1"></div>
    <span style="font-size:10px;color:var(--text3);font-style:italic">Tap pour verrouiller</span>
  </div>
  <div class="metrics">
    <div class="metric"><div class="t-label">Quantité</div><div class="metric-val">${h.quantity}</div></div>
    <div class="metric"><div class="t-label">PRU (${hCur})</div><div class="metric-val t-num">${fmtNative(h.avgBuyPrice,hCur)}</div></div>
    <div class="metric"><div class="t-label">Investi (${hCur})</div><div class="metric-val t-num">${fmt(invested)}</div></div>
    <div class="metric"><div class="t-label">P&amp;L latent (${hCur})</div><div class="metric-val ${pnlProduit>=0?'t-gain':'t-loss'} t-num">${pnlProduit>=0?'+':''}${fmt(pnlProduit)}</div></div>
    <div class="metric"><div class="t-label">Valeur (${hCur})</div><div class="metric-val t-num">${fmt(h.quantity*h.currentPrice)}</div></div>
    <div class="metric"><div class="t-label">P&amp;L latent %</div><div class="metric-val ${pnlPct>=0?'t-gain':'t-loss'} t-num">${fmtPct(pnlPct)}</div></div>
    ${realizedPnL!==0?`<div class="metric"><div class="t-label">P&amp;L réalisé (${hCur})</div><div class="metric-val ${realizedPnL>=0?'t-gain':'t-loss'} t-num">${realizedPnL>=0?'+':''}${maskedNative(realizedPnL,hCur)}</div></div>`:''}
    ${showProduit?`<div class="metric"><div class="t-label">P&amp;L latent (${S.currency})</div><div class="metric-val ${pnlRefDisp>=0?'t-gain':'t-loss'} t-num">${pnlRefDisp>=0?'+':''}${fmtE(pnlRefDisp)}</div></div>`:''}
    ${divTotal>0?`<div class="metric" style="grid-column:1/-1"><div class="t-label">Dividendes perçus (${hCur})</div><div class="metric-val t-gain t-num">+${maskedNative(divTotal,hCur)}</div></div>`:''}
  </div>
  <div class="row" style="padding:4px 20px 10px;justify-content:space-between;align-items:center">
    <div class="t-section">Mouvements</div>
    <div class="row gap8" style="align-items:center">
      <div style="font-size:12px;font-weight:600;color:var(--text2)">${h.transactions.length}</div>
      <div id="js-add-tx" class="tap" style="height:30px;padding:0 12px;border-radius:15px;background:var(--accent-dim);color:var(--accent);font-size:12px;font-weight:700;display:flex;align-items:center">+ Ajouter un mouvement</div>
    </div>
  </div>
  <div id="js-tx-list">${txs}</div>`;
}


SCREEN_BIND.stock = function (el, id) {
    el.querySelector('#js-back')?.addEventListener('click',back);
    el.querySelector('#js-ticker-refresh')?.addEventListener('click', () => {
      const acc = S.accounts.find(a => a.id === S.accountId);
      const h   = acc?.holdings.find(h => h.id === S.holdingId);
      if (h) fetchTickerPrice(h.ticker, S.accountId, S.holdingId);
    });
    el.querySelector('#js-ticker-history')?.addEventListener('click', () => {
      const acc = S.accounts.find(a => a.id === S.accountId);
      const h   = acc?.holdings.find(h => h.id === S.holdingId);
      if (h) fetchTickerHistory(h.ticker, S.accountId, S.holdingId);
    });
    el.querySelector('#js-watch-toggle')?.addEventListener('click', () => {
      const acc = S.accounts.find(a => a.id === S.accountId);
      const h   = acc?.holdings.find(h => h.id === S.holdingId);
      if (!h) return;
      const idx = S.watchlist.findIndex(w => w.ticker === h.ticker);
      haptic(idx >= 0 ? 6 : 12);
      if (idx >= 0) {
        S.watchlist.splice(idx, 1);
        toast(`${h.ticker} retiré des favoris`);
      } else {
        S.watchlist.push({ ticker: h.ticker, name: h.name, price: h.currentPrice, change1d: acc.change1d || 0, currency: h.currency || 'EUR' });
        toast(`${h.ticker} ajouté aux favoris ⭐`);
        const starEl = el.querySelector('#js-watch-toggle');
        if (starEl) { starEl.classList.remove('star-pop'); void starEl.offsetWidth; starEl.classList.add('star-pop'); }
      }
      saveAccounts();
      refreshMain();
      renderScreen('stock');
    });
    // Period selector
    el.querySelectorAll('[data-speriod]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        S.stockPeriod=btn.dataset.speriod;
        const wrap=el.querySelector('#js-stock-chart-wrap');
        const a=S.accounts.find(a=>a.id===S.accountId);
        const hh=a?.holdings.find(h=>h.id===S.holdingId);
        if(!wrap||!hh) return;
        const cw=chartWidth();
        wrap.innerHTML=stockChartSvg(hh,cw,120,S.stockPeriod)+'<div class="stock-chart-tip" id="js-stock-chart-tip"></div>';
        initStockChart(wrap,hh);
        attachChartFs(wrap,'stock');
        el.querySelectorAll('[data-speriod]').forEach(b=>b.classList.toggle('on',b.dataset.speriod===S.stockPeriod));
      });
    });
    // Edit holding button
    el.querySelector('#js-edit-holding')?.addEventListener('click',()=>{
      const a=S.accounts.find(a=>a.id===S.accountId);
      const hh=a?.holdings.find(h=>h.id===S.holdingId);
      if(hh) openEditHolding(S.accountId,S.holdingId);
    });
    // Interactive stock chart with overlays
    const chartWrap=el.querySelector('#js-stock-chart-wrap');
    const acc=S.accounts.find(a=>a.id===S.accountId);
    const h=acc?.holdings.find(h=>h.id===S.holdingId);
    if(chartWrap&&h) { initStockChart(chartWrap,h); attachChartFs(chartWrap,'stock'); }
    el.querySelector('#js-add-tx')?.addEventListener('click',()=>{ if(h) openAddOrder(S.accountId,S.holdingId); });
    // Transaction edit and delete buttons
    el.querySelector('#js-tx-list')?.addEventListener('click',e=>{
      const editBtn=e.target.closest('.tx-edit-btn');
      const delBtn=e.target.closest('.tx-del-btn');
      if(editBtn&&h){
        const idx=parseInt(editBtn.dataset.txidx);
        openEditTx(S.accountId,S.holdingId,idx);
      }
      if(delBtn&&h&&acc){
        const idx=parseInt(delBtn.dataset.txidx);
        const tx=h.transactions[idx];
        const lbl={BUY:'achat',SELL:'vente',DIV:'dividende'}[tx.type]||'mouvement';
        const delErr=txCheckDelete(h.transactions,idx);
        if(delErr){toast(delErr);return;}
        openConfirm(`Supprimer ce ${lbl} du ${fmtDate(tx.date)} ?`,()=>{
          h.transactions.splice(idx,1);
          recalcHolding(h);
          acc.value=accTotal(acc);
          renderScreen('stock');
          refreshMain();
          toast('Mouvement supprimé');
        });
      }
    });
};
