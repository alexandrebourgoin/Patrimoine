// Modales d ordres : modification d une transaction et ajout d un ordre (achat / vente / dividende).
// + écran « Ordres » en deux parties sur une seule page : ordres limites en cours (haut) puis alertes de prix (bas), séparés par un trait.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

// ═══════════════════════════════════════════════
// CONTRÔLE DES VENTES : on ne peut pas vendre plus que ce qu'on détient
// ═══════════════════════════════════════════════
// Vrai si, en rejouant les mouvements dans l'ordre chronologique (achats avant ventes à date égale),
// la quantité détenue devient négative à un moment.
function _sellsExceedHoldings(txs){
  const rank={BUY:0,SELL:1};
  const seq=txs.map((t,i)=>({t,i})).sort((a,b)=>
    (a.t.date<b.t.date?-1:a.t.date>b.t.date?1:0) ||
    ((rank[a.t.type]??2)-(rank[b.t.type]??2)) || (a.i-b.i));
  let q=0;
  for(const {t} of seq){
    if(t.type==='BUY') q+=t.qty;
    else if(t.type==='SELL'){ q-=t.qty; if(q<-1e-9) return true; }
  }
  return false;
}
// Quantité calculée depuis les mouvements (tous achats − toutes ventes).
function _heldQty(txs){
  return txs.reduce((q,t)=>t.type==='BUY'?q+t.qty:t.type==='SELL'?q-t.qty:q,0);
}
// Quantité détenue d'une position : champ `quantity` (tenu à jour par recalcHolding), sinon calcul sur les mouvements.
function _holdingQty(h){
  return typeof h.quantity==='number' ? h.quantity : _heldQty(h.transactions||[]);
}
function _fmtQty(q){ return (Math.round(q*1e6)/1e6).toString(); }

// ═══════════════════════════════════════════════
// EDIT TRANSACTION MODAL
// ═══════════════════════════════════════════════
let _editTxAccId=null, _editTxHoldId=null, _editTxIdx=null, _editTxType='BUY';

function openEditTx(accId, holdId, idx){
  _editTxAccId=accId; _editTxHoldId=holdId; _editTxIdx=idx;
  const acc=S.accounts.find(a=>a.id===accId);
  const h=acc?.holdings.find(h=>h.id===holdId);
  if(!h||idx<0||idx>=h.transactions.length) return;
  const tx=h.transactions[idx];
  _editTxType=tx.type;
  document.querySelectorAll('#edit-type-btns .type-btn').forEach(b=>{
    b.classList.toggle('on',b.dataset.etype===tx.type);
  });
  document.getElementById('edit-tx-qty').value=tx.qty;
  document.getElementById('edit-tx-price').value=tx.price;
  document.getElementById('edit-tx-date').value=tx.date;
  document.getElementById('edit-tx-bg').classList.add('show');
  document.getElementById('edit-tx-sheet').classList.add('show');
}
function closeEditTx(){
  document.getElementById('edit-tx-bg').classList.remove('show');
  document.getElementById('edit-tx-sheet').classList.remove('show');
}
document.getElementById('edit-tx-bg').addEventListener('click',closeEditTx);
document.getElementById('edit-tx-close').addEventListener('click',closeEditTx);
document.querySelectorAll('#edit-type-btns .type-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#edit-type-btns .type-btn').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  _editTxType=b.dataset.etype;
}));
document.getElementById('edit-tx-submit').addEventListener('click',()=>{
  const qty=parseFloat(document.getElementById('edit-tx-qty').value);
  const price=parseFloat(document.getElementById('edit-tx-price').value);
  const date=document.getElementById('edit-tx-date').value;
  if(!(qty>0)||!(price>0)||!date){toast('Quantité, prix et date requis');return;}
  const acc=S.accounts.find(a=>a.id===_editTxAccId);
  const h=acc?.holdings.find(h=>h.id===_editTxHoldId);
  if(!h){toast('Position introuvable');return;}
  // Refuse une modification qui rendrait la quantité négative à une date (sauf si l'historique l'était déjà)
  const next=h.transactions.map((t,i)=>i===_editTxIdx?{date,type:_editTxType,qty,price}:t);
  if(_sellsExceedHoldings(next)&&!_sellsExceedHoldings(h.transactions)){
    toast('Modification impossible : les ventes dépasseraient la quantité détenue');return;
  }
  h.transactions[_editTxIdx]={date,type:_editTxType,qty,price};
  recalcHolding(h);
  acc.value=accTotal(acc);
  closeEditTx();
  renderScreen('stock');
  refreshMain();
  toast('Mouvement modifié ✓');
});


