import { describe, it, expect } from 'vitest';
import {
  toRefCcy, accSum, recalcHolding, computeRealizedPnL,
  fmtPct, timeSince, initials, mkTx, fxSubText,
} from './utils.js';

// Standard FX table used across tests: FX_RATES[X] = units of X per EUR
const FX = { EUR: 1, USD: 1.08, GBP: 1.16, CHF: 1.05, JPY: 163 };

// ─── mkTx ──────────────────────────────────────────────────────────────────
describe('mkTx', () => {
  it('creates a transaction object', () => {
    expect(mkTx('2023-01-01', 'BUY', 10, 150)).toEqual({
      date: '2023-01-01', type: 'BUY', qty: 10, price: 150,
    });
  });
});

// ─── toRefCcy ──────────────────────────────────────────────────────────────
describe('toRefCcy', () => {
  it('EUR → EUR = no change', () => {
    expect(toRefCcy(100, 'EUR', FX, 'EUR')).toBe(100);
  });
  it('USD → EUR (divides by USD rate)', () => {
    expect(toRefCcy(108, 'USD', FX, 'EUR')).toBeCloseTo(100, 4);
  });
  it('EUR → USD (multiplies by USD rate)', () => {
    expect(toRefCcy(100, 'EUR', FX, 'USD')).toBeCloseTo(108, 4);
  });
  it('USD → GBP (cross rate)', () => {
    // 108 USD → EUR → GBP: 108/1.08 * 1.16 = 116
    expect(toRefCcy(108, 'USD', FX, 'GBP')).toBeCloseTo(116, 4);
  });
  it('unknown currency defaults to 1 (treated as EUR)', () => {
    expect(toRefCcy(100, 'XXX', FX, 'EUR')).toBeCloseTo(100, 4);
  });
  it('defaults appCcy to EUR when omitted', () => {
    expect(toRefCcy(108, 'USD', FX)).toBeCloseTo(100, 4);
  });
});

// ─── accSum ────────────────────────────────────────────────────────────────
describe('accSum', () => {
  it('uses valueRef when available', () => {
    expect(accSum([{ value: 1000, valueRef: 950 }, { value: 2000, valueRef: 1900 }])).toBe(2850);
  });
  it('falls back to value when valueRef is undefined', () => {
    expect(accSum([{ value: 1000 }, { value: 2000, valueRef: undefined }])).toBe(3000);
  });
  it('null valueRef falls back to value', () => {
    expect(accSum([{ value: 500, valueRef: null }])).toBe(500);
  });
  it('0 valueRef is respected (not treated as falsy)', () => {
    expect(accSum([{ value: 500, valueRef: 0 }])).toBe(0);
  });
  it('empty array returns 0', () => {
    expect(accSum([])).toBe(0);
  });
});

// ─── recalcHolding ─────────────────────────────────────────────────────────
describe('recalcHolding', () => {
  it('single BUY — basic fields', () => {
    const h = { currentPrice: 200, currency: 'EUR', transactions: [mkTx('2023-01-01', 'BUY', 10, 150)] };
    recalcHolding(h, FX, 'EUR');
    expect(h.quantity).toBe(10);
    expect(h.avgBuyPrice).toBe(150);
    expect(h.value).toBe(2000);
    expect(h.pnl).toBeCloseTo(500);
    expect(h.pnlPct).toBeCloseTo(33.33, 1);
    expect(h.valueRef).toBe(2000);
    expect(h.pnlRef).toBeCloseTo(500);
  });

  it('multiple BUYs — weighted average price', () => {
    const h = {
      currentPrice: 100, currency: 'EUR',
      transactions: [mkTx('2023-01-01', 'BUY', 10, 80), mkTx('2023-06-01', 'BUY', 10, 120)],
    };
    recalcHolding(h, FX, 'EUR');
    expect(h.quantity).toBe(20);
    expect(h.avgBuyPrice).toBe(100);
    expect(h.pnl).toBeCloseTo(0);
  });

  it('BUY then partial SELL — remaining position correct', () => {
    const h = {
      currentPrice: 200, currency: 'EUR',
      transactions: [mkTx('2023-01-01', 'BUY', 10, 100), mkTx('2023-06-01', 'SELL', 5, 180)],
    };
    recalcHolding(h, FX, 'EUR');
    expect(h.quantity).toBe(5);
    expect(h.avgBuyPrice).toBe(100);
    expect(h.value).toBeCloseTo(1000);
    expect(h.pnl).toBeCloseTo(500);
  });

  it('USD holding in EUR app — valueRef converts correctly', () => {
    const h = { currentPrice: 108, currency: 'USD', transactions: [mkTx('2023-01-01', 'BUY', 1, 108)] };
    recalcHolding(h, FX, 'EUR');
    expect(h.value).toBe(108);               // stays in USD
    expect(h.valueRef).toBeCloseTo(100, 1);  // 108 / 1.08 = 100 EUR
    expect(h.pnlRef).toBeCloseTo(0, 1);
  });

  it('zero quantity when all shares sold', () => {
    const h = {
      currentPrice: 200, currency: 'EUR',
      transactions: [mkTx('2023-01-01', 'BUY', 5, 100), mkTx('2023-06-01', 'SELL', 5, 150)],
    };
    recalcHolding(h, FX, 'EUR');
    expect(h.quantity).toBe(0);
    expect(h.value).toBe(0);
    expect(h.pnl).toBe(0);
  });

  it('DIV transactions are ignored in quantity/cost calculation', () => {
    const h = {
      currentPrice: 100, currency: 'EUR',
      transactions: [mkTx('2023-01-01', 'BUY', 10, 80), mkTx('2023-06-01', 'DIV', 10, 2)],
    };
    recalcHolding(h, FX, 'EUR');
    expect(h.quantity).toBe(10);
    expect(h.avgBuyPrice).toBe(80);
  });
});

