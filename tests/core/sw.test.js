import { describe, it, expect, vi } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

// On évalue le VRAI sw.js avec un faux environnement de service worker (self, caches, fetch, Request, Response).
const SCOPE = 'https://x.test/app/';
class FakeResponse { constructor(body, init = {}) { this.body = body; this.status = init.status ?? 200; this.ok = this.status >= 200 && this.status < 300; }
  clone() { return new FakeResponse(this.body, { status: this.status }); } }
class FakeRequest { constructor(url, init = {}) { this.url = url; this.method = 'GET'; Object.assign(this, init); } }

function env({ online = true, failUrls = [] } = {}) {
  const stores = new Map();                                   // nom de cache → Map(url → réponse)
  const open = name => { if (!stores.has(name)) stores.set(name, new Map()); return stores.get(name); };
  const key = r => (typeof r === 'string' ? r : r.url);
  const caches = {
    open: async name => { const s = open(name); return { put: async (r, resp) => { s.set(key(r), resp); }, match: async r => s.get(key(r)) }; },
    match: async r => { for (const s of stores.values()) if (s.has(key(r))) return s.get(key(r)); },
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
  };
  const calls = [];                                           // requêtes réellement parties au réseau
  const fetch = vi.fn(async r => {
    calls.push(r);
    const url = key(r);
    if (!online) throw new TypeError('offline');
    if (failUrls.includes(url)) return new FakeResponse('nope', { status: 404 });
    return new FakeResponse('NET:' + url);
  });
  const handlers = {};
  const self = {
    registration: { scope: SCOPE }, location: { origin: 'https://x.test' },
    addEventListener: (t, f) => { handlers[t] = f; },
    skipWaiting: vi.fn(async () => {}), clients: { claim: vi.fn(async () => {}) },
  };
  const sw = loadClassic('sw.js', { globals: { self, caches, fetch, Request: FakeRequest, Response: FakeResponse }, exports: ['CACHE', 'SHELL'] });
  const waitUntil = async ev => { let p; ev.waitUntil = x => { p = x; }; handlers[ev.type](ev); await p; };
  const install = () => waitUntil({ type: 'install' });
  const activate = () => waitUntil({ type: 'activate' });
  const request = async (url, init = {}) => {                  // renvoie la réponse, ou undefined si le SW ne l'intercepte pas
    let out; const ev = { request: new FakeRequest(url, init), respondWith: p => { out = p; } };
    handlers.fetch(ev);
    return out === undefined ? undefined : await out;
  };
  return { sw, stores, caches, fetch, calls, self, install, activate, request };
}
const url = rel => SCOPE + rel;

describe('installation : précache atomique du SHELL', () => {
  it('télécharge chaque fichier avec cache:"reload" et le range dans le cache de la version', async () => {
    const e = env();
    await e.install();
    const cache = e.stores.get(e.sw.CACHE);
    expect(cache.size).toBe(e.sw.SHELL.length);
    for (const rel of e.sw.SHELL) expect(cache.has(new URL(rel, SCOPE).href), rel).toBe(true);
    expect(e.calls.every(r => r.cache === 'reload')).toBe(true);         // jamais la copie du cache HTTP
    expect(e.self.skipWaiting).toHaveBeenCalled();
  });
  it('un seul fichier en échec → installation refusée, cache à moitié rempli supprimé, pas de skipWaiting', async () => {
    const e = env({ failUrls: [url('js/core/ui.js')] });
    await expect(e.install()).rejects.toThrow(/js\/core\/ui\.js/);
    expect(e.stores.has(e.sw.CACHE)).toBe(false);
    expect(e.self.skipWaiting).not.toHaveBeenCalled();
  });
});

describe('activation', () => {
  it('supprime les caches des anciennes versions, garde le courant, prend le contrôle des pages', async () => {
    const e = env();
    await e.install();
    e.stores.set('patrimoine-v1', new Map()); e.stores.set('autre', new Map());
    await e.activate();
    expect([...e.stores.keys()]).toEqual([e.sw.CACHE]);
    expect(e.self.clients.claim).toHaveBeenCalled();
  });
});