// ═══════════════════════════════════════════════
// ADD ORDER MODAL
// ═══════════════════════════════════════════════
let _mAccId=null, _mHoldId=null, _mType='BUY';

function openAddOrder(accId, holdId) {
  _mAccId=accId; _mHoldId=holdId; _mType='BUY';
  const acc=S.accounts.find(a=>a.id===accId);
  const h=acc?.holdings.find(h=>h.id===holdId);
  if(!h) return;
  document.getElementById('modal-ticker').textContent=h.ticker;
  document.getElementById('modal-name').textContent=h.name;
  document.getElementById('modal-qty').value='';
  document.getElementById('modal-price').value=h.currentPrice.toFixed(2);
  document.getElementById('modal-date').value=new Date().toISOString().slice(0,10);
  document.querySelectorAll('.type-btn').forEach(b=>b.classList.toggle('on',b.dataset.type==='BUY'));
  document.getElementById('modal-bg').classList.add('show');
  document.getElementById('modal-sheet').classList.add('show');
  setTimeout(()=>document.getElementById('modal-qty').focus(),330);
}

function closeModal() {
  document.getElementById('modal-bg').classList.remove('show');
  document.getElementById('modal-sheet').classList.remove('show');
}

document.getElementById('modal-bg').addEventListener('click', closeModal);
document.getElementById('modal-close').addEventListener('click', closeModal);

document.querySelectorAll('.type-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.type-btn').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  _mType=b.dataset.type;
  const qtyLabel=document.querySelector('#modal-qty').closest('.form-field').querySelector('.form-label');
  qtyLabel.textContent=_mType==='DIV'?'Nb actions':'Quantité';
  const priceLabel=document.querySelector('#modal-price').closest('.form-field').querySelector('.form-label');
  priceLabel.textContent=_mType==='DIV'?'Dividende/action':'Prix unitaire';
}));

document.getElementById('modal-submit').addEventListener('click',()=>{
  const qty=parseFloat(document.getElementById('modal-qty').value);
  const price=parseFloat(document.getElementById('modal-price').value);
  const date=document.getElementById('modal-date').value||new Date().toISOString().slice(0,10);
  if(!(qty>0)||!(price>0)){toast('Quantité et prix requis');return;}
  const acc=S.accounts.find(a=>a.id===_mAccId);
  const h=acc?.holdings.find(h=>h.id===_mHoldId);
  if(!h){toast('Position introuvable');return;}
  // Une vente ne peut pas dépasser la quantité détenue (ni à la date saisie, ni aujourd'hui)
  if(_mType==='SELL'){
    const held=_holdingQty(h);
    if(qty>held+1e-9){
      toast('Vente impossible : vous ne détenez que '+_fmtQty(Math.max(held,0))+' titre(s)');return;
    }
    if(h.transactions.length && _sellsExceedHoldings([...h.transactions,{date,type:_mType,qty,price}])){
      toast('Vente impossible à cette date : quantité détenue insuffisante');return;
    }
  }
  h.transactions.push({date,type:_mType,qty,price});
  // recalcHolding recompute tout (dont valueRef/pnlRef, que le calcul manuel oubliait :
  // accSum lit valueRef → patrimoine faux jusqu'au prochain fetch), comme edit-tx-submit
  recalcHolding(h);
  acc.value=accTotal(acc);
  closeModal();
  const accEl=document.getElementById('s-account');
  const holdsEl=accEl?.querySelector('#js-holds');
  if(holdsEl) renderHoldsHTML(acc);
  // Saisie depuis la fiche d'un titre : rafraîchir cette fiche (mouvements, quantité, PRU)
  if(S.screen==='stock') renderScreen('stock');
  refreshMain();
  const lbl={BUY:'Achat',SELL:'Vente',DIV:'Dividende'}[_mType];
  toast(`${lbl} enregistré ✓`);
});


