// Sauvegarde : destinations du fichier selon l'appareil (partage pour OneDrive / mail, dossier, téléchargement)
import { describe, it, expect } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const bk = loadClassic('js/features/backup.js', {
  globals: { S: { isDemo: false }, toast() {}, openConfirm() {}, registerModal() {} },
  exports: ['backupTargets', 'backupFileName', 'backupSheetHTML', 'BACKUP_TARGETS'],
});
const NOW = Date.UTC(2026, 10, 27, 12);

describe('sauvegarde : où enregistrer le fichier', () => {
  it('téléphone Android (partage de fichiers texte) : partager, puis télécharger', () => {
    const nav = { share() {}, canShare: d => d.files.every(f => f.type === 'text/plain' && f.name.endsWith('.txt')) };
    expect(bk.backupTargets({ window: {}, navigator: nav })).toEqual(['share', 'download']);
  });
  it('ordinateur (Chrome / Edge) : choisir un dossier, puis télécharger', () => {
    expect(bk.backupTargets({ window: { showSaveFilePicker() {} }, navigator: {} })).toEqual(['folder', 'download']);
  });
  it('navigateur sans partage ni dossier : téléchargement seul, toujours possible', () => {
    expect(bk.backupTargets({ window: {}, navigator: {} })).toEqual(['download']);
    expect(bk.backupTargets({ window: {}, navigator: { share() {}, canShare: () => false } })).toEqual(['download']);
  });
  it('nom du fichier daté ; en .txt pour le partage (Chrome refuse de partager un .json)', () => {
    expect(bk.backupFileName(NOW)).toBe('patrimoine-sauvegarde-2026-11-27.json');
    expect(bk.backupFileName(NOW, 'txt')).toBe('patrimoine-sauvegarde-2026-11-27.txt');
  });
  it('fenêtre : une ligne par destination, avec OneDrive et mail cités pour le partage', () => {
    const html = bk.backupSheetHTML(['share', 'download']);
    expect((html.match(/data-target=/g) || []).length).toBe(2);
    expect(html).toContain('OneDrive, Gmail');
    expect(html).toContain('Dossier Téléchargements');
  });
});
