import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadClassic } from '../helpers/load-classic.js';

// Sauvegarde complète (js/features/backup.js) : rien ne doit se perdre, nouveaux modules compris.
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: i => [...m.keys()][i] ?? null,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}
const bk = loadClassic('js/features/backup.js', {
  globals: { S: { isDemo: false }, toast() {}, openConfirm() {}, registerModal() {} },
  exports: ['buildBackup', 'parseBackup', 'restoreBackup', 'lastBackupAt', 'markBackup', 'backupDue', 'backupAgeLabel', 'BACKUP_EXCLUDE', 'SETTINGS_PRIVATE_FIELDS'],
});
const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 25, 12);
const settings = { theme: 'dark', currency: 'EUR', navItems: ['dashboard'], fmpApiKey: 'SECRET', priceApiKey: 'K', lockEnabled: true, lockHash: 'h', lockSalt: 's' };
const device = () => fakeStorage({
  'patrimoine-accounts': '{"accounts":[{"id":"a1"}],"isDemo":false}',
  'patrimoine-accounts-real': '{"accounts":[{"id":"a1"}]}',
  'patrimoine-accounts-demo': '{"accounts":[{"id":"demo"}]}',
  'patrimoine-dca-real': '{"plans":[1]}',
  'patrimoine-orders-alerts-real': '{"orders":[],"alerts":[1]}',
  'patrimoine-immo-real': '[{"id":"p1"}]',
  'patrimoine-wealth': '[[1,2]]',
  'patrimoine-settings': JSON.stringify(settings),
  'patrimoine-prices': '{"prices":{}}',
  'patrimoine-history': '{}',
  'patrimoine-bglog': 'x',
  'patrimoine-version': '1.11.113',
  'accPerfMode': 'all',
});

describe('export', () => {
  it('contient tous les modules (comptes réels et démo, DCA, ordres, immobilier, historique du patrimoine, réglages)', () => {
    const b = bk.buildBackup(device(), NOW, '1.11.114');
    expect(b).toMatchObject({ app: 'mon-patrimoine', format: 2, appVersion: '1.11.114', exportedAt: '2026-11-25T12:00:00.000Z' });
    expect(Object.keys(b.data)).toEqual([
      'patrimoine-accounts', 'patrimoine-accounts-demo', 'patrimoine-accounts-real', 'patrimoine-dca-real',
      'patrimoine-immo-real', 'patrimoine-orders-alerts-real', 'patrimoine-settings', 'patrimoine-wealth',
    ]);
    expect(b.data['patrimoine-immo-real']).toBe('[{"id":"p1"}]');   // contenu brut, inchangé
  });
  it('un futur module rangé sous « patrimoine-* » est sauvegardé sans modifier backup.js', () => {
    const st = device(); st.setItem('patrimoine-credits-real', '[{"id":"c1"}]');
    expect(bk.buildBackup(st, NOW).data['patrimoine-credits-real']).toBe('[{"id":"c1"}]');
  });
  it('ni caches, ni journal, ni secrets (clés d\'API, code de verrouillage)', () => {
    const b = bk.buildBackup(device(), NOW);
    ['patrimoine-prices', 'patrimoine-history', 'patrimoine-bglog', 'patrimoine-version'].forEach(k => expect(b.data[k]).toBeUndefined());
    const s = JSON.parse(b.data['patrimoine-settings']);
    expect(s.theme).toBe('dark');
    bk.SETTINGS_PRIVATE_FIELDS.forEach(f => expect(s[f]).toBeUndefined());
    expect(JSON.stringify(b)).not.toContain('SECRET');
  });
});

