// Filet de sécurité DOM, à charger EN PREMIER (juste après utils.js).
// Après une mise à jour le service worker peut servir un nouveau JS avec un ancien HTML : on crée ici les
// éléments dont les scripts suivants ont besoin au chargement (ils y attachent des écouteurs) plutôt que de
// planter sur un getElementById(...) null. Doit précéder shell.js, dca.js et js/modals/*.js.

// Filet de sécurité « versions mélangées » : après une mise à jour, le service worker peut servir
// un nouveau JS avec un ancien HTML (ou l'inverse). Si le HTML n'a pas les éléments dont ce JS
// a besoin, on les crée ici plutôt que de planter au premier addEventListener (la barre du bas
// se retrouvait alors morte jusqu'au redémarrage).
(function ensureShellEls() {
  const app = document.getElementById('app') || document.body;
  const mk = (id, tag, cls, html) => {
    if (document.getElementById(id)) return;
    const e = document.createElement(tag); e.id = id;
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    app.appendChild(e);
  };
  mk('drawer-bg', 'div');
  mk('drawer', 'aside');
  mk('s-dca', 'div', 'screen no-nav');
  mk('dca-modal-bg', 'div', 'add-modal-bg');
  mk('dca-modal-sheet', 'div', 'add-modal-sheet', '<div class="modal-drag"></div><div class="modal-body" id="dca-modal-body"></div>');
  const sheet = document.getElementById('dca-modal-sheet');
  if (sheet) sheet.style.cssText = 'max-height:92vh;overflow-y:auto';
})();
