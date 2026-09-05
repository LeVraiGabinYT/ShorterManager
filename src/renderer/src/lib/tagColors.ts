import type { CSSProperties } from 'react'
import { TAG_COLOR_PRESETS } from '@shared/types'

export function getTagChipStyle(color: string): CSSProperties {
  return {
    backgroundColor: `${color}26`,
    borderColor: `${color}66`,
    color
  }
}

export function randomTagColor(): string {
  return TAG_COLOR_PRESETS[Math.floor(Math.random() * TAG_COLOR_PRESETS.length)]
}
