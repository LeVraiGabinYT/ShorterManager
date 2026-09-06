export function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatPrice(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

export function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—'
  return Math.round(value).toLocaleString('fr-FR')
}

export function formatRelativeTime(value: string | null): string {
  if (!value) return 'inconnue'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'inconnue'
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays < 0) return 'à venir'
  if (diffDays === 0) return "aujourd'hui"
  if (diffDays === 1) return 'hier'
  if (diffDays < 14) return `il y a ${diffDays} jours`
  if (diffDays < 60) return `il y a ${Math.round(diffDays / 7)} semaines`
  if (diffDays < 730) return `il y a ${Math.round(diffDays / 30)} mois`
  return `il y a ${Math.round(diffDays / 365)} ans`
}

export function toDateInputValue(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}
