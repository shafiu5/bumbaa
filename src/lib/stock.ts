export function stockColorClass(current: number, threshold: number | null): string {
  if (current < 0) return 'text-red-600 dark:text-red-400'
  if (threshold != null && current <= threshold) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}
