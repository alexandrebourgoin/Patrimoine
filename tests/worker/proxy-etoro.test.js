// Route ?etoro= du proxy des cours (proxy-worker.js) : seuls deux appels en lecture relayés, clés transmises sans cache
import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../../proxy-worker.js';

const req = (q, headers = {}, method = 'GET') => new Request('https://prix.dev/?' + q, { method, headers });
afterEach(() => vi.unstubAllGlobals());

describe('proxy des cours : route eToro', () => {
  it('pnl et instruments relayés vers eToro avec les clés, sans mise en cache', async () => {
    const seen = [];
    vi.stubGlobal('fetch', async (url, o) => { seen.push([url, o.headers]); return new Response('{"ok":1}', { status: 200 }); });
    const r = await worker.fetch(req('etoro=pnl', { 'x-api-key': 'A', 'x-user-key': 'U', 'x-request-id': 'id1' }));
    expect(r.status).toBe(200);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(seen[0]).toEqual(['https://public-api.etoro.com/api/v1/trading/info/real/pnl', { 'x-api-key': 'A', 'x-user-key': 'U', 'x-request-id': 'id1' }]);
    await worker.fetch(req('etoro=instruments&ids=1001,abc,100000', { 'x-api-key': 'A', 'x-user-key': 'U' }));
    expect(seen[1][0]).toBe('https://public-api.etoro.com/api/v1/market-data/instruments?instrumentIds=1001,100000');
  });
  it('code d erreur eToro et Retry-After répercutés ; autre demande refusée sans appel', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => { calls++; return new Response('{}', { status: 429, headers: { 'Retry-After': '30' } }); });
    const r = await worker.fetch(req('etoro=pnl'));
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('30');
    expect((await worker.fetch(req('etoro=trading/execution'))).status).toBe(400);
    expect((await worker.fetch(req('etoro=instruments&ids=../x'))).status).toBe(400);
    expect(calls).toBe(1);
  });
  it('pré-vol CORS : en-têtes des clés autorisés', async () => {
    const r = await worker.fetch(req('etoro=pnl', {}, 'OPTIONS'));
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Headers')).toMatch(/x-user-key/);
  });
});
