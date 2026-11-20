import { describe, it, expect, vi } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const isin = 'FR0000000001';
const pending = () => ({ ticker: isin, isin, name: isin, weight: 50, resolved: false });
function fixture(lines, resolver) {
  const S = { isDemo: false, screen: 'dashboard', dca: { plans: [{ lines }], goals: [] } };
  const setItem = vi.fn();
  const { dcaResolveIsins } = loadClassic('js/features/dca.js', {
    globals: { S, resolveIsinOnline: resolver, localStorage: { setItem }, toast: vi.fn(), renderScreen: vi.fn() },
    exports: ['dcaResolveIsins'],
  });
  return { S, setItem, resolve: dcaResolveIsins };
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

describe('Résolution ISIN en ligne du DCA', () => {
  it('résout et sauvegarde dans le mode réel en conservant ISIN et poids', async () => {
    const f = fixture([pending()], vi.fn().mockResolvedValue({ ticker: 'AAA', name: 'Titre A', currency: 'EUR' }));
    const result = await f.resolve();
    expect(result.resolved).toBe(1);
    expect(f.S.dca.plans[0].lines[0]).toMatchObject({ ticker: 'AAA', isin, weight: 50, resolved: true, currency: 'EUR' });
    expect(f.setItem).toHaveBeenCalledWith('patrimoine-dca-real', expect.any(String));
  });

  it('refuse une collision sans modifier le plan ni sauvegarder', async () => {
    const lines = [pending(), { ticker: 'AAA', weight: 50 }];
    const before = JSON.stringify(lines);
    const f = fixture(lines, vi.fn().mockResolvedValue({ ticker: ' aaa ', name: 'Titre A' }));
    const result = await f.resolve();
    expect(result.conflicts).toBe(1);
    expect(JSON.stringify(f.S.dca.plans[0].lines)).toBe(before);
    expect(f.setItem).not.toHaveBeenCalled();
  });

  it.each([[null], [{}], [{ ticker: '' }]])('conserve une ligne pour une réponse inutilisable %j', async info => {
    const lines = [pending()];
    const before = JSON.stringify(lines);
    const f = fixture(lines, vi.fn().mockResolvedValue(info));
    expect((await f.resolve()).failed).toBe(1);
    expect(JSON.stringify(lines)).toBe(before);
    expect(f.setItem).not.toHaveBeenCalled();
  });

  it('absorbe un échec de recherche sans perdre l’ISIN', async () => {
    const f = fixture([pending()], vi.fn().mockRejectedValue(new Error('Réseau indisponible')));
    expect((await f.resolve()).failed).toBe(1);
    expect(f.S.dca.plans[0].lines[0].resolved).toBe(false);
    expect(f.setItem).not.toHaveBeenCalled();
  });

  it('ignore la réponse tardive après changement démo/réel', async () => {
    const request = deferred();
    const original = [pending()];
    const f = fixture(original, vi.fn(() => request.promise));
    const run = f.resolve();
    const demoData = { plans: [], goals: [] };
    f.S.isDemo = true;
    f.S.dca = demoData;
    request.resolve({ ticker: 'AAA' });
    expect((await run).cancelled).toBe(true);
    expect(f.S.dca).toBe(demoData);
    expect(original[0].resolved).toBe(false);
    expect(f.setItem).not.toHaveBeenCalled();
  });

  it('n’ouvre pas deux recherches concurrentes pour le même traitement', async () => {
    const request = deferred();
    const resolver = vi.fn(() => request.promise);
    const f = fixture([pending()], resolver);
    const first = f.resolve();
    expect((await f.resolve()).pending).toBe(true);
    expect(resolver).toHaveBeenCalledOnce();
    request.resolve({ ticker: 'AAA' });
    await first;
  });

  it('permet de retenter manuellement après un échec automatique', async () => {
    const resolver = vi.fn().mockResolvedValue(null);
    const f = fixture([pending()], resolver);
    await f.resolve();
    await f.resolve();
    expect(resolver).toHaveBeenCalledOnce();
    await f.resolve(true);
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('ne restaure pas une ligne supprimée durant la recherche', async () => {
    const request = deferred();
    const f = fixture([pending()], vi.fn(() => request.promise));
    const run = f.resolve();
    f.S.dca.plans[0].lines = [];
    request.resolve({ ticker: 'AAA' });
    await run;
    expect(f.S.dca.plans[0].lines).toEqual([]);
    expect(f.setItem).not.toHaveBeenCalled();
  });
});
