import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

// Les fichiers de js/ sont des scripts classiques (const/let/function globaux, pas d'exports ES),
// chargés par des <script> dans le navigateur. Pour tester le VRAI fichier livré, on l'évalue
// dans une fonction dont les « globales » (S, document, crypto…) sont injectées en paramètres.

// Élément DOM factice : n'importe quelle propriété/appel renvoie lui-même (les scripts attachent
// des écouteurs au parsing : document.getElementById('x').addEventListener(...)).
function fakeEl() {
  const el = new Proxy(function () {}, { get: () => el, apply: () => el, set: () => true });
  return el;
}
export function fakeDocument() {
  const el = fakeEl();
  return { getElementById: () => el, querySelectorAll: () => [], addEventListener() {}, hidden: false };
}

let _navCatalog = null;
function navCatalog() {
  if (!_navCatalog) {
    const src = readFileSync(new URL('../../js/core/shell.js', import.meta.url), 'utf8');
    _navCatalog = new Function(src.match(/const NAV_CATALOG = \{[\s\S]*?\n\};/)[0] + '\nreturn NAV_CATALOG;')();
  }
  return _navCatalog;
}

/**
 * @param relPath  chemin depuis la racine du projet, ex. 'js/features/dca.js'
 * @param opts.globals  variables globales à injecter (S, toRefCcy…) — par référence : modifiables par le test
 * @param opts.exports  noms de fonctions/constantes à récupérer du script
 */
export function loadClassic(relPath, { globals = {}, exports = [] } = {}) {
  // navLabel (js/core/shell.js) : libellé unique d'un module, lu dans le vrai catalogue NAV_CATALOG.
  globals = { navLabel: key => (key === 'privacy' ? 'Masquer' : navCatalog()[key]?.label ?? key), ...globals };
  const src = readFileSync(new URL(`../../${relPath}`, import.meta.url), 'utf8');
  // Les modules enregistrent leurs modales dès l'évaluation (registerModal) : ce défaut ne simule pas leur comportement,
  // les tests de modales injectent leur propre registre.
  // backBarHTML (js/core/shell.js) : barre « Retour » + burger des écrans secondaires, simplifiée ici.
  const backBarHTML = (label = 'Retour') => `<div class="back-bar"><div class="back tap" id="js-back">${label}</div><div id="js-burger-btn"></div></div>`;
  // moduleBarHTML (js/core/shell.js) : barre de titre des écrans de module (nom + burger), simplifiée ici.
  const moduleBarHTML = (key, sub = '') => `<div class="top-bar"><div class="top-bar-title">${globals.navLabel ? globals.navLabel(key) : key}</div><div id="js-burger-btn"></div></div>${sub ? `<div class="module-sub">${sub}</div>` : ''}`;
  // HOME_WATCH (js/features/home-watch.js) : registre du bloc « À surveiller », où les modules enregistrent leur source au chargement.
  const base = { document: fakeDocument(), window: {}, crypto: webcrypto, registerModal() {}, backBarHTML, moduleBarHTML, HOME_WATCH: {}, ...globals };
  // Un défaut que le script déclare lui-même (ex. HOME_WATCH dans home-watch.js) n'est pas injecté : il serait déclaré deux fois.
  const declares = n => new RegExp(`^(?:const|let|var|function)\\s+${n}\\b`, 'm').test(src);
  const names = Object.keys(base).filter(n => n in globals || !declares(n));
  return new Function(...names, `${src}\n;return { ${exports.join(', ')} };`)(...names.map(n => base[n]));
}
