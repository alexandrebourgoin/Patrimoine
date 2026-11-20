// Accueil : patrimoine net, brut, dette immobilière et suivi financier.
function wealthBreakdown() {
  const financial = S.accounts.filter(a => !a.observer).reduce((s,a) => s + (+a.value || 0), 0);
  let property = 0, debt = 0, count = 0;
  const today = _dayKey(Date.now());
  if (typeof loadImmo === 'function') loadImmo().forEach(p => {
    if (!p.buyDate || p.buyDate > today || !(p.price > 0)) return;
    const c = immoCalc(p);
    if (!Number.isFinite(c.value) || !Number.isFinite(c.debt)) return;
    property += c.value; debt += c.debt; count++;
  });
  return {financial, property, debt, count, gross:financial + property, net:financial + property - debt};
}
function wealthSummaryHTML(d, dark=false) {
  const row = (label,v) => `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:7px"><span>${label}</span><span class="t-num">${masked(v)}</span></div>`;
  return `<div style="font-size:13px;${dark?'color:rgba(255,255,255,.8)':''}">${row('Patrimoine brut',d.gross)}${row('Crédits immobiliers restants',d.debt)}${row('Dont immobilier brut',d.property)}</div>`;
}
let _wealthIntegrationReady = false;
function installWealthPresentation() {
  if (_wealthIntegrationReady) return;
  _wealthIntegrationReady = true;
  // Ne change pas totalWealth : les snapshots existants et les performances des comptes restent financiers.
  const baseAnalysis = renderAnalysis;
  renderAnalysis = function() {
    const d = wealthBreakdown();
    const html = baseAnalysis();
    const summary = `<section style="margin:12px 20px;padding:16px;border-radius:14px;background:var(--card);border:1px solid var(--border)"><div class="t-label">Patrimoine net</div><div class="t-num" style="font-size:28px;font-weight:800;margin:6px 0">${masked(d.net)}</div>${wealthSummaryHTML(d)}</section>`;
    return summary + html.replace('Patrimoine total','Comptes financiers').replace("comment il est placé aujourd'hui","répartition des comptes financiers");
  };
  // Chaque sauvegarde immobilière invalide les écrans financiers affichés en arrière-plan.
  const baseSave = saveImmo;
  saveImmo = function(properties) { baseSave(properties); refreshMain(); };
}
function renderDash() {
  installWealthPresentation();
  const d = wealthBreakdown();
  const hs = S.accounts.filter(a=>!a.observer).flatMap(a=>a.holdings);
  const pnl = hs.reduce((s,h)=>s+(h.pnlRef??h.pnl??0),0);
  return `<div class="dash-top">${renderTopBar(`<div id="js-privacy-btn" class="top-btn tap" role="button" aria-label="Afficher ou masquer les montants">${S.privacy?'Afficher':'Masquer'}</div>`)}</div>
  <div class="wealth-card anim"><div class="wealth-label">Patrimoine net</div><div class="wealth-amount t-num">${S.privacy?'● ● ●':fmtCur(d.net)}</div>${wealthSummaryHTML(d,true)}<div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:12px">${S.accounts.filter(a=>!a.observer).length} comptes · ${d.count} biens immobiliers</div><div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:8px">P&amp;L des positions financières : ${masked(pnl)}</div>${S.lastPriceUpdate?`<div class="t-sm" style="margin-top:6px">Cours · ${timeSince(S.lastPriceUpdate)}</div>`:''}</div>
  ${renderHistCard()}${renderWatchlistCard()}`;
}
function renderWatchlistCard() {
  if (!S.watchlist.length) return '';
  const mode=S.watchSort||'default';
  const sorted=[...S.watchlist].sort((a,b)=>mode==='perf_desc'?b.change1d-a.change1d:mode==='perf_asc'?a.change1d-b.change1d:0);
  return `<div class="watch-card anim"><div class="watch-head"><div class="t-section">Titres suivis</div><div class="row gap8"><div id="js-watch-sort" class="tap">Trier</div><span>${sorted.length}</span><div id="js-watch-add" class="hold-add-btn tap">+</div></div></div>${sorted.map(w=>{
    const cur=w.currency||SECURITIES_DB[w.ticker]?.currency||'EUR';
    return `<div class="watch-item tap" data-watch="${esc(w.ticker)}"><div class="watch-tick">${esc(w.ticker.slice(0,4))}</div><div class="flex1 col gap4" style="min-width:0"><div style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(w.name)}</div><div class="t-sm">${fmtNative(w.price,cur)}</div></div><div class="badge ${w.change1d>=0?'up':'dn'}">${fmtPct(w.change1d||0)}</div><div class="hold-del-btn tap" data-wdel="${esc(w.ticker)}" style="padding:6px">×</div></div>`;
  }).join('')}</div>`;
}
function renderHistCard() {
  if (!S.accounts.length) return '';
  const pts=genHistData(S.histPeriod);
  const pct=pts[0]?(pts[pts.length-1]/pts[0]-1)*100:null;
  return `<div class="hist-card anim"><div class="hist-head"><div class="t-section">Évolution des comptes financiers</div><div class="hist-periods">${['1S','1M','3M','1A'].map(p=>`<div class="hperiod${p===S.histPeriod?' on':''}" data-period="${p}">${p}</div>`).join('')}</div></div><div class="t-sm" style="padding:0 12px 8px">Hors immobilier · ${pts.real?'historique financier reconstitué':'courbe financière estimée'}</div><div class="hist-wrap" id="js-hist-wrap">${histSvg(pts,Math.min(window.innerWidth,480)-72,80)}<div class="hist-tip"></div></div><div class="hist-range"><span>${masked(pts[0])}</span><span>${pct===null?'—':fmtPct(pct)}</span><span>${masked(pts[pts.length-1])}</span></div></div>`;
}
SCREEN_BIND.dashboard = function(el) {
  el.querySelector('#js-privacy-btn')?.addEventListener('click',togglePrivacy);
  el.querySelectorAll('.hperiod').forEach(p=>p.addEventListener('click',()=>{S.histPeriod=p.dataset.period;renderScreen('dashboard');}));
  const card=el.querySelector('.hist-card');
  if(card) initHistChart(card,genHistData(S.histPeriod));
  attachChartFs(el.querySelector('#js-hist-wrap'),'hist');
  el.querySelector('#js-settings-btn')?.addEventListener('click',()=>go('settings'));
  el.querySelector('#js-assistant-btn')?.addEventListener('click',()=>go('assistant'));
  el.querySelector('#js-watch-add')?.addEventListener('click',openWatchModal);
  el.querySelector('#js-watch-sort')?.addEventListener('click',()=>{const modes=['default','perf_desc','perf_asc'];S.watchSort=modes[(modes.indexOf(S.watchSort||'default')+1)%3];renderScreen('dashboard');});
  el.querySelectorAll('[data-wdel]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const ticker=b.dataset.wdel;openConfirm(`Retirer ${ticker} de la liste de suivi ?`,()=>{S.watchlist=S.watchlist.filter(w=>w.ticker!==ticker);saveAccounts();refreshMain();});}));
  el.querySelectorAll('[data-watch]').forEach(b=>b.addEventListener('click',e=>{if(e.target.closest('[data-wdel]'))return;S.watchTicker=b.dataset.watch;go('watchstock');}));
  clearInterval(el._freshTimer);
};
