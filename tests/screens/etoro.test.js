import { describe, it, expect } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const make = (accounts, HOME_WATCH) => loadClassic('js/screens/etoro.js', {
  globals: { S: { accounts }, esc: s => String(s), timeSince: () => 'il y a 5 min', fmtNative: (v, c) => `${v} ${c}`, _CHIP: '',
    ...(HOME_WATCH ? { HOME_WATCH } : {}) },
  exports: ['etoroBannerHTML'],
});

describe('compte eToro : écran', () => {
  it('bandeau : lecture seule, dernière synchro, solde eToro, erreur, boutons ; rien pour un compte normal', () => {
    const acc = { id: 'e', name: 'eToro', sync: { provider: 'etoro', lastSync: 1, equityUSD: 6136, error: 'Clés refusées' } };
    const html = make([acc]).etoroBannerHTML(acc);
    expect(html).toContain('Synchronisé avec eToro · lecture seule');
    expect(html).toContain('Dernière synchro : <b>il y a 5 min</b> · solde eToro 6136 USD');
    expect(html).toContain('⚠ Clés refusées');
    expect(html).toContain('id="js-etoro-sync"');
    expect(html).toContain('id="js-etoro-keys"');
    expect(make([]).etoroBannerHTML({ id: 'x' })).toBe('');
  });
  it('« À surveiller » : compte en échec ou synchronisé depuis plus de 24 h', () => {
    const HW = {};
    const now = Date.now();
    make([{ id: 'a', name: 'OK', sync: { provider: 'etoro', lastSync: now - 3600e3 } },
      { id: 'b', name: 'Vieux', sync: { provider: 'etoro', lastSync: now - 30 * 3600e3 } },
      { id: 'c', name: 'Cassé', sync: { provider: 'etoro', lastSync: now, error: 'Clés refusées' } }], HW);
    expect(HW.etoro().map(x => [x.text, x.sub, x.accountId])).toEqual([
      ['« Vieux » non synchronisé avec eToro', 'Dernière synchro de plus de 24 h', 'b'],
      ['« Cassé » non synchronisé avec eToro', 'Clés refusées', 'c'],
    ]);
  });
});
