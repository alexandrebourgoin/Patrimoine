import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Écran Compte : les lignes de positions n'ont plus de boutons (⭐ + 🗑) qui écrasaient « quantité × cours · type ».
// Toutes les actions sont dans la fiche du titre : favori, mouvement, modifier, et supprimer (fiche « Modifier »).
const account = readFileSync('js/screens/account.js', 'utf8');
const rows = account.slice(account.indexOf('function renderHoldsHTML'), account.indexOf('// ── MOUVEMENTS DU COMPTE'));

describe('lignes de positions', () => {
  it('aucun bouton d\'action dans la ligne ; un toucher ouvre la fiche du titre', () => {
    expect(rows).not.toMatch(/hold-(watch|add|del)-btn/);
    expect(rows).toContain("S.holdingId=item.dataset.hid; go('stock');");
  });
  it('la fiche titre garde favori, ajout de mouvement et modification', () => {
    const stock = readFileSync('js/screens/stock.js', 'utf8');
    for (const id of ['js-watch-toggle', 'js-edit-holding']) expect(stock).toContain(id);
    expect(stock).toContain('Ajouter un mouvement');
  });
  it('supprimer un titre : bouton dans « Modifier », avec confirmation, puis retour au compte', () => {
    expect(readFileSync('mon-patrimoine.html', 'utf8')).toContain('id="eh-delete"');
    expect(readFileSync('js/modals/position.js', 'utf8')).toContain('deleteHolding(accId,holdId);');
    const del = account.slice(account.indexOf('function deleteHolding'), account.indexOf('function applyRefresh'));
    expect(del).toContain('openConfirm(');
    expect(del).toContain("if (S.screen==='stock') back();");
  });
});
