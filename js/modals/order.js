// Modales d ordres : modification d une transaction et ajout d un ordre (achat / vente / dividende).
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
// Quantité actuellement détenue (tous achats − toutes ventes).
function _heldQty(txs){
  return txs.reduce((q,t)=>t.type==='BUY'?q+t.qty:t.type==='SELL'?q-t.qty:q,0);
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
    const held=_heldQty(h.transactions);
    if(qty>held+1e-9){
      toast('Vente impossible : vous ne détenez que '+_fmtQty(Math.max(held,0))+' titre(s)');return;
    }
    if(_sellsExceedHoldings([...h.transactions,{date,type:_mType,qty,price}])){
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



// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('edit-tx-sheet', closeEditTx);
registerModal('modal-sheet', closeModal);
