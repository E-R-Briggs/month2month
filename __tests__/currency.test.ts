import { formatCurrency, getCurrencySymbol, CURRENCY_OPTIONS } from '../utils/currency';

describe('formatCurrency', () => {
  it('formats GBP with £ symbol and 2 decimals', () => {
    expect(formatCurrency(50, 'GBP')).toBe('£50.00');
  });

  it('formats negative values with minus sign', () => {
    expect(formatCurrency(-50, 'GBP')).toBe('-£50.00');
  });

  it('formats zero', () => {
    expect(formatCurrency(0, 'GBP')).toBe('£0.00');
  });

  it('formats large numbers with commas', () => {
    expect(formatCurrency(1234.56, 'GBP')).toBe('£1,234.56');
  });

  it('formats JPY with no decimals', () => {
    expect(formatCurrency(500, 'JPY')).toBe('¥500');
  });

  it('formats USD with $ symbol', () => {
    expect(formatCurrency(25, 'USD')).toBe('$25.00');
  });

  it('formats EUR with € symbol', () => {
    expect(formatCurrency(10, 'EUR')).toBe('€10.00');
  });

  it('uses GBP as default currency', () => {
    expect(formatCurrency(5)).toBe('£5.00');
  });
});

describe('getCurrencySymbol', () => {
  it('returns £ for GBP', () => {
    expect(getCurrencySymbol('GBP')).toBe('£');
  });

  it('returns $ for USD', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
  });

  it('returns ¥ for JPY', () => {
    expect(getCurrencySymbol('JPY')).toBe('¥');
  });

  it('returns £ as default', () => {
    expect(getCurrencySymbol()).toBe('£');
  });
});

describe('CURRENCY_OPTIONS', () => {
  it('has 6 currencies', () => {
    expect(CURRENCY_OPTIONS).toHaveLength(6);
  });

  it('includes GBP, USD, EUR, JPY, CAD, AUD', () => {
    const codes = CURRENCY_OPTIONS.map(c => c.code);
    expect(codes).toEqual(['GBP', 'USD', 'EUR', 'JPY', 'CAD', 'AUD']);
  });
});
