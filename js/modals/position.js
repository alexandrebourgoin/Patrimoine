// Modales de position : ajout d un titre (autocomplete ticker/ISIN) et modification d un titre.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

// Grise dans une liste déroulante les types d'actifs interdits sur le compte (règles : js/features/account-rules.js).
// keepValue = true : ne touche pas à la valeur courante (titre déjà présent, qui peut ne plus être conforme).
function _applyAssetTypeRules(selectEl,acc,keepValue){
  const r=assetTypeOptions(acc&&acc.type,[...selectEl.options].map(o=>o.value),selectEl.value,keepValue);
  [...selectEl.options].forEach(o=>{ o.disabled=r.disabled.includes(o.value); });
  selectEl.value=r.value;
}

// ═══════════════════════════════════════════════
// ADD POSITION MODAL
// ═══════════════════════════════════════════════
let _posAccId=null;
let _posYahooSymbol=null;   // symbole Yahoo complet (avec suffixe) si résolu via ISIN, sinon null
// Cotation choisie dans la recherche en ligne (js/features/symbols.js) : { ticker, cand } ; mémorisée pour toute l'app
// à l'enregistrement de la position (symbolSet), avec le cours et l'heure de cotation reçus
let _posPick=null;
function openPosModal(accId){
  _posAccId=accId;
  _posYahooSymbol=null; _posPick=null;
  ['pos-ticker','pos-name','pos-qty','pos-pru','pos-country'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pos-type').value='Action';
  _applyAssetTypeRules(document.getElementById('pos-type'),S.accounts.find(a=>a.id===accId));
  document.getElementById('pos-currency').value='EUR';
  document.getElementById('pos-sector').value='Technologie';
  document.getElementById('pos-date').value=PU.dayKey(Date.now());
  document.getElementById('pos-ac-list').classList.add('hidden');
  document.getElementById('pos-ac-list').classList.remove('ac-wide');
  document.getElementById('pos-modal-bg').classList.add('show');
  document.getElementById('pos-modal-sheet').classList.add('show');
  setTimeout(()=>document.getElementById('pos-ticker').focus(),330);
}
function closePosModal(){
  document.getElementById('pos-modal-bg').classList.remove('show');
  document.getElementById('pos-modal-sheet').classList.remove('show');
  document.getElementById('pos-ac-list').classList.add('hidden');
}

// ── Autocomplete for ticker ──
(function initPosAutocomplete(){
  const tickerInp=document.getElementById('pos-ticker');
  const acList=document.getElementById('pos-ac-list');
  function fillFromDB(ticker){
    const db=SECURITIES_DB[ticker];
    if(!db) return false;
    document.getElementById('pos-name').value=db.name;
    document.getElementById('pos-type').value=db.type;
    document.getElementById('pos-currency').value=db.currency;
    document.getElementById('pos-country').value=db.country;
    document.getElementById('pos-sector').value=db.sector;
    acList.classList.add('hidden');
    return true;
  }
  function fillFromIsinEntry(entry){
    tickerInp.value=entry.ticker;
    if(!fillFromDB(entry.ticker)) document.getElementById('pos-name').value=entry.name;
    toast(`ISIN résolu : ${entry.ticker} ✓`);
  }
  // Titre hors base : résolution en ligne (nom, devise, type) via le proxy
  async function resolveAndFill(tk){
    if(!tk || SECURITIES_DB[tk]) return;
    const info = await resolveTickerOnline(tk);
    if(!info){ toast(`« ${tk} » introuvable en ligne`); return; }
    const nameEl=document.getElementById('pos-name');
    if(!nameEl.value.trim()) nameEl.value=info.name;
    setSelectValue(document.getElementById('pos-currency'), info.currency, info.currency);
    document.getElementById('pos-type').value=info.type;
    toast(`${tk} résolu : ${info.name} (${info.currency}) ✓`);
  }
  // ISIN absent de la base locale : résolution en ligne (ticker, nom, devise, type) via le proxy
  async function resolveIsinAndFill(isin){
    const info = await resolveIsinOnline(isin);
    if(!info){ toast(`ISIN « ${isin} » introuvable en ligne`); return; }
    tickerInp.value=info.ticker;
    _posYahooSymbol=info.yahooSymbol||null;   // suffixe Yahoo (ex. .PA) mémorisé à part, jamais affiché
    const nameEl=document.getElementById('pos-name');
    if(!nameEl.value.trim()) nameEl.value=info.name;
    setSelectValue(document.getElementById('pos-currency'), info.currency, info.currency);
    document.getElementById('pos-type').value=info.type;
    toast(`ISIN résolu : ${info.ticker} (${info.name}) ✓`);
  }
  // Recherche en ligne (bourse + cryptos) : les cotations s'affichent dans la liste ; un toucher remplit la fiche
  let _acCands=[], _acBusy=false;
  async function searchOnline(q){
    _acBusy=true;
    acList.classList.add('ac-wide');
    acList.innerHTML=`<div class="ac-item ac-empty"><span class="ac-tick">…</span><span class="ac-name">Recherche de « ${esc(q)} »…</span></div>`;
    acList.classList.remove('hidden');
    try{
      _acCands=await symbolSearchAll(q);
      if(tickerInp.value.trim().toUpperCase()!==q && !_acBusy) return;
      acList.innerHTML=_acCands.length ? _acCands.map((c,i)=>`<div class="ac-item ac-cand" data-cand="${i}">
          <span class="ac-tick">${esc(c.ticker.slice(0,6))}</span>
          <span class="ac-name">${esc(c.name)}<span class="ac-place">${esc([c.kind==='yahoo'?c.id:'',c.place,c.currency].filter(Boolean).join(' · '))}</span></span>
          <span class="ac-sub">${c.price!=null?esc(fmtNative(c.price,c.currency||'EUR')):''}</span>
        </div>`).join('')
        : `<div class="ac-item ac-empty"><span class="ac-tick">∅</span><span class="ac-name">Rien trouvé : essayez le nom ou l'ISIN, ou saisissez la position à la main</span></div>`;
    }catch(e){
      acList.innerHTML=`<div class="ac-item ac-empty"><span class="ac-tick">!</span><span class="ac-name">${esc(e.message||'Recherche impossible')}</span></div>`;
    }finally{ _acBusy=false; }
  }
  function pickCandidate(c){
    tickerInp.value=c.ticker;
    _posYahooSymbol=null;
    _posPick={ticker:c.ticker,cand:c};
    document.getElementById('pos-name').value=c.name.replace(/ \([A-Z0-9]+\)$/,'');
    if(c.currency) setSelectValue(document.getElementById('pos-currency'), c.currency, c.currency);
    document.getElementById('pos-type').value=c.type;
    acList.classList.add('hidden');
    toast(`${c.ticker} : cotation ${c.kind==='cg'?'CoinGecko':c.id} retenue ✓`);
  }
  tickerInp.addEventListener('input',()=>{
    acList.classList.remove('ac-wide');
    _posYahooSymbol=null;   // toute frappe manuelle invalide un précédent symbole Yahoo résolu par ISIN
    _posPick=null;
    const q=tickerInp.value.trim().toUpperCase();
    if(!q){acList.classList.add('hidden');return;}
    // ISIN detection: 12 chars, 2 letters + 10 alphanumeric
    if(/^[A-Z]{2}[A-Z0-9]{10}$/.test(q)){
      const entry=ISIN_MAP[q];
      if(entry){
        fillFromIsinEntry(entry);
        acList.classList.add('hidden');
        return;
      }
      // ISIN absent de la base locale → proposer une résolution en ligne (recherche Yahoo)
      acList.innerHTML=`<div class="ac-item ac-empty" data-search="${q}">
        <span class="ac-tick">🔍</span>
        <span class="ac-name">Chercher l'ISIN « ${q} » en ligne</span>
        <span class="ac-sub">places, devises, cours</span>
      </div>`;
      acList.classList.remove('hidden');
      return;
    }
    const matches=Object.entries(SECURITIES_DB).filter(([k,v])=>
      k.startsWith(q)||v.name.toUpperCase().includes(q)
    ).slice(0,6);
    if(!matches.length){
      const safe=q.replace(/&/g,'&amp;').replace(/</g,'&lt;');
      acList.innerHTML=`<div class="ac-item ac-empty" data-search="${safe}">
        <span class="ac-tick">🔍</span>
        <span class="ac-name">Chercher « ${safe} » en ligne</span>
        <span class="ac-sub">bourse et cryptos</span>
      </div>`;
      acList.classList.remove('hidden');
      return;
    }
    acList.innerHTML=matches.map(([ticker,db])=>
      `<div class="ac-item" data-ticker="${ticker}">
        <span class="ac-tick">${ticker}</span>
        <span class="ac-name">${db.name}</span>
        <span class="ac-sub">${db.type} · ${db.currency}</span>
      </div>`
    ).join('')+`<div class="ac-item ac-empty" data-search="${q.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}">
        <span class="ac-tick">🔍</span><span class="ac-name">Autre cotation : chercher en ligne</span><span class="ac-sub">bourse et cryptos</span></div>`;
    acList.classList.remove('hidden');
  });
  acList.addEventListener('click',e=>{
    const item=e.target.closest('.ac-item');
    if(!item) return;
    if(item.dataset.search){ searchOnline(item.dataset.search); return; }
    if(item.dataset.cand){ const c=_acCands[+item.dataset.cand]; if(c) pickCandidate(c); return; }
    if(!item.dataset.ticker) return;
    tickerInp.value=item.dataset.ticker;
    fillFromDB(item.dataset.ticker);
  });
  // La liste reste ouverte pendant une recherche ou quand elle montre des cotations à choisir
  tickerInp.addEventListener('blur',()=>setTimeout(()=>{ if(!_acBusy && !acList.querySelector('.ac-cand')) acList.classList.add('hidden'); },200));
  tickerInp.addEventListener('change',()=>{
    // Cotation choisie, recherche en cours, ou liste encore ouverte (l'utilisateur la touche) : pas de résolution automatique
    if(_posPick || _acBusy || !acList.classList.contains('hidden')) return;
    const tk=tickerInp.value.trim().toUpperCase();
    if(/^[A-Z]{2}[A-Z0-9]{10}$/.test(tk)){
      const entry=ISIN_MAP[tk];
      if(entry) fillFromIsinEntry(entry); else resolveIsinAndFill(tk);
      return;
    }
    if(!fillFromDB(tk)) resolveAndFill(tk);
  });
})();

document.getElementById('pos-modal-bg').addEventListener('click',closePosModal);
document.getElementById('pos-modal-close').addEventListener('click',closePosModal);
document.getElementById('pos-submit').addEventListener('click',()=>{
  const ticker=document.getElementById('pos-ticker').value.trim().toUpperCase();
  const name=document.getElementById('pos-name').value.trim()||ticker;
  const qty=parseFloat(document.getElementById('pos-qty').value);
  const pru=parseFloat(document.getElementById('pos-pru').value);
  const country=document.getElementById('pos-country').value.trim()||'Inconnu';
  const sector=document.getElementById('pos-sector').value||'Autre';
  const type=document.getElementById('pos-type').value;
  const currency=document.getElementById('pos-currency').value;
  const dateVal=document.getElementById('pos-date').value||PU.dayKey(Date.now());
  if(!ticker||!(qty>0)||!(pru>0)){toast('Ticker, quantité et PRU requis');return;}
  const acc=S.accounts.find(a=>a.id===_posAccId);
  if(!acc) return;
  // Un titre résolu en ligne peut imposer son type : la règle du compte est revérifiée à l'enregistrement
  const typeErr=assetTypeError(acc,type,country);
  if(typeErr){toast(typeErr);return;}
  if(acc.holdings.find(h=>h.ticker===ticker)){toast('Ce ticker existe déjà dans ce compte');return;}
  const hid=ticker+'_'+Date.now().toString(36);
  const newH={id:hid,ticker,name,quantity:qty,avgBuyPrice:pru,currentPrice:pru,
    type,country,sector,currency,
    ...(_posYahooSymbol && _posYahooSymbol!==ticker ? {yahooSymbol:_posYahooSymbol} : {}),
    ...(_posPick && _posPick.ticker===ticker && _posPick.cand.price>0 ? {currentPrice:_posPick.cand.price, priceAt:Date.now(), ...(_posPick.cand.quoteAt?{quoteAt:_posPick.cand.quoteAt}:{})} : {}),
    transactions:[{date:dateVal,type:'BUY',qty,price:pru}],
    value:qty*pru,pnl:0,pnlPct:0,pnlRef:0,valueRef:+toRefCcy(qty*pru,currency).toFixed(2)};
  // Cotation choisie en ligne : mémorisée pour toute l'app (toutes les positions de ce ticker, suivi, historiques)
  if(_posPick && _posPick.ticker===ticker) symbolSet(ticker, symbolEntry(_posPick.cand));
  acc.holdings.push(newH);
  recalcHolding(newH);
  acc.value=accTotal(acc);
  closePosModal();
  if(S.screen==='account'&&S.accountId===_posAccId) renderHoldsHTML(acc);
  refreshMain();
  toast(`${ticker} ajouté ✓`);
});


// ═══════════════════════════════════════════════
// EDIT HOLDING
// ═══════════════════════════════════════════════
let _ehAccId=null,_ehHoldId=null,_ehManual=false;
function openEditHolding(accId,holdId){
  _ehAccId=accId; _ehHoldId=holdId;
  const acc=S.accounts.find(a=>a.id===accId);
  const h=acc?.holdings.find(h=>h.id===holdId); if(!h) return;
  document.getElementById('eh-ticker').value=h.ticker;
  document.getElementById('eh-name').value=h.name||'';
  document.getElementById('eh-type').value=h.type||'Action';
  _applyAssetTypeRules(document.getElementById('eh-type'),acc,true);   // types interdits grisés, valeur actuelle conservée
  document.getElementById('eh-currency').value=h.currency||'EUR';
  document.getElementById('eh-country').value=h.country||'';
  document.getElementById('eh-sector').value=h.sector||'Autre';
  document.getElementById('eh-price').value=h.currentPrice||'';
  _ehManual=h.manualPrice===true;
  document.getElementById('eh-manual-tog').classList.toggle('on',_ehManual);
  document.getElementById('edit-holding-bg').classList.add('show');
  document.getElementById('edit-holding-sheet').classList.add('show');
}
function closeEditHolding(){
  document.getElementById('edit-holding-bg').classList.remove('show');
  document.getElementById('edit-holding-sheet').classList.remove('show');
  _ehAccId=null; _ehHoldId=null;
}
document.getElementById('edit-holding-bg').addEventListener('click',closeEditHolding);
document.getElementById('edit-holding-close').addEventListener('click',closeEditHolding);
// Supprimer la position (avec confirmation) : l'action a quitté les lignes de l'écran Compte pour la fiche du titre
document.getElementById('eh-delete').addEventListener('click',()=>{
  const accId=_ehAccId, holdId=_ehHoldId;
  closeEditHolding();
  deleteHolding(accId,holdId);
});
document.getElementById('eh-manual-tog').addEventListener('click',()=>{
  _ehManual=!_ehManual;
  document.getElementById('eh-manual-tog').classList.toggle('on',_ehManual);
});
document.getElementById('eh-submit').addEventListener('click',()=>{
  const acc=S.accounts.find(a=>a.id===_ehAccId);
  const h=acc?.holdings.find(h=>h.id===_ehHoldId); if(!h) return;
  const newTicker=document.getElementById('eh-ticker').value.trim().toUpperCase();
  if(!newTicker){toast('Ticker requis');return;}
  // Une modification de type ou de pays n'est refusée que si elle crée une combinaison interdite ; un titre déjà non conforme reste modifiable
  const newType=document.getElementById('eh-type').value;
  const newCountry=document.getElementById('eh-country').value.trim()||h.country;
  if(newType!==h.type||newCountry!==h.country){
    const typeErr=assetTypeError(acc,newType,newCountry);
    if(typeErr){toast(typeErr);return;}
  }
  if(newTicker!==h.ticker){
    if(acc.holdings.find(o=>o.id!==h.id&&o.ticker===newTicker)){toast('Ce ticker existe déjà dans ce compte');return;}
    h.ticker=newTicker;
    delete h.yahooSymbol; // le suffixe Yahoo mémorisé référait à l'ancien ticker
  }
  const newName=document.getElementById('eh-name').value.trim();
  if(newName) h.name=newName;
  h.type=newType;
  h.currency=document.getElementById('eh-currency').value;
  h.country=newCountry;
  h.sector=document.getElementById('eh-sector').value;
  const newPrice=parseFloat(document.getElementById('eh-price').value);
  if(newPrice>0){
    h.currentPrice=newPrice;
    recalcHolding(h);
    acc.value=accTotal(acc);
  }
  // Cours saisi à la main : protégé de l'actualisation et exclu de « Non synchro » (js/services/prices.js)
  // Date de saisie : à chaque nouveau cours, ou au passage en « saisi à la main » (rappel au-delà d'un mois : js/features/symbols.js)
  if(_ehManual){ if(newPrice>0 || h.manualPrice!==true || !h.manualAt) h.manualAt=Date.now(); h.manualPrice=true; }
  else { delete h.manualPrice; delete h.manualAt; }
  saveAccounts();
  closeEditHolding();
  renderScreen('stock');
  refreshMain();
  toast(`${h.ticker} mis à jour ✓`);
});

// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('pos-modal-sheet', closePosModal);
registerModal('edit-holding-sheet', closeEditHolding);
