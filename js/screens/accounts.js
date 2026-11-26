// Écran Comptes : liste / grille + binding (cartes, vue, glisser-déposer branché ici).
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre son binding dans SCREEN_BIND (js/core/screens.js, chargé avant).

// ── COMPTES ──
function renderComptes() {
  const w=totalWealth();
  const anim=_skipAccAnim?'':' anim';   // remis à faux en fin de fonction
  const gridView = S.accountsView==='grid' && S.accounts.length>0; // pas de grille pour l'état vide
  const accs=S.accounts.map(a=>{
    const pct=w>0?(a.value/w*100).toFixed(1):'0';
    const totPnl=a.holdings.reduce((s,h)=>s+(h.pnlRef??h.pnl??0),0);
    const totInv=a.holdings.reduce((s,h)=>s+toRefCcy((h.avgBuyPrice||0)*(h.quantity||0),h.currency||'EUR'),0);
    let allTimePct=totInv>0?(totPnl/totInv)*100:0;
    // Même performance que sur l'écran du compte (flux d'apports et de retraits) quand elle est calculable ; sinon P&L des positions
    const flowPct=accPerfPctNow(a);
    if(flowPct!=null) allTimePct=flowPct;
    const up=allTimePct>=0;
    const accCcy=a.currency||S.currency;
    const fxAcc=(FX_RATES[accCcy]||1)/(FX_RATES[S.currency]||1);
    const displayVal=accCcy===S.currency?masked(a.value):maskedNative(a.value*fxAcc,accCcy);
    const obsTag=a.observer?`<div class="obs-tag" style="margin-left:6px">Observateur</div>`:'';
    if(gridView) return `<div class="acc-card acc-card-grid tap${anim}" data-acc="${a.id}" style="${a.observer?'opacity:.72':''}">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div class="acc-icon" style="background:${a.iconBg}">${iconHtml(a.icon)}</div>
        <div class="acc-menu-btn tap" data-menu="${a.id}" title="Actions" style="margin-left:0">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
        </div>
      </div>
      <div style="font-size:14px;font-weight:700;margin-top:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.name)}</div>
      <div class="t-sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${esc(a.type||"")} · ${a.holdings.length} valeur${a.holdings.length!==1?'s':''}${a.bank?' · '+esc(a.bank):''}</div>
      ${obsTag?`<div style="margin-top:6px">${obsTag}</div>`:''}
      <div style="font-size:15px;font-weight:800;margin-top:10px" class="t-num">${displayVal}</div>
      <div style="font-size:12px;font-weight:700;margin-top:2px" class="${up?'t-gain':'t-loss'}">${a.holdings.length?fmtPct(allTimePct):'—'}</div>
      ${!a.observer?`<div class="acc-bar" style="margin-top:12px"><div class="acc-bar-fill" style="width:${pct}%"></div></div>`:''}
    </div>`;
    return `<div class="acc-card${anim}" data-acc="${a.id}" style="${a.observer?'opacity:.72':''}">
      <div class="row gap12">
        <div class="acc-icon tap" data-acc="${a.id}" style="background:${a.iconBg};cursor:pointer">${iconHtml(a.icon)}</div>
        <div class="flex1 col gap4 tap" data-acc="${a.id}" style="min-width:0;cursor:pointer">
          <div class="row" style="flex-wrap:wrap;gap:4px;align-items:center">
            <div style="font-size:15px;font-weight:700">${esc(a.name)}</div>${obsTag}
          </div>
          <div class="t-sm">${esc(a.type||"")} · ${a.holdings.length} valeur${a.holdings.length!==1?'s':''}${a.bank?' · '+esc(a.bank):''}</div>
        </div>
        <div class="col right gap4 tap" data-acc="${a.id}" style="cursor:pointer">
          <div style="font-size:15px;font-weight:800" class="t-num">${displayVal}</div>
          <div style="font-size:12px;font-weight:700" class="${up?'t-gain':'t-loss'}">${a.holdings.length?fmtPct(allTimePct):'—'}</div>
        </div>
        <div class="acc-menu-btn tap" data-menu="${a.id}" title="Actions">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
        </div>
      </div>
      ${!a.observer?`<div class="acc-bar tap" data-acc="${a.id}" style="cursor:pointer"><div class="acc-bar-fill" style="width:${pct}%"></div></div>`:''}
    </div>`;
  }).join('');
  const empty=!S.accounts.length?`<div style="text-align:center;padding:40px 20px;color:var(--text2)">
    <div style="font-size:40px;margin-bottom:12px">🏦</div>
    <div style="font-size:15px;font-weight:600;margin-bottom:6px">Aucun compte</div>
    <div style="font-size:13px">Ajoutez un compte pour commencer</div>
  </div>`:'';
  _skipAccAnim=false;
  return `${renderTopBar(`
    <div class="top-btn tap" id="js-acc-view" title="${gridView?'Vue liste':'Vue grille'}">${gridView?_SVG_VIEW_LIST:_SVG_VIEW_GRID}</div>
    <div class="top-btn tap" id="js-acc-add" title="Ajouter un compte">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
    </div>
  `, navLabel('comptes'))}
  <div class="${gridView?'acc-grid':'col gap12'} px" id="js-acc-list">${accs}${empty}</div>`;
}


function _bindAccCards(el) {
  el.querySelectorAll('[data-acc]').forEach(c=>c.addEventListener('click',e=>{
    if(e.target.closest('[data-menu]')) return;
    if(S.accountId!==c.dataset.acc){S.search='';S.sort='value';S.sortDir=-1;}
    S.accountId=c.dataset.acc; go('account');
  }));
  el.querySelectorAll('[data-menu]').forEach(btn=>btn.addEventListener('click',e=>{
    e.stopPropagation();
    openAccMenu(btn.dataset.menu);
  }));
}


SCREEN_BIND.comptes = function (el, id) {
    _bindAccCards(el);
    // Le glisser-déposer suppose un empilement vertical (voir bindAccDrag) : pas de sens en grille
    if(S.accountsView!=='grid') bindAccDrag(el.querySelector('#js-acc-list'));
    el.querySelector('#js-acc-add')?.addEventListener('click', openAccModal);
    el.querySelector('#js-acc-view')?.addEventListener('click', ()=>{
      S.accountsView = S.accountsView==='grid' ? 'list' : 'grid';
      saveSettings();
      renderScreen('comptes');
    });
    el.querySelector('#js-settings-btn')?.addEventListener('click', ()=>go('settings'));
    el.querySelector('#js-assistant-btn')?.addEventListener('click', ()=>go('assistant'));
};
