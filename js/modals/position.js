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
function openPosModal(accId){
  _posAccId=accId;
  _posYahooSymbol=null;
  ['pos-ticker','pos-name','pos-qty','pos-pru','pos-country'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pos-type').value='Action';
  _applyAssetTypeRules(document.getElementById('pos-type'),S.accounts.find(a=>a.id===accId));
  document.getElementById('pos-currency').value='EUR';
  document.getElementById('pos-sector').value='Technologie';
  document.getElementById('pos-date').value=new Date().toISOString().slice(0,10);
  document.getElementById('pos-ac-list').classList.add('hidden');
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
  tickerInp.addEventListener('input',()=>{
    _posYahooSymbol=null;   // toute frappe manuelle invalide un précédent symbole Yahoo résolu par ISIN
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
      acList.innerHTML=`<div class="ac-item ac-empty" data-isin="${q}">
        <span class="ac-tick">🔍</span>
        <span class="ac-name">Résoudre l'ISIN « ${q} » en ligne</span>
        <span class="ac-sub">ticker + nom + devise auto</span>
      </div>`;
      acList.classList.remove('hidden');
      return;
    }
    const matches=Object.entries(SECURITIES_DB).filter(([k,v])=>
      k.startsWith(q)||v.name.toUpperCase().includes(q)
    ).slice(0,6);
    if(!matches.length){
      const safe=q.replace(/&/g,'&amp;').replace(/</g,'&lt;');
      acList.innerHTML=`<div class="ac-item ac-empty" data-manual="1">
        <span class="ac-tick">🔍</span>
        <span class="ac-name">Rechercher « ${safe} » en ligne</span>
        <span class="ac-sub">nom + devise auto</span>
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
    ).join('');
    acList.classList.remove('hidden');
  });
  acList.addEventListener('click',e=>{
    const item=e.target.closest('.ac-item');
    if(!item) return;
    if(item.dataset.isin){
      acList.classList.add('hidden');
      resolveIsinAndFill(item.dataset.isin);
      document.getElementById('pos-name').focus();
      return;
    }
    if(item.dataset.manual){
      acList.classList.add('hidden');
      resolveAndFill(tickerInp.value.trim().toUpperCase());
      document.getElementById('pos-name').focus();
      return;
    }
    tickerInp.value=item.dataset.ticker;
    fillFromDB(item.dataset.ticker);
  });
  tickerInp.addEventListener('blur',()=>setTimeout(()=>acList.classList.add('hidden'),200));
  tickerInp.addEventListener('change',()=>{
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
  const dateVal=document.getElementById('pos-date').value||new Date().toISOString().slice(0,10);
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
    transactions:[{date:dateVal,type:'BUY',qty,price:pru}],
    value:qty*pru,pnl:0,pnlPct:0,pnlRef:0,valueRef:+toRefCcy(qty*pru,currency).toFixed(2)};
  acc.holdings.push(newH);
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
  if(_ehManual) h.manualPrice=true; else delete h.manualPrice;
  saveAccounts();
  closeEditHolding();
  renderScreen('stock');
  refreshMain();
  toast(`${h.ticker} mis à jour ✓`);
});

// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('pos-modal-sheet', closePosModal);
registerModal('edit-holding-sheet', closeEditHolding);
