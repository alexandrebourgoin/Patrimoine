import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../utils.js';   // expose PU (PU.dayKey : date locale)
import { loadClassic } from '../helpers/load-classic.js';

// Tables de référence réelles (ISIN → ticker, base de titres) injectées comme dans le navigateur.
const { ISIN_MAP, SECURITIES_DB } = loadClassic('js/data/securities.js', { exports: ['ISIN_MAP', 'SECURITIES_DB'] });
const toast = vi.fn();
const { parseCsvText, parseCSV, _csvParseLine, _csvCleanNum, _csvParseDate } = loadClassic('js/services/csv-import.js', {
  globals: {
    S: { accounts: [] }, ISIN_MAP, SECURITIES_DB, toast, esc: s => String(s),
    registerModal() {}, recalcHolding() {}, refreshMain() {}, haptic() {},
  },
  exports: ['parseCsvText', 'parseCSV', '_csvParseLine', '_csvCleanNum', '_csvParseDate'],
});
afterEach(() => { toast.mockClear(); vi.useRealTimers(); });

describe('_csvCleanNum (nombres français et anglais)', () => {
  it('format français : espaces, point des milliers, virgule décimale', () => {
    expect(_csvCleanNum('1 234,56')).toBe(1234.56);
    expect(_csvCleanNum('1.234,56')).toBe(1234.56);
    expect(_csvCleanNum('12,5')).toBe(12.5);
  });
  it('format anglais : virgule des milliers, point décimal', () => {
    expect(_csvCleanNum('1,234.56')).toBe(1234.56);
    expect(_csvCleanNum('1234.5')).toBe(1234.5);
  });
  it('entiers, négatifs, guillemets', () => {
    expect(_csvCleanNum('1000')).toBe(1000);
    expect(_csvCleanNum('-5,5')).toBe(-5.5);
    expect(_csvCleanNum('"1 000"')).toBe(1000);
  });
  it('vide ou illisible → 0 (jamais NaN)', () => {
    expect(_csvCleanNum('')).toBe(0);
    expect(_csvCleanNum(undefined)).toBe(0);
    expect(_csvCleanNum('abc')).toBe(0);
  });
});