describe('restauration', () => {
  it('aller-retour : un appareil vide retrouve exactement les mêmes données', () => {
    const src = device();
    const file = JSON.stringify(bk.buildBackup(src, NOW));
    const dst = fakeStorage();
    bk.restoreBackup(dst, bk.parseBackup(file));
    const b = JSON.parse(file).data;
    Object.entries(b).forEach(([k, v]) => expect(dst.getItem(k)).toBe(v));
  });
  it('remplace les données existantes, garde caches et secrets de l\'appareil', () => {
    const file = bk.buildBackup(fakeStorage({ 'patrimoine-accounts': '{"accounts":[{"id":"old"}]}', 'patrimoine-settings': '{"theme":"light"}' }), NOW);
    const dst = device();
    bk.restoreBackup(dst, file);
    expect(dst.getItem('patrimoine-accounts')).toBe('{"accounts":[{"id":"old"}]}');
    expect(dst.getItem('patrimoine-immo-real')).toBeNull();           // absent de la sauvegarde : retiré
    expect(dst.getItem('patrimoine-prices')).toBe('{"prices":{}}');   // cache conservé
    expect(dst.getItem('accPerfMode')).toBe('all');                   // hors préfixe : intouché
    const s = JSON.parse(dst.getItem('patrimoine-settings'));
    expect(s).toMatchObject({ theme: 'light', fmpApiKey: 'SECRET', lockHash: 'h' });
  });
  it('refuse les fichiers illisibles, étrangers, anciens, futurs ou corrompus avec un message clair', () => {
    expect(() => bk.parseBackup('pas du json')).toThrow('Fichier illisible');
    expect(() => bk.parseBackup('{"foo":1}')).toThrow('pas une sauvegarde de Mon patrimoine');
    expect(() => bk.parseBackup('{"version":"1.0.2","accounts":[]}')).toThrow('Ancien format');
    expect(() => bk.parseBackup('{"app":"mon-patrimoine","format":3,"data":{"patrimoine-x":"1"}}')).toThrow('plus récente');
    expect(() => bk.parseBackup('{"app":"mon-patrimoine","format":2,"data":{}}')).toThrow('vide');
    expect(() => bk.parseBackup('{"app":"mon-patrimoine","format":2,"data":{"autre":"1"}}')).toThrow('corrompue');
    expect(() => bk.parseBackup('{"app":"mon-patrimoine","format":2,"data":{"patrimoine-x":{}}}')).toThrow('corrompue');
  });
});

describe('date de dernière sauvegarde et rappel à 10 jours', () => {
  it('jamais sauvegardé : rappel', () => {
    const st = fakeStorage();
    expect(bk.lastBackupAt(st)).toBeNull();
    expect(bk.backupDue(st, NOW)).toBe(true);
    expect(bk.backupAgeLabel(st, NOW)).toBe('Jamais sauvegardé sur cet appareil');
  });
  it('rappel seulement au-delà de 10 jours', () => {
    const st = fakeStorage();
    bk.markBackup(st, NOW - 10 * DAY);
    expect(bk.backupDue(st, NOW)).toBe(false);
    bk.markBackup(st, NOW - 10 * DAY - 1);
    expect(bk.backupDue(st, NOW)).toBe(true);
    expect(bk.backupAgeLabel(st, NOW)).toBe('Dernière sauvegarde : il y a 10 jours');
  });
  it('libellés aujourd\'hui / hier ; date future ou illisible = inconnue', () => {
    const st = fakeStorage();
    bk.markBackup(st, NOW - 3600e3); expect(bk.backupAgeLabel(st, NOW)).toBe('Dernière sauvegarde : aujourd\'hui');
    bk.markBackup(st, NOW - DAY - 1); expect(bk.backupAgeLabel(st, NOW)).toBe('Dernière sauvegarde : hier');
    bk.markBackup(st, NOW + DAY); expect(bk.backupDue(st, NOW)).toBe(true);
    st.setItem('patrimoine-backup-meta', 'n\'importe quoi'); expect(bk.lastBackupAt(st)).toBeNull();
  });
  it('la date de sauvegarde n\'est pas exportée (elle concerne cet appareil)', () => {
    const st = device(); bk.markBackup(st, NOW);
    expect(bk.buildBackup(st, NOW).data['patrimoine-backup-meta']).toBeUndefined();
  });
});