// ═══════════════════════════════════════════════
// ORDRES LIMITES — suivi manuel (aucun mouvement n'est créé automatiquement)
// Stockés à part (clé patrimoine-orders) : [{id, accId, holdId, type:'BUY'|'SELL', qty, limit, createdAt, updatedAt?}]
// À la réouverture de l'appli, l'utilisateur confirme l'exécution : le mouvement est alors ajouté au compte.
// Un ordre en attente peut être modifié (compte, titre, sens, quantité, prix limite) ou annulé.
// ═══════════════════════════════════════════════
const STORE_ORDERS='patrimoine-orders';
function loadOrders(){
  try{ const a=JSON.parse(localStorage.getItem(STORE_ORDERS)||'[]'); return Array.isArray(a)?a:[]; }
  catch(e){ return []; }
}
function saveOrders(a){ try{ localStorage.setItem(STORE_ORDERS,JSON.stringify(a)); }catch(e){} }
function _ordLookup(o){
  const acc=S.accounts.find(a=>a.id===o.accId);
  const h=acc?acc.holdings.find(x=>x.id===o.holdId):null;
  return (acc&&h)?{acc,h}:null;
}
// Le cours a-t-il pu toucher le prix limite ? Indicatif : cours actuel + clôtures quotidiennes depuis la création
// (les plus haut/bas intraday ne sont pas connus).
function _ordHint(o,h){
  const buy=o.type==='BUY', cp=h.currentPrice, ok=p=>buy?p<=o.limit:p>=o.limit;
  if(cp>0&&ok(cp)) return {hit:true,html:`Le cours actuel (${maskedNative(cp,h.currency)}) a atteint ton prix limite : l'ordre a probablement été exécuté.`};
  const ser=getHistorySeries(h.ticker);
  if(ser){
    const since=_dayKey(o.createdAt);
    const pts=ser.series.filter(p=>p.d>=since&&ok(p.c));
    if(pts.length){
      const p=pts[pts.length-1];
      return {hit:true,html:`Clôture du ${fmtDate(p.d)} à ${maskedNative(p.c,ser.currency||h.currency)} : le prix limite a pu être atteint.`};
    }
  }
  return {hit:false,html:''};
}
function _ordRow(k,v){
  return `<div style='display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--border);font-size:14px'><span style='color:var(--text2)'>${k}</span><span style='font-weight:600;text-align:right'>${v}</span></div>`;
}

