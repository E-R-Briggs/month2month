export const CURRENCY_OPTIONS = [
  { code: 'GBP', label: 'British Pound', symbol: '\u00A3' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '\u20AC' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '\u00A5' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'];

const CURRENCY_MAP = Object.fromEntries(
  CURRENCY_OPTIONS.map(c => [c.code, c]),
) as Record<CurrencyCode, (typeof CURRENCY_OPTIONS)[number]>;

export function formatCurrency(amount: number, code: CurrencyCode = 'GBP'): string {
  try {
    const fractionDigits = code === 'JPY' ? 0 : 2;
    const isNegative = amount < 0;
    const formatted = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(isNegative ? -amount : amount);
    const symbol = CURRENCY_MAP[code]?.symbol || '\u00A3';
    return isNegative ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
  } catch {
    const symbol = CURRENCY_MAP[code]?.symbol || '\u00A3';
    const prefix = amount < 0 ? '-' : '';
    return `${prefix}${symbol}${Math.abs(amount).toFixed(2)}`;
  }
}

export function getCurrencySymbol(code: CurrencyCode = 'GBP'): string {
  return CURRENCY_MAP[code]?.symbol || '\u00A3';
}
