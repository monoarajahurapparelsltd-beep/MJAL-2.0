/**
 * Currency Utility for Bangladeshi Taka (BDT) and USD formatting.
 *
 * Rules:
 * - When BDT amount >= 1 Crore (10,000,000 BDT), show concise Crore format (e.g., "৳ 1.25 Cr")
 * - When BDT amount < 1 Crore, show full exact amount (e.g., "৳ 8,550,000" or "৳ 85,50,000")
 * - Provides full breakdown and helper values for tooltips and secondary cards.
 */

export interface BDTFormatResult {
  display: string;
  fullAmount: string;
  isCrore: boolean;
  shortFormatted: string;
  croreValue: number;
  toString(): string;
}

export function formatBDT(amount: number): BDTFormatResult {
  const num = Math.round(Number(amount) || 0);
  const CRORE = 10_000_000;
  
  // Format full amount with Indian/South Asian style or standard localized commas
  const fullAmount = `৳ ${num.toLocaleString('en-IN')}`;

  if (num >= CRORE) {
    const croreVal = num / CRORE;
    // Format to 2 decimal places, e.g. 1.25 Cr, 14.80 Cr
    const formattedCrore = croreVal >= 100 ? croreVal.toFixed(1) : croreVal.toFixed(2);
    const shortFormatted = `৳ ${formattedCrore} Cr`;
    return {
      display: shortFormatted,
      fullAmount,
      isCrore: true,
      shortFormatted,
      croreValue: croreVal,
      toString() {
        return this.display;
      }
    };
  } else {
    return {
      display: fullAmount,
      fullAmount,
      isCrore: false,
      shortFormatted: fullAmount,
      croreValue: num / CRORE,
      toString() {
        return this.display;
      }
    };
  }
}

/**
 * Quick helper returning only the display string
 */
export function formatBDTDisplay(amount: number): string {
  return formatBDT(amount).display;
}

/**
 * Exchange rate configuration (Standard Industry Benchmark: 1 USD = 120 BDT)
 */
export const USD_TO_BDT_RATE = 120;
