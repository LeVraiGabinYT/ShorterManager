import type { CSSProperties } from 'react'

export function getTagChipStyle(color: string): CSSProperties {
  return {
    backgroundColor: `${color}26`,
    borderColor: `${color}66`,
    color
  }
}