describe('_csvParseDate', () => {
  it('JJ-MM-AAAA et JJ/MM/AAAA → AAAA-MM-JJ', () => {
    expect(_csvParseDate('15-03-2024')).toBe('2024-03-15');
    expect(_csvParseDate('15/03/2024')).toBe('2024-03-15');
  });
  it('ISO conservé, heure ignorée ; format inconnu renvoyé tel quel', () => {
    expect(_csvParseDate('2024-03-15')).toBe('2024-03-15');
    expect(_csvParseDate('2024-03-15T10:00:00Z')).toBe('2024-03-15');
    expect(_csvParseDate('hier')).toBe('hier');
  });
  it('date absente : jour LOCAL, pas UTC (00h30 locale = encore le même jour)', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 27, 0, 30));
    expect(_csvParseDate('')).toBe('2026-11-27');
  });
  it('vide → date du jour', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2024, 5, 15, 12));
    expect(_csvParseDate('')).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('_csvParseLine', () => {
  it('découpe, retire les espaces et les guillemets', () => {
    expect(_csvParseLine('a; b ;"c";d', ';')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('un délimiteur entre guillemets ne coupe pas la cellule', () => {
    expect(_csvParseLine('x;"y;z";w', ';')).toEqual(['x', 'y;z', 'w']);
    expect(_csvParseLine('"1,5",2', ',')).toEqual(['1,5', '2']);
  });
});

describe('parseCsvText — erreurs', () => {
  it('vide ou une seule ligne', () => {
    expect(parseCsvText('')).toEqual({ error: 'CSV vide ou invalide' });
    expect(parseCsvText('Date;Produit')).toEqual({ error: 'CSV vide ou invalide' });
  });
  it('aucune ligne exploitable', () => {
    const r = parseCsvText('account,ticker,name,date,type,quantity,price\nPEA,,,2024-01-01,BUY,,');
    expect(r).toEqual({ error: 'Aucun mouvement valide détecté dans ce fichier' });
  });
});

describe('parseCsvText — format générique', () => {
  const head = 'account,ticker,name,date,type,quantity,price';
  it('ligne complète', () => {
    const r = parseCsvText(`${head}\nPEA,MC,LVMH,2024-01-10,BUY,3,100`);
    expect(r.format).toBe('Générique');
    expect(r.rows).toEqual([{ date: '2024-01-10', type: 'BUY', ticker: 'MC', name: 'LVMH', qty: 3, price: 100, _account: 'PEA' }]);
    expect(r.unknownTickers.size).toBe(0);
  });
  it('type en majuscules, nom repris de la base si absent, ticker en majuscules', () => {
    const r = parseCsvText(`${head}\nCTO,aapl,,15/02/2024,sell,2,"190,5"`);
    expect(r.rows[0]).toMatchObject({ ticker: 'AAPL', name: 'Apple', type: 'SELL', date: '2024-02-15', qty: 2, price: 190.5 });
  });
  it('ligne incomplète → _skip ; ticker hors base signalé comme inconnu', () => {
    const r = parseCsvText(`${head}\nPEA,MC,LVMH,2024-01-10,BUY,3,100\nPEA,MC,LVMH,2024-01-11,BUY,3,\nPEA,ZZZ,,2024-01-12,BUY,1,5`);
    expect(r.rows.map(x => x._skip === true)).toEqual([false, true, false]);
    expect([...r.unknownTickers]).toEqual(['ZZZ']);
    expect(r.rows[2].name).toBe('ZZZ');                    // nom = ticker faute de mieux
  });
  it('fins de ligne CRLF et lignes vides ignorées', () => {
    const r = parseCsvText(`${head}\r\n\r\nPEA,MC,LVMH,2024-01-10,BUY,3,100\r\n`);
    expect(r.rows).toHaveLength(1);
  });
});

describe('parseCsvText — format Degiro (détecté par ISIN + quantité)', () => {
  const head = 'Date;Produit;Code ISIN;Quantité;Cours';
  it('ticker résolu depuis l\'ISIN, nombres français, date JJ-MM-AAAA', () => {
    const r = parseCsvText(`${head}\n15-03-2024;APPLE INC;US0378331005;10;"1 234,56"`);
    expect(r.format).toBe('Degiro (auto-détecté)');
    expect(r.rows).toEqual([{ date: '2024-03-15', type: 'BUY', ticker: 'AAPL', name: 'Apple', qty: 10, price: 1234.56 }]);
  });
  it('quantité négative = vente (valeur absolue)', () => {
    const r = parseCsvText(`${head}\n16-03-2024;APPLE INC;US0378331005;-5;180,2`);
    expect(r.rows[0]).toMatchObject({ type: 'SELL', qty: 5, price: 180.2 });
  });
  it('ISIN inconnu : ticker = 1er mot du produit (suffixes « COMMON STOCK… » retirés), signalé inconnu', () => {
    const r = parseCsvText(`${head}\n17-03-2024;FOO CORP - COMMON STOCK;XX0000000000;3;10`);
    expect(r.rows[0]).toMatchObject({ ticker: 'FOO', name: 'FOO CORP', qty: 3, price: 10 });
    expect([...r.unknownTickers]).toEqual(['FOO']);
  });
  it('frais et lignes sans cours ou sans quantité : ignorés (ni importés ni comptés comme « ignorés »)', () => {
    const r = parseCsvText(`${head}\n15-03-2024;APPLE INC;US0378331005;10;100\n15-03-2024;FRAIS;;0;5\n15-03-2024;DIVIDENDE;US0378331005;10;0`);
    expect(r.rows).toHaveLength(1);
  });
});

describe('parseCSV (enveloppe avec interface)', () => {
  it('erreur → message affiché dans un toast, pas d\'aperçu', () => {
    parseCSV('');
    expect(toast).toHaveBeenCalledWith('CSV vide ou invalide');
  });
  it('fichier valide → aucun toast d\'erreur, l\'aperçu est construit sans exception', () => {
    expect(() => parseCSV('account,ticker,name,date,type,quantity,price\nPEA,MC,LVMH,2024-01-10,BUY,3,100')).not.toThrow();
    expect(toast).not.toHaveBeenCalled();
  });
});
