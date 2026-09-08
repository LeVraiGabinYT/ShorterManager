import type { ReactElement } from 'react'
import { COUNTDOWN_TONE_CLASS, formatCountdown } from '../lib/countdown'

interface CountdownBadgeProps {
  date: string | null
}

export function CountdownBadge({ date }: CountdownBadgeProps): ReactElement | null {
  const countdown = formatCountdown(date)
  if (!countdown) return null

  return (
    <span
      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${COUNTDOWN_TONE_CLASS[countdown.tone]}`}
    >
      {countdown.label}
    </span>
  )
}