// Écran « Ordres » : en haut les ordres limites en cours, un séparateur, puis en bas les alertes de prix — tout sur la même page.
function renderOrders(){
  const rows=loadOrders().map(o=>({o,r:_ordLookup(o)})).filter(x=>x.r);
  const cards=rows.map(({o,r})=>{
    const {acc,h}=r, buy=o.type==='BUY', hint=_ordHint(o,h);
    const col=buy?'var(--gain)':'var(--loss)';
    return `<div style='background:var(--card2);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:10px'>
      <div style='display:flex;justify-content:space-between;align-items:center;gap:8px'>
        <div style='font-weight:800;font-size:15px'>${esc(h.ticker)} <span style='color:${col};font-size:12px;font-weight:700'>${buy?'Achat limite':'Vente limite'}</span></div>
        <div class='t-sm'>${esc(new Date(o.createdAt).toLocaleDateString('fr-FR'))}</div>
      </div>
      <div class='t-sm' style='margin-top:2px'>${esc(acc.icon||'')} ${esc(acc.name)}</div>
      <div style='margin-top:8px;font-size:14px'>${_fmtQty(o.qty)} × ${maskedNative(o.limit,h.currency)} = <b>${maskedNative(o.qty*o.limit,h.currency)}</b></div>
      <div class='t-sm' style='margin-top:2px'>Cours actuel : ${maskedNative(h.currentPrice,h.currency)}</div>
      ${hint.hit?`<div style='margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.12);color:#F59E0B;font-size:12px;font-weight:600'>⚠ ${hint.html}</div>`:''}
      <div style='display:flex;gap:8px;margin-top:12px'>
        <button class='form-submit' data-oexec='${esc(o.id)}' style='margin:0;flex:2;height:42px'>Exécuté ✓</button>
        <button class='confirm-cancel' data-oedit='${esc(o.id)}' style='flex:1;height:42px;border-radius:12px;font-weight:700;cursor:pointer'>Modifier</button>
        <button class='confirm-cancel' data-ocancel='${esc(o.id)}' style='flex:1;height:42px;border-radius:12px;font-weight:700;cursor:pointer'>Annuler</button>
      </div>
    </div>`;
  }).join('');
  const alerts=loadAlerts().map(a=>({a,q:_altQuote(a.ticker),hit:alertHit(a)})).sort((x,y)=>(y.hit-x.hit)||(x.a.createdAt-y.a.createdAt));
  const nHit=alerts.filter(x=>x.hit).length;
  const altCards=alerts.map(({a,q,hit})=>{
    const ccy=q?q.ccy:'EUR', above=a.dir==='above';
    return `<div style='background:var(--card2);border:1px solid ${hit?'#F59E0B':'var(--border)'};border-radius:var(--r);padding:14px;margin-bottom:10px'>
      <div style='display:flex;justify-content:space-between;align-items:center;gap:8px'>
        <div style='font-weight:800;font-size:15px'>${esc(a.ticker)} <span style='font-size:12px;font-weight:600;color:var(--text2)'>${esc(a.name||'')}</span></div>
        <span style='font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;${hit?'background:rgba(245,158,11,.15);color:#F59E0B':'background:var(--card);color:var(--text2)'}'>${hit?'Déclenchée':'En attente'}</span>
      </div>
      <div style='margin-top:8px;font-size:14px'>Cours ${above?'≥':'≤'} <b>${maskedNative(a.price,ccy)}</b></div>
      <div class='t-sm' style='margin-top:2px'>${q?'Cours actuel : '+maskedNative(q.p,q.ccy):'Cours actuel inconnu (titre absent des comptes et du suivi)'}</div>
      <div style='margin-top:10px'><button class='confirm-cancel' data-adel='${esc(a.id)}' style='height:38px;padding:0 18px;border-radius:12px;font-weight:700;cursor:pointer'>Supprimer</button></div>
    </div>`;
  }).join('');
  return `${renderTopBar()}
  <div style='padding:4px 16px 110px'>
    <div style='font-size:20px;font-weight:800;margin:6px 0 16px'>Ordres et alertes</div>

    <div style='font-size:15px;font-weight:800;margin-bottom:2px'>Ordres en cours <span class='t-sm' style='font-weight:600'>(${rows.length})</span></div>
    <div class='t-sm' style='margin-bottom:10px'>Ordres limites passés chez ton courtier. Confirme l'exécution ici pour ajouter le mouvement au compte.</div>
    <button class='form-submit' data-onew='1' style='margin:0 0 12px'>+ Nouvel ordre limite</button>
    ${cards||`<div class='t-sm' style='text-align:center;padding:16px 0'>Aucun ordre en cours.</div>`}

    <div style='height:1px;background:var(--border);margin:24px 0 18px'></div>

    <div style='font-size:15px;font-weight:800;margin-bottom:2px'>Alertes de prix <span class='t-sm' style='font-weight:600'>(${alerts.length}${nHit?` · ${nHit} déclenchée${nHit>1?'s':''}`:''})</span></div>
    <div class='t-sm' style='margin-bottom:10px'>Vérifiées à l'ouverture et à chaque actualisation des cours (pas quand l'appli est fermée). Le compteur de la barre du bas additionne les ordres en cours et les alertes déclenchées.</div>
    <button class='form-submit' data-anew='1' style='margin:0 0 12px'>+ Nouvelle alerte</button>
    ${altCards||`<div class='t-sm' style='text-align:center;padding:16px 0'>Aucune alerte.</div>`}
  </div>`;
}
function bindOrders(el){
  el.onclick=e=>{
    if(e.target.closest('[data-onew]')){ openOrdNew(); return; }
    if(e.target.closest('[data-anew]')){ openAltNew(); return; }
    const ex=e.target.closest('[data-oexec]');
    if(ex){ openOrdExec(ex.dataset.oexec); return; }
    const ed=e.target.closest('[data-oedit]');
    if(ed){ openOrdNew(ed.dataset.oedit); return; }
    const ca=e.target.closest('[data-ocancel]');
    if(ca){
      saveOrders(loadOrders().filter(o=>o.id!==ca.dataset.ocancel));
      renderScreen('orders');
      toast('Ordre annulé');
      return;
    }
    const ad=e.target.closest('[data-adel]');
    if(ad){
      saveAlerts(loadAlerts().filter(a=>a.id!==ad.dataset.adel));
      renderScreen('orders');
      toast('Alerte supprimée');
    }
  };
}
// Compatibilité : l'ancien écran « Alertes » est fusionné dans « Ordres »
function renderAlerts(){ return renderOrders(); }
function bindAlerts(el){ bindOrders(el); }

