// Modales d ordres : modification d une transaction et ajout d un ordre (achat / vente / dividende).
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

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