describe('garde-fou : chaque clé de stockage du code est sauvegardée ou exclue explicitement', () => {
  const files = (function walk(d) {
    return readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
  })('js').concat(['mon-patrimoine.js']);
  const keys = new Set(files.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/'(patrimoine-[a-z0-9-]*)'/g)].map(m => m[1])));
  it('les clés trouvées commencent par le préfixe sauvegardé, ou figurent dans BACKUP_EXCLUDE', () => {
    expect(keys.size).toBeGreaterThan(8);
    for (const k of keys) {
      // préfixes dynamiques (« patrimoine-immo- » + mode) et clé complète : tous sous « patrimoine- » → sauvegardés,
      // sauf exclusion explicite avec une raison.
      expect(k.startsWith('patrimoine-')).toBe(true);
      if (k in bk.BACKUP_EXCLUDE) expect(bk.BACKUP_EXCLUDE[k].length).toBeGreaterThan(5);
    }
  });
  it('aucune donnée utilisateur stockée hors du préfixe (sinon elle échapperait à la sauvegarde)', () => {
    const outside = files.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/localStorage\.setItem\(\s*'([^']+)'/g)].map(m => m[1]))
      .filter(k => !k.startsWith('patrimoine-'));
    expect(outside).toEqual(['accPerfMode']);   // préférence d'affichage YTD / Historique : volontairement hors sauvegarde
  });
  // Règle : toute donnée ajoutée (nouveau module, nouveau réglage…) doit être sauvegardée. Chaque écriture dans le
  // stockage est vérifiée : sa clé doit commencer par « patrimoine- » (alors sauvegardée automatiquement), ou la ligne
  // doit dire pourquoi elle n'est pas sauvegardée (« hors sauvegarde : raison », ex. clés d'API).
  it('chaque écriture dans le stockage vise une clé sauvegardée, ou dit pourquoi elle ne l\'est pas', () => {
    const src = Object.fromEntries(files.map(f => [f, readFileSync(f, 'utf8')]));
    const consts = {};
    for (const t of Object.values(src)) for (const m of t.matchAll(/const ([A-Z_]+)\s*=\s*'([^']+)'/g)) consts[m[1]] = m[2];
    const bad = [];
    for (const [f, t] of Object.entries(src)) {
      t.split('\n').forEach((line, i) => {
        for (const m of line.matchAll(/\.setItem\(\s*([^,]+?)\s*,/g)) {
          const arg = m[1], where = `${f}:${i + 1} (${arg})`;
          if (/hors sauvegarde\s*:/.test(line)) continue;                               // exclusion justifiée sur la ligne
          if (/^'[^']*'$/.test(arg)) { if (!arg.startsWith("'patrimoine-") && arg !== "'accPerfMode'") bad.push(where); continue; }
          const id = arg.match(/^([A-Z_]+)$/);                                            // constante : sa valeur
          if (id) { if (!(consts[id[1]] || '').startsWith('patrimoine-')) bad.push(where); continue; }
          // clé calculée (préfixe + mode, clé de restauration…) : le fichier doit construire ses clés sous « patrimoine- »
          if (!/'patrimoine-[a-z-]*'|BACKUP_PREFIX|STORE_[A-Z_]+/.test(t)) bad.push(where);
        }
      });
    }
    expect(bad).toEqual([]);
  });
  it('pas d\'autre stockage que localStorage (il échapperait à la sauvegarde)', () => {
    const other = files.filter(f => /\b(indexedDB|sessionStorage|document\.cookie)\b/.test(readFileSync(f, 'utf8')));
    expect(other).toEqual([]);
  });
});

describe('date de dernière sauvegarde visible dans le menu ☰', () => {
  it('ligne du menu : libellé de la date, en rouge si le rappel est dû', () => {
    const S = { isDemo: false };
    const storage = fakeStorage();
    const m = loadClassic('js/features/backup.js', {
      globals: { S, localStorage: storage, toast() {}, openConfirm() {}, registerModal() {} },
      exports: ['drawerBackupRow', 'markBackup'],
    });
    expect(m.drawerBackupRow()).toContain('Jamais sauvegardé sur cet appareil');
    expect(m.drawerBackupRow()).toContain('dr-sub due');
    m.markBackup(storage, Date.now());
    expect(m.drawerBackupRow()).toContain('Dernière sauvegarde : aujourd\'hui');
    expect(m.drawerBackupRow()).not.toContain(' due');
  });
  it('le menu affiche la ligne et un toucher lance la sauvegarde', () => {
    const src = readFileSync('js/core/shell.js', 'utf8');
    expect(src).toContain('drawerBackupRow()');
    expect(src).toContain("if (e.target.closest('#js-drawer-backup')) { closeDrawer(); runBackup(); return; }");
  });
});

describe('accueil « À surveiller » : sauvegarde en retard', () => {
  it('signalée hors démo quand la sauvegarde est due, absente sinon', () => {
    const HOME_WATCH = {}, S = { isDemo: false };
    let due = true;
    loadClassic('js/screens/settings.js', {
      globals: { S, HOME_WATCH, SCREEN_BIND: {}, PU: {}, localStorage: {}, backupDue: () => due, backupAgeLabel: () => 'Dernière sauvegarde : il y a 12 jours' },
      exports: [],
    });
    expect(HOME_WATCH.backup()).toEqual([{ level: 'alert', go: 'settings', text: 'Sauvegarde à faire', sub: 'Dernière sauvegarde : il y a 12 jours' }]);
    S.isDemo = true;
    expect(HOME_WATCH.backup()).toEqual([]);
    S.isDemo = false; due = false;
    expect(HOME_WATCH.backup()).toEqual([]);
  });
});
