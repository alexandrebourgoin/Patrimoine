// Registre des écrans. Chaque js/screens/*.js enregistre sa fonction de binding :
//   SCREEN_BIND.<id> = function (el, id) { … attache les écouteurs de l'écran … };
// renderScreen() (mon-patrimoine.js) injecte le HTML de l'écran puis appelle bindEvents().
// Chargé AVANT les écrans (ils s'enregistrent à leur évaluation).
const SCREEN_BIND = {};

function bindEvents(id, el) {
  const fn = SCREEN_BIND[id];
  if (fn) fn(el, id);
}
