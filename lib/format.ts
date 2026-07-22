export function formatINR(value: number | string | null | undefined, options?: { compact?: boolean }) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    notation: options?.compact ? 'compact' : 'standard',
  }).format(amount);
}
