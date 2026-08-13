'use client'

import Link from 'next/link'
import { useOptimistic, useTransition } from 'react'
import { reorderColumns, setColumnActive } from '@/app/actions/columns'
import { SortableList, DragHandle } from '@/components/ui/SortableList'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'

export type CatalogItem = { id: string; name: string; typeLabel: string }

function ActiveButtons({ id }: { id: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link href={`/admin/columns/${id}/edit`}>
        <Button variant="secondary" type="button">
          Edytuj
        </Button>
      </Link>
      <form action={setColumnActive}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value="false" />
        <Button variant="ghost" type="submit">
          Dezaktywuj
        </Button>
      </form>
    </div>
  )
}

export function ColumnCatalogList({
  active,
  inactive,
}: {
  active: CatalogItem[]
  inactive: CatalogItem[]
}) {
  const [items, setItems] = useOptimistic(active)
  const [, start] = useTransition()

  function onReorder(orderedIds: string[]) {
    const byId = new Map(active.map((i) => [i.id, i]))
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((i): i is CatalogItem => i !== undefined)
    start(async () => {
      setItems(next)
      await reorderColumns(orderedIds)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length > 0 && (
        <SortableList
          items={items}
          onReorder={onReorder}
          renderItem={(item, handle) => (
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <DragHandle handle={handle} />
                <span className="font-medium text-fg">{item.name}</span>
                <span className="text-sm text-muted">{item.typeLabel}</span>
              </div>
              <ActiveButtons id={item.id} />
            </Card>
          )}
        />
      )}

      {inactive.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">Nieaktywne kroki</span>
          {inactive.map((item) => (
            <Card key={item.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-fg">{item.name}</span>
                <span className="text-sm text-muted">{item.typeLabel}</span>
                <StatusBadge status="neutral">Nieaktywny</StatusBadge>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/admin/columns/${item.id}/edit`}>
                  <Button variant="secondary" type="button">
                    Edytuj
                  </Button>
                </Link>
                <form action={setColumnActive}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="active" value="true" />
                  <Button variant="secondary" type="submit">
                    Aktywuj
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
