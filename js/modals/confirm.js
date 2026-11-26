// Boîte de confirmation générique : openConfirm(message, callback, libelléDuBouton = 'Supprimer').
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

// ═══════════════════════════════════════════════
// CONFIRM DIALOG
// ═══════════════════════════════════════════════
let _confirmCb=null;
function openConfirm(msg,cb,okLabel='Supprimer'){
  _confirmCb=cb;
  document.getElementById('confirm-msg').textContent=msg;
  document.getElementById('confirm-ok').textContent=okLabel;
  document.getElementById('confirm-bg').classList.add('show');
  document.getElementById('confirm-sheet').classList.add('show');
}
function closeConfirm(){
  document.getElementById('confirm-bg').classList.remove('show');
  document.getElementById('confirm-sheet').classList.remove('show');
  _confirmCb=null;
}
document.getElementById('confirm-cancel').addEventListener('click',closeConfirm);
document.getElementById('confirm-bg').addEventListener('click',closeConfirm);
document.getElementById('confirm-ok').addEventListener('click',()=>{ haptic(10); if(_confirmCb)_confirmCb(); closeConfirm(); });

// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('confirm-sheet', closeConfirm);
