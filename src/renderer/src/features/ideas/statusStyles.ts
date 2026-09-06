import type { CSSProperties } from 'react'

export function getStatusBadgeStyle(color: string): CSSProperties {
  return { backgroundColor: `${color}26`, borderColor: `${color}66`, color }
}

export function getStatusRowStyle(color: string): CSSProperties {
  return { backgroundColor: `${color}14` }
}