// Écran + feuilles créés ici (le HTML n'a pas à les déclarer)
(function(){
  const ref=document.getElementById('s-dca');
  if(ref && !document.getElementById('s-orders')){
    const d=document.createElement('div');
    d.id='s-orders'; d.className='screen no-nav';
    ref.insertAdjacentElement('afterend',d);
  }
  if(ref && !document.getElementById('s-alerts')){
    const d=document.createElement('div');
    d.id='s-alerts'; d.className='screen no-nav';
    ref.insertAdjacentElement('afterend',d);
  }
  const closeBtn=`width:32px;height:32px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:16px;flex-shrink:0`;
  document.body.insertAdjacentHTML('beforeend',`
<div id='ord-bg' class='add-modal-bg'></div>
<div id='ord-sheet' class='add-modal-sheet'>
  <div class='modal-drag'></div>
  <div class='modal-body'>
    <div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:16px'>
      <div class='modal-title' id='ord-title' style='margin-bottom:0'>Nouvel ordre limite</div>
      <div id='ord-close' style='${closeBtn}'>✕</div>
    </div>
    <div class='form-row'><div class='form-field'><div class='form-label'>Compte</div><select class='form-input' id='ord-acc' style='cursor:pointer'></select></div></div>
    <div class='form-row'><div class='form-field'><div class='form-label'>Titre</div><select class='form-input' id='ord-hold' style='cursor:pointer'></select></div></div>
    <div class='type-btns' id='ord-type-btns'>
      <div class='type-btn buy on' data-otype='BUY'>Achat</div>
      <div class='type-btn sell' data-otype='SELL'>Vente</div>
    </div>
    <div class='form-row'>
      <div class='form-field'><div class='form-label'>Quantité</div><input class='form-input' type='number' id='ord-qty' min='0.0000001' step='any' placeholder='0' inputmode='decimal'></div>
      <div class='form-field'><div class='form-label'>Prix limite</div><input class='form-input' type='number' id='ord-limit' min='0' step='any' placeholder='0.00' inputmode='decimal'></div>
    </div>
    <button class='form-submit' id='ord-submit'>Enregistrer l'ordre</button>
  </div>
</div>
<div id='oexec-bg' class='add-modal-bg'></div>
<div id='oexec-sheet' class='add-modal-sheet' style='max-height:92vh;overflow-y:auto'>
  <div class='modal-drag'></div>
  <div class='modal-body' id='oexec-body'></div>
</div>
<div id='alt-bg' class='add-modal-bg'></div>
<div id='alt-sheet' class='add-modal-sheet'>
  <div class='modal-drag'></div>
  <div class='modal-body'>
    <div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:16px'>
      <div class='modal-title' style='margin-bottom:0'>Nouvelle alerte de prix</div>
      <div id='alt-close' style='${closeBtn}'>✕</div>
    </div>
    <div class='form-row'><div class='form-field'><div class='form-label'>Titre</div><select class='form-input' id='alt-tick' style='cursor:pointer'></select></div></div>
    <div class='type-btns' id='alt-dir-btns'>
      <div class='type-btn buy on' data-adir='above'>Au-dessus de</div>
      <div class='type-btn sell' data-adir='below'>En dessous de</div>
    </div>
    <div class='form-row'><div class='form-field'><div class='form-label'>Prix (devise du titre)</div><input class='form-input' type='number' id='alt-price' min='0' step='any' placeholder='0.00' inputmode='decimal'></div></div>
    <button class='form-submit' id='alt-submit'>Enregistrer l'alerte</button>
  </div>
</div>`);
})();

