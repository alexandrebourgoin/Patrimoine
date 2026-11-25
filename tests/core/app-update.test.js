import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

// Mise à jour de l'application (js/core/app-update.js) : la page doit recharger quand le nouveau service worker
// prend la main, sans vider les caches ni recharger depuis le cache HTTP du navigateur.

function setup({ hadController = true, remoteVersion = '1.11.200', busy = false, offline = false } = {}) {
  const listeners = { sw: {}, win: {}, doc: {} };
  const reg = { update: vi.fn(async () => {}), unregister: vi.fn() };
  const navigator = {
    serviceWorker: {
      controller: hadController ? {} : null,
      addEventListener: (ev, fn) => { listeners.sw[ev] = fn; },
      register: vi.fn(async () => reg),
      getRegistration: vi.fn(async () => reg),
      getRegistrations: vi.fn(async () => [reg]),
    },
  };
  const document = {
    hidden: false,
    _busy: busy,
    querySelector: () => (document._busy ? {} : null),
    addEventListener: (ev, fn) => { listeners.doc[ev] = fn; },
  };
  const window = { addEventListener: (ev, fn) => { listeners.win[ev] = fn; } };
  const location = { reload: vi.fn() };
  const caches = { keys: vi.fn(async () => ['patrimoine-v113']), delete: vi.fn() };
  const toasts = [];
  const fetch = vi.fn(async () => { if (offline) throw new Error('offline'); return { ok: true, text: async () => `const APP_VERSION = '${remoteVersion}';` }; });
  const mod = loadClassic('js/core/app-update.js', {
    globals: { navigator, document, window, location, caches, fetch, toast: m => toasts.push(m), APP_VERSION: '1.11.113', console: { log() {}, warn() {} } },
    exports: ['forceAppUpdate'],
  });
  return { mod, reg, listeners, location, caches, toasts, document, navigator };
}

beforeEach(() => { vi.useRealTimers(); });

describe('rechargement à la prise de contrôle du nouveau service worker', () => {
  it('recharge une fois quand une nouvelle version prend la main', () => {
    const t = setup();
    t.listeners.sw.controllerchange();
    t.listeners.sw.controllerchange();
    expect(t.location.reload).toHaveBeenCalledTimes(1);
  });
  it('ne recharge pas au tout premier lancement (aucun SW auparavant)', () => {
    const t = setup({ hadController: false });
    t.listeners.sw.controllerchange();
    expect(t.location.reload).not.toHaveBeenCalled();
  });
  it('fenêtre de saisie ouverte : rechargement différé jusqu\'à sa fermeture', () => {
    const t = setup({ busy: true });
    t.listeners.sw.controllerchange();
    expect(t.location.reload).not.toHaveBeenCalled();
    t.document.hidden = true; t.listeners.doc.visibilitychange();
    expect(t.location.reload).not.toHaveBeenCalled();        // toujours ouverte : on attend
    t.document._busy = false; t.listeners.doc.visibilitychange();
    expect(t.location.reload).toHaveBeenCalledTimes(1);
  });
});

describe('vérification au retour sur l\'application', () => {
  it('relance la vérification du service worker quand l\'app redevient visible', async () => {
    const t = setup();
    t.listeners.win.load();
    await Promise.resolve(); await Promise.resolve();
    t.listeners.doc.visibilitychange();
    expect(t.reg.update).toHaveBeenCalledTimes(1);
  });
});

describe('« Rechercher une mise à jour »', () => {
  it('nouvelle version : met à jour le SW sans le désinscrire ni vider les caches, puis recharge à la prise de contrôle', async () => {
    const t = setup();
    await t.mod.forceAppUpdate();
    expect(t.reg.update).toHaveBeenCalledTimes(1);
    expect(t.reg.unregister).not.toHaveBeenCalled();
    expect(t.caches.delete).not.toHaveBeenCalled();
    t.listeners.sw.controllerchange();
    expect(t.location.reload).toHaveBeenCalledTimes(1);
  });
  it('même version : aucun rechargement', async () => {
    const t = setup({ remoteVersion: '1.11.113' });
    await t.mod.forceAppUpdate();
    expect(t.reg.update).not.toHaveBeenCalled();
    expect(t.toasts.at(-1)).toContain('Déjà à jour');
  });
  it('hors ligne : rien n\'est touché', async () => {
    const t = setup({ offline: true });
    await t.mod.forceAppUpdate();
    expect(t.reg.update).not.toHaveBeenCalled();
    expect(t.location.reload).not.toHaveBeenCalled();
    expect(t.caches.delete).not.toHaveBeenCalled();
    expect(t.toasts.at(-1)).toContain('Hors ligne');
  });
});
