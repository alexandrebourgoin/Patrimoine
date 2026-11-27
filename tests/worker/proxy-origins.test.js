// Proxy des cours (proxy-worker.js) : seules les pages de l'application peuvent l'appeler depuis un navigateur
import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../../proxy-worker.js';

const req = (origin, q = 'search=FR0013412269') => new Request('https://prix.dev/?' + q, { headers: origin ? { Origin: origin } : {} });
const yahoo = () => vi.stubGlobal('fetch', async () => new Response('{"quotes":[]}', { status: 200, headers: { 'set-cookie': 'A=1' } }));
afterEach(() => vi.unstubAllGlobals());

describe('proxy des cours : origines autorisées', () => {
  it('application et aperçu : servis, avec leur origine en retour (plus de *)', async () => {
    yahoo();
    for (const o of ['https://alexandrebourgoin.github.io', 'https://julienluigi.github.io', 'http://localhost:8080']) {
      const r = await worker.fetch(req(o));
      expect(r.status).toBe(200);
      expect(r.headers.get('Access-Control-Allow-Origin')).toBe(o);
      expect(r.headers.get('Vary')).toMatch(/Origin/);
    }
  });
  it('autre site : 403, sans appel à Yahoo', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const r = await worker.fetch(req('https://exemple.com'));
    expect(r.status).toBe(403);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(f).not.toHaveBeenCalled();
    expect((await worker.fetch(req('https://alexandrebourgoin.github.io.evil.com'))).status).toBe(403);
  });
  it('sans en-tête Origin (outil, test) : servi tel quel', async () => {
    yahoo();
    expect((await worker.fetch(req(null))).status).toBe(200);
  });
});
