import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadClassic } from '../helpers/load-classic.js';

const S = { lockUntil: 0 };
const { _lockPenalty, _lockBlockedFor, _eqConst, _hex, _b64u, _unb64u, _randomPin, _pinHash } =
  loadClassic('js/features/lock.js', {
    globals: { S, toast() {}, saveSettings() {}, haptic() {} },
    exports: ['_lockPenalty', '_lockBlockedFor', '_eqConst', '_hex', '_b64u', '_unb64u', '_randomPin', '_pinHash'],
  });

afterEach(() => { vi.useRealTimers(); S.lockUntil = 0; });

describe('_lockPenalty (anti-force brute)', () => {
  it('aucun blocage sous 5 échecs', () => {
    for (const n of [0, 1, 4]) expect(_lockPenalty(n)).toBe(0);
  });
  it('paliers 30 s / 60 s / 300 s', () => {
    for (const n of [5, 6]) expect(_lockPenalty(n)).toBe(30);
    for (const n of [7, 8]) expect(_lockPenalty(n)).toBe(60);
    for (const n of [9, 10, 50]) expect(_lockPenalty(n)).toBe(300);
  });
});

describe('_lockBlockedFor', () => {
  it('secondes restantes arrondies au supérieur, 0 une fois écoulé', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2025, 0, 1));
    S.lockUntil = Date.now() + 4200; expect(_lockBlockedFor()).toBe(5);
    S.lockUntil = Date.now() - 1;    expect(_lockBlockedFor()).toBe(0);
    S.lockUntil = 0;                 expect(_lockBlockedFor()).toBe(0);
  });
});

describe('_eqConst (comparaison à temps constant)', () => {
  it('égalité stricte de chaînes', () => {
    expect(_eqConst('abcdef', 'abcdef')).toBe(true);
    expect(_eqConst('abcdef', 'abcdeg')).toBe(false);
  });
  it('longueurs différentes ou types non-chaîne → false', () => {
    expect(_eqConst('abc', 'abcd')).toBe(false);
    expect(_eqConst('1', 1)).toBe(false);
    expect(_eqConst(undefined, undefined)).toBe(false);
  });
});

describe('encodages', () => {
  it('_hex : octets → hexadécimal sur 2 caractères', () => {
    expect(_hex(new Uint8Array([0, 15, 255]).buffer)).toBe('000fff');
  });
  it('_b64u : base64url sans padding (+ → -, / → _)', () => {
    expect(_b64u(new Uint8Array([0xfb, 0xff, 0xfe]).buffer)).toBe('-__-');
    expect(_b64u(new Uint8Array([1]).buffer)).toBe('AQ');   // padding « == » retiré
  });
  it('_unb64u inverse _b64u', () => {
    const bytes = Uint8Array.from({ length: 40 }, (_, i) => (i * 37) % 256);
    expect([..._unb64u(_b64u(bytes.buffer))]).toEqual([...bytes]);
  });
});

describe('_randomPin', () => {
  it('uniquement des chiffres, longueur 6 par défaut', () => {
    for (let i = 0; i < 50; i++) expect(_randomPin()).toMatch(/^\d{6}$/);
  });
  it('longueur personnalisable', () => {
    expect(_randomPin(10)).toMatch(/^\d{10}$/);
  });
});

describe('_pinHash (PBKDF2-SHA256)', () => {
  it('déterministe : même code + même sel → même dérivé de 64 hex', async () => {
    const a = await _pinHash('123456', 'aa'.repeat(16));
    const b = await _pinHash('123456', 'aa'.repeat(16));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });
  it('un autre code ou un autre sel change le dérivé', async () => {
    const base = await _pinHash('123456', 'aa'.repeat(16));
    expect(await _pinHash('123457', 'aa'.repeat(16))).not.toBe(base);
    expect(await _pinHash('123456', 'bb'.repeat(16))).not.toBe(base);
  });
});
