'use client'

import { useState, useTransition } from 'react'
import { addComment } from '@/app/actions/comments'
import { Button } from '@/components/ui/Button'

export function CommentForm({ versionId }: { versionId: string }) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await addComment(versionId, content)
      if (res.error) {
        setError(res.error)
      } else {
        setContent('')
        setError(null)
      }
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Dodaj komentarz…"
        aria-label="Treść komentarza"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
      />
      {error && (
        <p role="alert" className="text-sm text-fail-strong">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending || content.trim() === ''}>
          {pending ? 'Dodawanie…' : 'Dodaj komentarz'}
        </Button>
      </div>
    </form>
  )
}
