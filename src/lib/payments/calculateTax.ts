/**
 * Calculate tax for registration purchases
 * Currently: 13% HST for Ontario on all purchases
 */

const HST_RATE = 0.13; // 13% HST for Ontario

/**
 * Calculate tax amount for a given subtotal
 * @param subtotal - The subtotal amount in dollars
 * @returns The tax amount in dollars
 */
export function calculateTax(subtotal: number): number {
  if (subtotal <= 0) {
    return 0;
  }
  
  // Round to 2 decimal places
  return Math.round(subtotal * HST_RATE * 100) / 100;
}

/**
 * Calculate total amount including tax
 * @param subtotal - The subtotal amount in dollars
 * @returns Object with subtotal, tax, and total amounts in dollars
 */
export function calculateTotalWithTax(subtotal: number): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const tax = calculateTax(subtotal);
  const total = Math.round((subtotal + tax) * 100) / 100; // Round to 2 decimal places
  
  return {
    subtotal,
    tax,
    total,
  };
}

/**
 * Get tax rate as a percentage string for display
 */
export function getTaxRateDisplay(): string {
  return '13%';
}

/**
 * Get tax label for display
 */
export function getTaxLabel(): string {
  return 'HST (Ontario)';
}

