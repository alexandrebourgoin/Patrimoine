import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadClassic } from '../helpers/load-classic.js';

// ── Le registre lui-même, avec un faux DOM : { id → classes présentes } ──
const shown = new Set();
const doc = { getElementById: id => ({ classList: { contains: c => c === 'show' && shown.has(id) } }) };
const { registerModal, anyModalOpen, closeAllModals, MODAL_REGISTRY } =
  loadClassic('js/core/modals.js', { globals: { document: doc }, exports: ['registerModal', 'anyModalOpen', 'closeAllModals', 'MODAL_REGISTRY'] });

describe('registre de modales', () => {
  it('anyModalOpen : vrai dès qu\'une feuille enregistrée porte la classe « show »', () => {
    registerModal('a-sheet', () => {});
    registerModal('b-sheet', () => {});
    expect(anyModalOpen()).toBe(false);
    shown.add('b-sheet');
    expect(anyModalOpen()).toBe(true);
    shown.clear();
  });
  it('une feuille non enregistrée est ignorée', () => {
    shown.add('inconnue-sheet');
    expect(anyModalOpen()).toBe(false);
    shown.clear();
  });
  it('closeAllModals appelle TOUTES les fermetures (comme les anciennes listes), ouvertes ou non', () => {
    MODAL_REGISTRY.length = 0;
    const a = vi.fn(), b = vi.fn(), c = vi.fn();
    registerModal('a-sheet', a); registerModal('b-sheet', b); registerModal('c-sheet', c);
    shown.add('b-sheet');
    closeAllModals();
    expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledOnce(); expect(c).toHaveBeenCalledOnce();
    shown.clear();
  });
});

// ── Garde-fou sur le code réel : plus d'oubli possible ──
// (cas déjà arrivé : edit-holding-sheet n'était dans aucune des deux listes → le retour Android ne la fermait pas)
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = f => readFileSync(join(root, f), 'utf8');
const walk = d => readdirSync(join(root, d)).flatMap(n => {
  const rel = `${d}/${n}`;
  return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
});
const jsFiles = walk('js').filter(f => f.endsWith('.js'));
const SHEETS_NOT_REGISTERED = ['tp-sheet']; // choix du type, empilé au-dessus des fenêtres de compte : gardé à part dans les handlers

const registrations = jsFiles.flatMap(f =>
  [...read(f).matchAll(/registerModal\('([a-z-]+-sheet)',\s*([A-Za-z_]+)\)/g)].map(m => ({ file: f, sheet: m[1], close: m[2] })));

describe('toutes les feuilles du HTML sont enregistrées', () => {
  const htmlSheets = [...read('mon-patrimoine.html').matchAll(/id="([a-z-]+-sheet)"/g)].map(m => m[1]);

  it('chaque feuille #…-sheet du HTML a un registerModal (sauf le choix du type, empilé)', () => {
    const registered = registrations.map(r => r.sheet);
    for (const id of htmlSheets.filter(id => !SHEETS_NOT_REGISTERED.includes(id)))
      expect(registered, id).toContain(id);
  });
  it('aucune feuille enregistrée deux fois, aucune feuille inexistante', () => {
    const ids = registrations.map(r => r.sheet);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    for (const id of ids) expect(htmlSheets, id).toContain(id);
  });
  it('la fonction de fermeture enregistrée est définie dans le même fichier', () => {
    for (const r of registrations)
      expect(read(r.file), `${r.file} : ${r.close}`).toMatch(new RegExp(`function ${r.close}\\s*\\(`));
  });
});