// ── Nouvel ordre limite / modification d'un ordre ──
let _ordType='BUY', _ordEditId=null;
function _ordFillHoldings(){
  const acc=S.accounts.find(a=>String(a.id)===document.getElementById('ord-acc').value);
  const hs=(acc?acc.holdings:[]).filter(h=>h.type!=='Cash');
  document.getElementById('ord-hold').innerHTML=hs.map(h=>`<option value='${esc(String(h.id))}'>${esc(h.ticker)} — ${esc(h.name)} (détenu : ${_fmtQty(_holdingQty(h))})</option>`).join('')||`<option value=''>Aucune position</option>`;
}
// editId : ordre à modifier (champs préremplis), sinon nouvel ordre
function openOrdNew(editId){
  const accs=S.accounts.filter(a=>a.holdings.some(h=>h.type!=='Cash'));
  if(!accs.length){ toast('Aucune position sur laquelle passer un ordre'); return; }
  const o=editId?loadOrders().find(x=>x.id===editId):null;
  _ordEditId=o?o.id:null;
  _ordType=o?o.type:'BUY';
  document.querySelectorAll('#ord-type-btns .type-btn').forEach(b=>b.classList.toggle('on',b.dataset.otype===_ordType));
  document.getElementById('ord-acc').innerHTML=accs.map(a=>`<option value='${esc(String(a.id))}'>${esc(a.icon||'')} ${esc(a.name)}</option>`).join('');
  if(o) document.getElementById('ord-acc').value=String(o.accId);
  _ordFillHoldings();
  if(o) document.getElementById('ord-hold').value=String(o.holdId);
  document.getElementById('ord-qty').value=o?o.qty:'';
  document.getElementById('ord-limit').value=o?o.limit:'';
  document.getElementById('ord-title').textContent=o?"Modifier l'ordre":'Nouvel ordre limite';
  document.getElementById('ord-submit').textContent=o?'Enregistrer les modifications':"Enregistrer l'ordre";
  document.getElementById('ord-bg').classList.add('show');
  document.getElementById('ord-sheet').classList.add('show');
}
function closeOrdNew(){
  document.getElementById('ord-bg').classList.remove('show');
  document.getElementById('ord-sheet').classList.remove('show');
}
document.getElementById('ord-bg').addEventListener('click',closeOrdNew);
document.getElementById('ord-close').addEventListener('click',closeOrdNew);
document.getElementById('ord-acc').addEventListener('change',_ordFillHoldings);
document.querySelectorAll('#ord-type-btns .type-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#ord-type-btns .type-btn').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  _ordType=b.dataset.otype;
}));
document.getElementById('ord-submit').addEventListener('click',()=>{
  const acc=S.accounts.find(a=>String(a.id)===document.getElementById('ord-acc').value);
  const h=acc?acc.holdings.find(x=>String(x.id)===document.getElementById('ord-hold').value):null;
  const qty=parseFloat(document.getElementById('ord-qty').value);
  const limit=parseFloat(document.getElementById('ord-limit').value);
  if(!acc||!h){ toast('Compte et titre requis'); return; }
  if(!(qty>0)||!(limit>0)){ toast('Quantité et prix limite requis'); return; }
  if(_ordType==='SELL'&&qty>_holdingQty(h)+1e-9){
    toast('Vente impossible : vous ne détenez que '+_fmtQty(Math.max(_holdingQty(h),0))+' titre(s)'); return;
  }
  const all=loadOrders();
  const edit=!!_ordEditId&&all.some(o=>o.id===_ordEditId);
  if(edit){
    const i=all.findIndex(o=>o.id===_ordEditId);
    all[i]={...all[i],accId:acc.id,holdId:h.id,type:_ordType,qty,limit,updatedAt:Date.now()};
  } else {
    const id='o'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    all.push({id,accId:acc.id,holdId:h.id,type:_ordType,qty,limit,createdAt:Date.now()});
  }
  saveOrders(all);
  closeOrdNew();
  if(S.screen==='orders') renderScreen('orders'); else renderNav();
  toast(edit?'Ordre modifié ✓':'Ordre limite enregistré ✓');
});