describe('fichiers de l\'app : cache-first', () => {
  it('hors-ligne, tout le SHELL est servi depuis le cache, sans toucher au réseau', async () => {
    const e = env(); await e.install();
    const off = env({ online: false }); off.stores.set(off.sw.CACHE, e.stores.get(e.sw.CACHE));
    const before = off.calls.length;
    for (const rel of e.sw.SHELL.filter(r => r !== './index.html')) {
      const resp = await off.request(url(rel.slice(2)), { mode: 'no-cors' });
      expect(resp.body, rel).toBe('NET:' + new URL(rel, SCOPE).href);
    }
    expect(off.calls.length).toBe(before);
  });
  it('en ligne aussi : le cache de la version prime (pas de mélange avec une copie plus récente)', async () => {
    const e = env(); await e.install();
    e.calls.length = 0;
    await e.request(url('js/core/ui.js'));
    expect(e.calls).toHaveLength(0);
  });
  it('la racine du scope sert index.html', async () => {
    const e = env(); await e.install(); e.calls.length = 0;
    expect((await e.request(SCOPE, { mode: 'navigate' })).body).toBe('NET:' + url('index.html'));
    expect(e.calls).toHaveLength(0);
  });
  it('une navigation avec paramètres (?utm=…) est servie depuis le cache', async () => {
    const e = env(); await e.install(); e.calls.length = 0;
    const r = await e.request(url('mon-patrimoine.html?utm=pwa'), { mode: 'navigate' });
    expect(r.body).toBe('NET:' + url('mon-patrimoine.html'));
    expect(e.calls).toHaveLength(0);
  });
});

describe('contournement du cache (indispensable à « Rechercher une mise à jour »)', () => {
  it('fichier de l\'app demandé avec un paramètre (?_=…) → réseau', async () => {
    const e = env(); await e.install(); e.calls.length = 0;
    const r = await e.request(url('mon-patrimoine.js?_=123'));
    expect(r.body).toBe('NET:' + url('mon-patrimoine.js?_=123'));
    expect(e.calls).toHaveLength(1);
  });
  it('cache:"no-store" ou "reload" → réseau', async () => {
    const e = env(); await e.install(); e.calls.length = 0;
    for (const c of ['no-store', 'reload']) await e.request(url('mon-patrimoine.js'), { cache: c });
    expect(e.calls).toHaveLength(2);
  });
});

describe('correspondance par chemin exact (et non plus par nom de fichier)', () => {
  it('js/screens/account.js ≠ js/modals/account.js ; un nom identique ailleurs n\'est pas pris pour un fichier de l\'app', async () => {
    const e = env(); await e.install(); e.calls.length = 0;
    expect((await e.request(url('js/screens/account.js'))).body).toContain('js/screens/account.js');
    expect((await e.request(url('js/modals/account.js'))).body).toContain('js/modals/account.js');
    expect(e.calls).toHaveLength(0);                                    // les deux depuis le cache
    await e.request(url('autre/account.js'));                           // même nom, autre dossier → pas du SHELL
    expect(e.calls).toHaveLength(1);
  });
});

describe('ce que le service worker n\'intercepte pas', () => {
  it('autres origines (proxy de cours, CoinGecko…) : aucune réponse du SW', async () => {
    const e = env(); await e.install();
    expect(await e.request('https://patrimoine-prices.al-the-best.workers.dev/?symbols=MC')).toBeUndefined();
    expect(await e.request('https://api.coingecko.com/api/v3/simple/price')).toBeUndefined();
  });
  it('requêtes non-GET', async () => {
    const e = env(); await e.install();
    expect(await e.request(url('mon-patrimoine.js'), { method: 'POST' })).toBeUndefined();
  });
});

describe('autres stratégies', () => {
  it('Google Fonts : cache-first (réseau une seule fois)', async () => {
    const e = env();
    const f = 'https://fonts.gstatic.com/s/x.woff2';
    await e.request(f); await e.request(f);
    expect(e.calls).toHaveLength(1);
  });
  it('même origine hors SHELL : network-first, repli sur le cache hors-ligne, sinon 503', async () => {
    const on = env();
    expect((await on.request(url('donnees.json'))).body).toBe('NET:' + url('donnees.json'));
    const off = env({ online: false }); off.stores.set(off.sw.CACHE, on.stores.get(on.sw.CACHE));
    expect((await off.request(url('donnees.json'))).body).toBe('NET:' + url('donnees.json'));   // repli cache
    expect((await off.request(url('jamais-vu.json'))).status).toBe(503);
  });
});
