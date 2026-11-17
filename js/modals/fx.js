// Modale des taux de change (ouverte depuis Réglages) + bouton d actualisation.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

function openFxModal() {
  document.getElementById('js-fx-modal-body').innerHTML = renderFxModalRows();
  document.getElementById('fx-modal-bg').classList.add('show');
  document.getElementById('fx-modal-sheet').classList.add('show');
}
function closeFxModal() {
  document.getElementById('fx-modal-bg').classList.remove('show');
  document.getElementById('fx-modal-sheet').classList.remove('show');
}
document.getElementById('fx-modal-bg').addEventListener('click', closeFxModal);

document.getElementById('js-fx-modal-refresh').addEventListener('click', async () => {
  const icon = document.getElementById('js-fx-modal-refresh-icon');
  if (icon) icon.classList.add('spin');
  await fetchFxRates();
  if (icon) icon.classList.remove('spin');
  document.getElementById('js-fx-modal-body').innerHTML = renderFxModalRows();
  // Mettre à jour le sous-titre dans settings si visible
  const sub = document.getElementById('js-fx-sub');
  if (sub) sub.textContent = fxSubText();
});

// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('fx-modal-sheet', closeFxModal);
