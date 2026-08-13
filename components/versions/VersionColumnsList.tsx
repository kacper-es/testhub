'use client'

import { useOptimistic, useTransition } from 'react'
import {
  removeVersionColumn,
  reorderVersionColumns,
} from '@/app/actions/version-columns'
import { SortableList, DragHandle } from '@/components/ui/SortableList'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export type VersionColumnItem = { id: string; name: string }

export function VersionColumnsList({
  versionId,
  columns,
}: {
  versionId: string
  columns: VersionColumnItem[]
}) {
  const [items, setItems] = useOptimistic(columns)
  const [, start] = useTransition()

  function onReorder(orderedIds: string[]) {
    const byId = new Map(columns.map((c) => [c.id, c]))
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((c): c is VersionColumnItem => c !== undefined)
    start(async () => {
      setItems(next)
      await reorderVersionColumns(versionId, orderedIds)
    })
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">Ta wersja nie ma kroków.</p>
  }

  return (
    <SortableList
      items={items}
      onReorder={onReorder}
      renderItem={(item, handle) => (
        <Card className="flex items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-2">
            <DragHandle handle={handle} />
            <span className="text-fg">{item.name}</span>
          </div>
          <form action={removeVersionColumn}>
            <input type="hidden" name="id" value={item.id} />
            <Button variant="ghost" type="submit" className="text-fail-strong">
              Usuń
            </Button>
          </form>
        </Card>
      )}
    />
  )
}