// ── Validation de l'exécution : récapitulatif puis ajout du mouvement ──
let _oExecId=null;
function openOrdExec(id){
  const o=loadOrders().find(x=>x.id===id), r=o&&_ordLookup(o);
  if(!r){ toast('Ordre introuvable'); return; }
  _oExecId=id;
  const {acc,h}=r, buy=o.type==='BUY', hint=_ordHint(o,h);
  document.getElementById('oexec-body').innerHTML=`
    <div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:12px'>
      <div class='modal-title' style='margin-bottom:0'>Confirmer l'exécution</div>
      <div id='oexec-close' style='width:32px;height:32px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:16px;flex-shrink:0'>✕</div>
    </div>
    ${hint.hit?`<div style='margin-bottom:10px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.12);color:#F59E0B;font-size:12px;font-weight:600'>⚠ ${hint.html}</div>`:''}
    ${_ordRow('Compte',`${esc(acc.icon||'')} ${esc(acc.name)}${acc.type?' · '+esc(acc.type):''}`)}
    ${_ordRow('Titre',`${esc(h.ticker)} — ${esc(h.name)}`)}
    ${_ordRow('Sens',buy?'Achat':'Vente')}
    ${_ordRow('Quantité',_fmtQty(o.qty))}
    ${_ordRow('Prix limite',maskedNative(o.limit,h.currency))}
    <div class='form-row' style='margin-top:12px'>
      <div class='form-field'><div class='form-label'>Prix d'exécution</div><input class='form-input' type='number' id='oexec-price' min='0' step='any' inputmode='decimal' value='${o.limit}'></div>
      <div class='form-field'><div class='form-label'>Date</div><input class='form-input' type='date' id='oexec-date' value='${_dayKey(Date.now())}'></div>
    </div>
    <div id='oexec-calc'></div>
    <div style='display:flex;gap:10px;margin-top:14px'>
      <button class='confirm-cancel' id='oexec-cancel' style='flex:1;height:46px;border-radius:12px;font-weight:700;cursor:pointer'>Retour</button>
      <button class='form-submit' id='oexec-ok' style='flex:2;height:46px;margin:0'>Confirmer et ajouter</button>
    </div>`;
  _ordExecUpdate();
  document.getElementById('oexec-bg').classList.add('show');
  document.getElementById('oexec-sheet').classList.add('show');
}
function closeOrdExec(){
  document.getElementById('oexec-bg').classList.remove('show');
  document.getElementById('oexec-sheet').classList.remove('show');
}
function _ordExecUpdate(){
  const o=loadOrders().find(x=>x.id===_oExecId), r=o&&_ordLookup(o);
  const box=document.getElementById('oexec-calc');
  if(!r||!box) return;
  const h=r.h, price=parseFloat(document.getElementById('oexec-price').value)||0;
  const held=_holdingQty(h), after=o.type==='BUY'?held+o.qty:held-o.qty;
  box.innerHTML=_ordRow('Montant',maskedNative(o.qty*price,h.currency))
    +_ordRow('Quantité détenue',`${_fmtQty(held)} → <b>${_fmtQty(after)}</b>`)
    +(after<-1e-9?`<div style='color:var(--loss);font-size:12px;font-weight:600;margin-top:6px'>La quantité détenue est insuffisante pour cette vente.</div>`:'');
}
function _ordExecute(){
  const o=loadOrders().find(x=>x.id===_oExecId), r=o&&_ordLookup(o);
  if(!r){ toast('Ordre introuvable'); return; }
  const {acc,h}=r;
  const price=parseFloat(document.getElementById('oexec-price').value);
  const date=document.getElementById('oexec-date').value||_dayKey(Date.now());
  if(!(price>0)){ toast('Prix d\'exécution requis'); return; }
  if(o.type==='SELL'){
    const held=_holdingQty(h);
    if(o.qty>held+1e-9){ toast('Exécution impossible : vous ne détenez que '+_fmtQty(Math.max(held,0))+' titre(s)'); return; }
    if(h.transactions.length && _sellsExceedHoldings([...h.transactions,{date,type:'SELL',qty:o.qty,price}])){
      toast('Exécution impossible à cette date : quantité détenue insuffisante'); return;
    }
  }
  h.transactions.push({date,type:o.type,qty:o.qty,price});
  recalcHolding(h);
  acc.value=accTotal(acc);
  saveOrders(loadOrders().filter(x=>x.id!==o.id));
  closeOrdExec();
  if(document.querySelector('#s-account #js-holds')) renderHoldsHTML(acc);
  if(S.screen==='stock') renderScreen('stock');
  if(S.screen==='orders') renderScreen('orders');
  refreshMain();
  toast((o.type==='BUY'?'Achat':'Vente')+' ajouté sur '+acc.name+' ✓');
}
document.getElementById('oexec-bg').addEventListener('click',closeOrdExec);
document.getElementById('oexec-body').addEventListener('click',e=>{
  if(e.target.closest('#oexec-ok')) _ordExecute();
  else if(e.target.closest('#oexec-cancel')||e.target.closest('#oexec-close')) closeOrdExec();
});
document.getElementById('oexec-body').addEventListener('input',_ordExecUpdate);

// Raccourci « Ordres » : proposé dans Personnaliser la barre du bas (menu burger). Il porte aussi les alertes de prix.
_NAV_PATH.orders='M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z';
NAV_CATALOG.orders={ label:'Ordres', kind:'screen' };

// Rappel à l'ouverture : ordres limites en attente de validation
setTimeout(()=>{
  if(S.isDemo) return;
  const n=loadOrders().filter(o=>_ordLookup(o)).length;
  if(n) toast(n+' ordre(s) limite à vérifier');
},1800);