// ─── computeRealizedPnL ────────────────────────────────────────────────────
describe('computeRealizedPnL', () => {
  it('no sells → 0', () => {
    const h = { transactions: [mkTx('2023-01-01', 'BUY', 10, 100)] };
    expect(computeRealizedPnL(h)).toBe(0);
  });

  it('sell at profit', () => {
    const h = {
      transactions: [mkTx('2023-01-01', 'BUY', 10, 100), mkTx('2023-06-01', 'SELL', 5, 150)],
    };
    expect(computeRealizedPnL(h)).toBeCloseTo(250); // (150-100)*5
  });

  it('sell at loss', () => {
    const h = {
      transactions: [mkTx('2023-01-01', 'BUY', 10, 100), mkTx('2023-06-01', 'SELL', 5, 80)],
    };
    expect(computeRealizedPnL(h)).toBeCloseTo(-100); // (80-100)*5
  });

  it('multiple sells use correct running average', () => {
    const h = {
      transactions: [
        mkTx('2023-01-01', 'BUY',  10, 100),
        mkTx('2023-06-01', 'BUY',  10, 200),  // avg = 150
        mkTx('2023-09-01', 'SELL',  5, 180),  // realized = (180-150)*5 = 150
      ],
    };
    expect(computeRealizedPnL(h)).toBeCloseTo(150);
  });
});

// ─── fmtPct ────────────────────────────────────────────────────────────────
describe('fmtPct', () => {
  it('positive value shows "+"', () => {
    expect(fmtPct(5.5)).toBe('+5,50 %');
  });
  it('negative value no "+"', () => {
    expect(fmtPct(-3.14)).toBe('-3,14 %');
  });
  it('zero shows "+"', () => {
    expect(fmtPct(0)).toBe('+0,00 %');
  });
});

// ─── timeSince ─────────────────────────────────────────────────────────────
describe('timeSince', () => {
  const NOW = 1_700_000_000_000; // fixed reference — avoids Date.now() non-determinism
  it('< 1 min → instant', () => {
    expect(timeSince(NOW - 30_000, NOW)).toBe("à l'instant");
  });
  it('5 min', () => {
    expect(timeSince(NOW - 5 * 60_000, NOW)).toBe('il y a 5 min');
  });
  it('2 hours', () => {
    expect(timeSince(NOW - 2 * 3_600_000, NOW)).toBe('il y a 2h');
  });
  it('3 days', () => {
    expect(timeSince(NOW - 3 * 86_400_000, NOW)).toBe('il y a 3j');
  });
  it('exactly 60 min → 1 hour (not 60 min)', () => {
    expect(timeSince(NOW - 60 * 60_000, NOW)).toBe('il y a 1h');
  });
});

// ─── initials ──────────────────────────────────────────────────────────────
describe('initials', () => {
  it('two words', () => expect(initials('Apple Inc')).toBe('AI'));
  it('single word', () => expect(initials('LVMH')).toBe('L'));
  it('three words → takes first two', () => expect(initials('BNP Paribas SA')).toBe('BP'));
});

// ─── fxSubText ─────────────────────────────────────────────────────────────
describe('fxSubText', () => {
  it('no updatedAt → "Valeurs approximatives"', () => {
    expect(fxSubText(FX, 'EUR', null)).toBe('Valeurs approximatives');
    expect(fxSubText(FX, 'EUR', 0)).toBe('Valeurs approximatives');
  });

  it('EUR app → shows two non-EUR pairs with "·" separator', () => {
    const text = fxSubText(FX, 'EUR', 1_700_000_000);
    expect(text).toContain('1 EUR =');
    expect(text).toContain('$');
    expect(text).toContain(' · ');
  });

  it('USD app → first pair references USD', () => {
    const text = fxSubText(FX, 'USD', 1_700_000_000);
    expect(text).toContain('1 USD =');
    expect(text).toContain('€');
  });

  it('JPY rate >= 10 → displayed with 2 decimal places', () => {
    // 1 EUR = 163 JPY (>= 10), so toFixed(2) is used
    // Build a simple FX where appCcy is EUR and first non-EUR is JPY
    const jpyFX = { EUR: 1, JPY: 163 };
    const text = fxSubText(jpyFX, 'EUR', 1_700_000_000);
    expect(text).toContain('163.00');
  });
});
