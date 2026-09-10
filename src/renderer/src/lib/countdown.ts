// A compact "days from now" reading for a date — "Avant-hier"/"Hier"/"Aujourd'hui"/"Demain"/
// "Après-demain" for anything within 2 days, then "Dans X jours"/"Il y a X jours" out to a week,
// then weeks, then months past that — so a shoot/publish/due date can be scanned at a glance
// instead of mentally computing an offset from a raw calendar date every time.
export type CountdownTone = 'urgent' | 'soon' | 'today' | 'neutral' | 'past'

export interface Countdown {
  label: string
  tone: CountdownTone
}

function daysFromNow(dateStr: string, now: Date): number {
  const target = new Date(dateStr.slice(0, 10) + 'T00:00:00')
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

// French plural — irregular forms (e.g. "mois", same in singular and plural) pass their own.
function count(n: number, singular: string, plural: string = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

// Beyond a week, "X jours" stops being an at-a-glance unit — switch to weeks, then to months
// beyond about a month, rounding to the nearest whole unit.
function magnitudeLabel(days: number): string {
  if (days <= 7) return count(days, 'jour')
  if (days <= 30) return count(Math.round(days / 7), 'semaine')
  return count(Math.round(days / 30), 'mois', 'mois')
}

export function formatCountdown(dateStr: string | null, now: Date = new Date()): Countdown | null {
  if (!dateStr) return null
  const days = daysFromNow(dateStr, now)

  if (days === -2) return { label: 'Avant-hier', tone: 'past' }
  if (days === -1) return { label: 'Hier', tone: 'soon' }
  if (days === 0) return { label: 'Aujourd’hui', tone: 'today' }
  if (days === 1) return { label: 'Demain', tone: 'urgent' }
  if (days === 2) return { label: 'Après-demain', tone: 'soon' }

  if (days > 2) {
    return { label: `Dans ${magnitudeLabel(days)}`, tone: days <= 3 ? 'soon' : 'neutral' }
  }

  return { label: `Il y a ${magnitudeLabel(Math.abs(days))}`, tone: 'past' }
}

export const COUNTDOWN_TONE_CLASS: Record<CountdownTone, string> = {
  urgent: 'border-red-500/40 bg-red-500/20 text-red-300',
  soon: 'border-amber-500/40 bg-amber-500/20 text-amber-300',
  today: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300',
  neutral: 'border-white/10 bg-white/5 text-gray-400',
  past: 'border-white/10 bg-white/5 text-gray-500'
}
