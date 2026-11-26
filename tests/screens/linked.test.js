import { describe, it, expect } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const SVC = { etoro: { label: 'eToro' } };
const make = (accounts, HOME_WATCH) => loadClassic('js/screens/linked.js', {
  globals: { S: { accounts }, esc: s => String(s), timeSince: () => 'il y a 5 min', LINKED_SERVICES: SVC,
    linkedService: a => (a && a.sync && SVC[a.sync.provider]) || null, ...(HOME_WATCH ? { HOME_WATCH } : {}) },
  exports: ['linkedChipHTML'],
});

describe('compte lié : écran', () => {
  it('pastille discrète « eToro · il y a 5 min », orange et message en cas d échec ; rien pour un compte normal', () => {
    const ok = { id: 'e', sync: { provider: 'etoro', lastSync: 1 } };
    const html = make([ok]).linkedChipHTML(ok);
    expect(html).toContain('id="js-linked"');
    expect(html).toContain('eToro · il y a 5 min');
    expect(html).not.toContain('⚠');
    const ko = { id: 'k', sync: { provider: 'etoro', lastSync: 1, error: 'Clé refusée' } };
    expect(make([ko]).linkedChipHTML(ko)).toMatch(/· ⚠[\s\S]*Clé refusée/);
    expect(make([]).linkedChipHTML({ id: 'x' })).toBe('');
  });
  it('« À surveiller » : compte en échec ou synchronisé depuis plus de 24 h', () => {
    const HW = {};
    const now = Date.now();
    make([{ id: 'a', name: 'OK', sync: { provider: 'etoro', lastSync: now - 3600e3 } },
      { id: 'b', name: 'Vieux', sync: { provider: 'etoro', lastSync: now - 30 * 3600e3 } },
      { id: 'c', name: 'Cassé', sync: { provider: 'etoro', lastSync: now, error: 'Clé refusée' } }], HW);
    expect(HW.linked().map(x => [x.text, x.sub, x.accountId])).toEqual([
      ['« Vieux » non mis à jour par eToro', 'Dernière synchro de plus de 24 h', 'b'],
      ['« Cassé » non mis à jour par eToro', 'Clé refusée', 'c'],
    ]);
  });
});
