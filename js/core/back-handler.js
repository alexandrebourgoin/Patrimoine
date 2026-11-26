// Retour Android (bouton / geste) et touche Échap : ferment d abord ce qui est ouvert, puis remontent la pile
// d écrans, puis (écran racine) demandent un 2e appui pour quitter. Ordre de priorité :
//   verrou actif → sélecteur d icône (empilé au-dessus) → tiroir ☰ → modales (registre js/core/modals.js) → navigation.
// Au chargement : amorce l historique (depth 0/1/2). Dépend, À L APPEL seulement, de S, back, toast, isLocked… (autres fichiers).

// ═══════════════════════════════════════════════
// ANDROID BACK BUTTON (PWA)
// Intercepts the hardware/gesture back so it navigates
// within the app instead of exiting the PWA.
// ═══════════════════════════════════════════════
(function initBackHandler() {
  // Seed with TWO extra entries (depth:1 + depth:2).
  // Protects against rapid double-tap on Android: even if the
  // OS fires two back events before JS runs, depth:0 is never
  // reached and the PWA stays alive.
  history.replaceState({ appNav: true, depth: 0 }, '');
  history.pushState({ appNav: true, depth: 1 }, '');
  history.pushState({ appNav: true, depth: 2 }, '');

  let _exitTs = 0;
  let _lastBack = 0; // debounce : absorbe les double-taps rapides

  window.addEventListener('popstate', () => {
    // Re-push immediately to always maintain a forward entry.
    history.pushState({ appNav: true, depth: 2 }, '');

    // Verrouillé : le bouton retour ne doit rien faire d'autre que rester sur le verrou
    if (isLocked()) return;

    // Debounce : si deux popstate arrivent en moins de 250 ms
    // (double-tap Android), on absorbe le second silencieusement.
    const now = Date.now();
    if (now - _lastBack < 250) { _lastBack = now; return; }
    _lastBack = now;

    // Le choix du type est empilé AU-DESSUS d'une fenêtre de compte : il se ferme seul
    if (typeof typePickerOpen === 'function' && typePickerOpen()) { closeTypePicker(); return; }

    // Tiroir ☰ ouvert : le retour le ferme (ou revient au menu depuis l'édition des raccourcis)
    if (document.getElementById('drawer')?.classList.contains('show')) {
      if (_drawerEdit) { _drawerEdit = false; renderDrawer(); } else closeDrawer();
      return;
    }

    // Close any open modal first (regardless of stack depth) — registre : js/core/modals.js
    if (anyModalOpen()) { closeAllModals(); return; }

    if (S.stack.length > 1) {
      back();
      _exitTs = 0;
    } else if (!NAV_SCREENS.includes(S.screen)) {
      // Stack corrompu mais on est sur un écran non-racine : utiliser les fallbacks
      back();
      _exitTs = 0;
    } else {
      // Sur un écran racine (tab) avec stack à 1 entrée → logique de sortie
      const now = Date.now();
      if (now - _exitTs < 2200) {
        toast('Utilisez le sélecteur d\'apps pour fermer');
        _exitTs = 0;
      } else {
        _exitTs = now;
        toast('Appuyez à nouveau pour quitter');
      }
    }
  });
})();

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUTS (desktop)
// ═══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (_lockState) return;   // l'overlay de verrouillage gère ses propres touches
  if (e.key === 'Escape') {
    if (typeof typePickerOpen === 'function' && typePickerOpen()) { closeTypePicker(); return; }
    if (anyModalOpen()) {
      closeAllModals();
    } else if (S.stack.length > 1) {
      back();
    }
  }
});
