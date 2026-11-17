// Registre des feuilles modales. Chaque js/modals/*.js (et les fichiers qui ont leur propre modale)
// déclare sa feuille et sa fonction de fermeture :
//   registerModal('<id de la feuille>', closeXxx);
// Le bouton retour Android (popstate) et la touche Échap (mon-patrimoine.js) n'ont ainsi plus de liste à
// maintenir : ajouter une modale = une ligne registerModal() dans son fichier, rien d'autre.
// Non enregistrés (ordre de priorité propre, gardés dans les handlers) : le sélecteur d'icône
// (empilé au-dessus d'une autre feuille) et le tiroir ☰. Chargé AVANT les modales.
const MODAL_REGISTRY = [];

function registerModal(sheetId, close) { MODAL_REGISTRY.push({ sheetId, close }); }

function anyModalOpen() {
  return MODAL_REGISTRY.some(m => document.getElementById(m.sheetId)?.classList.contains('show'));
}
// Ferme TOUTES les feuilles enregistrées (comme avant : on appelle chaque fermeture, ouverte ou non).
function closeAllModals() { MODAL_REGISTRY.forEach(m => m.close()); }
