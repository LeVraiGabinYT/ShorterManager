// A compact "days from now" reading for a date — "J-3" (in 3 days), "Aujourd'hui", "J+2" (2 days
// ago) — so a shoot/publish/due date can be scanned at a glance instead of mentally computing an
// offset from a raw calendar date every time.
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

export function formatCountdown(dateStr: string | null, now: Date = new Date()): Countdown | null {
  if (!dateStr) return null
  const days = daysFromNow(dateStr, now)

  if (days === 0) return { label: 'Aujourd’hui', tone: 'today' }
  if (days > 0) {
    const label = `J-${days}`
    if (days === 1) return { label, tone: 'urgent' }
    if (days <= 3) return { label, tone: 'soon' }
    return { label, tone: 'neutral' }
  }

  const label = `J+${Math.abs(days)}`
  return { label, tone: days >= -2 ? 'soon' : 'past' }
}

export const COUNTDOWN_TONE_CLASS: Record<CountdownTone, string> = {
  urgent: 'border-red-500/40 bg-red-500/20 text-red-300',
  soon: 'border-amber-500/40 bg-amber-500/20 text-amber-300',
  today: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300',
  neutral: 'border-white/10 bg-white/5 text-gray-400',
  past: 'border-white/10 bg-white/5 text-gray-500'
}