// ═══════════════════════════════════════════════
// ALERTES DE PRIX — stockées à part (clé patrimoine-alerts) : [{id, ticker, name, dir:'above'|'below', price, createdAt}]
// Une alerte est « déclenchée » tant que le dernier cours connu (position d'un compte, sinon liste de suivi) est au-dessus / en dessous du prix.
// Vérification à l'ouverture de l'appli et à chaque actualisation des cours seulement : rien n'est surveillé application fermée.
// Affichées dans la moitié basse de l'écran « Ordres » ; le compteur de la barre du bas (raccourci « Ordres ») additionne ordres en cours et alertes déclenchées.
// ═══════════════════════════════════════════════
const STORE_ALERTS='patrimoine-alerts';
function loadAlerts(){
  try{ const a=JSON.parse(localStorage.getItem(STORE_ALERTS)||'[]'); return Array.isArray(a)?a:[]; }
  catch(e){ return []; }
}
function saveAlerts(a){ try{ localStorage.setItem(STORE_ALERTS,JSON.stringify(a)); }catch(e){} }
// Dernier cours connu d'un ticker : {p, ccy, name} ou null
function _altQuote(ticker){
  for(const a of S.accounts) for(const h of a.holdings) if(h.ticker===ticker&&h.currentPrice>0) return {p:h.currentPrice,ccy:h.currency||'EUR',name:h.name};
  const w=S.watchlist.find(x=>x.ticker===ticker);
  return w&&w.price>0?{p:w.price,ccy:w.currency||'EUR',name:w.name}:null;
}
function alertHit(a){
  const q=_altQuote(a.ticker); if(!q) return false;
  return a.dir==='above'?q.p>=a.price:q.p<=a.price;
}
function alertsTriggeredCount(){ return loadAlerts().filter(alertHit).length; }

let _altDir='above';
function _altTickers(){
  const m=new Map();
  S.accounts.forEach(a=>a.holdings.forEach(h=>{ if(h.type!=='Cash'&&!m.has(h.ticker)) m.set(h.ticker,h.name); }));
  S.watchlist.forEach(w=>{ if(!m.has(w.ticker)) m.set(w.ticker,w.name); });
  return [...m.entries()];
}
function openAltNew(){
  const ts=_altTickers();
  if(!ts.length){ toast('Aucun titre : ajoute une position ou un favori'); return; }
  _altDir='above';
  document.querySelectorAll('#alt-dir-btns .type-btn').forEach(b=>b.classList.toggle('on',b.dataset.adir==='above'));
  document.getElementById('alt-tick').innerHTML=ts.map(([t,n])=>`<option value='${esc(t)}'>${esc(t)} — ${esc(n||'')}</option>`).join('');
  _altPrefill();
  document.getElementById('alt-bg').classList.add('show');
  document.getElementById('alt-sheet').classList.add('show');
}
function _altPrefill(){
  const q=_altQuote(document.getElementById('alt-tick').value);
  document.getElementById('alt-price').value=q?q.p:'';
}
function closeAltNew(){
  document.getElementById('alt-bg').classList.remove('show');
  document.getElementById('alt-sheet').classList.remove('show');
}
document.getElementById('alt-bg').addEventListener('click',closeAltNew);
document.getElementById('alt-close').addEventListener('click',closeAltNew);
document.getElementById('alt-tick').addEventListener('change',_altPrefill);
document.querySelectorAll('#alt-dir-btns .type-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#alt-dir-btns .type-btn').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  _altDir=b.dataset.adir;
}));
document.getElementById('alt-submit').addEventListener('click',()=>{
  const ticker=document.getElementById('alt-tick').value;
  const price=parseFloat(document.getElementById('alt-price').value);
  if(!ticker){ toast('Titre requis'); return; }
  if(!(price>0)){ toast('Prix requis'); return; }
  const q=_altQuote(ticker);
  const all=loadAlerts();
  all.push({id:'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),ticker,name:q?q.name:'',dir:_altDir,price,createdAt:Date.now()});
  saveAlerts(all);
  closeAltNew();
  if(S.screen==='orders') renderScreen('orders'); else renderNav();
  toast('Alerte enregistrée ✓');
});

// Rappel à l'ouverture : alertes de prix déjà déclenchées
setTimeout(()=>{
  const n=alertsTriggeredCount();
  if(n) toast(n+' alerte(s) de prix déclenchée(s)');
},2600);


// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('edit-tx-sheet', closeEditTx);
registerModal('modal-sheet', closeModal);
registerModal('ord-sheet', closeOrdNew);
registerModal('oexec-sheet', closeOrdExec);
registerModal('alt-sheet', closeAltNew);
