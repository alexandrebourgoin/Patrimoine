import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Garde-fous du packaging PWA : ce sont les oublis qui ont déjà fait perdre du temps
// (fichier absent de SHELL = app cassée hors-ligne ; chemin faux = installation du SW échouée ;
//  version et cache désalignés = « la mise à jour ne prend pas »).
// fileURLToPath : URL.pathname garderait les espaces encodés (%20) du chemin Windows.
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = f => readFileSync(join(root, f), 'utf8');

const sw = read('sw.js');
const html = read('mon-patrimoine.html');
const main = read('mon-patrimoine.js');

const SHELL = [...sw.match(/const SHELL = \[([\s\S]*?)\]/)[1].matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
const SCRIPTS = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

describe('version ↔ cache du service worker', () => {
  it('le 3e chiffre de APP_VERSION est le numéro du cache patrimoine-vNN', () => {
    const version = main.match(/const APP_VERSION = '(\d+)\.(\d+)\.(\d+)'/);
    const cache = sw.match(/const CACHE = 'patrimoine-v(\d+)'/);
    expect(version).not.toBeNull();
    expect(cache).not.toBeNull();
    expect(Number(version[3])).toBe(Number(cache[1]));
  });
});

describe('SHELL (précache du service worker)', () => {
  it('chaque fichier listé existe (sinon cache.addAll échoue et le SW ne s\'installe pas)', () => {
    for (const f of SHELL) expect(existsSync(join(root, f)), f).toBe(true);
  });
  it('pas de doublon', () => {
    expect(SHELL.filter((f, i) => SHELL.indexOf(f) !== i)).toEqual([]);
  });
  it('chaque <script src> local du HTML est précaché', () => {
    for (const s of SCRIPTS) expect(SHELL, s).toContain(s);
  });
  it('chaque fichier de js/ est chargé par le HTML et précaché (aucun oubli)', () => {
    for (const f of walk('js').filter(f => f.endsWith('.js'))) {
      expect(SCRIPTS, `${f} absent du HTML`).toContain(f);
      expect(SHELL, `${f} absent de SHELL`).toContain(f);
    }
  });
  it('tests/ et package.json ne sont jamais précachés', () => {
    expect(SHELL.filter(f => f.startsWith('tests/') || f === 'package.json')).toEqual([]);
  });
});

describe('ordre de chargement des scripts', () => {
  const idx = f => SCRIPTS.indexOf(f);
  it('utils.js → data → core → services/features → écrans → application', () => {
    expect(idx('utils.js')).toBeGreaterThanOrEqual(0);
    expect(idx('utils.js')).toBeLessThan(idx('js/data/securities.js'));
    expect(idx('js/core/screens.js')).toBeLessThan(idx('js/screens/dashboard.js'));
    for (const s of SCRIPTS.filter(s => s.startsWith('js/screens/')))
      expect(idx('js/core/screens.js'), s).toBeLessThan(idx(s));
    expect(SCRIPTS.at(-1)).toBe('mon-patrimoine.js');
  });
  it('dom-guard.js juste après utils.js, avant tout autre fichier de js/ (il crée les éléments que les suivants ciblent)', () => {
    expect(idx('js/core/dom-guard.js')).toBe(idx('utils.js') + 1);
  });
  it('les fichiers de js/core/ qui définissent les constantes/fonctions communes précèdent services, features, modales et écrans', () => {
    for (const core of ['js/core/storage.js', 'js/core/ui.js', 'js/core/navigation.js', 'js/core/shell.js', 'js/core/modals.js', 'js/core/screens.js'])
      for (const s of SCRIPTS.filter(s => /^js\/(services|features|modals|screens)\//.test(s)))
        expect(idx(core), `${core} avant ${s}`).toBeLessThan(idx(s));
  });
});
