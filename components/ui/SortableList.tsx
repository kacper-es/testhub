'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Reużywalna lista z reorderowaniem przez drag (mysz/dotyk) i klawiaturę.
// Uchwyt: `renderItem` dostaje propsy do rozłożenia na elemencie-chwycie.
// Kolejność po upuszczeniu wraca przez `onReorder(orderedIds)`.
type HandleProps = HTMLAttributes<HTMLElement>

function SortableRow({
  id,
  children,
}: {
  id: string
  children: (handle: HandleProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...(listeners ?? {}) })}
    </div>
  )
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
}: {
  items: T[]
  onReorder: (orderedIds: string[]) => void
  renderItem: (item: T, handle: HandleProps) => ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = items.map((i) => i.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// Wspólny wygląd uchwytu (grip). Rozłóż na nim propsy `handle`.
export function DragHandle({
  handle,
  className,
}: {
  handle: HandleProps
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label="Przeciągnij, by zmienić kolejność"
      className={
        'cursor-grab touch-none rounded px-1 text-muted hover:text-fg ' +
        'focus-visible:outline-2 focus-visible:outline-focus active:cursor-grabbing ' +
        (className ?? '')
      }
      {...handle}
    >
      <span aria-hidden>⠿</span>
    </button>
  )
}
