export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function nextMonthKey(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  const next = new Date(year, month, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', {
    month: 'short',
    year: '2-digit'
  })
}

export function todayMonthKey(): string {
  return monthKey(new Date().toISOString())
}
