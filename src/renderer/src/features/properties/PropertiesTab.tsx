import type { ReactElement } from 'react'
import { ObjectsTab } from '../objects/ObjectsTab'
import { TagsTab } from '../tags/TagsTab'

export function PropertiesTab(): ReactElement {
  return (
    <div className="grid h-full grid-cols-1 divide-y divide-white/10 overflow-hidden lg:grid-cols-2 lg:divide-x lg:divide-y-0">
      <div className="min-h-0 overflow-hidden">
        <ObjectsTab />
      </div>
      <div className="min-h-0 overflow-hidden">
        <TagsTab />
      </div>
    </div>
  )
}
