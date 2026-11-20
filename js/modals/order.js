// Modales de mouvements : ajout et modification d’un achat, d’une vente ou d’un dividende.
// Dépendances globales utilisées uniquement à l’appel ; DOM disponible à l’évaluation.

// Une même journée conserve l’ordre de saisie. Les dividendes ne changent pas la quantité.
// Fonction pure : ne trie et ne modifie jamais le tableau reçu.
function transactionHistoryIsValid(transactions) {
  const ordered = transactions.map((tx, index) => ({ tx, index }));
  ordered.sort((a, b) => a.tx.date.localeCompare(b.tx.date) || a.index - b.index);
  let quantity = 0;
  for (const { tx } of ordered) {
    if (!['BUY', 'SELL', 'DIV'].includes(tx.type) || !Number.isFinite(tx.qty) || tx.qty <= 0) return false;
    if (tx.type === 'BUY') quantity += tx.qty;
    if (tx.type === 'SELL') {
      quantity -= tx.qty;
      if (quantity < -1e-8) return false;
    }
  }
  return true;
}

let _editTxAccId = null, _editTxHoldId = null, _editTxIdx = null, _editTxType = 'BUY';

function openEditTx(accId, holdId, idx) {
  const acc = S.accounts.find(a => a.id === accId);
  const h = acc?.holdings.find(h => h.id === holdId);
  if (!h || !Number.isInteger(idx) || idx < 0 || idx >= h.transactions.length) return;
  _editTxAccId = accId;
  _editTxHoldId = holdId;
  _editTxIdx = idx;
  const tx = h.transactions[idx];
  _editTxType = tx.type;
  document.querySelectorAll('#edit-type-btns .type-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.etype === tx.type);
  });
  document.getElementById('edit-tx-qty').value = tx.qty;
  document.getElementById('edit-tx-price').value = tx.price;
  document.getElementById('edit-tx-date').value = tx.date;
  document.getElementById('edit-tx-bg').classList.add('show');
  document.getElementById('edit-tx-sheet').classList.add('show');
}

function closeEditTx() {
  document.getElementById('edit-tx-bg').classList.remove('show');
  document.getElementById('edit-tx-sheet').classList.remove('show');
}

document.getElementById('edit-tx-bg').addEventListener('click', closeEditTx);
document.getElementById('edit-tx-close').addEventListener('click', closeEditTx);
document.querySelectorAll('#edit-type-btns .type-btn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#edit-type-btns .type-btn').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  _editTxType = b.dataset.etype;
}));
document.getElementById('edit-tx-submit').addEventListener('click', () => {
  const qty = parseFloat(document.getElementById('edit-tx-qty').value);
  const price = parseFloat(document.getElementById('edit-tx-price').value);
  const date = document.getElementById('edit-tx-date').value;
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0 || !date) {
    toast('Quantité, prix et date requis');
    return;
  }
  const acc = S.accounts.find(a => a.id === _editTxAccId);
  const h = acc?.holdings.find(h => h.id === _editTxHoldId);
  if (!h || !Number.isInteger(_editTxIdx) || _editTxIdx < 0 || _editTxIdx >= h.transactions.length) {
    toast('Mouvement introuvable');
    return;
  }
  const candidate = h.transactions.map((tx, i) => i === _editTxIdx ? { date, type: _editTxType, qty, price } : tx);
  if (!transactionHistoryIsValid(candidate)) {
    toast('Modification impossible : une vente dépasserait la quantité détenue à sa date');
    return;
  }
  h.transactions = candidate;
  recalcHolding(h);
  acc.value = accTotal(acc);
  closeEditTx();
  renderScreen('stock');
  refreshMain();
  toast('Mouvement modifié ✓');
});

let _mAccId = null, _mHoldId = null, _mType = 'BUY';

function updateOrderTypeLabels() {
  document.querySelector('#modal-qty').closest('.form-field').querySelector('.form-label').textContent = _mType === 'DIV' ? 'Nb actions' : 'Quantité';
  document.querySelector('#modal-price').closest('.form-field').querySelector('.form-label').textContent = _mType === 'DIV' ? 'Dividende/action' : 'Prix unitaire';
}

function openAddOrder(accId, holdId) {
  const acc = S.accounts.find(a => a.id === accId);
  const h = acc?.holdings.find(h => h.id === holdId);
  if (!h) return;
  _mAccId = accId;
  _mHoldId = holdId;
  _mType = 'BUY';
  document.getElementById('modal-ticker').textContent = h.ticker;
  document.getElementById('modal-name').textContent = h.name;
  document.getElementById('modal-qty').value = '';
  document.getElementById('modal-price').value = h.currentPrice.toFixed(2);
  document.getElementById('modal-date').value = PU.dayKey(Date.now());
  document.querySelectorAll('#modal-sheet .type-btn[data-type]').forEach(b => b.classList.toggle('on', b.dataset.type === 'BUY'));
  updateOrderTypeLabels();
  document.getElementById('modal-bg').classList.add('show');
  document.getElementById('modal-sheet').classList.add('show');
  setTimeout(() => document.getElementById('modal-qty').focus(), 330);
}

function closeModal() {
  document.getElementById('modal-bg').classList.remove('show');
  document.getElementById('modal-sheet').classList.remove('show');
}

document.getElementById('modal-bg').addEventListener('click', closeModal);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.querySelectorAll('#modal-sheet .type-btn[data-type]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#modal-sheet .type-btn[data-type]').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  _mType = b.dataset.type;
  updateOrderTypeLabels();
}));
document.getElementById('modal-submit').addEventListener('click', () => {
  const qty = parseFloat(document.getElementById('modal-qty').value);
  const price = parseFloat(document.getElementById('modal-price').value);
  const date = document.getElementById('modal-date').value || PU.dayKey(Date.now());
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
    toast('Quantité et prix requis');
    return;
  }
  const acc = S.accounts.find(a => a.id === _mAccId);
  const h = acc?.holdings.find(h => h.id === _mHoldId);
  if (!h) { toast('Position introuvable'); return; }
  const candidate = [...h.transactions, { date, type: _mType, qty, price }];
  if (!transactionHistoryIsValid(candidate)) {
    toast('Mouvement impossible : une vente dépasserait la quantité détenue à sa date');
    return;
  }
  h.transactions = candidate;
  recalcHolding(h);
  acc.value = accTotal(acc);
  closeModal();
  const holdsEl = document.getElementById('s-account')?.querySelector('#js-holds');
  if (holdsEl) renderHoldsHTML(acc);
  refreshMain();
  if (S.screen === 'stock' && S.accountId === _mAccId && S.holdingId === _mHoldId) renderScreen('stock');
  const label = { BUY: 'Achat', SELL: 'Vente', DIV: 'Dividende' }[_mType];
  toast(`${label} enregistré ✓`);
});

registerModal('edit-tx-sheet', closeEditTx);
registerModal('modal-sheet', closeModal);
